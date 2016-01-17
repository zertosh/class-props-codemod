'use strict';

const assert = require('assert');
const classRe = /\bclass\b/;

module.exports = (file, api, options) => {
  const j = api.jscodeshift;
  const matches = new Map();
  let didChange = false;

  if (!classRe.test(file.source)) {
    return null;
  }

  try {
    var root = j(file.source);
  } catch(err) {
    if (!(err instanceof SyntaxError)) throw err;
    console.log('SKIPPING: "%s" because %s', file.path, err);
    api.stats('BROKEN_SYNTAX');
    return null;
  }

  root
    .find(j.ClassDeclaration)
    .forEach(p => {
      if (p.parent.value.type.startsWith('Export')) {
        return;
      }
      const className = p.value.id.name;
      const classIdxInParent = p.parentPath.value.indexOf(p.value);
      assert(classIdxInParent !== -1);
      const assignedStaticProps = p.parentPath.filter(stmt => {
        // Only look at stmts after the class decl
        if (stmt.name < classIdxInParent) return;
        if (
          stmt.value.type === 'ExpressionStatement' &&
          stmt.value.expression.type === 'AssignmentExpression' &&
          stmt.value.expression.operator === '=' &&
          stmt.value.expression.left.type === 'MemberExpression' &&
          stmt.value.expression.left.object.type === 'Identifier' &&
          stmt.value.expression.left.object.name === className
        ) {
          return true;
        }
      });
      if (assignedStaticProps.length) {
        matches.set(p, assignedStaticProps);
      }
    });

  for (const kv of matches) {
    const classPath = kv[0];
    const assignedStaticProps = kv[1];
    const className = classPath.value.id.name;

    const hasAnyComputedProp = assignedStaticProps
      .some(stmt => stmt.node.expression.left.computed);
    if (hasAnyComputedProp) {
      console.log(
        'SKIPPING: "%s" -> "%s" has a computed assigned static property.',
        file.path, className
      );
      api.stats('HAS_STATIC_PROPERTY');
      continue;
    }

    let expectedNextIdx = classPath.name;
    const hasContinousStmts = assignedStaticProps
      .every(stmt => stmt.name === ++expectedNextIdx);
    if (!hasContinousStmts) {
      console.log(
        'SKIPPING: "%s" -> "%s" may have side-effects between the class ' +
        'declaration and its assigned static properties.',
        file.path, className
      );
      api.stats('MAY_HAVE_SIDE_EFFECT');
      continue;
    }

    const hasSelfReference = assignedStaticProps.some(stmt =>
      j(stmt.get('expression', 'right'))
        .find(j.MemberExpression, {object: {name: className}})
        .paths()
        .some(p => p.scope === stmt.scope)
    );
    if (hasSelfReference) {
      console.log(
        'SKIPPING: "%s" -> "%s" references itself',
        file.path, className
      );
      api.stats('HAS_SELF_REFERENCE');
      continue;
    }

    const hasDuplicateWithValue = assignedStaticProps.some(stmt => {
      const staticKeyName = stmt.value.expression.left.property.name;
      return classPath.value.body.body.some(classEl => {
        if (classEl.type === 'ClassProperty' &&
            classEl.static === true &&
            classEl.value !== null &&
            classEl.key.type === 'Identifier' &&
            classEl.key.name === staticKeyName) {
          return true;
        }
        if (classEl.type === 'MethodDefinition' &&
            classEl.static === true &&
            classEl.key.type === 'Identifier' &&
            classEl.key.name === staticKeyName) {
          return true;
        }
      });
    });
    if (hasDuplicateWithValue) {
      console.log(
        'SKIPPING: "%s" -> "%s" has existing static key with value',
        file.path, className
      );
      api.stats('HAS_DUPLICATE_KEY');
      continue;
    }

    assignedStaticProps.forEach(stmt => {
      const staticKey = stmt.value.expression.left.property;
      const staticValue = stmt.value.expression.right;

      for (const classEl of classPath.value.body.body) {
        if (classEl.type === 'ClassProperty' &&
            classEl.static === true &&
            classEl.key.type === 'Identifier' &&
            classEl.key.name === staticKey.name) {
          classEl.value = staticValue;
          if (stmt.value.comments) {
            if (!classEl.comments) classEl.comments = [];
            classEl.comments = classEl.comments.concat(stmt.value.comments);
          }
          stmt.prune();
          didChange = true;
          console.log(
            'WARNING: "%s" -> "%s" had a pre-existing empty prop - re-check the output.',
            file.path, className
          );
          api.stats('HAS_PRE_EXISTING_KEY');
          return;
        }
      }

      const newClassProp = j.classProperty(
        staticKey,
        staticValue,
        /*typeAnnotation*/ null,
        /*static*/ true
      );
      if (stmt.value.comments) {
        newClassProp.comments = stmt.value.comments;
        if (options.flowfixme) {
          newClassProp.comments = stmt.value.comments.filter(cmt => {
            const hasFlowFixMe =
              cmt.value.includes('$FlowFixMe(>=0.19') ||
              cmt.value.includes('$FlowFixMe(>=0.20');
            if (!hasFlowFixMe) return true;
            console.log(
              'WARNING: "%s" -> "%s" had a $FlowFixMe - re-check the output.',
              file.path, className
            );
          });
        }
      }
      const classBody = classPath.get('body', 'body');
      const bestPosition = getPositionForStaticProp(classBody.value);
      if (bestPosition == null) {
        classBody.push(newClassProp);
      } else {
        classBody.insertAt(bestPosition, newClassProp);
      }
      stmt.prune();
      didChange = true;
    });
  }

  return didChange ? root.toSource() : file.source;
};

function getPositionForStaticProp(classBody) {
  for (let i = 0; i < classBody.length; i++) {
    const el = classBody[i];
    if (el.type === 'MethodDefinition') {
      return i;
    }
    if (el.type === 'ClassProperty') {
      const nextEl = classBody[i + 1];
      if (!nextEl || nextEl.type !== 'ClassProperty') {
        return i + 1;
      }
    }
  }
}
