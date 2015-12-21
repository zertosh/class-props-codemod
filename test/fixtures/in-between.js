class X {}
someOtherStatement;
X.foo = [];

class Y {}
Y.foo = 42;
Y.bar = '42';
someOtherStatement;

class Z {}
Z.foo = {};
someOtherStatement;
Z.bar = function() {};
