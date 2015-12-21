'use strict';

const assert = require('assert');

module.exports = (file, api, options) => {
  const j = api.jscodeshift;

  const root = j(file.source);
  const matches = new Map();

  let didChange = false;

  root
    .find(j.ClassDeclaration)
    .forEach(p => {
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
      classPath.get('body').get('body').unshift(newClassProp)
      stmt.prune();
      didChange = true;
    });
  }

  return didChange ? root.toSource() : file.source;
};
