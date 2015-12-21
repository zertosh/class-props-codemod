@decorator1
class X {
  // comment
  static foo = 42;

  method1() {}
}

class Y {
  static foo = 42;

  // comment
  static bar = {};

  @decorator2
  method2() {}
}
