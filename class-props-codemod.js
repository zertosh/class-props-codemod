'use strict';

const assert = require('assert');
const classRe = /\bclass\b/;

module.exports = (file, api, options) => {
  if (!classRe.test(file.source)) {
    return null;
  }

  const j = api.jscodeshift;

  const root = j(file.source);
  const matches = new Map();

  let didChange = false;

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

    const hasAnyComputedProp = assignedStaticProps
      .some(stmt => stmt.node.expression.left.computed);
    if (hasAnyComputedProp) {
      console.log(
        'SKIPPING: "%s" -> "%s" has a computed assigned static property.',
        file.path, classPath.value.id.name
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
        file.path, classPath.value.id.name
      );
      api.stats('MAY_HAVE_SIDE_EFFECT');
      continue;
    }

    assignedStaticProps.forEach(stmt => {
      const staticKey = stmt.value.expression.left.property;
      const staticValue = stmt.value.expression.right;
      const newClassProp = j.classProperty(
        staticKey,
        staticValue,
        /*typeAnnotation*/ null,
        /*static*/ true
      );
      newClassProp.comments = stmt.value.comments;
      const classBody = classPath.get('body').get('body');
      const bestPosition = getPositionForStaticProp(classBody.value);
      if (bestPosition == null) {
        classBody.push(newClassProp);
      } else {
        classBody.insertAt(bestPosition, newClassProp);
      }
      stmt.prune();
      didChange = true;
    });

    if (didChange) {
      let hasDecorators = false;
      // For some reason Recast isn't printing decorators
      classPath.value.body.body.forEach(classEl => {
        if (classEl.decorators) {
          hasDecorators = true;
          classEl.loc.lines = false;
        }
      });
      if (classPath.value.decorators) {
        hasDecorators = true;
        classPath.value.loc.lines = null;
      }
      if (hasDecorators) {
        console.log(
          'WARNING: "%s" -> "%s" has decorators - re-check the output.',
          file.path, classPath.value.id.name
        );
        api.stats('HAS_DECORATORS');
      }
    }
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
