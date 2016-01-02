class X {
  method1() {}
  // comment x1
  // comment x2
  static foo = 42;
}

class Y {
  method2() {}
  // comment y1
  // comment y2
  static bar: number = 43;
}

class Z {
  method2() {}
  // comment z1
  static baz: number = 44;
}
// comment z2
Z.baz = 45;
