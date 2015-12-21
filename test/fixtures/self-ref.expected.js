class X {
  static foo = 42;
  static bar = () => { X.qux(); };
}

class Y {}
Y.foo = 42;
Y.bar = Y.baz;
Y.bar = Y.qux();
