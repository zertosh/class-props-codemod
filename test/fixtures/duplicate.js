class X {
  method1() {}
  // comment x1
  static foo;
}
// comment x2
X.foo = 42;

class Y {
  method2() {}
  // comment y1
  static bar: number;
}
// comment y2
Y.bar = 43;

class Z {
  method2() {}
  // comment z1
  static baz: number = 44;
}
// comment z2
Z.baz = 45;
