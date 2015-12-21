class X {}
someOtherStatement;
X.foo = [];

class Y {
  static foo = 42;
  static bar = '42';
}
someOtherStatement;

class Z {}
Z.foo = {};
someOtherStatement;
Z.bar = function() {};
