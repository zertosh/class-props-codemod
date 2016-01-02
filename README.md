# class-props-codemod

Transform old-style assigned static properties to class static properties.

[![Build Status](https://travis-ci.org/zertosh/class-props-codemod.svg?branch=master)](https://travis-ci.org/zertosh/class-props-codemod)

## Usage

```sh
$ npm install -g jscodeshift
$ jscodeshift PATH_TO_SOURCE --transform PATH_TO_THIS_MODULE
```

## Example

```js
// BEFORE:
class X {
  method1() {}
}
X.foo = 42;

// AFTER:
class X {
  static foo = 42;
  method1() {}
}
```

## Caveats

* The transform is very conservative:

  * If there are any other statements between the class definition and the assigned static properties, then it'll skip that class. Example:

    ```js
      // This class will NOT be transformed
      class X {}
      someOtherStatement;
      X.foo = 42;
    ```

  * If any assigned static properties reference the class in the same scope, then it'll skip that class. Example:
    
    ```js
      // This class will NOT be transformed
      class X {}
      X.foo = 42;
      X.bar = X.baz();

      // This class WILL BE transformed
      class X {}
      X.foo = 42;
      X.bar = () => X.baz();
    ```

  * If a static property already exists with a name and a value, then it'll skip that class. If the static property exists, but it doesn't have a value, it will get transformed. Example:

    ```js
      // This class will NOT be transformed
      class X {
        static foo = 43;
      }
      X.foo = 42;

      // This class WILL BE transformed
      class X {
        static foo: number;
      }
      X.foo = 42;
    ```

* Newly created static properties are added to the class body in the order in which they're found. Either immediately before the first method definition or immediate after the first class property.
