class X {}
X.foo = 42;
X.bar = () => { X.qux(); };

class Y {}
Y.foo = 42;
Y.bar = Y.baz;
Y.bar = Y.qux();
