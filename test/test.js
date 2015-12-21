'use strict';

const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const jscodeshift = require('jscodeshift');
const classProsCodemod = require('../');

function testTransform(t) {
  return (name, options) => {
    const originalPath = path.join(__dirname, 'fixtures', name + '.js');
    const originalSource = fs.readFileSync(originalPath, 'utf8');
    const expectedPath = path.join(__dirname, 'fixtures', name + '.expected.js');
    const expectedSource = fs.readFileSync(expectedPath, 'utf8');
    const actualSource = classProsCodemod(
      {
        path: originalPath,
        source: originalSource
      },
      {jscodeshift},
      options || {}
    );
    return t.equal(actualSource, expectedSource, name);
  }
}

test('class-props-codemod', (t) => {
  const tt = testTransform(t);
  tt('simple');
  tt('in-between');
  t.done();
});
