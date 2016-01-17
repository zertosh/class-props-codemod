// decorator printing was broken in Recast prior to v0.10.42
// https://github.com/benjamn/recast/commit/d1ff3dfa7685812f936ec29ceec3eea735fedcf0

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
