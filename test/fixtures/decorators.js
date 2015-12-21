@decorator1
class X {
  method1() {}
}
// comment
X.foo = 42;

class Y {
  static foo = 42;
  @decorator2
  method2() {}
}
// comment
Y.bar = {};
