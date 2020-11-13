/*
 *  Sugar Custom 2020.11.13
 *
 *  Freely distributable and licensed under the MIT-style license.
 *  Copyright (c)  Andrew Plummer
 *  https://sugarjs.com/
 *
 * ---------------------------- */
(function() {
  'use strict';

  /***
   * @module Core
   * @description Core functionality including the ability to define methods and
   *              extend onto natives.
   *
   ***/

  // The global to export.
  var Sugar;

  // The name of Sugar in the global namespace.
  var SUGAR_GLOBAL = 'Sugar';

  // Natives available on initialization. Letting Object go first to ensure its
  // global is set by the time the rest are checking for chainable Object methods.
  var NATIVE_NAMES = 'Object Number String Array Date RegExp Function';

  // Static method flag
  var STATIC   = 0x1;

  // Instance method flag
  var INSTANCE = 0x2;

  // IE8 has a broken defineProperty but no defineProperties so this saves a try/catch.
  var PROPERTY_DESCRIPTOR_SUPPORT = !!(Object.defineProperty && Object.defineProperties);

  // The global context. Rhino uses a different "global" keyword so
  // do an extra check to be sure that it's actually the global context.
  var globalContext = typeof global !== 'undefined' && global.Object === Object ? global : this;

  // Is the environment node?
  var hasExports = typeof module !== 'undefined' && module.exports;

  // Whether object instance methods can be mapped to the prototype.
  var allowObjectPrototype = false;

  // A map from Array to SugarArray.
  var namespacesByName = {};

  // A map from [object Object] to namespace.
  var namespacesByClassString = {};

  // Defining properties.
  var defineProperty = PROPERTY_DESCRIPTOR_SUPPORT ?  Object.defineProperty : definePropertyShim;

  // A default chainable class for unknown types.
  var DefaultChainable = getNewChainableClass('Chainable');


  // Global methods

  function setupGlobal() {
    Sugar = globalContext[SUGAR_GLOBAL];
    // istanbul ignore if
    if (Sugar) {
      // Reuse already defined Sugar global object.
      return;
    }
    Sugar = function(arg) {
      forEachProperty(Sugar, function(sugarNamespace, name) {
        // Although only the only enumerable properties on the global
        // object are Sugar namespaces, environments that can't set
        // non-enumerable properties will step through the utility methods
        // as well here, so use this check to only allow true namespaces.
        if (hasOwn(namespacesByName, name)) {
          sugarNamespace.extend(arg);
        }
      });
      return Sugar;
    };
    // istanbul ignore else
    if (hasExports) {
      module.exports = Sugar;
    } else {
      try {
        globalContext[SUGAR_GLOBAL] = Sugar;
      } catch (e) {
        // Contexts such as QML have a read-only global context.
      }
    }
    forEachProperty(NATIVE_NAMES.split(' '), function(name) {
      createNamespace(name);
    });
    setGlobalProperties();
  }

  /***
   * @method createNamespace(name)
   * @returns SugarNamespace
   * @namespace Sugar
   * @short Creates a new Sugar namespace.
   * @extra This method is for plugin developers who want to define methods to be
   *        used with natives that Sugar does not handle by default. The new
   *        namespace will appear on the `Sugar` global with all the methods of
   *        normal namespaces, including the ability to define new methods. When
   *        extended, any defined methods will be mapped to `name` in the global
   *        context.
   *
   * @example
   *
   *   Sugar.createNamespace('Boolean');
   *
   * @param {string} name - The namespace name.
   *
   ***/
  function createNamespace(name) {

    // Is the current namespace Object?
    var isObject = name === 'Object';

    // A Sugar namespace is also a chainable class: Sugar.Array, etc.
    var sugarNamespace = getNewChainableClass(name, true);

    /***
     * @method extend([opts])
     * @returns Sugar
     * @namespace Sugar
     * @short Extends Sugar defined methods onto natives.
     * @extra This method can be called on individual namespaces like
     *        `Sugar.Array` or on the `Sugar` global itself, in which case
     *        [opts] will be forwarded to each `extend` call. For more,
     *        see `extending`.
     *
     * @options
     *
     *   methods           An array of method names to explicitly extend.
     *
     *   except            An array of method names or global namespaces (`Array`,
     *                     `String`) to explicitly exclude. Namespaces should be the
     *                     actual global objects, not strings.
     *
     *   namespaces        An array of global namespaces (`Array`, `String`) to
     *                     explicitly extend. Namespaces should be the actual
     *                     global objects, not strings.
     *
     *   enhance           A shortcut to disallow all "enhance" flags at once
     *                     (flags listed below). For more, see `enhanced methods`.
     *                     Default is `true`.
     *
     *   enhanceString     A boolean allowing String enhancements. Default is `true`.
     *
     *   enhanceArray      A boolean allowing Array enhancements. Default is `true`.
     *
     *   objectPrototype   A boolean allowing Sugar to extend Object.prototype
     *                     with instance methods. This option is off by default
     *                     and should generally not be used except with caution.
     *                     For more, see `object methods`.
     *
     * @example
     *
     *   Sugar.Array.extend();
     *   Sugar.extend();
     *
     * @option {Array<string>} [methods]
     * @option {Array<string|NativeConstructor>} [except]
     * @option {Array<NativeConstructor>} [namespaces]
     * @option {boolean} [enhance]
     * @option {boolean} [enhanceString]
     * @option {boolean} [enhanceArray]
     * @option {boolean} [objectPrototype]
     * @param {ExtendOptions} [opts]
     *
     ***
     * @method extend([opts])
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Extends Sugar defined methods for a specific namespace onto natives.
     * @param {ExtendOptions} [opts]
     *
     ***/
    var extend = function (opts) {

      var nativeClass = globalContext[name], nativeProto = nativeClass.prototype;
      var staticMethods = {}, instanceMethods = {}, methodsByName;

      function objectRestricted(name, target) {
        return isObject && target === nativeProto &&
               (!allowObjectPrototype || name === 'get' || name === 'set');
      }

      function arrayOptionExists(field, val) {
        var arr = opts[field];
        if (arr) {
          for (var i = 0, el; el = arr[i]; i++) {
            if (el === val) {
              return true;
            }
          }
        }
        return false;
      }

      function arrayOptionExcludes(field, val) {
        return opts[field] && !arrayOptionExists(field, val);
      }

      function disallowedByFlags(methodName, target, flags) {
        // Disallowing methods by flag currently only applies if methods already
        // exist to avoid enhancing native methods, as aliases should still be
        // extended (i.e. Array#all should still be extended even if Array#every
        // is being disallowed by a flag).
        if (!target[methodName] || !flags) {
          return false;
        }
        for (var i = 0; i < flags.length; i++) {
          if (opts[flags[i]] === false) {
            return true;
          }
        }
      }

      function namespaceIsExcepted() {
        return arrayOptionExists('except', nativeClass) ||
               arrayOptionExcludes('namespaces', nativeClass);
      }

      function methodIsExcepted(methodName) {
        return arrayOptionExists('except', methodName);
      }

      function canExtend(methodName, method, target) {
        return !objectRestricted(methodName, target) &&
               !disallowedByFlags(methodName, target, method.flags) &&
               !methodIsExcepted(methodName);
      }

      opts = opts || {};
      methodsByName = opts.methods;

      if (namespaceIsExcepted()) {
        return;
      } else if (isObject && typeof opts.objectPrototype === 'boolean') {
        // Store "objectPrototype" flag for future reference.
        allowObjectPrototype = opts.objectPrototype;
      }

      forEachProperty(methodsByName || sugarNamespace, function(method, methodName) {
        if (methodsByName) {
          // If we have method names passed in an array,
          // then we need to flip the key and value here
          // and find the method in the Sugar namespace.
          methodName = method;
          method = sugarNamespace[methodName];
        }
        if (hasOwn(method, 'instance') && canExtend(methodName, method, nativeProto)) {
          instanceMethods[methodName] = method.instance;
        }
        if(hasOwn(method, 'static') && canExtend(methodName, method, nativeClass)) {
          staticMethods[methodName] = method;
        }
      });

      // Accessing the extend target each time instead of holding a reference as
      // it may have been overwritten (for example Date by Sinon). Also need to
      // access through the global to allow extension of user-defined namespaces.
      extendNative(nativeClass, staticMethods);
      extendNative(nativeProto, instanceMethods);

      if (!methodsByName) {
        // If there are no method names passed, then
        // all methods in the namespace will be extended
        // to the native. This includes all future defined
        // methods, so add a flag here to check later.
        setProperty(sugarNamespace, 'active', true);
      }
      return sugarNamespace;
    };

    function defineWithOptionCollect(methodName, instance, args) {
      setProperty(sugarNamespace, methodName, function(arg1, arg2, arg3) {
        var opts = collectDefineOptions(arg1, arg2, arg3);
        defineMethods(sugarNamespace, opts.methods, instance, args, opts.last);
        return sugarNamespace;
      });
    }

    /***
     * @method defineStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods on the namespace that can later be extended
     *        onto the native globals.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. If `extend` was previously called
     *        with no arguments, the method will be immediately mapped to its
     *        native when defined.
     *
     * @example
     *
     *   Sugar.Number.defineStatic({
     *     isOdd: function (num) {
     *       return num % 2 === 1;
     *     }
     *   });
     *
     * @signature defineStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStatic', STATIC);

    /***
     * @method defineInstance(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines methods on the namespace that can later be extended as
     *        instance methods onto the native prototype.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. All functions should accept the
     *        native for which they are mapped as their first argument, and should
     *        never refer to `this`. If `extend` was previously called with no
     *        arguments, the method will be immediately mapped to its native when
     *        defined.
     *
     *        Methods cannot accept more than 4 arguments in addition to the
     *        native (5 arguments total). Any additional arguments will not be
     *        mapped. If the method needs to accept unlimited arguments, use
     *        `defineInstanceWithArguments`. Otherwise if more options are
     *        required, use an options object instead.
     *
     * @example
     *
     *   Sugar.Number.defineInstance({
     *     square: function (num) {
     *       return num * num;
     *     }
     *   });
     *
     * @signature defineInstance(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstance', INSTANCE);

    /***
     * @method defineInstanceAndStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short A shortcut to define both static and instance methods on the namespace.
     * @extra This method is intended for use with `Object` instance methods. Sugar
     *        will not map any methods to `Object.prototype` by default, so defining
     *        instance methods as static helps facilitate their proper use.
     *
     * @example
     *
     *   Sugar.Object.defineInstanceAndStatic({
     *     isAwesome: function (obj) {
     *       // check if obj is awesome!
     *     }
     *   });
     *
     * @signature defineInstanceAndStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceAndStatic', INSTANCE | STATIC);


    /***
     * @method defineStaticWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that collect arguments.
     * @extra This method is identical to `defineStatic`, except that when defined
     *        methods are called, they will collect any arguments past `n - 1`,
     *        where `n` is the number of arguments that the method accepts.
     *        Collected arguments will be passed to the method in an array
     *        as the last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineStaticWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineStaticWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStaticWithArguments', STATIC, true);

    /***
     * @method defineInstanceWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that collect arguments.
     * @extra This method is identical to `defineInstance`, except that when
     *        defined methods are called, they will collect any arguments past
     *        `n - 1`, where `n` is the number of arguments that the method
     *        accepts. Collected arguments will be passed to the method as the
     *        last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineInstanceWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineInstanceWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceWithArguments', INSTANCE, true);

    /***
     * @method defineStaticPolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that are mapped onto the native if they do
     *        not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments. Note that polyfill methods will
     *        be immediately mapped onto their native prototype regardless of the
     *        use of `extend`.
     *
     * @example
     *
     *   Sugar.Object.defineStaticPolyfill({
     *     keys: function (obj) {
     *       // get keys!
     *     }
     *   });
     *
     * @signature defineStaticPolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineStaticPolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name], opts.methods, true, opts.last);
      return sugarNamespace;
    });

    /***
     * @method defineInstancePolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that are mapped onto the native prototype
     *        if they do not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments. This method differs from
     *        `defineInstance` as there is no static signature (as the method
     *        is mapped as-is to the native), so it should refer to its `this`
     *        object. Note that polyfill methods will be immediately mapped onto
     *        their native prototype regardless of the use of `extend`.
     *
     * @example
     *
     *   Sugar.Array.defineInstancePolyfill({
     *     indexOf: function (arr, el) {
     *       // index finding code here!
     *     }
     *   });
     *
     * @signature defineInstancePolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineInstancePolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name].prototype, opts.methods, true, opts.last);
      // Map instance polyfills to chainable as well.
      forEachProperty(opts.methods, function(fn, methodName) {
        defineChainableMethod(sugarNamespace, methodName, fn);
      });
      return sugarNamespace;
    });

    /***
     * @method alias(toName, from)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Aliases one Sugar method to another.
     *
     * @example
     *
     *   Sugar.Array.alias('all', 'every');
     *
     * @signature alias(toName, fn)
     * @param {string} toName - Name for new method.
     * @param {string|Function} from - Method to alias, or string shortcut.
     ***/
    setProperty(sugarNamespace, 'alias', function(name, source) {
      var method = typeof source === 'string' ? sugarNamespace[source] : source;
      setMethod(sugarNamespace, name, method);
      return sugarNamespace;
    });

    // Each namespace can extend only itself through its .extend method.
    setProperty(sugarNamespace, 'extend', extend);

    // Cache the class to namespace relationship for later use.
    namespacesByName[name] = sugarNamespace;
    namespacesByClassString['[object ' + name + ']'] = sugarNamespace;

    mapNativeToChainable(name);
    mapObjectChainablesToNamespace(sugarNamespace);


    // Export
    return Sugar[name] = sugarNamespace;
  }

  function setGlobalProperties() {
    setProperty(Sugar, 'extend', Sugar);
    setProperty(Sugar, 'toString', toString);
    setProperty(Sugar, 'createNamespace', createNamespace);

    setProperty(Sugar, 'util', {
      'hasOwn': hasOwn,
      'getOwn': getOwn,
      'setProperty': setProperty,
      'classToString': classToString,
      'defineProperty': defineProperty,
      'forEachProperty': forEachProperty,
      'mapNativeToChainable': mapNativeToChainable
    });
  }

  function toString() {
    return SUGAR_GLOBAL;
  }


  // Defining Methods

  function defineMethods(sugarNamespace, methods, type, args, flags) {
    forEachProperty(methods, function(method, methodName) {
      var instanceMethod, staticMethod = method;
      if (args) {
        staticMethod = wrapMethodWithArguments(method);
      }
      if (flags) {
        staticMethod.flags = flags;
      }

      // A method may define its own custom implementation, so
      // make sure that's not the case before creating one.
      if (type & INSTANCE && !method.instance) {
        instanceMethod = wrapInstanceMethod(method, args);
        setProperty(staticMethod, 'instance', instanceMethod);
      }

      if (type & STATIC) {
        setProperty(staticMethod, 'static', true);
      }

      setMethod(sugarNamespace, methodName, staticMethod);

      if (sugarNamespace.active) {
        // If the namespace has been activated (.extend has been called),
        // then map this method as well.
        sugarNamespace.extend(methodName);
      }
    });
  }

  function collectDefineOptions(arg1, arg2, arg3) {
    var methods, last;
    if (typeof arg1 === 'string') {
      methods = {};
      methods[arg1] = arg2;
      last = arg3;
    } else {
      methods = arg1;
      last = arg2;
    }
    return {
      last: last,
      methods: methods
    };
  }

  function wrapInstanceMethod(fn, args) {
    return args ? wrapMethodWithArguments(fn, true) : wrapInstanceMethodFixed(fn);
  }

  function wrapMethodWithArguments(fn, instance) {
    // Functions accepting enumerated arguments will always have "args" as the
    // last argument, so subtract one from the function length to get the point
    // at which to start collecting arguments. If this is an instance method on
    // a prototype, then "this" will be pushed into the arguments array so start
    // collecting 1 argument earlier.
    var startCollect = fn.length - 1 - (instance ? 1 : 0);
    return function() {
      var args = [], collectedArgs = [], len;
      if (instance) {
        args.push(this);
      }
      len = Math.max(arguments.length, startCollect);
      // Optimized: no leaking arguments
      for (var i = 0; i < len; i++) {
        if (i < startCollect) {
          args.push(arguments[i]);
        } else {
          collectedArgs.push(arguments[i]);
        }
      }
      args.push(collectedArgs);
      return fn.apply(this, args);
    };
  }

  function wrapInstanceMethodFixed(fn) {
    switch(fn.length) {
      // Wrapped instance methods will always be passed the instance
      // as the first argument, but requiring the argument to be defined
      // may cause confusion here, so return the same wrapped function regardless.
      case 0:
      case 1:
        return function() {
          return fn(this);
        };
      case 2:
        return function(a) {
          return fn(this, a);
        };
      case 3:
        return function(a, b) {
          return fn(this, a, b);
        };
      case 4:
        return function(a, b, c) {
          return fn(this, a, b, c);
        };
      case 5:
        return function(a, b, c, d) {
          return fn(this, a, b, c, d);
        };
    }
  }

  // Method helpers

  function extendNative(target, source, polyfill, override) {
    forEachProperty(source, function(method, name) {
      if (polyfill && !override && target[name]) {
        // Method exists, so bail.
        return;
      }
      setProperty(target, name, method);
    });
  }

  function setMethod(sugarNamespace, methodName, method) {
    sugarNamespace[methodName] = method;
    if (method.instance) {
      defineChainableMethod(sugarNamespace, methodName, method.instance, true);
    }
  }


  // Chainables

  function getNewChainableClass(name) {
    var fn = function SugarChainable(obj, arg) {
      if (!(this instanceof fn)) {
        return new fn(obj, arg);
      }
      if (this.constructor !== fn) {
        // Allow modules to define their own constructors.
        obj = this.constructor.apply(obj, arguments);
      }
      this.raw = obj;
    };
    setProperty(fn, 'toString', function() {
      return SUGAR_GLOBAL + name;
    });
    setProperty(fn.prototype, 'valueOf', function() {
      return this.raw;
    });
    return fn;
  }

  function defineChainableMethod(sugarNamespace, methodName, fn) {
    var wrapped = wrapWithChainableResult(fn), existing, collision, dcp;
    dcp = DefaultChainable.prototype;
    existing = dcp[methodName];

    // If the method was previously defined on the default chainable, then a
    // collision exists, so set the method to a disambiguation function that will
    // lazily evaluate the object and find it's associated chainable. An extra
    // check is required to avoid false positives from Object inherited methods.
    collision = existing && existing !== Object.prototype[methodName];

    // The disambiguation function is only required once.
    if (!existing || !existing.disambiguate) {
      dcp[methodName] = collision ? disambiguateMethod(methodName) : wrapped;
    }

    // The target chainable always receives the wrapped method. Additionally,
    // if the target chainable is Sugar.Object, then map the wrapped method
    // to all other namespaces as well if they do not define their own method
    // of the same name. This way, a Sugar.Number will have methods like
    // isEqual that can be called on any object without having to traverse up
    // the prototype chain and perform disambiguation, which costs cycles.
    // Note that the "if" block below actually does nothing on init as Object
    // goes first and no other namespaces exist yet. However it needs to be
    // here as Object instance methods defined later also need to be mapped
    // back onto existing namespaces.
    sugarNamespace.prototype[methodName] = wrapped;
    if (sugarNamespace === Sugar.Object) {
      mapObjectChainableToAllNamespaces(methodName, wrapped);
    }
  }

  function mapObjectChainablesToNamespace(sugarNamespace) {
    forEachProperty(Sugar.Object && Sugar.Object.prototype, function(val, methodName) {
      if (typeof val === 'function') {
        setObjectChainableOnNamespace(sugarNamespace, methodName, val);
      }
    });
  }

  function mapObjectChainableToAllNamespaces(methodName, fn) {
    forEachProperty(namespacesByName, function(sugarNamespace) {
      setObjectChainableOnNamespace(sugarNamespace, methodName, fn);
    });
  }

  function setObjectChainableOnNamespace(sugarNamespace, methodName, fn) {
    var proto = sugarNamespace.prototype;
    if (!hasOwn(proto, methodName)) {
      proto[methodName] = fn;
    }
  }

  function wrapWithChainableResult(fn) {
    return function() {
      return new DefaultChainable(fn.apply(this.raw, arguments));
    };
  }

  function disambiguateMethod(methodName) {
    var fn = function() {
      var raw = this.raw, sugarNamespace;
      if (raw != null) {
        // Find the Sugar namespace for this unknown.
        sugarNamespace = namespacesByClassString[classToString(raw)];
      }
      if (!sugarNamespace) {
        // If no sugarNamespace can be resolved, then default
        // back to Sugar.Object so that undefined and other
        // non-supported types can still have basic object
        // methods called on them, such as type checks.
        sugarNamespace = Sugar.Object;
      }

      return new sugarNamespace(raw)[methodName].apply(this, arguments);
    };
    fn.disambiguate = true;
    return fn;
  }

  function mapNativeToChainable(name, methodNames) {
    var sugarNamespace = namespacesByName[name],
        nativeProto = globalContext[name].prototype;

    if (!methodNames && ownPropertyNames) {
      methodNames = ownPropertyNames(nativeProto);
    }

    forEachProperty(methodNames, function(methodName) {
      if (nativeMethodProhibited(methodName)) {
        // Sugar chainables have their own constructors as well as "valueOf"
        // methods, so exclude them here. The __proto__ argument should be trapped
        // by the function check below, however simply accessing this property on
        // Object.prototype causes QML to segfault, so pre-emptively excluding it.
        return;
      }
      try {
        var fn = nativeProto[methodName];
        if (typeof fn !== 'function') {
          // Bail on anything not a function.
          return;
        }
      } catch (e) {
        // Function.prototype has properties that
        // will throw errors when accessed.
        return;
      }
      defineChainableMethod(sugarNamespace, methodName, fn);
    });
  }

  function nativeMethodProhibited(methodName) {
    return methodName === 'constructor' ||
           methodName === 'valueOf' ||
           methodName === '__proto__';
  }


  // Util

  // Internal references
  var ownPropertyNames = Object.getOwnPropertyNames,
      internalToString = Object.prototype.toString,
      internalHasOwnProperty = Object.prototype.hasOwnProperty;

  // Defining this as a variable here as the ES5 module
  // overwrites it to patch DONTENUM.
  var forEachProperty = function (obj, fn) {
    for(var key in obj) {
      if (!hasOwn(obj, key)) continue;
      if (fn.call(obj, obj[key], key, obj) === false) break;
    }
  };

  // istanbul ignore next
  function definePropertyShim(obj, prop, descriptor) {
    obj[prop] = descriptor.value;
  }

  function setProperty(target, name, value, enumerable) {
    defineProperty(target, name, {
      value: value,
      enumerable: !!enumerable,
      configurable: true,
      writable: true
    });
  }

  // PERF: Attempts to speed this method up get very Heisenbergy. Quickly
  // returning based on typeof works for primitives, but slows down object
  // types. Even === checks on null and undefined (no typeof) will end up
  // basically breaking even. This seems to be as fast as it can go.
  function classToString(obj) {
    return internalToString.call(obj);
  }

  function hasOwn(obj, prop) {
    return !!obj && internalHasOwnProperty.call(obj, prop);
  }

  function getOwn(obj, prop) {
    if (hasOwn(obj, prop)) {
      return obj[prop];
    }
  }

  setupGlobal();

  /***
   * @module Common
   * @description Internal utility and common methods.
   ***/


  // For type checking, etc. Excludes object as this is more nuanced.
  var NATIVE_TYPES = 'Boolean Number String Date RegExp Function Array Error Set Map';

  // Prefix for private properties
  var PRIVATE_PROP_PREFIX = '_sugar_';

  // Regex for matching a formatted string
  var STRING_FORMAT_REG = /([{}])\1|\{([^}]*)\}|(%)%|(%(\w*))/g;

  // Common chars
  var HALF_WIDTH_ZERO = 0x30,
      FULL_WIDTH_ZERO = 0xff10,
      HALF_WIDTH_PERIOD   = '.',
      FULL_WIDTH_PERIOD   = '．',
      HALF_WIDTH_COMMA    = ',',
      OPEN_BRACE  = '{',
      CLOSE_BRACE = '}';

  // Namespace aliases
  var sugarObject   = Sugar.Object,
      sugarArray    = Sugar.Array,
      sugarDate     = Sugar.Date,
      sugarString   = Sugar.String,
      sugarNumber   = Sugar.Number,
      sugarFunction = Sugar.Function,
      sugarRegExp   = Sugar.RegExp;

  // Core utility aliases
  var hasOwn               = Sugar.util.hasOwn,
      getOwn               = Sugar.util.getOwn,
      setProperty          = Sugar.util.setProperty,
      classToString        = Sugar.util.classToString,
      defineProperty       = Sugar.util.defineProperty,
      forEachProperty      = Sugar.util.forEachProperty,
      mapNativeToChainable = Sugar.util.mapNativeToChainable;

  // Class checks
  var isSerializable,
      isBoolean, isNumber, isString,
      isDate, isRegExp, isFunction,
      isArray, isSet, isMap, isError;

  function buildClassChecks() {

    var knownTypes = {};

    function addCoreTypes() {

      var names = spaceSplit(NATIVE_TYPES);

      isBoolean = buildPrimitiveClassCheck(names[0]);
      isNumber  = buildPrimitiveClassCheck(names[1]);
      isString  = buildPrimitiveClassCheck(names[2]);

      isDate   = buildClassCheck(names[3]);
      isRegExp = buildClassCheck(names[4]);

      // Wanted to enhance performance here by using simply "typeof"
      // but Firefox has two major issues that make this impossible,
      // one fixed, the other not, so perform a full class check here.
      //
      // 1. Regexes can be typeof "function" in FF < 3
      //    https://bugzilla.mozilla.org/show_bug.cgi?id=61911 (fixed)
      //
      // 2. HTMLEmbedElement and HTMLObjectElement are be typeof "function"
      //    https://bugzilla.mozilla.org/show_bug.cgi?id=268945 (won't fix)
      isFunction = buildClassCheck(names[5]);


      isArray = Array.isArray || buildClassCheck(names[6]);
      isError = buildClassCheck(names[7]);

      isSet = buildClassCheck(names[8], typeof Set !== 'undefined' && Set);
      isMap = buildClassCheck(names[9], typeof Map !== 'undefined' && Map);

      // Add core types as known so that they can be checked by value below,
      // notably excluding Functions and adding Arguments and Error.
      addKnownType('Arguments');
      addKnownType(names[0]);
      addKnownType(names[1]);
      addKnownType(names[2]);
      addKnownType(names[3]);
      addKnownType(names[4]);
      addKnownType(names[6]);

    }

    function addArrayTypes() {
      var types = 'Int8 Uint8 Uint8Clamped Int16 Uint16 Int32 Uint32 Float32 Float64';
      forEach(spaceSplit(types), function(str) {
        addKnownType(str + 'Array');
      });
    }

    function addKnownType(className) {
      var str = '[object '+ className +']';
      knownTypes[str] = true;
    }

    function isKnownType(className) {
      return knownTypes[className];
    }

    function buildClassCheck(className, globalObject) {
      // istanbul ignore if
      if (globalObject && isClass(new globalObject, 'Object')) {
        return getConstructorClassCheck(globalObject);
      } else {
        return getToStringClassCheck(className);
      }
    }

    // Map and Set may be [object Object] in certain IE environments.
    // In this case we need to perform a check using the constructor
    // instead of Object.prototype.toString.
    // istanbul ignore next
    function getConstructorClassCheck(obj) {
      var ctorStr = String(obj);
      return function(obj) {
        return String(obj.constructor) === ctorStr;
      };
    }

    function getToStringClassCheck(className) {
      return function(obj, str) {
        // perf: Returning up front on instanceof appears to be slower.
        return isClass(obj, className, str);
      };
    }

    function buildPrimitiveClassCheck(className) {
      var type = className.toLowerCase();
      return function(obj) {
        var t = typeof obj;
        return t === type || t === 'object' && isClass(obj, className);
      };
    }

    addCoreTypes();
    addArrayTypes();

    isSerializable = function(obj, className) {
      // Only known objects can be serialized. This notably excludes functions,
      // host objects, Symbols (which are matched by reference), and instances
      // of classes. The latter can arguably be matched by value, but
      // distinguishing between these and host objects -- which should never be
      // compared by value -- is very tricky so not dealing with it here.
      className = className || classToString(obj);
      return isKnownType(className) || isPlainObject(obj, className);
    };

  }

  function isClass(obj, className, str) {
    if (!str) {
      str = classToString(obj);
    }
    return str === '[object '+ className +']';
  }

  // Wrapping the core's "define" methods to
  // save a few bytes in the minified script.
  function wrapNamespace(method) {
    return function(sugarNamespace, arg1, arg2) {
      sugarNamespace[method](arg1, arg2);
    };
  }

  // Method define aliases
  var alias                       = wrapNamespace('alias'),
      defineStatic                = wrapNamespace('defineStatic'),
      defineInstance              = wrapNamespace('defineInstance'),
      defineStaticPolyfill        = wrapNamespace('defineStaticPolyfill'),
      defineInstancePolyfill      = wrapNamespace('defineInstancePolyfill'),
      defineInstanceAndStatic     = wrapNamespace('defineInstanceAndStatic'),
      defineInstanceWithArguments = wrapNamespace('defineInstanceWithArguments');

  function defineInstanceSimilar(sugarNamespace, set, fn, flags) {
    defineInstance(sugarNamespace, collectSimilarMethods(set, fn), flags);
  }

  function collectSimilarMethods(set, fn) {
    var methods = {};
    if (isString(set)) {
      set = spaceSplit(set);
    }
    forEach(set, function(el, i) {
      fn(methods, el, i);
    });
    return methods;
  }

  function defineAccessor(namespace, name, fn) {
    setProperty(namespace, name, fn);
  }

  function defineOptionsAccessor(namespace, defaults) {
    var obj = simpleClone(defaults);

    function getOption(name) {
      return obj[name];
    }

    function setOption(arg1, arg2) {
      var options;
      if (arguments.length === 1) {
        options = arg1;
      } else {
        options = {};
        options[arg1] = arg2;
      }
      forEachProperty(options, function(val, name) {
        if (val === null) {
          val = defaults[name];
        }
        obj[name] = val;
      });
    }

    defineAccessor(namespace, 'getOption', getOption);
    defineAccessor(namespace, 'setOption', setOption);
    return getOption;
  }

  function isDefined(o) {
    return o !== undefined;
  }

  function isUndefined(o) {
    return o === undefined;
  }

  function privatePropertyAccessor(key) {
    var privateKey = PRIVATE_PROP_PREFIX + key;
    return function(obj, val) {
      if (arguments.length > 1) {
        setProperty(obj, privateKey, val);
        return obj;
      }
      return obj[privateKey];
    };
  }

  function setChainableConstructor(sugarNamespace, createFn) {
    sugarNamespace.prototype.constructor = function() {
      return createFn.apply(this, arguments);
    };
  }

  function getKeys(obj) {
    return Object.keys(obj);
  }

  function getOwnKey(obj, key) {
    if (hasOwn(obj, key)) {
      return key;
    }
  }

  function isObjectType(obj, type) {
    return !!obj && (type || typeof obj) === 'object';
  }

  function isPlainObject(obj, className) {
    return isObjectType(obj) &&
           isClass(obj, 'Object', className) &&
           hasValidPlainObjectPrototype(obj) &&
           hasOwnEnumeratedProperties(obj);
  }

  function hasValidPlainObjectPrototype(obj) {
    var hasToString = 'toString' in obj;
    var hasConstructor = 'constructor' in obj;
    // An object created with Object.create(null) has no methods in the
    // prototype chain, so check if any are missing. The additional hasToString
    // check is for false positives on some host objects in old IE which have
    // toString but no constructor. If the object has an inherited constructor,
    // then check if it is Object (the "isPrototypeOf" tapdance here is a more
    // robust way of ensuring this if the global has been hijacked). Note that
    // accessing the constructor directly (without "in" or "hasOwnProperty")
    // will throw a permissions error in IE8 on cross-domain windows.
    return (!hasConstructor && !hasToString) ||
            (hasConstructor && !hasOwn(obj, 'constructor') &&
             hasOwn(obj.constructor.prototype, 'isPrototypeOf'));
  }

  function hasOwnEnumeratedProperties(obj) {
    // Plain objects are generally defined as having enumerated properties
    // all their own, however in early IE environments without defineProperty,
    // there may also be enumerated methods in the prototype chain, so check
    // for both of these cases.
    var objectProto = Object.prototype;
    for (var key in obj) {
      var val = obj[key];
      if (!hasOwn(obj, key) && val !== objectProto[key]) {
        return false;
      }
    }
    return true;
  }

  function simpleClone(obj) {
    return simpleMerge({}, obj);
  }

  function simpleMerge(target, source) {
    forEachProperty(source, function(val, key) {
      target[key] = val;
    });
    return target;
  }

  function isArrayIndex(n) {
    return n >>> 0 == n && n != 0xFFFFFFFF;
  }

  function iterateOverSparseArray(arr, fn, fromIndex, loop) {
    var indexes = getSparseArrayIndexes(arr, fromIndex, loop), index;
    for (var i = 0, len = indexes.length; i < len; i++) {
      index = indexes[i];
      fn.call(arr, arr[index], index, arr);
    }
    return arr;
  }

  // It's unclear whether or not sparse arrays qualify as "simple enumerables".
  // If they are not, however, the wrapping function will be deoptimized, so
  // isolate here (also to share between es5 and array modules).
  function getSparseArrayIndexes(arr, fromIndex, loop, fromRight) {
    var indexes = [], i;
    for (i in arr) {
      if (isArrayIndex(i) && (loop || (fromRight ? i <= fromIndex : i >= fromIndex))) {
        indexes.push(+i);
      }
    }
    indexes.sort(function(a, b) {
      var aLoop = a > fromIndex;
      var bLoop = b > fromIndex;
      // This block cannot be reached unless ES5 methods are being shimmed.
      // istanbul ignore if
      if (aLoop !== bLoop) {
        return aLoop ? -1 : 1;
      }
      return a - b;
    });
    return indexes;
  }

  function spaceSplit(str) {
    return str.split(' ');
  }

  function commaSplit(str) {
    return str.split(HALF_WIDTH_COMMA);
  }

  function forEach(arr, fn) {
    for (var i = 0, len = arr.length; i < len; i++) {
      if (!(i in arr)) {
        return iterateOverSparseArray(arr, fn, i);
      }
      fn(arr[i], i);
    }
  }

  function filter(arr, fn) {
    var result = [];
    for (var i = 0, len = arr.length; i < len; i++) {
      var el = arr[i];
      if (i in arr && fn(el, i)) {
        result.push(el);
      }
    }
    return result;
  }

  function map(arr, fn) {
    // perf: Not using fixed array len here as it may be sparse.
    var result = [];
    for (var i = 0, len = arr.length; i < len; i++) {
      if (i in arr) {
        result.push(fn(arr[i], i));
      }
    }
    return result;
  }

  // istanbul ignore next
  var trunc = Math.trunc || function(n) {
    if (n === 0 || !isFinite(n)) return n;
    return n < 0 ? ceil(n) : floor(n);
  };

  function withPrecision(val, precision, fn) {
    var multiplier = pow(10, abs(precision || 0));
    fn = fn || round;
    if (precision < 0) multiplier = 1 / multiplier;
    return fn(val * multiplier) / multiplier;
  }

  function padNumber(num, place, sign, base, replacement) {
    var str = abs(num).toString(base || 10);
    str = repeatString(replacement || '0', place - str.replace(/\.\d+/, '').length) + str;
    if (sign || num < 0) {
      str = (num < 0 ? '-' : '+') + str;
    }
    return str;
  }

  function getOrdinalSuffix(num) {
    if (num >= 11 && num <= 13) {
      return 'th';
    } else {
      switch(num % 10) {
        case 1:  return 'st';
        case 2:  return 'nd';
        case 3:  return 'rd';
        default: return 'th';
      }
    }
  }

  // Fullwidth number helpers
  var fullWidthNumberReg, fullWidthNumberMap, fullWidthNumbers;

  function buildFullWidthNumber() {
    var fwp = FULL_WIDTH_PERIOD, hwp = HALF_WIDTH_PERIOD, hwc = HALF_WIDTH_COMMA, fwn = '';
    fullWidthNumberMap = {};
    for (var i = 0, digit; i <= 9; i++) {
      digit = chr(i + FULL_WIDTH_ZERO);
      fwn += digit;
      fullWidthNumberMap[digit] = chr(i + HALF_WIDTH_ZERO);
    }
    fullWidthNumberMap[hwc] = '';
    fullWidthNumberMap[fwp] = hwp;
    // Mapping this to itself to capture it easily
    // in stringToNumber to detect decimals later.
    fullWidthNumberMap[hwp] = hwp;
    fullWidthNumberReg = allCharsReg(fwn + fwp + hwc + hwp);
    fullWidthNumbers = fwn;
  }

  // Math aliases
  var abs   = Math.abs,
      pow   = Math.pow,
      min   = Math.min,
      max   = Math.max,
      ceil  = Math.ceil,
      floor = Math.floor,
      round = Math.round;

  var chr = String.fromCharCode;

  function trim(str) {
    return str.trim();
  }

  function repeatString(str, num) {
    var result = '';
    str = str.toString();
    while (num > 0) {
      if (num & 1) {
        result += str;
      }
      if (num >>= 1) {
        str += str;
      }
    }
    return result;
  }

  function simpleCapitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function createFormatMatcher(bracketMatcher, percentMatcher, precheck) {

    var reg = STRING_FORMAT_REG;
    var compileMemoized = memoizeFunction(compile);

    function getToken(format, match) {
      var get, token, literal, fn;
      var bKey = match[2];
      var pLit = match[3];
      var pKey = match[5];
      if (match[4] && percentMatcher) {
        token = pKey;
        get = percentMatcher;
      } else if (bKey) {
        token = bKey;
        get = bracketMatcher;
      } else if (pLit && percentMatcher) {
        literal = pLit;
      } else {
        literal = match[1] || match[0];
      }
      if (get) {
        assertPassesPrecheck(precheck, bKey, pKey);
        fn = function(obj, opt) {
          return get(obj, token, opt);
        };
      }
      format.push(fn || getLiteral(literal));
    }

    function getSubstring(format, str, start, end) {
      if (end > start) {
        var sub = str.slice(start, end);
        assertNoUnmatched(sub, OPEN_BRACE);
        assertNoUnmatched(sub, CLOSE_BRACE);
        format.push(function() {
          return sub;
        });
      }
    }

    function getLiteral(str) {
      return function() {
        return str;
      };
    }

    function assertPassesPrecheck(precheck, bt, pt) {
      if (precheck && !precheck(bt, pt)) {
        throw new TypeError('Invalid token '+ (bt || pt) +' in format string');
      }
    }

    function assertNoUnmatched(str, chr) {
      if (str.indexOf(chr) !== -1) {
        throw new TypeError('Unmatched '+ chr +' in format string');
      }
    }

    function compile(str) {
      var format = [], lastIndex = 0, match;
      reg.lastIndex = 0;
      while(match = reg.exec(str)) {
        getSubstring(format, str, lastIndex, match.index);
        getToken(format, match);
        lastIndex = reg.lastIndex;
      }
      getSubstring(format, str, lastIndex, str.length);
      return format;
    }

    return function(str, obj, opt) {
      var format = compileMemoized(str), result = '';
      for (var i = 0; i < format.length; i++) {
        result += format[i](obj, opt);
      }
      return result;
    };
  }

  function allCharsReg(src) {
    return RegExp('[' + src + ']', 'g');
  }

  function escapeRegExp(str) {
    if (!isString(str)) str = String(str);
    return str.replace(/([\\\/\'*+?|()\[\]{}.^$-])/g,'\\$1');
  }

  var _utc = privatePropertyAccessor('utc');

  function callDateGet(d, method) {
    return d['get' + (_utc(d) ? 'UTC' : '') + method]();
  }

  function callDateSet(d, method, value, safe) {
    // "Safe" denotes not setting the date if the value is the same as what is
    // currently set. In theory this should be a noop, however it will cause
    // timezone shifts when in the middle of a DST fallback. This is unavoidable
    // as the notation itself is ambiguous (i.e. there are two "1:00ams" on
    // November 1st, 2015 in northern hemisphere timezones that follow DST),
    // however when advancing or rewinding dates this can throw off calculations
    // so avoiding this unintentional shifting on an opt-in basis.
    if (safe && value === callDateGet(d, method, value)) {
      return;
    }
    d['set' + (_utc(d) ? 'UTC' : '') + method](value);
  }

  var INTERNAL_MEMOIZE_LIMIT = 1000;

  // Note that attemps to consolidate this with Function#memoize
  // ended up clunky as that is also serializing arguments. Separating
  // these implementations turned out to be simpler.
  function memoizeFunction(fn) {
    var memo = {}, counter = 0;

    return function(key) {
      if (hasOwn(memo, key)) {
        return memo[key];
      }
      // istanbul ignore if
      if (counter === INTERNAL_MEMOIZE_LIMIT) {
        memo = {};
        counter = 0;
      }
      counter++;
      return memo[key] = fn(key);
    };
  }

  buildClassChecks();

  buildFullWidthNumber();

  /***
   * @module Date
   * @description Date parsing and formatting, relative formats, number shortcuts,
   *              and locale support with default English locales.
   *
   ***/


  var DATE_OPTIONS = {
    'newDateInternal': defaultNewDate
  };

  var LOCALE_ARRAY_FIELDS = [
    'months', 'weekdays', 'units', 'numerals', 'placeholders',
    'articles', 'tokens', 'timeMarkers', 'ampm', 'timeSuffixes',
    'parse', 'timeParse', 'timeFrontParse', 'modifiers'
  ];

  // Regex for stripping Timezone Abbreviations
  var TIMEZONE_ABBREVIATION_REG = /(\w{3})[()\s\d]*$/;

  // One minute in milliseconds
  var MINUTES = 60 * 1000;

  // Date unit indexes
  var HOURS_INDEX   = 3,
      DAY_INDEX     = 4,
      WEEK_INDEX    = 5,
      MONTH_INDEX   = 6,
      YEAR_INDEX    = 7;

  // ISO Defaults
  var ISO_FIRST_DAY_OF_WEEK = 1,
      ISO_FIRST_DAY_OF_WEEK_YEAR = 4;

  var ParsingTokens = {
    'yyyy': {
      param: 'year',
      src: '\\d{4}'
    },
    'MM': {
      param: 'month',
      src: '[01]?\\d'
    },
    'dd': {
      param: 'date',
      src: '[0123]?\\d'
    },
    'hh': {
      param: 'hour',
      src: '[0-2]?\\d'
    },
    'mm': {
      param: 'minute',
      src: '[0-5]\\d'
    },
    'ss': {
      param: 'second',
      src: '[0-5]\\d(?:[,.]\\d+)?'
    },
    'yy': {
      param: 'year',
      src: '\\d{2}'
    },
    'y': {
      param: 'year',
      src: '\\d'
    },
    'yearSign': {
      src: '[+-]',
      sign: true
    },
    'tzHour': {
      src: '[0-1]\\d'
    },
    'tzMinute': {
      src: '[0-5]\\d'
    },
    'tzSign': {
      src: '[+−-]',
      sign: true
    },
    'ihh': {
      param: 'hour',
      src: '[0-2]?\\d(?:[,.]\\d+)?'
    },
    'imm': {
      param: 'minute',
      src: '[0-5]\\d(?:[,.]\\d+)?'
    },
    'GMT': {
      param: 'utc',
      src: 'GMT',
      val: 1
    },
    'Z': {
      param: 'utc',
      src: 'Z',
      val: 1
    },
    'timestamp': {
      src: '\\d+'
    }
  };

  var LocalizedParsingTokens = {
    'year': {
      base: 'yyyy',
      requiresSuffix: true
    },
    'month': {
      base: 'MM',
      requiresSuffix: true
    },
    'date': {
      base: 'dd',
      requiresSuffix: true
    },
    'hour': {
      base: 'hh',
      requiresSuffixOr: ':'
    },
    'minute': {
      base: 'mm'
    },
    'second': {
      base: 'ss'
    },
    'num': {
      src: '\\d+',
      requiresNumerals: true
    }
  };

  var CoreParsingFormats = [
    {
      // 12-1978
      // 08-1978 (MDY)
      src: '{MM}[-.\\/]{yyyy}'
    },
    {
      // 12/08/1978
      // 08/12/1978 (MDY)
      time: true,
      src: '{dd}[-.\\/]{MM}(?:[-.\\/]{yyyy|yy|y})?',
      mdy: '{MM}[-.\\/]{dd}(?:[-.\\/]{yyyy|yy|y})?'
    },
    {
      // 1975-08-25
      time: true,
      src: '{yyyy}[-.\\/]{MM}(?:[-.\\/]{dd})?'
    },
    {
      // .NET JSON
      src: '\\\\/Date\\({timestamp}(?:[+-]\\d{4,4})?\\)\\\\/'
    },
    {
      // ISO-8601
      src: '{yearSign?}{yyyy}(?:-?{MM}(?:-?{dd}(?:T{ihh}(?::?{imm}(?::?{ss})?)?)?)?)?{tzOffset?}'
    }
  ];

  var CoreOutputFormats = {
    'ISO8601': '{yyyy}-{MM}-{dd}T{HH}:{mm}:{ss}.{SSS}{Z}',
    'RFC1123': '{Dow}, {dd} {Mon} {yyyy} {HH}:{mm}:{ss} {ZZ}',
    'RFC1036': '{Weekday}, {dd}-{Mon}-{yy} {HH}:{mm}:{ss} {ZZ}'
  };

  var FormatTokensBase = [
    {
      ldml: 'Dow',
      strf: 'a',
      lowerToken: 'dow',
      get: function(d, localeCode) {
        return localeManager.get(localeCode).getWeekdayName(getWeekday(d), 2);
      }
    },
    {
      ldml: 'Weekday',
      strf: 'A',
      lowerToken: 'weekday',
      allowAlternates: true,
      get: function(d, localeCode, alternate) {
        return localeManager.get(localeCode).getWeekdayName(getWeekday(d), alternate);
      }
    },
    {
      ldml: 'Mon',
      strf: 'b h',
      lowerToken: 'mon',
      get: function(d, localeCode) {
        return localeManager.get(localeCode).getMonthName(getMonth(d), 2);
      }
    },
    {
      ldml: 'Month',
      strf: 'B',
      lowerToken: 'month',
      allowAlternates: true,
      get: function(d, localeCode, alternate) {
        return localeManager.get(localeCode).getMonthName(getMonth(d), alternate);
      }
    },
    {
      strf: 'C',
      get: function(d) {
        return getYear(d).toString().slice(0, 2);
      }
    },
    {
      ldml: 'd date day',
      strf: 'd',
      strfPadding: 2,
      ldmlPaddedToken: 'dd',
      ordinalToken: 'do',
      get: function(d) {
        return getDate(d);
      }
    },
    {
      strf: 'e',
      get: function(d) {
        return padNumber(getDate(d), 2, false, 10, ' ');
      }
    },
    {
      ldml: 'H 24hr',
      strf: 'H',
      strfPadding: 2,
      ldmlPaddedToken: 'HH',
      get: function(d) {
        return getHours(d);
      }
    },
    {
      ldml: 'h hours 12hr',
      strf: 'I',
      strfPadding: 2,
      ldmlPaddedToken: 'hh',
      get: function(d) {
        return getHours(d) % 12 || 12;
      }
    },
    {
      ldml: 'D',
      strf: 'j',
      strfPadding: 3,
      ldmlPaddedToken: 'DDD',
      get: function(d) {
        var s = setUnitAndLowerToEdge(cloneDate(d), MONTH_INDEX);
        return getDaysSince(d, s) + 1;
      }
    },
    {
      ldml: 'M',
      strf: 'm',
      strfPadding: 2,
      ordinalToken: 'Mo',
      ldmlPaddedToken: 'MM',
      get: function(d) {
        return getMonth(d) + 1;
      }
    },
    {
      ldml: 'm minutes',
      strf: 'M',
      strfPadding: 2,
      ldmlPaddedToken: 'mm',
      get: function(d) {
        return callDateGet(d, 'Minutes');
      }
    },
    {
      ldml: 'Q',
      get: function(d) {
        return ceil((getMonth(d) + 1) / 3);
      }
    },
    {
      ldml: 'TT',
      strf: 'p',
      get: function(d, localeCode) {
        return getMeridiemToken(d, localeCode);
      }
    },
    {
      ldml: 'tt',
      strf: 'P',
      get: function(d, localeCode) {
        return getMeridiemToken(d, localeCode).toLowerCase();
      }
    },
    {
      ldml: 'T',
      lowerToken: 't',
      get: function(d, localeCode) {
        return getMeridiemToken(d, localeCode).charAt(0);
      }
    },
    {
      ldml: 's seconds',
      strf: 'S',
      strfPadding: 2,
      ldmlPaddedToken: 'ss',
      get: function(d) {
        return callDateGet(d, 'Seconds');
      }
    },
    {
      ldml: 'S ms',
      strfPadding: 3,
      ldmlPaddedToken: 'SSS',
      get: function(d) {
        return callDateGet(d, 'Milliseconds');
      }
    },
    {
      ldml: 'e',
      strf: 'u',
      ordinalToken: 'eo',
      get: function(d) {
        return getWeekday(d) || 7;
      }
    },
    {
      strf: 'U',
      strfPadding: 2,
      get: function(d) {
        // Sunday first, 0-53
        return getWeekNumber(d, false, 0);
      }
    },
    {
      ldml: 'W',
      strf: 'V',
      strfPadding: 2,
      ordinalToken: 'Wo',
      ldmlPaddedToken: 'WW',
      get: function(d) {
        // Monday first, 1-53 (ISO8601)
        return getWeekNumber(d, true);
      }
    },
    {
      strf: 'w',
      get: function(d) {
        return getWeekday(d);
      }
    },
    {
      ldml: 'w',
      ordinalToken: 'wo',
      ldmlPaddedToken: 'ww',
      get: function(d, localeCode) {
        // Locale dependent, 1-53
        var loc = localeManager.get(localeCode),
            dow = loc.getFirstDayOfWeek(localeCode),
            doy = loc.getFirstDayOfWeekYear(localeCode);
        return getWeekNumber(d, true, dow, doy);
      }
    },
    {
      strf: 'W',
      strfPadding: 2,
      get: function(d) {
        // Monday first, 0-53
        return getWeekNumber(d, false);
      }
    },
    {
      ldmlPaddedToken: 'gggg',
      ldmlTwoDigitToken: 'gg',
      get: function(d, localeCode) {
        return getWeekYear(d, localeCode);
      }
    },
    {
      strf: 'G',
      strfPadding: 4,
      strfTwoDigitToken: 'g',
      ldmlPaddedToken: 'GGGG',
      ldmlTwoDigitToken: 'GG',
      get: function(d, localeCode) {
        return getWeekYear(d, localeCode, true);
      }
    },
    {
      ldml: 'year',
      ldmlPaddedToken: 'yyyy',
      ldmlTwoDigitToken: 'yy',
      strf: 'Y',
      strfPadding: 4,
      strfTwoDigitToken: 'y',
      get: function(d) {
        return getYear(d);
      }
    },
    {
      ldml: 'ZZ',
      strf: 'z',
      get: function(d) {
        return getUTCOffset(d);
      }
    },
    {
      ldml: 'X',
      get: function(d) {
        return trunc(d.getTime() / 1000);
      }
    },
    {
      ldml: 'x',
      get: function(d) {
        return d.getTime();
      }
    },
    {
      ldml: 'Z',
      get: function(d) {
        return getUTCOffset(d, true);
      }
    },
    {
      ldml: 'z',
      strf: 'Z',
      get: function(d) {
        // Note that this is not accurate in all browsing environments!
        // https://github.com/moment/moment/issues/162
        // It will continue to be supported for Node and usage with the
        // understanding that it may be blank.
        var match = d.toString().match(TIMEZONE_ABBREVIATION_REG);
        return match ? match[1]: '';
      }
    },
    {
      strf: 'D',
      alias: '%m/%d/%y'
    },
    {
      strf: 'F',
      alias: '%Y-%m-%d'
    },
    {
      strf: 'r',
      alias: '%I:%M:%S %p'
    },
    {
      strf: 'R',
      alias: '%H:%M'
    },
    {
      strf: 'T',
      alias: '%H:%M:%S'
    },
    {
      strf: 'x',
      alias: '{short}'
    },
    {
      strf: 'X',
      alias: '{time}'
    },
    {
      strf: 'c',
      alias: '{stamp}'
    }
  ];

  var DateUnits = [
    {
      name: 'millisecond',
      method: 'Milliseconds',
      multiplier: 1,
      start: 0,
      end: 999
    },
    {
      name: 'second',
      method: 'Seconds',
      multiplier: 1000,
      start: 0,
      end: 59
    },
    {
      name: 'minute',
      method: 'Minutes',
      multiplier: 60 * 1000,
      start: 0,
      end: 59
    },
    {
      name: 'hour',
      method: 'Hours',
      multiplier: 60 * 60 * 1000,
      start: 0,
      end: 23
    },
    {
      name: 'day',
      alias: 'date',
      method: 'Date',
      ambiguous: true,
      multiplier: 24 * 60 * 60 * 1000,
      start: 1,
      end: function(d) {
        return getDaysInMonth(d);
      }
    },
    {
      name: 'week',
      method: 'ISOWeek',
      ambiguous: true,
      multiplier: 7 * 24 * 60 * 60 * 1000
    },
    {
      name: 'month',
      method: 'Month',
      ambiguous: true,
      multiplier: 30.4375 * 24 * 60 * 60 * 1000,
      start: 0,
      end: 11
    },
    {
      name: 'year',
      method: 'FullYear',
      ambiguous: true,
      multiplier: 365.25 * 24 * 60 * 60 * 1000,
      start: 0
    }
  ];

  /***
   * @method getOption(name)
   * @returns Mixed
   * @accessor
   * @short Gets an option used internally by Date.
   * @example
   *
   *   Sugar.Date.getOption('newDateInternal');
   *
   * @param {string} name
   *
   ***
   * @method setOption(name, value)
   * @accessor
   * @short Sets an option used internally by Date.
   * @extra If `value` is `null`, the default value will be restored.
   * @options
   *
   *   newDateInternal   Sugar's internal date constructor. Date methods often
   *                     construct a `new Date()` internally as a reference point
   *                     (`isToday`, relative formats like `tomorrow`, etc). This
   *                     can be overridden if you need it to be something else.
   *                     Most commonly, this allows you to return a shifted date
   *                     to simulate a specific timezone, as dates in Javascript
   *                     are always local.
   *
   * @example
   *
   *   Sugar.Date.setOption('newDateInternal', function() {
   *     var d = new Date(), offset;
   *     offset = (d.getTimezoneOffset() - 600) * 60 * 1000; // Hawaii time!
   *     d.setTime(d.getTime() + offset);
   *     return d;
   *   });
   *
   * @signature setOption(options)
   * @param {DateOptions} options
   * @param {string} name
   * @param {any} value
   * @option {Function} newDateInternal
   *
   ***/
  var _dateOptions = defineOptionsAccessor(sugarDate, DATE_OPTIONS);

  function setDateChainableConstructor() {
    setChainableConstructor(sugarDate, createDate);
  }

  function getNewDate() {
    return _dateOptions('newDateInternal')();
  }

  function defaultNewDate() {
    return new Date;
  }

  function cloneDate(d) {
    // Rhino environments have a bug where new Date(d) truncates
    // milliseconds so need to call getTime() here.
    var clone = new Date(d.getTime());
    _utc(clone, !!_utc(d));
    return clone;
  }

  function dateIsValid(d) {
    return !isNaN(d.getTime());
  }

  function assertDateIsValid(d) {
    if (!dateIsValid(d)) {
      throw new TypeError('Date is not valid');
    }
  }

  function getHours(d) {
    return callDateGet(d, 'Hours');
  }

  function getWeekday(d) {
    return callDateGet(d, 'Day');
  }

  function getDate(d) {
    return callDateGet(d, 'Date');
  }

  function getMonth(d) {
    return callDateGet(d, 'Month');
  }

  function getYear(d) {
    return callDateGet(d, 'FullYear');
  }

  function setDate(d, val) {
    callDateSet(d, 'Date', val);
  }

  function setMonth(d, val) {
    callDateSet(d, 'Month', val);
  }

  function setYear(d, val) {
    callDateSet(d, 'FullYear', val);
  }

  function getDaysInMonth(d) {
    return 32 - callDateGet(new Date(getYear(d), getMonth(d), 32), 'Date');
  }

  function setWeekday(d, dow, dir) {
    if (!isNumber(dow)) return;
    var currentWeekday = getWeekday(d);
    if (dir) {
      // Allow a "direction" parameter to determine whether a weekday can
      // be set beyond the current weekday in either direction.
      var ndir = dir > 0 ? 1 : -1;
      var offset = dow % 7 - currentWeekday;
      if (offset && offset / abs(offset) !== ndir) {
        dow += 7 * ndir;
      }
    }
    setDate(d, getDate(d) + dow - currentWeekday);
    return d.getTime();
  }

  // Normal callDateSet method with ability
  // to handle ISOWeek setting as well.
  function callDateSetWithWeek(d, method, value, safe) {
    if (method === 'ISOWeek') {
      setISOWeekNumber(d, value);
    } else {
      callDateSet(d, method, value, safe);
    }
  }

  function isUTC(d) {
    return !!_utc(d) || tzOffset(d) === 0;
  }

  function getUTCOffset(d, iso) {
    var offset = _utc(d) ? 0 : tzOffset(d), hours, mins, colon;
    colon  = iso === true ? ':' : '';
    if (!offset && iso) return 'Z';
    hours = padNumber(trunc(-offset / 60), 2, true);
    mins = padNumber(abs(offset % 60), 2);
    return  hours + colon + mins;
  }

  function tzOffset(d) {
    return d.getTimezoneOffset();
  }

  function collectDateArguments(args, allowDuration) {
    var arg1 = args[0], arg2 = args[1];
    if (allowDuration && isString(arg1)) {
      arg1 = getDateParamsFromString(arg1);
    } else if (isNumber(arg1) && isNumber(arg2)) {
      arg1 = collectDateParamsFromArguments(args);
      arg2 = null;
    } else {
      if (isObjectType(arg1)) {
        arg1 = simpleClone(arg1);
      }
    }
    return [arg1, arg2];
  }

  function collectDateParamsFromArguments(args) {
    var params = {}, index = 0;
    walkUnitDown(YEAR_INDEX, function(unit) {
      var arg = args[index++];
      if (isDefined(arg)) {
        params[unit.name] = arg;
      }
    });
    return params;
  }

  function getDateParamsFromString(str) {
    var match, num, params = {};
    match = str.match(/^(-?\d*[\d.]\d*)?\s?(\w+?)s?$/i);
    if (match) {
      if (isUndefined(num)) {
        num = +match[1];
        if (isNaN(num)) {
          num = 1;
        }
      }
      params[match[2].toLowerCase()] = num;
    }
    return params;
  }

  // Years -> Milliseconds
  function iterateOverDateUnits(fn, startIndex, endIndex) {
    endIndex = endIndex || 0;
    if (isUndefined(startIndex)) {
      startIndex = YEAR_INDEX;
    }
    for (var index = startIndex; index >= endIndex; index--) {
      if (fn(DateUnits[index], index) === false) {
        break;
      }
    }
  }

  // Years -> Milliseconds using getLower/Higher methods
  function walkUnitDown(unitIndex, fn) {
    while (unitIndex >= 0) {
      if (fn(DateUnits[unitIndex], unitIndex) === false) {
        break;
      }
      unitIndex = getLowerUnitIndex(unitIndex);
    }
  }

  // Moving lower from specific unit
  function getLowerUnitIndex(index) {
    if (index === MONTH_INDEX) {
      return DAY_INDEX;
    } else if (index === WEEK_INDEX) {
      return HOURS_INDEX;
    }
    return index - 1;
  }

  // Moving higher from specific unit
  function getHigherUnitIndex(index) {
    return index === DAY_INDEX ? MONTH_INDEX : index + 1;
  }

  // Years -> Milliseconds checking all date params including "weekday"
  function iterateOverDateParams(params, fn, startIndex, endIndex) {

    function run(name, unit, i) {
      var val = getDateParam(params, name);
      if (isDefined(val)) {
        fn(name, val, unit, i);
      }
    }

    iterateOverDateUnits(function (unit, i) {
      var result = run(unit.name, unit, i);
      if (result !== false && i === DAY_INDEX) {
        // Check for "weekday", which has a distinct meaning
        // in the context of setting a date, but has the same
        // meaning as "day" as a unit of time.
        result = run('weekday', unit, i);
      }
      return result;
    }, startIndex, endIndex);

  }

  // Years -> Days
  function iterateOverHigherDateParams(params, fn) {
    iterateOverDateParams(params, fn, YEAR_INDEX, DAY_INDEX);
  }

  function advanceDate(d, unit, num, reset) {
    var set = {};
    set[unit] = num;
    return updateDate(d, set, reset, 1);
  }

  function advanceDateWithArgs(d, args, dir) {
    args = collectDateArguments(args, true);
    return updateDate(d, args[0], args[1], dir);
  }

  function resetTime(d) {
    return setUnitAndLowerToEdge(d, HOURS_INDEX);
  }

  function resetLowerUnits(d, unitIndex) {
    return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex));
  }

  function moveToBeginningOfWeek(d, firstDayOfWeek) {
    setWeekday(d, floor((getWeekday(d) - firstDayOfWeek) / 7) * 7 + firstDayOfWeek);
    return d;
  }

  function moveToEndOfWeek(d, firstDayOfWeek) {
    var target = firstDayOfWeek - 1;
    setWeekday(d, ceil((getWeekday(d) - target) / 7) * 7 + target);
    return d;
  }

  function moveToBeginningOfUnit(d, unitIndex, localeCode) {
    if (unitIndex === WEEK_INDEX) {
      moveToBeginningOfWeek(d, localeManager.get(localeCode).getFirstDayOfWeek());
    }
    return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex));
  }

  function moveToEndOfUnit(d, unitIndex, localeCode, stopIndex) {
    if (unitIndex === WEEK_INDEX) {
      moveToEndOfWeek(d, localeManager.get(localeCode).getFirstDayOfWeek());
    }
    return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex), stopIndex, true);
  }

  function setUnitAndLowerToEdge(d, startIndex, stopIndex, end) {
    walkUnitDown(startIndex, function(unit, i) {
      var val = end ? unit.end : unit.start;
      if (isFunction(val)) {
        val = val(d);
      }
      callDateSet(d, unit.method, val);
      return !isDefined(stopIndex) || i > stopIndex;
    });
    return d;
  }

  function getDateParamKey(params, key) {
    return getOwnKey(params, key) ||
           getOwnKey(params, key + 's') ||
           (key === 'day' && getOwnKey(params, 'date'));
  }

  function getDateParam(params, key) {
    return getOwn(params, getDateParamKey(params, key));
  }

  function deleteDateParam(params, key) {
    delete params[getDateParamKey(params, key)];
  }

  function getUnitIndexForParamName(name) {
    var params = {}, unitIndex;
    params[name] = 1;
    iterateOverDateParams(params, function(name, val, unit, i) {
      unitIndex = i;
      return false;
    });
    return unitIndex;
  }

  function getDaysSince(d1, d2) {
    return getTimeDistanceForUnit(d1, d2, DateUnits[DAY_INDEX]);
  }

  function getTimeDistanceForUnit(d1, d2, unit) {
    var fwd = d2 > d1, num, tmp;
    if (!fwd) {
      tmp = d2;
      d2  = d1;
      d1  = tmp;
    }
    num = d2 - d1;
    if (unit.multiplier > 1) {
      num = trunc(num / unit.multiplier);
    }
    // For higher order with potential ambiguity, use the numeric calculation
    // as a starting point, then iterate until we pass the target date.
    if (unit.ambiguous) {
      d1 = cloneDate(d1);
      if (num) {
        advanceDate(d1, unit.name, num);
      }
      while (d1 < d2) {
        advanceDate(d1, unit.name, 1);
        if (d1 > d2) {
          break;
        }
        num += 1;
      }
    }
    return fwd ? -num : num;
  }

  function getParsingTokenValue(token, str) {
    var val;
    if (token.val) {
      val = token.val;
    } else if (token.sign) {
      val = str === '+' ? 1 : -1;
    } else if (token.bool) {
      val = !!val;
    } else {
      val = +str.replace(/,/, '.');
    }
    if (token.param === 'month') {
      val -= 1;
    }
    return val;
  }

  function getYearFromAbbreviation(str, d, prefer) {
    // Following IETF here, adding 1900 or 2000 depending on the last two digits.
    // Note that this makes no accordance for what should happen after 2050, but
    // intentionally ignoring this for now. https://www.ietf.org/rfc/rfc2822.txt
    var val = +str, delta;
    val += val < 50 ? 2000 : 1900;
    if (prefer) {
      delta = val - getYear(d);
      if (delta / abs(delta) !== prefer) {
        val += prefer * 100;
      }
    }
    return val;
  }

  function setISOWeekNumber(d, num) {
    if (isNumber(num)) {
      // Intentionally avoiding updateDate here to prevent circular dependencies.
      var isoWeek = cloneDate(d), dow = getWeekday(d);
      moveToFirstDayOfWeekYear(isoWeek, ISO_FIRST_DAY_OF_WEEK, ISO_FIRST_DAY_OF_WEEK_YEAR);
      setDate(isoWeek, getDate(isoWeek) + 7 * (num - 1));
      setYear(d, getYear(isoWeek));
      setMonth(d, getMonth(isoWeek));
      setDate(d, getDate(isoWeek));
      setWeekday(d, dow || 7);
    }
    return d.getTime();
  }

  function getWeekNumber(d, allowPrevious, firstDayOfWeek, firstDayOfWeekYear) {
    var isoWeek, n = 0;
    if (isUndefined(firstDayOfWeek)) {
      firstDayOfWeek = ISO_FIRST_DAY_OF_WEEK;
    }
    if (isUndefined(firstDayOfWeekYear)) {
      firstDayOfWeekYear = ISO_FIRST_DAY_OF_WEEK_YEAR;
    }
    // Moving to the end of the week allows for forward year traversal, ie
    // Dec 29 2014 is actually week 01 of 2015.
    isoWeek = moveToEndOfWeek(cloneDate(d), firstDayOfWeek);
    moveToFirstDayOfWeekYear(isoWeek, firstDayOfWeek, firstDayOfWeekYear);
    if (allowPrevious && d < isoWeek) {
      // If the date is still before the start of the year, then it should be
      // the last week of the previous year, ie Jan 1 2016 is actually week 53
      // of 2015, so move to the beginning of the week to traverse the year.
      isoWeek = moveToBeginningOfWeek(cloneDate(d), firstDayOfWeek);
      moveToFirstDayOfWeekYear(isoWeek, firstDayOfWeek, firstDayOfWeekYear);
    }
    while (isoWeek <= d) {
      // Doing a very simple walk to get the week number.
      setDate(isoWeek, getDate(isoWeek) + 7);
      n++;
    }
    return n;
  }

  function getWeekYear(d, localeCode, iso) {
    var year, month, firstDayOfWeek, firstDayOfWeekYear, week, loc;
    year = getYear(d);
    month = getMonth(d);
    if (month === 0 || month === 11) {
      if (!iso) {
        loc = localeManager.get(localeCode);
        firstDayOfWeek = loc.getFirstDayOfWeek(localeCode);
        firstDayOfWeekYear = loc.getFirstDayOfWeekYear(localeCode);
      }
      week = getWeekNumber(d, false, firstDayOfWeek, firstDayOfWeekYear);
      if (month === 0 && week === 0) {
        year -= 1;
      } else if (month === 11 && week === 1) {
        year += 1;
      }
    }
    return year;
  }

  function moveToFirstDayOfWeekYear(d, firstDayOfWeek, firstDayOfWeekYear) {
    setUnitAndLowerToEdge(d, MONTH_INDEX);
    setDate(d, firstDayOfWeekYear);
    moveToBeginningOfWeek(d, firstDayOfWeek);
  }

  function dateRelative(d, dRelative, arg1, arg2) {
    var adu, format, type, localeCode, fn;
    assertDateIsValid(d);
    if (isFunction(arg1)) {
      fn = arg1;
    } else {
      localeCode = arg1;
      fn = arg2;
    }
    adu = getAdjustedUnitForDate(d, dRelative);
    if (fn) {
      format = fn.apply(d, adu.concat(localeManager.get(localeCode)));
      if (format) {
        return dateFormat(d, format, localeCode);
      }
    }
    // Adjust up if time is in ms, as this doesn't
    // look very good for a standard relative date.
    if (adu[1] === 0) {
      adu[1] = 1;
      adu[0] = 1;
    }
    if (dRelative) {
      type = 'duration';
    } else if (adu[2] > 0) {
      type = 'future';
    } else {
      type = 'past';
    }
    return localeManager.get(localeCode).getRelativeFormat(adu, type);
  }

  // Gets an "adjusted date unit" which is a way of representing
  // the largest possible meaningful unit. In other words, if passed
  // 3600000, this will return an array which represents "1 hour".
  function getAdjustedUnit(ms, fn) {
    var unitIndex = 0, value = 0;
    iterateOverDateUnits(function(unit, i) {
      value = abs(fn(unit));
      if (value >= 1) {
        unitIndex = i;
        return false;
      }
    });
    return [value, unitIndex, ms];
  }

  // Gets the adjusted unit based on simple division by
  // date unit multiplier.
  function getAdjustedUnitForNumber(ms) {
    return getAdjustedUnit(ms, function(unit) {
      return trunc(withPrecision(ms / unit.multiplier, 1));
    });
  }

  // Gets the adjusted unit using the unitsFromNow methods,
  // which use internal date methods that neatly avoid vaguely
  // defined units of time (days in month, leap years, etc).
  // Reserving dRelative to allow another date to be relative to.
  function getAdjustedUnitForDate(d, dRelative) {
    var ms;
    if (!dRelative) {
      dRelative = getNewDate();
      if (d > dRelative) {
        // If our date is greater than the one that we got from getNewDate, it
        // means that we are finding the unit for a date that is in the future
        // relative to now. However, often the incoming date was created in
        // the same cycle as our comparison, but our "now" date will have been
        // created an instant after it, creating situations where "5 minutes from
        // now" becomes "4 minutes from now" in the same tick. To prevent this,
        // subtract a buffer of 10ms to compensate.
        dRelative = new Date(dRelative.getTime() - 10);
      }
    }
    ms = d - dRelative;
    return getAdjustedUnit(ms, function(u) {
      return abs(getTimeDistanceForUnit(d, dRelative, u));
    });
  }

  // Formatting tokens
  var ldmlTokens, strfTokens;

  function dateFormat(d, format, localeCode) {
    assertDateIsValid(d);
    format = CoreOutputFormats[format] || format || '{long}';
    return dateFormatMatcher(format, d, localeCode);
  }

  function getMeridiemToken(d, localeCode) {
    var hours = getHours(d);
    return localeManager.get(localeCode).ampm[trunc(hours / 12)] || '';
  }

  function buildDateFormatTokens() {

    function addFormats(target, tokens, fn) {
      if (tokens) {
        forEach(spaceSplit(tokens), function(token) {
          target[token] = fn;
        });
      }
    }

    function buildLowercase(get) {
      return function(d, localeCode) {
        return get(d, localeCode).toLowerCase();
      };
    }

    function buildOrdinal(get) {
      return function(d, localeCode) {
        var n = get(d, localeCode);
        return n + localeManager.get(localeCode).getOrdinal(n);
      };
    }

    function buildPadded(get, padding) {
      return function(d, localeCode) {
        return padNumber(get(d, localeCode), padding);
      };
    }

    function buildTwoDigits(get) {
      return function(d, localeCode) {
        return get(d, localeCode) % 100;
      };
    }

    function buildAlias(alias) {
      return function(d, localeCode) {
        return dateFormatMatcher(alias, d, localeCode);
      };
    }

    function buildAlternates(f) {
      for (var n = 1; n <= 5; n++) {
        buildAlternate(f, n);
      }
    }

    function buildAlternate(f, n) {
      var alternate = function(d, localeCode) {
        return f.get(d, localeCode, n);
      };
      addFormats(ldmlTokens, f.ldml + n, alternate);
      if (f.lowerToken) {
        ldmlTokens[f.lowerToken + n] = buildLowercase(alternate);
      }
    }

    function getIdentityFormat(name) {
      return function(d, localeCode) {
        var loc = localeManager.get(localeCode);
        return dateFormatMatcher(loc[name], d, localeCode);
      };
    }

    ldmlTokens = {};
    strfTokens = {};

    forEach(FormatTokensBase, function(f) {
      var get = f.get, getPadded;
      if (f.lowerToken) {
        ldmlTokens[f.lowerToken] = buildLowercase(get);
      }
      if (f.ordinalToken) {
        ldmlTokens[f.ordinalToken] = buildOrdinal(get, f);
      }
      if (f.ldmlPaddedToken) {
        ldmlTokens[f.ldmlPaddedToken] = buildPadded(get, f.ldmlPaddedToken.length);
      }
      if (f.ldmlTwoDigitToken) {
        ldmlTokens[f.ldmlTwoDigitToken] = buildPadded(buildTwoDigits(get), 2);
      }
      if (f.strfTwoDigitToken) {
        strfTokens[f.strfTwoDigitToken] = buildPadded(buildTwoDigits(get), 2);
      }
      if (f.strfPadding) {
        getPadded = buildPadded(get, f.strfPadding);
      }
      if (f.alias) {
        get = buildAlias(f.alias);
      }
      if (f.allowAlternates) {
        buildAlternates(f);
      }
      addFormats(ldmlTokens, f.ldml, get);
      addFormats(strfTokens, f.strf, getPadded || get);
    });

    forEachProperty(CoreOutputFormats, function(src, name) {
      addFormats(ldmlTokens, name, buildAlias(src));
    });

    defineInstanceSimilar(sugarDate, 'short medium long full', function(methods, name) {
      var fn = getIdentityFormat(name);
      addFormats(ldmlTokens, name, fn);
      methods[name] = fn;
    });

    addFormats(ldmlTokens, 'time', getIdentityFormat('time'));
    addFormats(ldmlTokens, 'stamp', getIdentityFormat('stamp'));
  }

  var dateFormatMatcher;

  function buildDateFormatMatcher() {

    function getLdml(d, token, localeCode) {
      return getOwn(ldmlTokens, token)(d, localeCode);
    }

    function getStrf(d, token, localeCode) {
      return getOwn(strfTokens, token)(d, localeCode);
    }

    function checkDateToken(ldml, strf) {
      return hasOwn(ldmlTokens, ldml) || hasOwn(strfTokens, strf);
    }

    // Format matcher for LDML or STRF tokens.
    dateFormatMatcher = createFormatMatcher(getLdml, getStrf, checkDateToken);
  }

  function fullCompareDate(date, d, margin) {
    var tmp;
    if (!dateIsValid(date)) return;
    if (isString(d)) {
      d = trim(d).toLowerCase();
      switch(true) {
        case d === 'future':    return date.getTime() > getNewDate().getTime();
        case d === 'past':      return date.getTime() < getNewDate().getTime();
        case d === 'today':     return compareDay(date);
        case d === 'tomorrow':  return compareDay(date,  1);
        case d === 'yesterday': return compareDay(date, -1);
        case d === 'weekday':   return getWeekday(date) > 0 && getWeekday(date) < 6;
        case d === 'weekend':   return getWeekday(date) === 0 || getWeekday(date) === 6;

        case (isDefined(tmp = English.weekdayMap[d])):
          return getWeekday(date) === tmp;
        case (isDefined(tmp = English.monthMap[d])):
          return getMonth(date) === tmp;
      }
    }
    return compareDate(date, d, margin);
  }

  function compareDate(date, d, margin, localeCode, options) {
    var loMargin = 0, hiMargin = 0, timezoneShift, compareEdges, override, min, max, p, t;

    function getTimezoneShift() {
      // If there is any specificity in the date then we're implicitly not
      // checking absolute time, so ignore timezone shifts.
      if (p.set && p.set.specificity) {
        return 0;
      }
      return (tzOffset(p.date) - tzOffset(date)) * MINUTES;
    }

    function addSpecificUnit() {
      var unit = DateUnits[p.set.specificity];
      return advanceDate(cloneDate(p.date), unit.name, 1).getTime() - 1;
    }

    if (_utc(date)) {
      options = options || {};
      options.fromUTC = true;
      options.setUTC = true;
    }

    p = getExtendedDate(null, d, options, true);

    if (margin > 0) {
      loMargin = hiMargin = margin;
      override = true;
    }
    if (!dateIsValid(p.date)) return false;
    if (p.set && p.set.specificity) {
      if (isDefined(p.set.edge) || isDefined(p.set.shift)) {
        compareEdges = true;
        moveToBeginningOfUnit(p.date, p.set.specificity, localeCode);
      }
      if (compareEdges || p.set.specificity === MONTH_INDEX) {
        max = moveToEndOfUnit(cloneDate(p.date), p.set.specificity, localeCode).getTime();
      } else {
        max = addSpecificUnit();
      }
      if (!override && isDefined(p.set.sign) && p.set.specificity) {
        // If the time is relative, there can occasionally be an disparity between
        // the relative date and "now", which it is being compared to, so set an
        // extra margin to account for this.
        loMargin = 50;
        hiMargin = -50;
      }
    }
    t   = date.getTime();
    min = p.date.getTime();
    max = max || min;
    timezoneShift = getTimezoneShift();
    if (timezoneShift) {
      min -= timezoneShift;
      max -= timezoneShift;
    }
    return t >= (min - loMargin) && t <= (max + hiMargin);
  }

  function compareDay(d, shift) {
    var comp = getNewDate();
    if (shift) {
      setDate(comp, getDate(comp) + shift);
    }
    return getYear(d) === getYear(comp) &&
           getMonth(d) === getMonth(comp) &&
           getDate(d) === getDate(comp);
  }

  function createDate(d, options, forceClone) {
    return getExtendedDate(null, d, options, forceClone).date;
  }

  function createDateWithContext(contextDate, d, options, forceClone) {
    return getExtendedDate(contextDate, d, options, forceClone).date;
  }

  function getExtendedDate(contextDate, d, opt, forceClone) {

    var date, set, loc, options, afterCallbacks, relative, weekdayDir;

    afterCallbacks = [];
    options = getDateOptions(opt);

    function getDateOptions(opt) {
      var options = isString(opt) ? { locale: opt } : opt || {};
      options.prefer = +!!getOwn(options, 'future') - +!!getOwn(options, 'past');
      return options;
    }

    function getFormatParams(match, dif) {
      var set = getOwn(options, 'params') || {};
      forEach(dif.to, function(field, i) {
        var str = match[i + 1], token, val;
        if (!str) return;
        if (field === 'yy' || field === 'y') {
          field = 'year';
          val = getYearFromAbbreviation(str, date, getOwn(options, 'prefer'));
        } else if (token = getOwn(ParsingTokens, field)) {
          field = token.param || field;
          val = getParsingTokenValue(token, str);
        } else {
          val = loc.getTokenValue(field, str);
        }
        set[field] = val;
      });
      return set;
    }

    // Clone date will set the utc flag, but it will
    // be overriden later, so set option flags instead.
    function cloneDateByFlag(d, clone) {
      if (_utc(d) && !isDefined(getOwn(options, 'fromUTC'))) {
        options.fromUTC = true;
      }
      if (_utc(d) && !isDefined(getOwn(options, 'setUTC'))) {
        options.setUTC = true;
      }
      if (clone) {
        d = new Date(d.getTime());
      }
      return d;
    }

    function afterDateSet(fn) {
      afterCallbacks.push(fn);
    }

    function fireCallbacks() {
      forEach(afterCallbacks, function(fn) {
        fn.call();
      });
    }

    function parseStringDate(str) {

      str = str.toLowerCase();

      // The act of getting the locale will initialize
      // if it is missing and add the required formats.
      loc = localeManager.get(getOwn(options, 'locale'));

      for (var i = 0, dif, match; dif = loc.compiledFormats[i]; i++) {
        match = str.match(dif.reg);
        if (match) {

          // Note that caching the format will modify the compiledFormats array
          // which is not a good idea to do inside its for loop, however we
          // know at this point that we have a matched format and that we will
          // break out below, so simpler to do it here.
          loc.cacheFormat(dif, i);

          set = getFormatParams(match, dif);

          if (isDefined(set.timestamp)) {
            str = set.timestamp;
            set = null;
            break;
          }

          if (isDefined(set.ampm)) {
            handleAmpm(set.ampm);
          }

          if (set.utc || isDefined(set.tzHour)) {
            handleTimezoneOffset(set.tzHour, set.tzMinute, set.tzSign);
          }

          if (isDefined(set.shift) && isUndefined(set.unit)) {
            // "next january", "next monday", etc
            handleUnitlessShift();
          }

          if (isDefined(set.num) && isUndefined(set.unit)) {
            // "the second of January", etc
            handleUnitlessNum(set.num);
          }

          if (set.midday) {
            // "noon" and "midnight"
            handleMidday(set.midday);
          }

          if (isDefined(set.day)) {
            // Relative day localizations such as "today" and "tomorrow".
            handleRelativeDay(set.day);
          }

          if (isDefined(set.unit)) {
            // "3 days ago", etc
            handleRelativeUnit(set.unit);
          }

          if (set.edge) {
            // "the end of January", etc
            handleEdge(set.edge, set);
          }

          if (set.yearSign) {
            set.year *= set.yearSign;
          }

          break;
        }
      }

      if (!set) {
        // Fall back to native parsing
        date = new Date(str);
        if (getOwn(options, 'fromUTC')) {
          // Falling back to system date here which cannot be parsed as UTC,
          // so if we're forcing UTC then simply add the offset.
          date.setTime(date.getTime() + (tzOffset(date) * MINUTES));
        }
      } else if (relative) {
        updateDate(date, set, false, 1);
      } else {
        if (_utc(date)) {
          // UTC times can traverse into other days or even months,
          // so preemtively reset the time here to prevent this.
          resetTime(date);
        }
        updateDate(date, set, true, 0, getOwn(options, 'prefer'), weekdayDir);
      }
      fireCallbacks();
      return date;
    }

    function handleAmpm(ampm) {
      if (ampm === 1 && set.hour < 12) {
        // If the time is 1pm-11pm advance the time by 12 hours.
        set.hour += 12;
      } else if (ampm === 0 && set.hour === 12) {
        // If it is 12:00am then set the hour to 0.
        set.hour = 0;
      }
    }

    function handleTimezoneOffset(tzHour, tzMinute, tzSign) {
      // Adjust for timezone offset
      _utc(date, true);
      var offset = (tzSign || 1) * ((tzHour || 0) * 60 + (tzMinute || 0));
      if (offset) {
        set.minute = (set.minute || 0) - offset;
      }
    }

    function handleUnitlessShift() {
      if (isDefined(set.month)) {
        // "next January"
        set.unit = YEAR_INDEX;
      } else if (isDefined(set.weekday)) {
        // "next Monday"
        set.unit = WEEK_INDEX;
      }
    }

    function handleUnitlessNum(num) {
      if (isDefined(set.weekday)) {
        // "The second Tuesday of March"
        setOrdinalWeekday(num);
      } else if (isDefined(set.month)) {
        // "The second of March"
        set.date = set.num;
      }
    }

    function handleMidday(hour) {
      set.hour = hour % 24;
      if (hour > 23) {
        // If the date has hours past 24, we need to prevent it from traversing
        // into a new day as that would make it being part of a new week in
        // ambiguous dates such as "Monday".
        afterDateSet(function() {
          advanceDate(date, 'date', trunc(hour / 24));
        });
      }
    }

    function handleRelativeDay() {
      resetTime(date);
      if (isUndefined(set.unit)) {
        set.unit = DAY_INDEX;
        set.num  = set.day;
        delete set.day;
      }
    }

    function handleRelativeUnit(unitIndex) {
      var num = isDefined(set.num) ? set.num : 1;

      // If a weekday is defined, there are 3 possible formats being applied:
      //
      // 1. "the day after monday": unit is days
      // 2. "next monday": short for "next week monday", unit is weeks
      // 3. "the 2nd monday of next month": unit is months
      //
      // In the first case, we need to set the weekday up front, as the day is
      // relative to it. The second case also needs to be handled up front for
      // formats like "next monday at midnight" which will have its weekday reset
      // if not set up front. The last case will set up the params necessary to
      // shift the weekday and allow separateAbsoluteUnits below to handle setting
      // it after the date has been shifted.
      if(isDefined(set.weekday)) {
        if(unitIndex === MONTH_INDEX) {
          setOrdinalWeekday(num);
          num = 1;
        } else {
          updateDate(date, { weekday: set.weekday }, true);
          delete set.weekday;
        }
      }

      if (set.half) {
        // Allow localized "half" as a standalone colloquialism. Purposely avoiding
        // the locale number system to reduce complexity. The units "month" and
        // "week" are purposely excluded in the English date formats below, as
        // "half a week" and "half a month" are meaningless as exact dates.
        num *= set.half;
      }

      if (isDefined(set.shift)) {
        // Shift and unit, ie "next month", "last week", etc.
        num *= set.shift;
      } else if (set.sign) {
        // Unit and sign, ie "months ago", "weeks from now", etc.
        num *= set.sign;
      }

      if (isDefined(set.day)) {
        // "the day after tomorrow"
        num += set.day;
        delete set.day;
      }

      // Formats like "the 15th of last month" or "6:30pm of next week"
      // contain absolute units in addition to relative ones, so separate
      // them here, remove them from the params, and set up a callback to
      // set them after the relative ones have been set.
      separateAbsoluteUnits(unitIndex);

      // Finally shift the unit.
      set[English.units[unitIndex]] = num;
      relative = true;
    }

    function handleEdge(edge, params) {
      var edgeIndex = params.unit, weekdayOfMonth;
      if (!edgeIndex) {
        // If we have "the end of January", then we need to find the unit index.
        iterateOverHigherDateParams(params, function(unitName, val, unit, i) {
          if (unitName === 'weekday' && isDefined(params.month)) {
            // If both a month and weekday exist, then we have a format like
            // "the last tuesday in November, 2012", where the "last" is still
            // relative to the end of the month, so prevent the unit "weekday"
            // from taking over.
            return;
          }
          edgeIndex = i;
        });
      }
      if (edgeIndex === MONTH_INDEX && isDefined(params.weekday)) {
        // If a weekday in a month exists (as described above),
        // then set it up to be set after the date has been shifted.
        weekdayOfMonth = params.weekday;
        delete params.weekday;
      }
      afterDateSet(function() {
        var stopIndex;
        // "edge" values that are at the very edge are "2" so the beginning of the
        // year is -2 and the end of the year is 2. Conversely, the "last day" is
        // actually 00:00am so it is 1. -1 is reserved but unused for now.
        if (edge < 0) {
          moveToBeginningOfUnit(date, edgeIndex, getOwn(options, 'locale'));
        } else if (edge > 0) {
          if (edge === 1) {
            stopIndex = DAY_INDEX;
            moveToBeginningOfUnit(date, DAY_INDEX);
          }
          moveToEndOfUnit(date, edgeIndex, getOwn(options, 'locale'), stopIndex);
        }
        if (isDefined(weekdayOfMonth)) {
          setWeekday(date, weekdayOfMonth, -edge);
          resetTime(date);
        }
      });
      if (edgeIndex === MONTH_INDEX) {
        params.specificity = DAY_INDEX;
      } else {
        params.specificity = edgeIndex - 1;
      }
    }

    function setOrdinalWeekday(num) {
      // If we have "the 2nd Tuesday of June", then pass the "weekdayDir"
      // flag along to updateDate so that the date does not accidentally traverse
      // into the previous month. This needs to be independent of the "prefer"
      // flag because we are only ensuring that the weekday is in the future, not
      // the entire date.
      set.weekday = 7 * (num - 1) + set.weekday;
      set.date = 1;
      weekdayDir = 1;
    }

    function separateAbsoluteUnits(unitIndex) {
      var params;

      iterateOverDateParams(set, function(name, val, unit, i) {
        // If there is a time unit set that is more specific than
        // the matched unit we have a string like "5:30am in 2 minutes",
        // which is meaningless, so invalidate the date...
        if (i >= unitIndex) {
          date.setTime(NaN);
          return false;
        } else if (i < unitIndex) {
          // ...otherwise set the params to set the absolute date
          // as a callback after the relative date has been set.
          params = params || {};
          params[name] = val;
          deleteDateParam(set, name);
        }
      });
      if (params) {
        afterDateSet(function() {
          updateDate(date, params, true, false, getOwn(options, 'prefer'), weekdayDir);
        });
        if (set.edge) {
          // "the end of March of next year"
          handleEdge(set.edge, params);
          delete set.edge;
        }
      }
    }

    if (contextDate && d) {
      // If a context date is passed ("get" and "unitsFromNow"),
      // then use it as the starting point.
      date = cloneDateByFlag(contextDate, true);
    } else {
      date = getNewDate();
    }

    _utc(date, getOwn(options, 'fromUTC'));

    if (isString(d)) {
      date = parseStringDate(d);
    } else if (isDate(d)) {
      date = cloneDateByFlag(d, hasOwn(options, 'clone') || forceClone);
    } else if (isObjectType(d)) {
      set = simpleClone(d);
      updateDate(date, set, true);
    } else if (isNumber(d) || d === null) {
      date.setTime(d);
    }
    // A date created by parsing a string presumes that the format *itself* is
    // UTC, but not that the date, once created, should be manipulated as such. In
    // other words, if you are creating a date object from a server time
    // "2012-11-15T12:00:00Z", in the majority of cases you are using it to create
    // a date that will, after creation, be manipulated as local, so reset the utc
    // flag here unless "setUTC" is also set.
    _utc(date, !!getOwn(options, 'setUTC'));
    return {
      set: set,
      date: date
    };
  }

  function updateDate(d, params, reset, advance, prefer, weekdayDir) {
    var upperUnitIndex;

    function setUpperUnit(unitName, unitIndex) {
      if (prefer && !upperUnitIndex) {
        if (unitName === 'weekday') {
          upperUnitIndex = WEEK_INDEX;
        } else {
          upperUnitIndex = getHigherUnitIndex(unitIndex);
        }
      }
    }

    function setSpecificity(unitIndex) {
      // Other functions may preemptively set the specificity before arriving
      // here so concede to them if they have already set more specific units.
      if (unitIndex > params.specificity) {
        return;
      }
      params.specificity = unitIndex;
    }

    function canDisambiguate() {
      if (!upperUnitIndex || upperUnitIndex > YEAR_INDEX) {
        return;
      }
      switch(prefer) {
        case -1: return d > getNewDate();
        case  1: return d < getNewDate();
      }
    }

    function disambiguateHigherUnit() {
      var unit = DateUnits[upperUnitIndex];
      advance = prefer;
      setUnit(unit.name, 1, unit, upperUnitIndex);
    }

    function handleFraction(unit, unitIndex, fraction) {
      if (unitIndex) {
        var lowerUnit = DateUnits[getLowerUnitIndex(unitIndex)];
        var val = round(unit.multiplier / lowerUnit.multiplier * fraction);
        params[lowerUnit.name] = val;
      }
    }

    function monthHasShifted(d, targetMonth) {
      if (targetMonth < 0) {
        targetMonth = targetMonth % 12 + 12;
      }
      return targetMonth % 12 !== getMonth(d);
    }

    function setUnit(unitName, value, unit, unitIndex) {
      var method = unit.method, checkMonth, fraction;

      setUpperUnit(unitName, unitIndex);
      setSpecificity(unitIndex);

      fraction = value % 1;
      if (fraction) {
        handleFraction(unit, unitIndex, fraction);
        value = trunc(value);
      }

      if (unitName === 'weekday') {
        if (!advance) {
          // Weekdays are always considered absolute units so simply set them
          // here even if it is an "advance" operation. This is to help avoid
          // ambiguous meanings in "advance" as well as to neatly allow formats
          // like "Wednesday of next week" without more complex logic.
          setWeekday(d, value, weekdayDir);
        }
        return;
      }
      checkMonth = unitIndex === MONTH_INDEX && getDate(d) > 28;

      // If we are advancing or rewinding, then we need we need to set the
      // absolute time if the unit is "hours" or less. This is due to the fact
      // that setting by method is ambiguous during DST shifts. For example,
      // 1:00am on November 1st 2015 occurs twice in North American timezones
      // with DST, the second time being after the clocks are rolled back at
      // 2:00am. When springing forward this is automatically handled as there
      // is no 2:00am so the date automatically jumps to 3:00am. However, when
      // rolling back, setHours(2) will always choose the first "2am" even if
      // the date is currently set to the second, causing unintended jumps.
      // This ambiguity is unavoidable when setting dates as the notation is
      // ambiguous. However when advancing, we clearly want the resulting date
      // to be an acutal hour ahead, which can only be accomplished by setting
      // the absolute time. Conversely, any unit higher than "hours" MUST use
      // the internal set methods, as they are ambiguous as absolute units of
      // time. Years may be 365 or 366 days depending on leap years, months are
      // all over the place, and even days may be 23-25 hours depending on DST
      // shifts. Finally, note that the kind of jumping described above will
      // occur when calling ANY "set" method on the date and will occur even if
      // the value being set is identical to the one currently set (i.e.
      // setHours(2) on a date at 2am may not be a noop). This is precarious,
      // so avoiding this situation in callDateSet by checking up front that
      // the value is not the same before setting.
      if (advance && !unit.ambiguous) {
        d.setTime(d.getTime() + (value * advance * unit.multiplier));
        return;
      } else if (advance) {
        if (unitIndex === WEEK_INDEX) {
          value *= 7;
          method = DateUnits[DAY_INDEX].method;
        }
        value = (value * advance) + callDateGet(d, method);
      }
      callDateSetWithWeek(d, method, value, advance);
      if (checkMonth && monthHasShifted(d, value)) {
        // As we are setting the units in reverse order, there is a chance that
        // our date may accidentally traverse into a new month, such as setting
        // { month: 1, date 15 } on January 31st. Check for this here and reset
        // the date to the last day of the previous month if this has happened.
        setDate(d, 0);
      }
    }

    if (isNumber(params) && advance) {
      // If param is a number and advancing, the number is in milliseconds.
      params = { millisecond: params };
    } else if (isNumber(params)) {
      // Otherwise just set the timestamp and return.
      d.setTime(params);
      return d;
    }

    iterateOverDateParams(params, setUnit);

    if (reset && params.specificity) {
      resetLowerUnits(d, params.specificity);
    }

    // If past or future is preferred, then the process of "disambiguation" will
    // ensure that an ambiguous time/date ("4pm", "thursday", "June", etc.) will
    // be in the past or future. Weeks are only considered ambiguous if there is
    // a weekday, i.e. "thursday" is an ambiguous week, but "the 4th" is an
    // ambiguous month.
    if (canDisambiguate()) {
      disambiguateHigherUnit();
    }
    return d;
  }

  // Locale helpers
  var English, localeManager;

  function getEnglishVariant(v) {
    return simpleMerge(simpleClone(EnglishLocaleBaseDefinition), v);
  }

  function arrayToRegAlternates(arr) {
    var joined = arr.join('');
    if (!arr || !arr.length) {
      return '';
    }
    if (joined.length === arr.length) {
      return '[' + joined + ']';
    }
    // map handles sparse arrays so no need to compact the array here.
    return map(arr, escapeRegExp).join('|');
  }

  function getRegNonCapturing(src, opt) {
    if (src.length > 1) {
      src = '(?:' + src + ')';
    }
    if (opt) {
      src += '?';
    }
    return src;
  }

  function getParsingTokenWithSuffix(field, src, suffix) {
    var token = LocalizedParsingTokens[field];
    if (token.requiresSuffix) {
      src = getRegNonCapturing(src + getRegNonCapturing(suffix));
    } else if (token.requiresSuffixOr) {
      src += getRegNonCapturing(token.requiresSuffixOr + '|' + suffix);
    } else {
      src += getRegNonCapturing(suffix, true);
    }
    return src;
  }

  function getArrayWithOffset(arr, n, alternate, offset) {
    var val;
    if (alternate > 1) {
      val = arr[n + (alternate - 1) * offset];
    }
    return val || arr[n];
  }

  function buildLocales() {

    function LocaleManager(loc) {
      this.locales = {};
      this.add(loc);
    }

    LocaleManager.prototype = {

      get: function(code, fallback) {
        var loc = this.locales[code];
        if (!loc && LazyLoadedLocales[code]) {
          loc = this.add(code, LazyLoadedLocales[code]);
        } else if (!loc && code) {
          loc = this.locales[code.slice(0, 2)];
        }
        return loc || fallback === false ? loc : this.current;
      },

      getAll: function() {
        return this.locales;
      },

      set: function(code) {
        var loc = this.get(code, false);
        if (!loc) {
          throw new TypeError('Invalid Locale: ' + code);
        }
        return this.current = loc;
      },

      add: function(code, def) {
        if (!def) {
          def = code;
          code = def.code;
        } else {
          def.code = code;
        }
        var loc = def.compiledFormats ? def : getNewLocale(def);
        this.locales[code] = loc;
        if (!this.current) {
          this.current = loc;
        }
        return loc;
      },

      remove: function(code) {
        if (this.current.code === code) {
          this.current = this.get('en');
        }
        return delete this.locales[code];
      }

    };

    // Sorry about this guys...
    English = getNewLocale(AmericanEnglishDefinition);
    localeManager = new LocaleManager(English);
  }

  function getNewLocale(def) {

    function Locale(def) {
      this.init(def);
    }

    Locale.prototype = {

      getMonthName: function(n, alternate) {
        if (this.monthSuffix) {
          return (n + 1) + this.monthSuffix;
        }
        return getArrayWithOffset(this.months, n, alternate, 12);
      },

      getWeekdayName: function(n, alternate) {
        return getArrayWithOffset(this.weekdays, n, alternate, 7);
      },

      getTokenValue: function(field, str) {
        var map = this[field + 'Map'], val;
        if (map) {
          val = map[str];
        }
        if (isUndefined(val)) {
          val = this.getNumber(str);
          if (field === 'month') {
            // Months are the only numeric date field
            // whose value is not the same as its number.
            val -= 1;
          }
        }
        return val;
      },

      getNumber: function(str) {
        var num = this.numeralMap[str];
        if (isDefined(num)) {
          return num;
        }
        // The unary plus operator here show better performance and handles
        // every format that parseFloat does with the exception of trailing
        // characters, which are guaranteed not to be in our string at this point.
        num = +str.replace(/,/, '.');
        if (!isNaN(num)) {
          return num;
        }
        num = this.getNumeralValue(str);
        if (!isNaN(num)) {
          this.numeralMap[str] = num;
          return num;
        }
        return num;
      },

      getNumeralValue: function(str) {
        var place = 1, num = 0, lastWasPlace, isPlace, numeral, digit, arr;
        // Note that "numerals" that need to be converted through this method are
        // all considered to be single characters in order to handle CJK. This
        // method is by no means unique to CJK, but the complexity of handling
        // inflections in non-CJK languages adds too much overhead for not enough
        // value, so avoiding for now.
        arr = str.split('');
        for (var i = arr.length - 1; numeral = arr[i]; i--) {
          digit = getOwn(this.numeralMap, numeral);
          if (isUndefined(digit)) {
            digit = getOwn(fullWidthNumberMap, numeral) || 0;
          }
          isPlace = digit > 0 && digit % 10 === 0;
          if (isPlace) {
            if (lastWasPlace) {
              num += place;
            }
            if (i) {
              place = digit;
            } else {
              num += digit;
            }
          } else {
            num += digit * place;
            place *= 10;
          }
          lastWasPlace = isPlace;
        }
        return num;
      },

      getOrdinal: function(n) {
        var suffix = this.ordinalSuffix;
        return suffix || getOrdinalSuffix(n);
      },

      getRelativeFormat: function(adu, type) {
        return this.convertAdjustedToFormat(adu, type);
      },

      getDuration: function(ms) {
        return this.convertAdjustedToFormat(getAdjustedUnitForNumber(max(0, ms)), 'duration');
      },

      getFirstDayOfWeek: function() {
        var val = this.firstDayOfWeek;
        return isDefined(val) ? val : ISO_FIRST_DAY_OF_WEEK;
      },

      getFirstDayOfWeekYear: function() {
        return this.firstDayOfWeekYear || ISO_FIRST_DAY_OF_WEEK_YEAR;
      },

      convertAdjustedToFormat: function(adu, type) {
        var sign, unit, mult,
            num    = adu[0],
            u      = adu[1],
            ms     = adu[2],
            format = this[type] || this.relative;
        if (isFunction(format)) {
          return format.call(this, num, u, ms, type);
        }
        mult = !this.plural || num === 1 ? 0 : 1;
        unit = this.units[mult * 8 + u] || this.units[u];
        sign = this[ms > 0 ? 'fromNow' : 'ago'];
        return format.replace(/\{(.*?)\}/g, function(full, match) {
          switch(match) {
            case 'num': return num;
            case 'unit': return unit;
            case 'sign': return sign;
          }
        });
      },

      cacheFormat: function(dif, i) {
        this.compiledFormats.splice(i, 1);
        this.compiledFormats.unshift(dif);
      },

      addFormat: function(src, to) {
        var loc = this;

        function getTokenSrc(str) {
          var suffix, src, val,
              opt   = str.match(/\?$/),
              nc    = str.match(/^(\d+)\??$/),
              slice = str.match(/(\d)(?:-(\d))?/),
              key   = str.replace(/[^a-z]+$/i, '');

          // Allowing alias tokens such as {time}
          if (val = getOwn(loc.parsingAliases, key)) {
            src = replaceParsingTokens(val);
            if (opt) {
              src = getRegNonCapturing(src, true);
            }
            return src;
          }

          if (nc) {
            src = loc.tokens[nc[1]];
          } else if (val = getOwn(ParsingTokens, key)) {
            src = val.src;
          } else {
            val = getOwn(loc.parsingTokens, key) || getOwn(loc, key);

            // Both the "months" array and the "month" parsing token can be accessed
            // by either {month} or {months}, falling back as necessary, however
            // regardless of whether or not a fallback occurs, the final field to
            // be passed to addRawFormat must be normalized as singular.
            key = key.replace(/s$/, '');

            if (!val) {
              val = getOwn(loc.parsingTokens, key) || getOwn(loc, key + 's');
            }

            if (isString(val)) {
              src = val;
              suffix = loc[key + 'Suffix'];
            } else {
              if (slice) {
                val = filter(val, function(m, i) {
                  var mod = i % (loc.units ? 8 : val.length);
                  return mod >= slice[1] && mod <= (slice[2] || slice[1]);
                });
              }
              src = arrayToRegAlternates(val);
            }
          }
          if (!src) {
            return '';
          }
          if (nc) {
            // Non-capturing tokens like {0}
            src = getRegNonCapturing(src);
          } else {
            // Capturing group and add to parsed tokens
            to.push(key);
            src = '(' + src + ')';
          }
          if (suffix) {
            // Date/time suffixes such as those in CJK
            src = getParsingTokenWithSuffix(key, src, suffix);
          }
          if (opt) {
            src += '?';
          }
          return src;
        }

        function replaceParsingTokens(str) {

          // Make spaces optional
          str = str.replace(/ /g, ' ?');

          return str.replace(/\{([^,]+?)\}/g, function(match, token) {
            var tokens = token.split('|'), src;
            if (tokens.length > 1) {
              src = getRegNonCapturing(map(tokens, getTokenSrc).join('|'));
            } else {
              src = getTokenSrc(token);
            }
            return src;
          });
        }

        if (!to) {
          to = [];
          src = replaceParsingTokens(src);
        }

        loc.addRawFormat(src, to);
      },

      addRawFormat: function(format, to) {
        this.compiledFormats.unshift({
          reg: RegExp('^ *' + format + ' *$', 'i'),
          to: to
        });
      },

      init: function(def) {
        var loc = this;

        // -- Initialization helpers

        function initFormats() {
          loc.compiledFormats = [];
          loc.parsingAliases = {};
          loc.parsingTokens = {};
        }

        function initDefinition() {
          simpleMerge(loc, def);
        }

        function initArrayFields() {
          forEach(LOCALE_ARRAY_FIELDS, function(name) {
            var val = loc[name];
            if (isString(val)) {
              loc[name] = commaSplit(val);
            } else if (!val) {
              loc[name] = [];
            }
          });
        }

        // -- Value array build helpers

        function buildValueArray(name, mod, map, fn) {
          var field = name, all = [], setMap;
          if (!loc[field]) {
            field += 's';
          }
          if (!map) {
            map = {};
            setMap = true;
          }
          forAllAlternates(field, function(alt, j, i) {
            var idx = j * mod + i, val;
            val = fn ? fn(i) : i;
            map[alt] = val;
            map[alt.toLowerCase()] = val;
            all[idx] = alt;
          });
          loc[field] = all;
          if (setMap) {
            loc[name + 'Map'] = map;
          }
        }

        function forAllAlternates(field, fn) {
          forEach(loc[field], function(str, i) {
            forEachAlternate(str, function(alt, j) {
              fn(alt, j, i);
            });
          });
        }

        function forEachAlternate(str, fn) {
          var arr = map(str.split('+'), function(split) {
            return split.replace(/(.+):(.+)$/, function(full, base, suffixes) {
              return map(suffixes.split('|'), function(suffix) {
                return base + suffix;
              }).join('|');
            });
          }).join('|');
          forEach(arr.split('|'), fn);
        }

        function buildNumerals() {
          var map = {};
          buildValueArray('numeral', 10, map);
          buildValueArray('article', 1, map, function() {
            return 1;
          });
          buildValueArray('placeholder', 4, map, function(n) {
            return pow(10, n + 1);
          });
          loc.numeralMap = map;
        }

        function buildTimeFormats() {
          loc.parsingAliases['time'] = getTimeFormat();
          loc.parsingAliases['tzOffset'] = getTZOffsetFormat();
        }

        function getTimeFormat() {
          var src;
          if (loc.ampmFront) {
            // "ampmFront" exists mostly for CJK locales, which also presume that
            // time suffixes exist, allowing this to be a simpler regex.
            src = '{ampm?} {hour} (?:{minute} (?::?{second})?)?';
          } else if(loc.ampm.length) {
            src = '{hour}(?:[.:]{minute}(?:[.:]{second})? {ampm?}| {ampm})';
          } else {
            src = '{hour}(?:[.:]{minute}(?:[.:]{second})?)';
          }
          return src;
        }

        function getTZOffsetFormat() {
          return '(?:{Z}|{GMT?}(?:{tzSign}{tzHour}(?::?{tzMinute}(?: \\([\\w\\s]+\\))?)?)?)?';
        }

        function buildParsingTokens() {
          forEachProperty(LocalizedParsingTokens, function(token, name) {
            var src, arr;
            src = token.base ? ParsingTokens[token.base].src : token.src;
            if (token.requiresNumerals || loc.numeralUnits) {
              src += getNumeralSrc();
            }
            arr = loc[name + 's'];
            if (arr && arr.length) {
              src += '|' + arrayToRegAlternates(arr);
            }
            loc.parsingTokens[name] = src;
          });
        }

        function getNumeralSrc() {
          var all, src = '';
          all = loc.numerals.concat(loc.placeholders).concat(loc.articles);
          if (loc.allowsFullWidth) {
            all = all.concat(fullWidthNumbers.split(''));
          }
          if (all.length) {
            src = '|(?:' + arrayToRegAlternates(all) + ')+';
          }
          return src;
        }

        function buildTimeSuffixes() {
          iterateOverDateUnits(function(unit, i) {
            var token = loc.timeSuffixes[i];
            if (token) {
              loc[(unit.alias || unit.name) + 'Suffix'] = token;
            }
          });
        }

        function buildModifiers() {
          forEach(loc.modifiers, function(modifier) {
            var name = modifier.name, mapKey = name + 'Map', map;
            map = loc[mapKey] || {};
            forEachAlternate(modifier.src, function(alt, j) {
              var token = getOwn(loc.parsingTokens, name), val = modifier.value;
              map[alt] = val;
              loc.parsingTokens[name] = token ? token + '|' + alt : alt;
              if (modifier.name === 'sign' && j === 0) {
                // Hooking in here to set the first "fromNow" or "ago" modifier
                // directly on the locale, so that it can be reused in the
                // relative format.
                loc[val === 1 ? 'fromNow' : 'ago'] = alt;
              }
            });
            loc[mapKey] = map;
          });
        }

        // -- Format adding helpers

        function addCoreFormats() {
          forEach(CoreParsingFormats, function(df) {
            var src = df.src;
            if (df.mdy && loc.mdy) {
              // Use the mm/dd/yyyy variant if it
              // exists and the locale requires it
              src = df.mdy;
            }
            if (df.time) {
              // Core formats that allow time require the time
              // reg on both sides, so add both versions here.
              loc.addFormat(getFormatWithTime(src, true));
              loc.addFormat(getFormatWithTime(src));
            } else {
              loc.addFormat(src);
            }
          });
          loc.addFormat('{time}');
        }

        function addLocaleFormats() {
          addFormatSet('parse');
          addFormatSet('timeParse', true);
          addFormatSet('timeFrontParse', true, true);
        }

        function addFormatSet(field, allowTime, timeFront) {
          forEach(loc[field], function(format) {
            if (allowTime) {
              format = getFormatWithTime(format, timeFront);
            }
            loc.addFormat(format);
          });
        }

        function getFormatWithTime(baseFormat, timeBefore) {
          if (timeBefore) {
            return getTimeBefore() + baseFormat;
          }
          return baseFormat + getTimeAfter();
        }

        function getTimeBefore() {
          return getRegNonCapturing('{time}[,\\s\\u3000]', true);
        }

        function getTimeAfter() {
          var markers = ',?[\\s\\u3000]', localized;
          localized = arrayToRegAlternates(loc.timeMarkers);
          if (localized) {
            markers += '| (?:' + localized + ') ';
          }
          markers = getRegNonCapturing(markers, loc.timeMarkerOptional);
          return getRegNonCapturing(markers + '{time}', true);
        }

        initFormats();
        initDefinition();
        initArrayFields();

        buildValueArray('month', 12);
        buildValueArray('weekday', 7);
        buildValueArray('unit', 8);
        buildValueArray('ampm', 2);

        buildNumerals();
        buildTimeFormats();
        buildParsingTokens();
        buildTimeSuffixes();
        buildModifiers();

        // The order of these formats is important. Order is reversed so formats
        // that are initialized later will take precedence. Generally, this means
        // that more specific formats should come later.
        addCoreFormats();
        addLocaleFormats();

      }

    };

    return new Locale(def);
  }

  /***
   * @method [units]Since(d, [options])
   * @returns Number
   * @short Returns the time since [d].
   * @extra [d] will accept a date object, timestamp, or string. If not specified,
   *        [d] is assumed to be now. `unitsAgo` is provided as an alias to make
   *        this more readable when [d] is assumed to be the current date.
   *        [options] can be an object or a locale code as a string. See `create`
   *        for more.
   *
   * @set
   *   millisecondsSince
   *   secondsSince
   *   minutesSince
   *   hoursSince
   *   daysSince
   *   weeksSince
   *   monthsSince
   *   yearsSince
   *
   * @example
   *
   *   new Date().millisecondsSince('1 hour ago') -> 3,600,000
   *   new Date().daysSince('1 week ago')         -> 7
   *   new Date().yearsSince('15 years ago')      -> 15
   *   lastYear.yearsAgo()                 -> 1
   *
   * @param {string|number|Date} d
   * @param {DateCreateOptions} options
   *
   ***
   * @method [units]Ago()
   * @returns Number
   * @short Returns the time ago in the appropriate unit.
   *
   * @set
   *   millisecondsAgo
   *   secondsAgo
   *   minutesAgo
   *   hoursAgo
   *   daysAgo
   *   weeksAgo
   *   monthsAgo
   *   yearsAgo
   *
   * @example
   *
   *   lastYear.millisecondsAgo() -> 3,600,000
   *   lastYear.daysAgo()         -> 7
   *   lastYear.yearsAgo()        -> 15
   *
   ***
   * @method [units]Until([d], [options])
   * @returns Number
   * @short Returns the time until [d].
   * @extra [d] will accept a date object, timestamp, or string. If not specified,
   *        [d] is assumed to be now. `unitsFromNow` is provided as an alias to
   *        make this more readable when [d] is assumed to be the current date.
   *        [options] can be an object or a locale code as a string. See `create`
   *        for more.
   *
   *
   * @set
   *   millisecondsUntil
   *   secondsUntil
   *   minutesUntil
   *   hoursUntil
   *   daysUntil
   *   weeksUntil
   *   monthsUntil
   *   yearsUntil
   *
   * @example
   *
   *   new Date().millisecondsUntil('1 hour from now') -> 3,600,000
   *   new Date().daysUntil('1 week from now')         -> 7
   *   new Date().yearsUntil('15 years from now')      -> 15
   *   nextYear.yearsFromNow()                  -> 1
   *
   * @param {string|number|Date} d
   * @param {DateCreateOptions} options
   *
   ***
   * @method [units]FromNow()
   * @returns Number
   * @short Returns the time from now in the appropriate unit.
   *
   * @set
   *   millisecondsFromNow
   *   secondsFromNow
   *   minutesFromNow
   *   hoursFromNow
   *   daysFromNow
   *   weeksFromNow
   *   monthsFromNow
   *   yearsFromNow
   *
   * @example
   *
   *   nextYear.millisecondsFromNow() -> 3,600,000
   *   nextYear.daysFromNow()         -> 7
   *   nextYear.yearsFromNow()        -> 15
   *
   ***
   * @method add[Units](n, [reset] = false)
   * @returns Date
   * @short Adds `n` units to the date. If [reset] is true, all lower units will
   *        be reset.
   * @extra This method modifies the date! Note that in the case of `addMonths`,
   *        the date may fall on a date that doesn't exist (i.e. February 30). In
   *        this case the date will be shifted to the last day of the month. Don't
   *        use `addMonths` if you need precision.
   *
   * @set
   *   addMilliseconds
   *   addSeconds
   *   addMinutes
   *   addHours
   *   addDays
   *   addWeeks
   *   addMonths
   *   addYears
   *
   * @example
   *
   *   new Date().addYears(5)        -> current time + 5 years
   *   new Date().addDays(5)         -> current time + 5 days
   *   new Date().addDays(5, true)   -> current time + 5 days (time reset)
   *
   * @param {number} n
   * @param {boolean} [reset]
   *
   ***
   * @method isLast[Unit]([localeCode])
   * @returns Boolean
   * @short Returns true if the date is last week, month, or year.
   * @extra This method takes an optional locale code for `isLastWeek`, which is
   *        locale dependent. The default locale code is `en`, which places
   *        Sunday at the beginning of the week. You can pass `en-GB` as a quick
   *        way to force Monday as the beginning of the week.
   *
   * @set
   *   isLastWeek
   *   isLastMonth
   *   isLastYear
   *
   * @example
   *
   *   yesterday.isLastWeek()  -> true or false?
   *   yesterday.isLastMonth() -> probably not...
   *   yesterday.isLastYear()  -> even less likely...
   *
   * @param {string} [localeCode]
   *
   ***
   * @method isThis[Unit]([localeCode])
   * @returns Boolean
   * @short Returns true if the date is this week, month, or year.
   * @extra This method takes an optional locale code for `isThisWeek`, which is
   *        locale dependent. The default locale code is `en`, which places
   *        Sunday at the beginning of the week. You can pass `en-GB` as a quick
   *        way to force Monday as the beginning of the week.
   *
   * @set
   *   isThisWeek
   *   isThisMonth
   *   isThisYear
   *
   * @example
   *
   *   tomorrow.isThisWeek()  -> true or false?
   *   tomorrow.isThisMonth() -> probably...
   *   tomorrow.isThisYear()  -> signs point to yes...
   *
   * @param {string} [localeCode]
   *
   ***
   * @method isNext[Unit]([localeCode])
   * @returns Boolean
   * @short Returns true if the date is next week, month, or year.
   * @extra This method takes an optional locale code for `isNextWeek`, which is
   *        locale dependent. The default locale code is `en`, which places
   *        Sunday at the beginning of the week. You can pass `en-GB` as a quick
   *        way to force Monday as the beginning of the week.
   *
   * @set
   *   isNextWeek
   *   isNextMonth
   *   isNextYear
   *
   * @example
   *
   *   tomorrow.isNextWeek()  -> true or false?
   *   tomorrow.isNextMonth() -> probably not...
   *   tomorrow.isNextYear()  -> even less likely...
   *
   * @param {string} [localeCode]
   *
   ***
   * @method beginningOf[Unit]([localeCode])
   * @returns Date
   * @short Sets the date to the beginning of the appropriate unit.
   * @extra This method modifies the date! A locale code can be passed for
   *        `beginningOfWeek`, which is locale dependent. If consistency is
   *        needed, use `beginningOfISOWeek` instead.
   *
   * @set
   *   beginningOfDay
   *   beginningOfWeek
   *   beginningOfMonth
   *   beginningOfYear
   *
   * @example
   *
   *   new Date().beginningOfDay()   -> the beginning of today (resets the time)
   *   new Date().beginningOfWeek()  -> the beginning of the week
   *   new Date().beginningOfMonth() -> the beginning of the month
   *   new Date().beginningOfYear()  -> the beginning of the year
   *
   * @param {string} [localeCode]
   *
   ***
   * @method endOf[Unit]([localeCode])
   * @returns Date
   * @short Sets the date to the end of the appropriate unit.
   * @extra This method modifies the date! A locale code can be passed for
   *        `endOfWeek`, which is locale dependent. If consistency is needed, use
   *        `endOfISOWeek` instead.
   *
   * @set
   *   endOfDay
   *   endOfWeek
   *   endOfMonth
   *   endOfYear
   *
   * @example
   *
   *   new Date().endOfDay()   -> the end of today (sets the time to 23:59:59.999)
   *   new Date().endOfWeek()  -> the end of the week
   *   new Date().endOfMonth() -> the end of the month
   *   new Date().endOfYear()  -> the end of the year
   *
   * @param {string} [localeCode]
   *
   ***/
  function buildDateUnitMethods() {

    defineInstanceSimilar(sugarDate, DateUnits, function(methods, unit, index) {
      var name = unit.name, caps = simpleCapitalize(name);

      if (index > DAY_INDEX) {
        forEach(['Last','This','Next'], function(shift) {
          methods['is' + shift + caps] = function(d, localeCode) {
            return compareDate(d, shift + ' ' + name, 0, localeCode, { locale: 'en' });
          };
        });
      }
      if (index > HOURS_INDEX) {
        methods['beginningOf' + caps] = function(d, localeCode) {
          return moveToBeginningOfUnit(d, index, localeCode);
        };
        methods['endOf' + caps] = function(d, localeCode) {
          return moveToEndOfUnit(d, index, localeCode);
        };
      }

      methods['add' + caps + 's'] = function(d, num, reset) {
        return advanceDate(d, name, num, reset);
      };

      var since = function(date, d, options) {
        return getTimeDistanceForUnit(date, createDateWithContext(date, d, options, true), unit);
      };
      var until = function(date, d, options) {
        return getTimeDistanceForUnit(createDateWithContext(date, d, options, true), date, unit);
      };

      methods[name + 'sAgo']   = methods[name + 'sUntil']   = until;
      methods[name + 'sSince'] = methods[name + 'sFromNow'] = since;

    });

  }

  /***
   * @method is[Day]()
   * @returns Boolean
   * @short Returns true if the date falls on the specified day.
   *
   * @set
   *   isToday
   *   isYesterday
   *   isTomorrow
   *   isWeekday
   *   isWeekend
   *   isSunday
   *   isMonday
   *   isTuesday
   *   isWednesday
   *   isThursday
   *   isFriday
   *   isSaturday
   *
   * @example
   *
   *   tomorrow.isToday() -> false
   *   thursday.isTomorrow() -> ?
   *   yesterday.isWednesday() -> ?
   *   today.isWeekend() -> ?
   *
   ***
   * @method isFuture()
   * @returns Boolean
   * @short Returns true if the date is in the future.
   *
   * @example
   *
   *   lastWeek.isFuture() -> false
   *   nextWeek.isFuture() -> true
   *
   ***
   * @method isPast()
   * @returns Boolean
   * @short Returns true if the date is in the past.
   *
   * @example
   *
   *   lastWeek.isPast() -> true
   *   nextWeek.isPast() -> false
   *
   ***/
  function buildRelativeAliases() {
    var special  = spaceSplit('Today Yesterday Tomorrow Weekday Weekend Future Past');
    var weekdays = English.weekdays.slice(0, 7);
    var months   = English.months.slice(0, 12);
    var together = special.concat(weekdays).concat(months);
    defineInstanceSimilar(sugarDate, together, function(methods, name) {
      methods['is'+ name] = function(d) {
        return fullCompareDate(d, name);
      };
    });
  }

  defineStatic(sugarDate, {

    /***
     * @method create(d, [options])
     * @returns Date
     * @static
     * @short Alternate date constructor which accepts text formats, a timestamp,
     *        objects, or another date.
     * @extra If no argument is given, the date is assumed to be now. The second
     *        argument can either be an options object or a locale code as a
     *        shortcut. For more, see `date parsing`.
     *
     * @options
     *
     *   locale     A locale code to parse the date in. This can also be passed as
     *              the second argument to this method. Default is the current
     *              locale, which is `en` if none is set.
     *
     *   past       If `true`, ambiguous dates like `Sunday` will be parsed as
     *              `last Sunday`. Note that non-ambiguous dates are not
     *              guaranteed to be in the past.
     *              Default is `false`.
     *
     *   future     If `true`, ambiguous dates like `Sunday` will be parsed as
     *              `next Sunday`. Note that non-ambiguous dates are not
     *              guaranteed to be in the future.
     *              Default is `false`.
     *
     *   fromUTC    If `true`, dates with no timezone notation will be parsed as
     *              UTC (no timezone offset). This is useful for server
     *              timestamps, etc. Note that this flag is not required if the
     *              timezone is specified in the string, either as an explicit
     *              value (ex. +0900 or -09:00) or "Z", which is UTC time.
     *
     *   setUTC     If `true`, this will set a flag on the date that tells Sugar
     *              to internally use UTC methods like `getUTCHours` when handling
     *              it. This flag is the same as calling the `setUTC` method on
     *              the date after parsing is complete. Note that this is
     *              different from `fromUTC`, which parses a string as UTC, but
     *              does not set this flag.
     *
     *   clone      If `true` and `d` is a date, it will be cloned.
     *
     *   params     An optional object that is populated with properties that are
     *              parsed from string input. This option is useful when parsed
     *              properties need to be retained.
     *
     * @example
     *
     *   Date.create('July')                      -> July of this year
     *   Date.create('1776')                      -> 1776
     *   Date.create('today')                     -> today
     *   Date.create('Wednesday')                 -> This wednesday
     *   Date.create('next Friday')               -> Next friday
     *   Date.create('July 4, 1776')              -> July 4, 1776
     *   Date.create(-446806800000)               -> November 5, 1955
     *   Date.create('1776年07月04日', 'ja')      -> July 4, 1776
     *   Date.create('August', {past: true})      -> August of this or last year
     *   Date.create('August', {future: true})    -> August of this or next year
     *   Date.create('Thursday', {fromUTC: true}) -> Thursday at 12:00am UTC time
     *
     * @param {string|number|Date} d
     * @param {DateCreateOptions} [options]
     *
     * @option {string} [locale]
     * @option {boolean} [past]
     * @option {boolean} [future]
     * @option {boolean} [fromUTC]
     * @option {boolean} [setUTC]
     * @option {boolean} [clone]
     * @option {Object} [params]
     *
     ***/
    'create': function(d, options) {
      return createDate(d, options);
    },

    /***
     * @method getLocale([localeCode] = current)
     * @returns Locale
     * @static
     * @short Gets the locale object for the given code, or the current locale.
     * @extra The locale object has various properties that dictate how dates are
     *        parsed and formatted for that locale. The locale object is exposed
     *        here mostly for introspection - it should be uncommon to need to
     *        maniplate the object itself. For more, see `date locales`.
     *
     * @example
     *
     *   Date.getLocale()     -> Returns the current locale
     *   Date.getLocale('en') -> Returns the EN locale
     *
     * @param {string} [localeCode]
     *
     ***/
    'getLocale': function(code) {
      return localeManager.get(code, !code);
    },

    /***
     * @method getAllLocales()
     * @returns Array<Locale>
     * @static
     * @short Returns all available locales as an object.
     * @extra For more, see `date locales`.
     * @example
     *
     *   Date.getAllLocales()
     *
     ***/
    'getAllLocales': function() {
      return localeManager.getAll();
    },

    /***
     * @method getAllLocaleCodes()
     * @returns string[]
     * @static
     * @short Returns all available locale codes as an array of strings.
     * @extra For more, see `date locales`.
     * @example
     *
     *   Date.getAllLocaleCodes()
     *
     ***/
    'getAllLocaleCodes': function() {
      return getKeys(localeManager.getAll());
    },

    /***
     * @method setLocale(localeCode)
     * @returns Locale
     * @static
     * @short Sets the current locale to be used with dates.
     * @extra Sugar has native support for 17 major locales. In addition, you can
     *        define a new locale with `addLocale`. For more, see `date locales`.
     * @example
     *
     *   Date.setLocale('en')
     *
     * @param {string} localeCode
     *
     ***/
    'setLocale': function(code) {
      return localeManager.set(code);
    },

    /***
     * @method addLocale(localeCode, def)
     * @returns Locale
     * @static
     * @short Adds a locale definition to the locales understood by Sugar.
     * @extra This method should only be required for adding locale definitions
     *        that don't already exist. For more, see `date locales`.
     * @example
     *
     *   Date.addLocale('eo', {})
     *
     * @param {string} localeCode
     * @param {Object} def
     *
     ***/
    'addLocale': function(code, set) {
      return localeManager.add(code, set);
    },

    /***
     * @method removeLocale(localeCode)
     * @returns Locale
     * @static
     * @short Deletes the the locale by `localeCode` from Sugar's known locales.
     * @extra For more, see `date locales`.
     * @example
     *
     *   Date.removeLocale('foo')
     *
     * @param {string} localeCode
     *
     ***/
    'removeLocale': function(code) {
      return localeManager.remove(code);
    }

  });

  defineInstanceWithArguments(sugarDate, {

    /***
     * @method set(set, [reset] = false)
     * @returns Date
     * @short Sets the date object.
     * @extra This method accepts multiple formats including a single number as
     *        a timestamp, an object, or enumerated arguments. If [reset] is
     *        `true`, any units more specific than those passed will be reset.
     *
     * @example
     *
     *   new Date().set({year:2011,month:11,day:31}) -> December 31, 2011
     *   new Date().set(2011, 11, 31)                -> December 31, 2011
     *   new Date().set(86400000)                    -> 1 day after Jan 1, 1970
     *   new Date().set({year:2004,month:6}, true)   -> June 1, 2004, 00:00:00.000
     *
     * @signature set(milliseconds)
     * @signature set(year, month, [day], [hour], [minute], [second], [millliseconds])
     * @param {Object} set
     * @param {boolean} [reset]
     * @param {number} year
     * @param {number} month
     * @param {number} [day]
     * @param {number} [hour]
     * @param {number} [minute]
     * @param {number} [second]
     * @param {number} [milliseconds]
     *
     ***/
    'set': function(d, args) {
      args = collectDateArguments(args);
      return updateDate(d, args[0], args[1]);
    },

    /***
     * @method advance(set, [reset] = false)
     * @returns Date
     * @short Shifts the date forward.
     * @extra `set` accepts multiple formats including an object, a string in the
     *        format "3 days", a single number as milliseconds, or enumerated
     *        parameters (as with the Date constructor). If [reset] is `true`, any
     *        units more specific than those passed will be reset. This method
     *        modifies the date!
     *
     * @example
     *
     *   new Date().advance({ year: 2 }) -> 2 years in the future
     *   new Date().advance('2 hours')   -> 2 hours in the future
     *   new Date().advance(0, 2, 3)     -> 2 months 3 days in the future
     *   new Date().advance(86400000)    -> 1 day in the future
     *
     * @signature advance(milliseconds)
     * @signature advance(year, month, [day], [hour], [minute], [second], [millliseconds])
     * @param {string|Object} set
     * @param {boolean} [reset]
     * @param {number} year
     * @param {number} month
     * @param {number} [day]
     * @param {number} [hour]
     * @param {number} [minute]
     * @param {number} [second]
     * @param {number} [milliseconds]
     *
     ***/
    'advance': function(d, args) {
      return advanceDateWithArgs(d, args, 1);
    },

    /***
     * @method rewind(set, [reset] = false)
     * @returns Date
     * @short Shifts the date backward.
     * @extra [set] accepts multiple formats including an object, a string in the
     *        format "3 days", a single number as milliseconds, or enumerated
     *        parameters (as with the Date constructor). If [reset] is `true`, any
     *        units more specific than those passed will be reset. This method
     *        modifies the date!
     *
     * @example
     *
     *   new Date().rewind({ year: 2 }) -> 2 years in the past
     *   new Date().rewind('2 weeks')   -> 2 weeks in the past
     *   new Date().rewind(0, 2, 3)     -> 2 months 3 days in the past
     *   new Date().rewind(86400000)    -> 1 day in the past
     *
     * @signature advance(milliseconds)
     * @signature advance(year, month, [day], [hour], [minute], [second], [millliseconds])
     * @param {string|Object} set
     * @param {boolean} [reset]
     * @param {number} year
     * @param {number} month
     * @param {number} [day]
     * @param {number} [hour]
     * @param {number} [minute]
     * @param {number} [second]
     * @param {number} [milliseconds]
     *
     ***/
    'rewind': function(d, args) {
      return advanceDateWithArgs(d, args, -1);
    }

  });

  defineInstance(sugarDate, {

    /***
     * @method get(d, [options])
     * @returns Date
     * @short Gets a new date using the current one as a starting point.
     * @extra This method is identical to `Date.create`, except that relative
     *        formats like `next month` are relative to the date instance rather
     *        than the current date. Accepts a locale code as a string in place
     *        of [options]. See `create` for more.
     *
     * @example
     *
     *   nextYear.get('monday') -> monday of the week exactly 1 year from now
     *   millenium.get('2 years before') -> 2 years before Jan 1, 2000.
     *
     * @param {string|number|Date} d
     * @param {DateCreateOptions} options
     *
     ***/
    'get': function(date, d, options) {
      return createDateWithContext(date, d, options);
    },

    /***
     * @method setWeekday(dow)
     * @short Sets the weekday of the date, starting with Sunday at `0`.
     * @extra This method modifies the date!
     *
     * @example
     *
     *   d = new Date(); d.setWeekday(1); d; -> Monday of this week
     *   d = new Date(); d.setWeekday(6); d; -> Saturday of this week
     *
     * @param {number} dow
     *
     ***/
    'setWeekday': function(date, dow) {
      return setWeekday(date, dow);
    },

    /***
     * @method setISOWeek(num)
     * @short Sets the week (of the year) as defined by the ISO8601 standard.
     * @extra Note that this standard places Sunday at the end of the week (day 7).
     *        This method modifies the date!
     *
     * @example
     *
     *   d = new Date(); d.setISOWeek(15); d; -> 15th week of the year
     *
     * @param {number} num
     *
     ***/
    'setISOWeek': function(date, num) {
      return setISOWeekNumber(date, num);
    },

    /***
     * @method getISOWeek()
     * @returns Number
     * @short Gets the date's week (of the year) as defined by the ISO8601 standard.
     * @extra Note that this standard places Sunday at the end of the week (day 7).
     *        If `utc` is set on the date, the week will be according to UTC time.
     *
     * @example
     *
     *   new Date().getISOWeek() -> today's week of the year
     *
     ***/
    'getISOWeek': function(date) {
      return getWeekNumber(date, true);
    },

    /***
     * @method beginningOfISOWeek()
     * @returns Date
     * @short Set the date to the beginning of week as defined by ISO8601.
     * @extra Note that this standard places Monday at the start of the week.
     *        This method modifies the date!
     *
     * @example
     *
     *   new Date().beginningOfISOWeek() -> Monday
     *
     ***/
    'beginningOfISOWeek': function(date) {
      var day = getWeekday(date);
      if (day === 0) {
        day = -6;
      } else if (day !== 1) {
        day = 1;
      }
      setWeekday(date, day);
      return resetTime(date);
    },

    /***
     * @method endOfISOWeek()
     * @returns Date
     * @short Set the date to the end of week as defined by this ISO8601 standard.
     * @extra Note that this standard places Sunday at the end of the week.
     *        This method modifies the date!
     *
     * @example
     *
     *   new Date().endOfISOWeek() -> Sunday
     *
     ***/
    'endOfISOWeek': function(date) {
      if (getWeekday(date) !== 0) {
        setWeekday(date, 7);
      }
      return moveToEndOfUnit(date, DAY_INDEX);
    },

    /***
     * @method getUTCOffset([iso] = false)
     * @returns String
     * @short Returns a string representation of the offset from UTC time. If [iso]
     *        is true the offset will be in ISO8601 format.
     *
     * @example
     *
     *   new Date().getUTCOffset()     -> "+0900"
     *   new Date().getUTCOffset(true) -> "+09:00"
     *
     * @param {boolean} iso
     *
     ***/
    'getUTCOffset': function(date, iso) {
      return getUTCOffset(date, iso);
    },

    /***
     * @method setUTC([on] = false)
     * @returns Date
     * @short Controls a flag on the date that tells Sugar to internally use UTC
     *        methods like `getUTCHours`.
     * @extra This flag is most commonly used for output in UTC time with the
     *        `format` method. Note that this flag only governs which methods are
     *        called internally – date native methods like `setHours` will still
     *        return local non-UTC values. This method will modify the date!
     *
     * @example
     *
     *   new Date().setUTC(true).long()  -> formatted with UTC methods
     *   new Date().setUTC(false).long() -> formatted without UTC methods
     *
     * @param {boolean} on
     *
     ***/
    'setUTC': function(date, on) {
      return _utc(date, on);
    },

    /***
     * @method isUTC()
     * @returns Boolean
     * @short Returns true if the date has no timezone offset.
     * @extra This will also return true for dates whose internal utc flag is set
     *        with `setUTC`. Even if the utc flag is set, `getTimezoneOffset`
     *        will always report the same thing as Javascript always reports that
     *        based on the environment's locale.
     *
     * @example
     *
     *   new Date().isUTC() -> true or false (depends on the local offset)
     *   new Date().setUTC(true).isUTC() -> true
     *
     ***/
    'isUTC': function(date) {
      return isUTC(date);
    },

    /***
     * @method isValid()
     * @returns Boolean
     * @short Returns true if the date is valid.
     *
     * @example
     *
     *   new Date().isValid()         -> true
     *   new Date('flexor').isValid() -> false
     *
     ***/
    'isValid': function(date) {
      return dateIsValid(date);
    },

    /***
     * @method isAfter(d, [margin] = 0)
     * @returns Boolean
     * @short Returns true if the date is after `d`.
     * @extra [margin] is to allow extra margin of error in ms. `d` will accept
     *        a date object, timestamp, or string. If not specified, `d` is
     *        assumed to be now. See `create` for formats.
     *
     * @example
     *
     *   today.isAfter('tomorrow')  -> false
     *   today.isAfter('yesterday') -> true
     *
     * @param {string|number|Date} d
     * @param {number} [margin]
     *
     ***/
    'isAfter': function(date, d, margin) {
      return date.getTime() > createDate(d).getTime() - (margin || 0);
    },

    /***
     * @method isBefore(d, [margin] = 0)
     * @returns Boolean
     * @short Returns true if the date is before `d`.
     * @extra [margin] is to allow extra margin of error in ms. `d` will accept
     *        a date object, timestamp, or text format. If not specified, `d` is
     *        assumed to be now. See `create` for formats.
     *
     * @example
     *
     *   today.isBefore('tomorrow')  -> true
     *   today.isBefore('yesterday') -> false
     *
     * @param {string|number|Date} d
     * @param {number} [margin]
     *
     ***/
    'isBefore': function(date, d, margin) {
      return date.getTime() < createDate(d).getTime() + (margin || 0);
    },

    /***
     * @method isBetween(d1, d2, [margin] = 0)
     * @returns Boolean
     * @short Returns true if the date is later or equal to `d1` and before or
     *        equal to `d2`.
     * @extra [margin] is to allow extra margin of error in ms. `d1` and `d2` will
     *        accept a date object, timestamp, or text format. If not specified,
     *        they are assumed to be now.  See `create` for formats.
     *
     * @example
     *
     *   new Date().isBetween('yesterday', 'tomorrow')    -> true
     *   new Date().isBetween('last year', '2 years ago') -> false
     *
     * @param {string|number|Date} d1
     * @param {string|number|Date} d2
     * @param {number} [margin]
     *
     ***/
    'isBetween': function(date, d1, d2, margin) {
      var t  = date.getTime();
      var t1 = createDate(d1).getTime();
      var t2 = createDate(d2).getTime();
      var lo = min(t1, t2);
      var hi = max(t1, t2);
      margin = margin || 0;
      return (lo - margin <= t) && (hi + margin >= t);
    },

    /***
     * @method isLeapYear()
     * @returns Boolean
     * @short Returns true if the date is a leap year.
     *
     * @example
     *
     *   millenium.isLeapYear() -> true
     *
     ***/
    'isLeapYear': function(date) {
      var year = getYear(date);
      return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    },

    /***
     * @method daysInMonth()
     * @returns Number
     * @short Returns the number of days in the date's month.
     *
     * @example
     *
     *   may.daysInMonth() -> 31
     *   feb.daysInMonth() -> 28 or 29
     *
     ***/
    'daysInMonth': function(date) {
      return getDaysInMonth(date);
    },

    /***
     * @method format([f], [localeCode] = currentLocaleCode)
     * @returns String
     * @short Returns the date as a string using the format `f`.
     * @extra `f` is a string that contains tokens in either LDML format using
     *        curly braces, or "strftime" format using a percent sign. If `f` is
     *        not specified, the locale specific `{long}` format is used. [localeCode]
     *        is a locale code to use (if not specified the current locale is
     *        used). For more, see `date formatting`.
     *
     * @example
     *
     *   new Date().format()                        -> ex. February 13, 2012 11:21 AM
     *   new Date().format('{Weekday} {d} {Month}') -> ex. Monday July 4
     *   new Date().format('{hh}:{mm}')             -> ex. 15:57
     *   new Date().format('%H:%M')                 -> ex. 15:57
     *   new Date().format('{12hr}:{mm}{tt}')       -> ex. 3:57pm
     *   new Date().format('ISO8601')               -> ex. 2011-07-05 12:24:55.528Z
     *   new Date().format('{Weekday}', 'ja')       -> ex. 先週
     *
     * @param {string} f
     * @param {string} [localeCode]
     *
     ***
     * @method short([localeCode] = currentLocaleCode)
     * @returns String
     * @short Outputs the date in the short format for the current locale.
     * @extra [localeCode] overrides the current locale code if passed.
     *
     * @example
     *
     *   new Date().short()     -> ex. 02/13/2016
     *   new Date().short('fi') -> ex. 13.2.2016
     *
     * @param {string} [localeCode]
     *
     ***
     * @method medium([localeCode] = currentLocaleCode)
     * @returns String
     * @short Outputs the date in the medium format for the current locale.
     * @extra [localeCode] overrides the current locale code if passed.
     *
     * @example
     *
     *   new Date().medium()     -> ex. February 13, 2016
     *   new Date().medium('ja') -> ex. 2016年2月13日
     *
     * @param {string} [localeCode]
     *
     ***
     * @method long([localeCode] = currentLocaleCode)
     * @returns String
     * @short Outputs the date in the long format for the current locale.
     * @extra [localeCode] overrides the current locale code if passed.
     *
     * @example
     *
     *   new Date().long()     -> ex. February 13, 2016 6:22 PM
     *   new Date().long('es') -> ex. 13 de febrero de 2016 18:22
     *
     * @param {string} [localeCode]
     *
     ***
     * @method full([localeCode] = currentLocaleCode)
     * @returns String
     * @short Outputs the date in the full format for the current locale.
     * @extra [localeCode] overrides the current locale code if passed.
     *
     * @example
     *
     *   new Date().full()     -> ex. Saturday, February 13, 2016 6:23 PM
     *   new Date().full('ru') -> ex. суббота, 13 февраля 2016 г., 18:23
     *
     * @param {string} [localeCode]
     *
     ***/
    'format': function(date, f, localeCode) {
      return dateFormat(date, f, localeCode);
    },

    /***
     * @method relative([localeCode] = currentLocaleCode, [relativeFn])
     * @returns String
     * @short Returns the date in a text format relative to the current time,
     *        such as "5 minutes ago".
     * @extra [relativeFn] is a function that can be passed to provide more granular
     *        control over the resulting string. Its return value will be passed
     *        to `format`. If nothing is returned, the relative format will be
     *        used. [relativeFn] can be passed as the first argument in place of
     *        [locale]. For more about formats, see `date formatting`.
     *
     * @callback relativeFn
     *
     *   num   The offset number in `unit`.
     *   unit  A numeric representation of the unit that `num` is in, starting at
     *         0 for ms.
     *   ms    The absolute offset in milliseconds.
     *   loc   The locale object, either specified by [locale] or default.
     *
     * @example
     *
     *   hourAgo.relative() -> 1 hour ago
     *   jan.relative()     -> ex. 5 months ago
     *   jan.relative('ja') -> 3ヶ月前
     *   jan.relative(function(num, unit, ms, loc) {
     *     // Return an absolute date for anything over 6 months.
     *     if(unit == 6 && num > 6 || unit > 6) {
     *       return '{Month} {d}, {yyyy}';
     *     }
     *   }); -> ex. 5 months ago
     *
     * @signature relative([relativeFn])
     * @param {string} [localeCode]
     * @param {relativeFn} [relativeFn]
     * @callbackParam {number} num
     * @callbackParam {number} unit
     * @callbackParam {number} ms
     * @callbackParam {Locale} loc
     * @callbackReturns {string} relativeFn
     *
     ***/
    'relative': function(date, localeCode, relativeFn) {
      return dateRelative(date, null, localeCode, relativeFn);
    },

    /***
     * @method relativeTo(d, [localeCode] = currentLocaleCode)
     * @returns String
     * @short Returns the date in a text format relative to `d`, such as
     *        "5 minutes".
     * @extra `d` will accept a date object, timestamp, or string. [localeCode]
     *        applies to the method output, not `d`.
     *
     * @example
     *
     *   jan.relativeTo(jul)                 -> 5 months
     *   yesterday.relativeTo('today', 'ja') -> 一日
     *
     * @param {string|number|Date} d
     * @param {string} localeCode
     *
     *
     ***/
    'relativeTo': function(date, d, localeCode) {
      return dateRelative(date, createDate(d), localeCode);
    },

    /***
     * @method is(d, [margin] = 0)
     * @returns Boolean
     * @short Returns true if the date matches `d`.
     * @extra `d` will accept a date object, timestamp, or text format. In the
     *        case of objects and text formats, `is` will additionally compare
     *        based on the precision implied in the input. In the case of text
     *        formats `d` will use the currently set locale. [margin] allows an
     *        extra margin of error in milliseconds. See `create` for formats.
     *
     * @example
     *
     *   new Date().is('July')               -> true or false?
     *   new Date().is('1776')               -> false
     *   new Date().is('today')              -> true
     *   new Date().is('weekday')            -> true or false?
     *   new Date().is('July 4, 1776')       -> false
     *   new Date().is(-6106093200000)       -> false
     *   new Date().is(new Date(1776, 6, 4)) -> false
     *
     * @param {string|number|Date} d
     * @param {number} [margin]
     *
     ***/
    'is': function(date, d, margin) {
      return fullCompareDate(date, d, margin);
    },

    /***
     * @method reset([unit] = 'day', [localeCode] = currentLocaleCode)
     * @returns Date
     * @short Resets the date to the beginning of [unit].
     * @extra This method effectively resets all smaller units, pushing the date
     *        to the beginning of [unit]. Default is `day`, which effectively
     *        resets the time. [localeCode] is provided for resetting weeks, which
     *        is locale dependent. This method modifies the date!
     *
     * @example
     *
     *   new Date().reset('day')   -> Beginning of the day
     *   new Date().reset('month') -> Beginning of the month
     *
     * @param {string} [unit]
     * @param {string} [localeCode]
     *
     ***/
    'reset': function(date, unit, localeCode) {
      var unitIndex = unit ? getUnitIndexForParamName(unit) : DAY_INDEX;
      moveToBeginningOfUnit(date, unitIndex, localeCode);
      return date;
    },

    /***
     * @method clone()
     * @returns Date
     * @short Clones the date.
     * @extra Note that the UTC flag will be preserved if set. This flag is
     *        set via the `setUTC` method or an option on `Date.create`.
     *
     * @example
     *
     *   new Date().clone() -> Copy of now
     *
     ***/
    'clone': function(date) {
      return cloneDate(date);
    },

    /***
     * @method iso()
     * @alias toISOString
     *
     ***/
    'iso': function(date) {
      return date.toISOString();
    },

    /***
     * @method getWeekday()
     * @returns Number
     * @short Alias for `getDay`.
     *
     * @example
     *
     *   new Date().getWeekday();    -> (ex.) 3
     *
     ***/
    'getWeekday': function(date) {
      return getWeekday(date);
    },

    /***
     * @method getUTCWeekday()
     * @returns Number
     * @short Alias for `getUTCDay`.
     *
     * @example
     *
     *   new Date().getUTCWeekday(); -> (ex.) 3
     *
     ***/
    'getUTCWeekday': function(date) {
      return date.getUTCDay();
    }

  });

  var EnglishLocaleBaseDefinition = {
    'code': 'en',
    'plural': true,
    'timeMarkers': 'at',
    'ampm': 'AM|A.M.|a,PM|P.M.|p',
    'units': 'millisecond:|s,second:|s,minute:|s,hour:|s,day:|s,week:|s,month:|s,year:|s',
    'months': 'Jan:uary|,Feb:ruary|,Mar:ch|,Apr:il|,May,Jun:e|,Jul:y|,Aug:ust|,Sep:tember|t|,Oct:ober|,Nov:ember|,Dec:ember|',
    'weekdays': 'Sun:day|,Mon:day|,Tue:sday|,Wed:nesday|,Thu:rsday|,Fri:day|,Sat:urday|+weekend',
    'numerals': 'zero,one|first,two|second,three|third,four:|th,five|fifth,six:|th,seven:|th,eight:|h,nin:e|th,ten:|th',
    'articles': 'a,an,the',
    'tokens': 'the,st|nd|rd|th,of|in,a|an,on',
    'time': '{H}:{mm}',
    'past': '{num} {unit} {sign}',
    'future': '{num} {unit} {sign}',
    'duration': '{num} {unit}',
    'modifiers': [
      { 'name': 'half',   'src': 'half', 'value': .5 },
      { 'name': 'midday', 'src': 'noon', 'value': 12 },
      { 'name': 'midday', 'src': 'midnight', 'value': 24 },
      { 'name': 'day',    'src': 'yesterday', 'value': -1 },
      { 'name': 'day',    'src': 'today|tonight', 'value': 0 },
      { 'name': 'day',    'src': 'tomorrow', 'value': 1 },
      { 'name': 'sign',   'src': 'ago|before', 'value': -1 },
      { 'name': 'sign',   'src': 'from now|after|from|in|later', 'value': 1 },
      { 'name': 'edge',   'src': 'first day|first|beginning', 'value': -2 },
      { 'name': 'edge',   'src': 'last day', 'value': 1 },
      { 'name': 'edge',   'src': 'end|last', 'value': 2 },
      { 'name': 'shift',  'src': 'last', 'value': -1 },
      { 'name': 'shift',  'src': 'the|this', 'value': 0 },
      { 'name': 'shift',  'src': 'next', 'value': 1 }
    ],
    'parse': [
      '(?:just)? now',
      '{shift} {unit:5-7}',
      "{months?} (?:{year}|'{yy})",
      '{midday} {4?} {day|weekday}',
      '{months},?(?:[-.\\/\\s]{year})?',
      '{edge} of (?:day)? {day|weekday}',
      '{0} {num}{1?} {weekday} {2} {months},? {year?}',
      '{shift?} {day?} {weekday?} {timeMarker?} {midday}',
      '{sign?} {3?} {half} {3?} {unit:3-4|unit:7} {sign?}',
      '{0?} {edge} {weekday?} {2} {shift?} {unit:4-7?} {months?},? {year?}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{shift} {unit:5?} {weekday}',
      '{0?} {date}{1?} {2?} {months?}',
      '{weekday} {2?} {shift} {unit:5}',
      '{0?} {num} {2?} {months}\\.?,? {year?}',
      '{num?} {unit:4-5} {sign} {day|weekday}',
      '{year}[-.\\/\\s]{months}[-.\\/\\s]{date}',
      '{0|months} {date?}{1?} of {shift} {unit:6-7}',
      '{0?} {num}{1?} {weekday} of {shift} {unit:6}',
      "{date}[-.\\/\\s]{months}[-.\\/\\s](?:{year}|'?{yy})",
      "{weekday?}\\.?,? {months}\\.?,? {date}{1?},? (?:{year}|'{yy})?"
    ],
    'timeFrontParse': [
      '{sign} {num} {unit}',
      '{num} {unit} {sign}',
      '{4?} {day|weekday}'
    ]
  };

  var AmericanEnglishDefinition = getEnglishVariant({
    'mdy': true,
    'firstDayOfWeek': 0,
    'firstDayOfWeekYear': 1,
    'short':  '{MM}/{dd}/{yyyy}',
    'medium': '{Month} {d}, {yyyy}',
    'long':   '{Month} {d}, {yyyy} {time}',
    'full':   '{Weekday}, {Month} {d}, {yyyy} {time}',
    'stamp':  '{Dow} {Mon} {d} {yyyy} {time}',
    'time':   '{h}:{mm} {TT}'
  });

  var BritishEnglishDefinition = getEnglishVariant({
    'short':  '{dd}/{MM}/{yyyy}',
    'medium': '{d} {Month} {yyyy}',
    'long':   '{d} {Month} {yyyy} {H}:{mm}',
    'full':   '{Weekday}, {d} {Month}, {yyyy} {time}',
    'stamp':  '{Dow} {d} {Mon} {yyyy} {time}'
  });

  var CanadianEnglishDefinition = getEnglishVariant({
    'short':  '{yyyy}-{MM}-{dd}',
    'medium': '{d} {Month}, {yyyy}',
    'long':   '{d} {Month}, {yyyy} {H}:{mm}',
    'full':   '{Weekday}, {d} {Month}, {yyyy} {time}',
    'stamp':  '{Dow} {d} {Mon} {yyyy} {time}'
  });

  var LazyLoadedLocales = {
    'en-US': AmericanEnglishDefinition,
    'en-GB': BritishEnglishDefinition,
    'en-AU': BritishEnglishDefinition,
    'en-CA': CanadianEnglishDefinition
  };

  buildLocales();

  buildDateFormatTokens();

  buildDateFormatMatcher();

  buildDateUnitMethods();

  buildRelativeAliases();

  setDateChainableConstructor();

  /***
   * @module Range
   * @description Date, Number, and String ranges that can be manipulated and compared,
   *              or enumerate over specific points within the range.
   *
   ***/


  var DURATION_UNITS = 'year|month|week|day|hour|minute|second|millisecond';

  var DURATION_REG   = RegExp('(\\d+)?\\s*('+ DURATION_UNITS +')s?', 'i');

  var MULTIPLIERS = {
    'Hours': 60 * 60 * 1000,
    'Minutes': 60 * 1000,
    'Seconds': 1000,
    'Milliseconds': 1
  };

  function Range(start, end) {
    this.start = cloneRangeMember(start);
    this.end   = cloneRangeMember(end);
  }

  function getRangeMemberPrimitiveValue(m) {
    if (m == null) return m;
    return isDate(m) ? m.getTime() : m.valueOf();
  }

  function cloneRangeMember(m) {
    if (isDate(m)) {
      return new Date(m.getTime());
    } else {
      return getRangeMemberPrimitiveValue(m);
    }
  }

  function getDateIncrementObject(amt) {
    var match, val, unit;
    if (isNumber(amt)) {
      return [amt, 'Milliseconds'];
    }
    match = amt.match(DURATION_REG);
    val = +match[1] || 1;
    unit = simpleCapitalize(match[2].toLowerCase());
    if (unit.match(/hour|minute|second/i)) {
      unit += 's';
    } else if (unit === 'Year') {
      unit = 'FullYear';
    } else if (unit === 'Week') {
      unit = 'Date';
      val *= 7;
    } else if (unit === 'Day') {
      unit = 'Date';
    }
    return [val, unit];
  }

  function incrementDate(src, amount, unit) {
    var mult = MULTIPLIERS[unit], d;
    if (mult) {
      d = new Date(src.getTime() + (amount * mult));
    } else {
      d = new Date(src);
      callDateSet(d, unit, callDateGet(src, unit) + amount);
    }
    return d;
  }

  var FULL_CAPTURED_DURATION = '((?:\\d+)?\\s*(?:' + DURATION_UNITS + '))s?';

  // Duration text formats
  var RANGE_REG_FROM_TO        = /(?:from)?\s*(.+)\s+(?:to|until)\s+(.+)$/i,
      RANGE_REG_REAR_DURATION  = RegExp('(.+)\\s*for\\s*' + FULL_CAPTURED_DURATION, 'i'),
      RANGE_REG_FRONT_DURATION = RegExp('(?:for)?\\s*'+ FULL_CAPTURED_DURATION +'\\s*(?:starting)?\\s(?:at\\s)?(.+)', 'i');

  var DateRangeConstructor = function(start, end) {
    if (arguments.length === 1 && isString(start)) {
      return createDateRangeFromString(start);
    }
    return new Range(getDateForRange(start), getDateForRange(end));
  };

  function createDateRangeFromString(str) {
    var match, datetime, duration, dio, start, end;
    if (sugarDate.get && (match = str.match(RANGE_REG_FROM_TO))) {
      start = getDateForRange(match[1].replace('from', 'at'));
      end = sugarDate.get(start, match[2]);
      return new Range(start, end);
    }
    if (match = str.match(RANGE_REG_FRONT_DURATION)) {
      duration = match[1];
      datetime = match[2];
    }
    if (match = str.match(RANGE_REG_REAR_DURATION)) {
      datetime = match[1];
      duration = match[2];
    }
    if (datetime && duration) {
      start = getDateForRange(datetime);
      dio = getDateIncrementObject(duration);
      end = incrementDate(start, dio[0], dio[1]);
    } else {
      start = str;
    }
    return new Range(getDateForRange(start), getDateForRange(end));
  }

  function getDateForRange(d) {
    if (isDate(d)) {
      return d;
    } else if (d == null) {
      return new Date();
    } else if (sugarDate.create) {
      return sugarDate.create(d);
    }
    return new Date(d);
  }

  defineStatic(sugarDate, {

    /***
     * @method range([start], [end])
     * @returns Range
     * @namespace Date
     * @static
     * @short Creates a new date range between [start] and [end].
     * @extra Arguments may be either dates or strings which will be forwarded to
     *        the date constructor (`create` will be used if present in the build).
     *        If either [start] or [end] are undefined, they will default to the
     *        current date. This method also accepts an alternate syntax of a
     *        single string describing the range in natural language. See `ranges`
     *        for more.
     *
     * @example
     *
     *   Date.range(jan, may)
     *   Date.range('today', 'tomorrow')
     *   Date.range('now', '5 days ago')
     *   Date.range('last Monday')
     *   Date.range('Monday to Friday')
     *   Date.range('tomorrow from 3pm to 5pm')
     *   Date.range('1 hour starting at 5pm Tuesday')
     *
     * @param {string|Date} [start]
     * @param {string|Date} [end]
     *
     ***/
    'range': DateRangeConstructor

  });

  /***
   * @module Locales
   * @description Locale files for the Sugar Date module.
   *
   ***/

  /*
   * Catalan locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('ca')
   *
   */
  Sugar.Date.addLocale('ca', {
    'plural': true,
    'units': 'milisegon:|s,segon:|s,minut:|s,hor:a|es,di:a|es,setman:a|es,mes:|os,any:|s',
    'months': 'gen:er|,febr:er|,mar:ç|,abr:il|,mai:g|,jun:y|,jul:iol|,ag:ost|,set:embre|,oct:ubre|,nov:embre|,des:embre|',
    'weekdays': 'diumenge|dg,dilluns|dl,dimarts|dt,dimecres|dc,dijous|dj,divendres|dv,dissabte|ds',
    'numerals': 'zero,un,dos,tres,quatre,cinc,sis,set,vuit,nou,deu',
    'tokens': 'el,la,de',
    'short':  '{dd}/{MM}/{yyyy}',
    'medium': '{d} {month} {yyyy}',
    'long':   '{d} {month} {yyyy} {time}',
    'full':   '{weekday} {d} {month} {yyyy} {time}',
    'stamp':  '{dow} {d} {mon} {yyyy} {time}',
    'time':   '{H}:{mm}',
    'past':   '{sign} {num} {unit}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarkers': 'a las',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': "abans d'ahir", 'value': -2 },
      { 'name': 'day', 'src': 'ahir', 'value': -1 },
      { 'name': 'day', 'src': 'avui', 'value': 0 },
      { 'name': 'day', 'src': 'demà|dema', 'value': 1 },
      { 'name': 'sign', 'src': 'fa', 'value': -1 },
      { 'name': 'sign', 'src': 'en', 'value': 1 },
      { 'name': 'shift', 'src': 'passat', 'value': -1 },
      { 'name': 'shift', 'src': 'el proper|la propera', 'value': 1 }
    ],
    'parse': [
      '{sign} {num} {unit}',
      '{num} {unit} {sign}',
      '{0?}{1?} {unit:5-7} {shift}',
      '{0?}{1?} {shift} {unit:5-7}'
    ],
    'timeParse': [
      '{shift} {weekday}',
      '{weekday} {shift}',
      '{date?} {2?} {months}\\.? {2?} {year?}'
    ]
  });


  /*
   * Danish locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('da')
   *
   */
  Sugar.Date.addLocale('da', {
    'plural': true,
    'units': 'millisekund:|er,sekund:|er,minut:|ter,tim:e|er,dag:|e,ug:e|er|en,måned:|er|en+maaned:|er|en,år:||et+aar:||et',
    'months': 'jan:uar|,feb:ruar|,mar:ts|,apr:il|,maj,jun:i|,jul:i|,aug:ust|,sep:tember|,okt:ober|,nov:ember|,dec:ember|',
    'weekdays': 'søn:dag|+son:dag|,man:dag|,tir:sdag|,ons:dag|,tor:sdag|,fre:dag|,lør:dag|+lor:dag|',
    'numerals': 'nul,en|et,to,tre,fire,fem,seks,syv,otte,ni,ti',
    'tokens':   'den,for',
    'articles': 'den',
    'short':  '{dd}-{MM}-{yyyy}',
    'medium': '{d}. {month} {yyyy}',
    'long':   '{d}. {month} {yyyy} {time}',
    'full':   '{weekday} d. {d}. {month} {yyyy} {time}',
    'stamp':  '{dow} {d} {mon} {yyyy} {time}',
    'time':   '{H}:{mm}',
    'past':   '{num} {unit} {sign}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'forgårs|i forgårs|forgaars|i forgaars', 'value': -2 },
      { 'name': 'day', 'src': 'i går|igår|i gaar|igaar', 'value': -1 },
      { 'name': 'day', 'src': 'i dag|idag', 'value': 0 },
      { 'name': 'day', 'src': 'i morgen|imorgen', 'value': 1 },
      { 'name': 'day', 'src': 'over morgon|overmorgen|i over morgen|i overmorgen|iovermorgen', 'value': 2 },
      { 'name': 'sign', 'src': 'siden', 'value': -1 },
      { 'name': 'sign', 'src': 'om', 'value':  1 },
      { 'name': 'shift', 'src': 'i sidste|sidste', 'value': -1 },
      { 'name': 'shift', 'src': 'denne', 'value': 0 },
      { 'name': 'shift', 'src': 'næste|naeste', 'value': 1 }
    ],
    'parse': [
      '{months} {year?}',
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{1?} {num} {unit} {sign}',
      '{shift} {unit:5-7}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{date} {months?}\\.? {year?}'
    ],
    'timeFrontParse': [
      '{shift} {weekday}',
      '{0?} {weekday?},? {date}\\.? {months?}\\.? {year?}'
    ]
  });


  /*
   * German locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('de')
   *
   */
  Sugar.Date.addLocale('de', {
    'plural': true,
    'units': 'Millisekunde:|n,Sekunde:|n,Minute:|n,Stunde:|n,Tag:|en,Woche:|n,Monat:|en,Jahr:|en|e',
    'months': 'Jan:uar|,Feb:ruar|,M:är|ärz|ar|arz,Apr:il|,Mai,Juni,Juli,Aug:ust|,Sept:ember|,Okt:ober|,Nov:ember|,Dez:ember|',
    'weekdays': 'So:nntag|,Mo:ntag|,Di:enstag|,Mi:ttwoch|,Do:nnerstag|,Fr:eitag|,Sa:mstag|',
    'numerals': 'null,ein:|e|er|en|em,zwei,drei,vier,fuenf,sechs,sieben,acht,neun,zehn',
    'tokens': 'der',
    'short': '{dd}.{MM}.{yyyy}',
    'medium': '{d}. {Month} {yyyy}',
    'long': '{d}. {Month} {yyyy} {time}',
    'full': '{Weekday}, {d}. {Month} {yyyy} {time}',
    'stamp': '{Dow} {d} {Mon} {yyyy} {time}',
    'time': '{H}:{mm}',
    'past': '{sign} {num} {unit}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarkers': 'um',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'vorgestern', 'value': -2 },
      { 'name': 'day', 'src': 'gestern', 'value': -1 },
      { 'name': 'day', 'src': 'heute', 'value': 0 },
      { 'name': 'day', 'src': 'morgen', 'value': 1 },
      { 'name': 'day', 'src': 'übermorgen|ubermorgen|uebermorgen', 'value': 2 },
      { 'name': 'sign', 'src': 'vor:|her', 'value': -1 },
      { 'name': 'sign', 'src': 'in', 'value': 1 },
      { 'name': 'shift', 'src': 'letzte:|r|n|s', 'value': -1 },
      { 'name': 'shift', 'src': 'nächste:|r|n|s+nachste:|r|n|s+naechste:|r|n|s+kommende:n|r', 'value': 1 }
    ],
    'parse': [
      '{months} {year?}',
      '{sign} {num} {unit}',
      '{num} {unit} {sign}',
      '{shift} {unit:5-7}'
    ],
    'timeParse': [
      '{shift?} {day|weekday}',
      '{weekday?},? {date}\\.? {months?}\\.? {year?}'
    ],
    'timeFrontParse': [
      '{shift} {weekday}',
      '{weekday?},? {date}\\.? {months?}\\.? {year?}'
    ]
  });


  /*
   * Spanish locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('es')
   *
   */
  Sugar.Date.addLocale('es', {
    'plural': true,
    'units': 'milisegundo:|s,segundo:|s,minuto:|s,hora:|s,día|días|dia|dias,semana:|s,mes:|es,año|años|ano|anos',
    'months': 'ene:ro|,feb:rero|,mar:zo|,abr:il|,may:o|,jun:io|,jul:io|,ago:sto|,sep:tiembre|,oct:ubre|,nov:iembre|,dic:iembre|',
    'weekdays': 'dom:ingo|,lun:es|,mar:tes|,mié:rcoles|+mie:rcoles|,jue:ves|,vie:rnes|,sáb:ado|+sab:ado|',
    'numerals': 'cero,uno,dos,tres,cuatro,cinco,seis,siete,ocho,nueve,diez',
    'tokens': 'el,la,de',
    'short':  '{dd}/{MM}/{yyyy}',
    'medium': '{d} de {Month} de {yyyy}',
    'long':   '{d} de {Month} de {yyyy} {time}',
    'full':   '{weekday}, {d} de {month} de {yyyy} {time}',
    'stamp':  '{dow} {d} {mon} {yyyy} {time}',
    'time':   '{H}:{mm}',
    'past':   '{sign} {num} {unit}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarkers': 'a las',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'anteayer', 'value': -2 },
      { 'name': 'day', 'src': 'ayer', 'value': -1 },
      { 'name': 'day', 'src': 'hoy', 'value': 0 },
      { 'name': 'day', 'src': 'mañana|manana', 'value': 1 },
      { 'name': 'sign', 'src': 'hace', 'value': -1 },
      { 'name': 'sign', 'src': 'dentro de', 'value': 1 },
      { 'name': 'shift', 'src': 'pasad:o|a', 'value': -1 },
      { 'name': 'shift', 'src': 'próximo|próxima|proximo|proxima', 'value': 1 }
    ],
    'parse': [
      '{months} {2?} {year?}',
      '{sign} {num} {unit}',
      '{num} {unit} {sign}',
      '{0?}{1?} {unit:5-7} {shift}',
      '{0?}{1?} {shift} {unit:5-7}'
    ],
    'timeParse': [
      '{shift?} {day|weekday} {shift?}',
      '{date} {2?} {months?}\\.? {2?} {year?}'
    ],
    'timeFrontParse': [
      '{shift?} {weekday} {shift?}',
      '{date} {2?} {months?}\\.? {2?} {year?}'
    ]
  });


  /*
   * Finnish locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('fi')
   *
   */
  Sugar.Date.addLocale('fi', {
    'plural': true,
    'units': 'millisekun:ti|tia|nin|teja|tina,sekun:ti|tia|nin|teja|tina,minuut:ti|tia|in|teja|tina,tun:ti|tia|nin|teja|tina,päiv:ä|ää|än|iä|änä,viik:ko|koa|on|olla|koja|kona,kuukau:si|tta|den+kuussa,vuo:si|tta|den|sia|tena|nna',
    'months': 'tammi:kuuta||kuu,helmi:kuuta||kuu,maalis:kuuta||kuu,huhti:kuuta||kuu,touko:kuuta||kuu,kesä:kuuta||kuu,heinä:kuuta||kuu,elo:kuuta||kuu,syys:kuuta||kuu,loka:kuuta||kuu,marras:kuuta||kuu,joulu:kuuta||kuu',
    'weekdays': 'su:nnuntai||nnuntaina,ma:anantai||anantaina,ti:istai||istaina,ke:skiviikko||skiviikkona,to:rstai||rstaina,pe:rjantai||rjantaina,la:uantai||uantaina',
    'numerals': 'nolla,yksi|ensimmäinen,kaksi|toinen,kolm:e|as,neljä:|s,vii:si|des,kuu:si|des,seitsemä:n|s,kahdeksa:n|s,yhdeksä:n|s,kymmene:n|s',
    'short': '{d}.{M}.{yyyy}',
    'medium': '{d}. {month} {yyyy}',
    'long': '{d}. {month} {yyyy} klo {time}',
    'full': '{weekday} {d}. {month} {yyyy} klo {time}',
    'stamp': '{dow} {d} {mon} {yyyy} {time}',
    'time': '{H}.{mm}',
    'timeMarkers': 'klo,kello',
    'ordinalSuffix': '.',
    'relative': function(num, unit, ms, format) {
      var units = this['units'];
      function numberWithUnit(mult) {
        return num + ' ' + units[(8 * mult) + unit];
      }
      function baseUnit() {
        return numberWithUnit(num === 1 ? 0 : 1);
      }
      switch(format) {
        case 'duration':  return baseUnit();
        case 'past':      return baseUnit() + ' sitten';
        case 'future':    return numberWithUnit(2) + ' kuluttua';
      }
    },
    'modifiers': [
      { 'name': 'day',   'src': 'toissa päivänä', 'value': -2 },
      { 'name': 'day',   'src': 'eilen|eilistä', 'value': -1 },
      { 'name': 'day',   'src': 'tänään', 'value': 0 },
      { 'name': 'day',   'src': 'huomenna|huomista', 'value': 1 },
      { 'name': 'day',   'src': 'ylihuomenna|ylihuomista', 'value': 2 },
      { 'name': 'sign',  'src': 'sitten|aiemmin', 'value': -1 },
      { 'name': 'sign',  'src': 'päästä|kuluttua|myöhemmin', 'value': 1 },
      { 'name': 'edge',  'src': 'lopussa', 'value': 2 },
      { 'name': 'edge',  'src': 'ensimmäinen|ensimmäisenä', 'value': -2 },
      { 'name': 'shift', 'src': 'edel:linen|lisenä', 'value': -1 },
      { 'name': 'shift', 'src': 'viime', 'value': -1 },
      { 'name': 'shift', 'src': 'tä:llä|ssä|nä|mä', 'value': 0 },
      { 'name': 'shift', 'src': 'seuraava|seuraavana|tuleva|tulevana|ensi', 'value': 1 }
    ],
    'parse': [
      '{months} {year?}',
      '{shift} {unit:5-7}'
    ],
    'timeParse': [
      '{shift?} {day|weekday}',
      '{weekday?},? {date}\\.? {months?}\\.? {year?}'
    ],
    'timeFrontParse': [
      '{shift?} {day|weekday}',
      '{num?} {unit} {sign}',
      '{weekday?},? {date}\\.? {months?}\\.? {year?}'
    ]
  });


  /*
   * French locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('fr')
   *
   */
  Sugar.Date.addLocale('fr', {
    'plural': true,
    'units': 'milliseconde:|s,seconde:|s,minute:|s,heure:|s,jour:|s,semaine:|s,mois,an:|s|née|nee',
    'months': 'janv:ier|,févr:ier|+fevr:ier|,mars,avr:il|,mai,juin,juil:let|,août,sept:embre|,oct:obre|,nov:embre|,déc:embre|+dec:embre|',
    'weekdays': 'dim:anche|,lun:di|,mar:di|,mer:credi|,jeu:di|,ven:dredi|,sam:edi|',
    'numerals': 'zéro,un:|e,deux,trois,quatre,cinq,six,sept,huit,neuf,dix',
    'tokens': "l'|la|le,er",
    'short':  '{dd}/{MM}/{yyyy}',
    'medium': '{d} {month} {yyyy}',
    'long':   '{d} {month} {yyyy} {time}',
    'full':   '{weekday} {d} {month} {yyyy} {time}',
    'stamp':  '{dow} {d} {mon} {yyyy} {time}',
    'time':   '{H}:{mm}',
    'past':   '{sign} {num} {unit}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarkers': 'à',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'hier', 'value': -1 },
      { 'name': 'day', 'src': "aujourd'hui", 'value': 0 },
      { 'name': 'day', 'src': 'demain', 'value': 1 },
      { 'name': 'sign', 'src': 'il y a', 'value': -1 },
      { 'name': 'sign', 'src': "dans|d'ici", 'value': 1 },
      { 'name': 'shift', 'src': 'derni:èr|er|ère|ere', 'value': -1 },
      { 'name': 'shift', 'src': 'prochain:|e', 'value': 1 }
    ],
    'parse': [
      '{months} {year?}',
      '{sign} {num} {unit}',
      '{0?} {unit:5-7} {shift}'
    ],
    'timeParse': [
      '{day|weekday} {shift?}',
      '{weekday?},? {0?} {date}{1?} {months}\\.? {year?}'
    ],
    'timeFrontParse': [
      '{0?} {weekday} {shift}',
      '{weekday?},? {0?} {date}{1?} {months}\\.? {year?}'
    ]
  });


  /*
   * Italian locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('it')
   *
   */
  Sugar.Date.addLocale('it', {
    'plural': true,
    'units': 'millisecond:o|i,second:o|i,minut:o|i,or:a|e,giorn:o|i,settiman:a|e,mes:e|i,ann:o|i',
    'months': 'gen:naio|,feb:braio|,mar:zo|,apr:ile|,mag:gio|,giu:gno|,lug:lio|,ago:sto|,set:tembre|,ott:obre|,nov:embre|,dic:embre|',
    'weekdays': 'dom:enica|,lun:edì||edi,mar:tedì||tedi,mer:coledì||coledi,gio:vedì||vedi,ven:erdì||erdi,sab:ato|',
    'numerals': "zero,un:|a|o|',due,tre,quattro,cinque,sei,sette,otto,nove,dieci",
    'tokens': "l'|la|il",
    'short': '{dd}/{MM}/{yyyy}',
    'medium': '{d} {month} {yyyy}',
    'long': '{d} {month} {yyyy} {time}',
    'full': '{weekday}, {d} {month} {yyyy} {time}',
    'stamp': '{dow} {d} {mon} {yyyy} {time}',
    'time': '{H}:{mm}',
    'past': '{num} {unit} {sign}',
    'future': '{num} {unit} {sign}',
    'duration': '{num} {unit}',
    'timeMarkers': 'alle',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'ieri', 'value': -1 },
      { 'name': 'day', 'src': 'oggi', 'value': 0 },
      { 'name': 'day', 'src': 'domani', 'value': 1 },
      { 'name': 'day', 'src': 'dopodomani', 'value': 2 },
      { 'name': 'sign', 'src': 'fa', 'value': -1 },
      { 'name': 'sign', 'src': 'da adesso', 'value': 1 },
      { 'name': 'shift', 'src': 'scors:o|a', 'value': -1 },
      { 'name': 'shift', 'src': 'prossim:o|a', 'value': 1 }
    ],
    'parse': [
      '{months} {year?}',
      '{num} {unit} {sign}',
      '{0?} {unit:5-7} {shift}',
      '{0?} {shift} {unit:5-7}'
    ],
    'timeParse': [
      '{shift?} {day|weekday}',
      '{weekday?},? {date} {months?}\\.? {year?}'
    ],
    'timeFrontParse': [
      '{shift?} {day|weekday}',
      '{weekday?},? {date} {months?}\\.? {year?}'
    ]
  });


  /*
   * Japanese locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('ja')
   *
   */
  Sugar.Date.addLocale('ja', {
    'ampmFront': true,
    'numeralUnits': true,
    'allowsFullWidth': true,
    'timeMarkerOptional': true,
    'firstDayOfWeek': 0,
    'firstDayOfWeekYear': 1,
    'units': 'ミリ秒,秒,分,時間,日,週間|週,ヶ月|ヵ月|月,年|年度',
    'weekdays': '日:曜日||曜,月:曜日||曜,火:曜日||曜,水:曜日||曜,木:曜日||曜,金:曜日||曜,土:曜日||曜',
    'numerals': '〇,一,二,三,四,五,六,七,八,九',
    'placeholders': '十,百,千,万',
    'timeSuffixes': ',秒,分,時,日,,月,年度?',
    'short':  '{yyyy}/{MM}/{dd}',
    'medium': '{yyyy}年{M}月{d}日',
    'long':   '{yyyy}年{M}月{d}日{time}',
    'full':   '{yyyy}年{M}月{d}日{time} {weekday}',
    'stamp':  '{yyyy}年{M}月{d}日 {H}:{mm} {dow}',
    'time':   '{tt}{h}時{mm}分',
    'past':   '{num}{unit}{sign}',
    'future': '{num}{unit}{sign}',
    'duration': '{num}{unit}',
    'ampm': '午前,午後',
    'modifiers': [
      { 'name': 'day', 'src': '一昨々日|前々々日', 'value': -3 },
      { 'name': 'day', 'src': '一昨日|おととい|前々日', 'value': -2 },
      { 'name': 'day', 'src': '昨日|前日', 'value': -1 },
      { 'name': 'day', 'src': '今日|当日|本日', 'value': 0 },
      { 'name': 'day', 'src': '明日|翌日|次日', 'value': 1 },
      { 'name': 'day', 'src': '明後日|翌々日', 'value': 2 },
      { 'name': 'day', 'src': '明々後日|翌々々日', 'value': 3 },
      { 'name': 'sign', 'src': '前', 'value': -1 },
      { 'name': 'sign', 'src': '後', 'value': 1 },
      { 'name': 'edge', 'src': '始|初日|頭', 'value': -2 },
      { 'name': 'edge', 'src': '末|尻', 'value': 2 },
      { 'name': 'edge', 'src': '末日', 'value': 1 },
      { 'name': 'shift', 'src': '一昨々|前々々', 'value': -3 },
      { 'name': 'shift', 'src': '一昨|前々|先々', 'value': -2 },
      { 'name': 'shift', 'src': '先|昨|去|前', 'value': -1 },
      { 'name': 'shift', 'src': '今|本|当', 'value':  0 },
      { 'name': 'shift', 'src': '来|明|翌|次', 'value':  1 },
      { 'name': 'shift', 'src': '明後|翌々|次々|再来|さ来', 'value': 2 },
      { 'name': 'shift', 'src': '明々後|翌々々', 'value':  3 }
    ],
    'parse': [
      '{month}{edge}',
      '{num}{unit}{sign}',
      '{year?}{month}',
      '{year}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{shift}{unit:5}{weekday?}',
      '{shift}{unit:7}{month}{edge}',
      '{shift}{unit:7}{month?}{date?}',
      '{shift}{unit:6}{edge?}{date?}',
      '{year?}{month?}{date}'
    ]
  });


  /*
   * Korean locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('ko')
   *
   */
  Sugar.Date.addLocale('ko', {
    'ampmFront': true,
    'numeralUnits': true,
    'units': '밀리초,초,분,시간,일,주,개월|달,년|해',
    'weekdays': '일:요일|,월:요일|,화:요일|,수:요일|,목:요일|,금:요일|,토:요일|',
    'numerals': '영|제로,일|한,이,삼,사,오,육,칠,팔,구,십',
    'short':  '{yyyy}.{MM}.{dd}',
    'medium': '{yyyy}년 {M}월 {d}일',
    'long':   '{yyyy}년 {M}월 {d}일 {time}',
    'full':   '{yyyy}년 {M}월 {d}일 {weekday} {time}',
    'stamp':  '{yyyy}년 {M}월 {d}일 {H}:{mm} {dow}',
    'time':   '{tt} {h}시 {mm}분',
    'past':   '{num}{unit} {sign}',
    'future': '{num}{unit} {sign}',
    'duration': '{num}{unit}',
    'timeSuffixes': ',초,분,시,일,,월,년',
    'ampm': '오전,오후',
    'modifiers': [
      { 'name': 'day', 'src': '그저께', 'value': -2 },
      { 'name': 'day', 'src': '어제', 'value': -1 },
      { 'name': 'day', 'src': '오늘', 'value': 0 },
      { 'name': 'day', 'src': '내일', 'value': 1 },
      { 'name': 'day', 'src': '모레', 'value': 2 },
      { 'name': 'sign', 'src': '전', 'value': -1 },
      { 'name': 'sign', 'src': '후', 'value':  1 },
      { 'name': 'shift', 'src': '지난|작', 'value': -1 },
      { 'name': 'shift', 'src': '이번|올', 'value': 0 },
      { 'name': 'shift', 'src': '다음|내', 'value': 1 }
    ],
    'parse': [
      '{num}{unit} {sign}',
      '{shift?} {unit:5-7}',
      '{year?} {month}',
      '{year}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{shift} {unit:5?} {weekday}',
      '{year?} {month?} {date} {weekday?}'
    ]
  });


  /*
   * Dutch locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('nl')
   *
   */
  Sugar.Date.addLocale('nl', {
    'plural': true,
    'units': 'milliseconde:|n,seconde:|n,minu:ut|ten,uur,dag:|en,we:ek|ken,maand:|en,jaar',
    'months': 'jan:uari|,feb:ruari|,maart|mrt,apr:il|,mei,jun:i|,jul:i|,aug:ustus|,sep:tember|,okt:ober|,nov:ember|,dec:ember|',
    'weekdays': 'zondag|zo,maandag|ma,dinsdag|di,woensdag|wo|woe,donderdag|do,vrijdag|vr|vrij,zaterdag|za',
    'numerals': 'nul,een,twee,drie,vier,vijf,zes,zeven,acht,negen,tien',
    'short':  '{dd}-{MM}-{yyyy}',
    'medium': '{d} {month} {yyyy}',
    'long':   '{d} {Month} {yyyy} {time}',
    'full':   '{weekday} {d} {Month} {yyyy} {time}',
    'stamp':  '{dow} {d} {Mon} {yyyy} {time}',
    'time':   '{H}:{mm}',
    'past':   '{num} {unit} {sign}',
    'future': '{num} {unit} {sign}',
    'duration': '{num} {unit}',
    'timeMarkers': "'s,om",
    'modifiers': [
      { 'name': 'day', 'src': 'gisteren', 'value': -1 },
      { 'name': 'day', 'src': 'vandaag', 'value': 0 },
      { 'name': 'day', 'src': 'morgen', 'value': 1 },
      { 'name': 'day', 'src': 'overmorgen', 'value': 2 },
      { 'name': 'sign', 'src': 'geleden', 'value': -1 },
      { 'name': 'sign', 'src': 'vanaf nu', 'value': 1 },
      { 'name': 'shift', 'src': 'laatste|vorige|afgelopen', 'value': -1 },
      { 'name': 'shift', 'src': 'volgend:|e', 'value': 1 }
    ],
    'parse': [
      '{months} {year?}',
      '{num} {unit} {sign}',
      '{0?} {unit:5-7} {shift}',
      '{0?} {shift} {unit:5-7}'
    ],
    'timeParse': [
      '{shift?} {day|weekday}',
      '{weekday?},? {date} {months?}\\.? {year?}'
    ],
    'timeFrontParse': [
      '{shift?} {day|weekday}',
      '{weekday?},? {date} {months?}\\.? {year?}'
    ]
  });


  /*
   * Norwegian locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('no')
   *
   */
  Sugar.Date.addLocale('no', {
    'plural': true,
    'units': 'millisekund:|er,sekund:|er,minutt:|er,tim:e|er,dag:|er,uk:e|er|en,måned:|er|en+maaned:|er|en,år:||et+aar:||et',
    'months': 'januar,februar,mars,april,mai,juni,juli,august,september,oktober,november,desember',
    'weekdays': 'søndag|sondag,mandag,tirsdag,onsdag,torsdag,fredag,lørdag|lordag',
    'numerals': 'en|et,to,tre,fire,fem,seks,sju|syv,åtte,ni,ti',
    'tokens': 'den,for',
    'articles': 'den',
    'short':'d. {d}. {month} {yyyy}',
    'long': 'den {d}. {month} {yyyy} {H}:{mm}',
    'full': '{Weekday} den {d}. {month} {yyyy} {H}:{mm}:{ss}',
    'past': '{num} {unit} {sign}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'forgårs|i forgårs|forgaars|i forgaars', 'value': -2 },
      { 'name': 'day', 'src': 'i går|igår|i gaar|igaar', 'value': -1 },
      { 'name': 'day', 'src': 'i dag|idag', 'value': 0 },
      { 'name': 'day', 'src': 'i morgen|imorgen', 'value': 1 },
      { 'name': 'day', 'src': 'overimorgen|overmorgen|over i morgen', 'value': 2 },
      { 'name': 'sign', 'src': 'siden', 'value': -1 },
      { 'name': 'sign', 'src': 'om', 'value':  1 },
      { 'name': 'shift', 'src': 'i siste|siste', 'value': -1 },
      { 'name': 'shift', 'src': 'denne', 'value': 0 },
      { 'name': 'shift', 'src': 'neste', 'value': 1 }
    ],
    'parse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{1?} {num} {unit} {sign}',
      '{shift} {unit:5-7}'
    ],
    'timeParse': [
      '{date} {month}',
      '{shift} {weekday}',
      '{0?} {weekday?},? {date?} {month}\\.? {year}'
    ]
  });


  /*
   * Polish locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('pl')
   *
   */
  Sugar.Date.addLocale('pl', {
    'plural': true,
    'units': 'milisekund:a|y|,sekund:a|y|,minut:a|y|,godzin:a|y|,dzień|dni|dni,tydzień|tygodnie|tygodni,miesiąc|miesiące|miesięcy,rok|lata|lat',
    'months': 'sty:cznia||czeń,lut:ego||y,mar:ca||zec,kwi:etnia||ecień,maj:a|,cze:rwca||rwiec,lip:ca||iec,sie:rpnia||rpień,wrz:eśnia||esień,paź:dziernika||dziernik,lis:topada||topad,gru:dnia||dzień',
    'weekdays': 'nie:dziela||dzielę,pon:iedziałek|,wt:orek|,śr:oda||odę,czw:artek|,piątek|pt,sobota|sb|sobotę',
    'numerals': 'zero,jeden|jedną,dwa|dwie,trzy,cztery,pięć,sześć,siedem,osiem,dziewięć,dziesięć',
    'tokens': 'w|we,roku',
    'short': '{dd}.{MM}.{yyyy}',
    'medium': '{d} {month} {yyyy}',
    'long':  '{d} {month} {yyyy} {time}',
    'full' : '{weekday}, {d} {month} {yyyy} {time}',
    'stamp': '{dow} {d} {mon} {yyyy} {time}',
    'time': '{H}:{mm}',
    'timeMarkers': 'o',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'przedwczoraj', 'value': -2 },
      { 'name': 'day', 'src': 'wczoraj', 'value': -1 },
      { 'name': 'day', 'src': 'dzisiaj|dziś', 'value': 0 },
      { 'name': 'day', 'src': 'jutro', 'value': 1 },
      { 'name': 'day', 'src': 'pojutrze', 'value': 2 },
      { 'name': 'sign', 'src': 'temu|przed', 'value': -1 },
      { 'name': 'sign', 'src': 'za', 'value': 1 },
      { 'name': 'shift', 'src': 'zeszły|zeszła|ostatni|ostatnia', 'value': -1 },
      { 'name': 'shift', 'src': 'następny|następna|następnego|przyszły|przyszła|przyszłego', 'value': 1 }
    ],
    'relative': function (num, unit, ms, format) {
      // special cases for relative days
      var DAY = 4;
      if (unit === DAY) {
        if (num === 1 && format === 'past')   return 'wczoraj';
        if (num === 1 && format === 'future') return 'jutro';
        if (num === 2 && format === 'past')   return 'przedwczoraj';
        if (num === 2 && format === 'future') return 'pojutrze';
      }

      var mult;
      var last  = +num.toFixed(0).slice(-1);
      var last2 = +num.toFixed(0).slice(-2);
      switch (true) {
        case num === 1:                  mult = 0; break;
        case last2 >= 12 && last2 <= 14: mult = 2; break;
        case last  >=  2 && last  <=  4: mult = 1; break;
        default:                         mult = 2;
      }
      var text = this['units'][(mult * 8) + unit];
      var prefix = num + ' ';

      // changing to accusative case for 'past' and 'future' formats
      // (only singular feminine unit words are different in accusative, each of which ends with 'a')
      if ((format === 'past' || format === 'future') && num === 1) {
        text = text.replace(/a$/, 'ę');
      }

      text = prefix + text;
      switch (format) {
        case 'duration': return text;
        case 'past':     return text + ' temu';
        case 'future':   return 'za ' + text;
      }
    },
    'parse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{months} {year?}',
      '{shift} {unit:5-7}',
      '{0} {shift?} {weekday}'
    ],
    'timeFrontParse': [
      '{day|weekday}',
      '{date} {months} {year?} {1?}',
      '{0?} {shift?} {weekday}'
    ]
  });


  /*
   * Portuguese locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('pt')
   *
   */
  Sugar.Date.addLocale('pt', {
    'plural': true,
    'units': 'milisegundo:|s,segundo:|s,minuto:|s,hora:|s,dia:|s,semana:|s,mês|mêses|mes|meses,ano:|s',
    'months': 'jan:eiro|,fev:ereiro|,mar:ço|,abr:il|,mai:o|,jun:ho|,jul:ho|,ago:sto|,set:embro|,out:ubro|,nov:embro|,dez:embro|',
    'weekdays': 'dom:ingo|,seg:unda-feira|,ter:ça-feira|,qua:rta-feira|,qui:nta-feira|,sex:ta-feira|,sáb:ado||ado',
    'numerals': 'zero,um:|a,dois|duas,três|tres,quatro,cinco,seis,sete,oito,nove,dez',
    'tokens': 'a,de',
    'short':  '{dd}/{MM}/{yyyy}',
    'medium': '{d} de {Month} de {yyyy}',
    'long':   '{d} de {Month} de {yyyy} {time}',
    'full':   '{Weekday}, {d} de {Month} de {yyyy} {time}',
    'stamp':  '{Dow} {d} {Mon} {yyyy} {time}',
    'time':   '{H}:{mm}',
    'past':   '{num} {unit} {sign}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'timeMarkers': 'às',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'anteontem', 'value': -2 },
      { 'name': 'day', 'src': 'ontem', 'value': -1 },
      { 'name': 'day', 'src': 'hoje', 'value': 0 },
      { 'name': 'day', 'src': 'amanh:ã|a', 'value': 1 },
      { 'name': 'sign', 'src': 'atrás|atras|há|ha', 'value': -1 },
      { 'name': 'sign', 'src': 'daqui a', 'value': 1 },
      { 'name': 'shift', 'src': 'passad:o|a', 'value': -1 },
      { 'name': 'shift', 'src': 'próximo|próxima|proximo|proxima', 'value': 1 }
    ],
    'parse': [
      '{months} {1?} {year?}',
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{0?} {unit:5-7} {shift}',
      '{0?} {shift} {unit:5-7}'
    ],
    'timeParse': [
      '{shift?} {day|weekday}',
      '{0?} {shift} {weekday}',
      '{date} {1?} {months?} {1?} {year?}'
    ],
    'timeFrontParse': [
      '{shift?} {day|weekday}',
      '{date} {1?} {months?} {1?} {year?}'
    ]
  });


  /*
   * Russian locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('ru')
   *
   */
  Sugar.Date.addLocale('ru', {
    'firstDayOfWeekYear': 1,
    'units': 'миллисекунд:а|у|ы|,секунд:а|у|ы|,минут:а|у|ы|,час:||а|ов,день|день|дня|дней,недел:я|ю|и|ь|е,месяц:||а|ев|е,год|год|года|лет|году',
    'months': 'янв:аря||.|арь,фев:раля||р.|раль,мар:та||т,апр:еля||.|ель,мая|май,июн:я||ь,июл:я||ь,авг:уста||.|уст,сен:тября||т.|тябрь,окт:ября||.|ябрь,ноя:бря||брь,дек:абря||.|абрь',
    'weekdays': 'воскресенье|вс,понедельник|пн,вторник|вт,среда|ср,четверг|чт,пятница|пт,суббота|сб',
    'numerals': 'ноль,од:ин|ну,дв:а|е,три,четыре,пять,шесть,семь,восемь,девять,десять',
    'tokens': 'в|на,г\\.?(?:ода)?',
    'short':  '{dd}.{MM}.{yyyy}',
    'medium': '{d} {month} {yyyy} г.',
    'long':   '{d} {month} {yyyy} г., {time}',
    'full':   '{weekday}, {d} {month} {yyyy} г., {time}',
    'stamp':  '{dow} {d} {mon} {yyyy} {time}',
    'time':   '{H}:{mm}',
    'timeMarkers': 'в',
    'ampm': ' утра, вечера',
    'modifiers': [
      { 'name': 'day', 'src': 'позавчера', 'value': -2 },
      { 'name': 'day', 'src': 'вчера', 'value': -1 },
      { 'name': 'day', 'src': 'сегодня', 'value': 0 },
      { 'name': 'day', 'src': 'завтра', 'value': 1 },
      { 'name': 'day', 'src': 'послезавтра', 'value': 2 },
      { 'name': 'sign', 'src': 'назад', 'value': -1 },
      { 'name': 'sign', 'src': 'через', 'value': 1 },
      { 'name': 'shift', 'src': 'прошл:ый|ой|ом', 'value': -1 },
      { 'name': 'shift', 'src': 'следующ:ий|ей|ем', 'value': 1 }
    ],
    'relative': function(num, unit, ms, format) {
      var numberWithUnit, last = num.toString().slice(-1), mult;
      switch(true) {
        case num >= 11 && num <= 15: mult = 3; break;
        case last == 1: mult = 1; break;
        case last >= 2 && last <= 4: mult = 2; break;
        default: mult = 3;
      }
      numberWithUnit = num + ' ' + this['units'][(mult * 8) + unit];
      switch(format) {
        case 'duration':  return numberWithUnit;
        case 'past':      return numberWithUnit + ' назад';
        case 'future':    return 'через ' + numberWithUnit;
      }
    },
    'parse': [
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{months} {year?}',
      '{0?} {shift} {unit:5-7}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{0?} {shift} {weekday}',
      '{date} {months?} {year?} {1?}'
    ],
    'timeFrontParse': [
      '{0?} {shift} {weekday}',
      '{date} {months?} {year?} {1?}'
    ]
  });


  /*
   * Swedish locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('sv')
   *
   */
  Sugar.Date.addLocale('sv', {
    'plural': true,
    'units': 'millisekund:|er,sekund:|er,minut:|er,timm:e|ar,dag:|ar,veck:a|or|an,månad:|er|en+manad:|er|en,år:||et+ar:||et',
    'months': 'jan:uari|,feb:ruari|,mar:s|,apr:il|,maj,jun:i|,jul:i|,aug:usti|,sep:tember|,okt:ober|,nov:ember|,dec:ember|',
    'weekdays': 'sön:dag|+son:dag|,mån:dag||dagen+man:dag||dagen,tis:dag|,ons:dag|,tor:sdag|,fre:dag|,lör:dag||dag',
    'numerals': 'noll,en|ett,två|tva,tre,fyra,fem,sex,sju,åtta|atta,nio,tio',
    'tokens': 'den,för|for',
    'articles': 'den',
    'short':  '{yyyy}-{MM}-{dd}',
    'medium': '{d} {month} {yyyy}',
    'long':   '{d} {month} {yyyy} {time}',
    'full':   '{weekday} {d} {month} {yyyy} {time}',
    'stamp':  '{dow} {d} {mon} {yyyy} {time}',
    'time':   '{H}:{mm}',
    'past':   '{num} {unit} {sign}',
    'future': '{sign} {num} {unit}',
    'duration': '{num} {unit}',
    'ampm': 'am,pm',
    'modifiers': [
      { 'name': 'day', 'src': 'förrgår|i förrgår|iförrgår|forrgar|i forrgar|iforrgar', 'value': -2 },
      { 'name': 'day', 'src': 'går|i går|igår|gar|i gar|igar', 'value': -1 },
      { 'name': 'day', 'src': 'dag|i dag|idag', 'value': 0 },
      { 'name': 'day', 'src': 'morgon|i morgon|imorgon', 'value': 1 },
      { 'name': 'day', 'src': 'över morgon|övermorgon|i över morgon|i övermorgon|iövermorgon|over morgon|overmorgon|i over morgon|i overmorgon|iovermorgon', 'value': 2 },
      { 'name': 'sign', 'src': 'sedan|sen', 'value': -1 },
      { 'name': 'sign', 'src': 'om', 'value':  1 },
      { 'name': 'shift', 'src': 'i förra|förra|i forra|forra', 'value': -1 },
      { 'name': 'shift', 'src': 'denna', 'value': 0 },
      { 'name': 'shift', 'src': 'nästa|nasta', 'value': 1 }
    ],
    'parse': [
      '{months} {year?}',
      '{num} {unit} {sign}',
      '{sign} {num} {unit}',
      '{1?} {num} {unit} {sign}',
      '{shift} {unit:5-7}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{shift} {weekday}',
      '{0?} {weekday?},? {date} {months?}\\.? {year?}'
    ],
    'timeFrontParse': [
      '{day|weekday}',
      '{shift} {weekday}',
      '{0?} {weekday?},? {date} {months?}\\.? {year?}'
    ]
  });


  /*
   * Simplified Chinese locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('zh-CN')
   *
   */
  Sugar.Date.addLocale('zh-CN', {
    'ampmFront': true,
    'numeralUnits': true,
    'allowsFullWidth': true,
    'timeMarkerOptional': true,
    'units': '毫秒,秒钟,分钟,小时,天,个星期|周,个月,年',
    'weekdays': '星期日|日|周日|星期天,星期一|一|周一,星期二|二|周二,星期三|三|周三,星期四|四|周四,星期五|五|周五,星期六|六|周六',
    'numerals': '〇,一,二,三,四,五,六,七,八,九',
    'placeholders': '十,百,千,万',
    'short':  '{yyyy}-{MM}-{dd}',
    'medium': '{yyyy}年{M}月{d}日',
    'long':   '{yyyy}年{M}月{d}日{time}',
    'full':   '{yyyy}年{M}月{d}日{weekday}{time}',
    'stamp':  '{yyyy}年{M}月{d}日{H}:{mm}{dow}',
    'time':   '{tt}{h}点{mm}分',
    'past':   '{num}{unit}{sign}',
    'future': '{num}{unit}{sign}',
    'duration': '{num}{unit}',
    'timeSuffixes': ',秒,分钟?,点|时,日|号,,月,年',
    'ampm': '上午,下午',
    'modifiers': [
      { 'name': 'day', 'src': '大前天', 'value': -3 },
      { 'name': 'day', 'src': '前天', 'value': -2 },
      { 'name': 'day', 'src': '昨天', 'value': -1 },
      { 'name': 'day', 'src': '今天', 'value': 0 },
      { 'name': 'day', 'src': '明天', 'value': 1 },
      { 'name': 'day', 'src': '后天', 'value': 2 },
      { 'name': 'day', 'src': '大后天', 'value': 3 },
      { 'name': 'sign', 'src': '前', 'value': -1 },
      { 'name': 'sign', 'src': '后', 'value':  1 },
      { 'name': 'shift', 'src': '上|去', 'value': -1 },
      { 'name': 'shift', 'src': '这', 'value':  0 },
      { 'name': 'shift', 'src': '下|明', 'value':  1 }
    ],
    'parse': [
      '{num}{unit}{sign}',
      '{shift}{unit:5-7}',
      '{year?}{month}',
      '{year}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{shift}{weekday}',
      '{year?}{month?}{date}'
    ]
  });


  /*
   * Traditional Chinese locale definition.
   * See the readme for customization and more information.
   * To set this locale globally:
   *
   * Sugar.Date.setLocale('zh-TW')
   *
   */
  Sugar.Date.addLocale('zh-TW', {
    'ampmFront': true,
    'numeralUnits': true,
    'allowsFullWidth': true,
    'timeMarkerOptional': true,
    'units': '毫秒,秒鐘,分鐘,小時,天,個星期|週,個月,年',
    'weekdays': '星期日|日|週日|星期天,星期一|一|週一,星期二|二|週二,星期三|三|週三,星期四|四|週四,星期五|五|週五,星期六|六|週六',
    'numerals': '〇,一,二,三,四,五,六,七,八,九',
    'placeholders': '十,百,千,万',
    'short':  '{yyyy}/{MM}/{dd}',
    'medium': '{yyyy}年{M}月{d}日',
    'long':   '{yyyy}年{M}月{d}日{time}',
    'full':   '{yyyy}年{M}月{d}日{weekday}{time}',
    'stamp':  '{yyyy}年{M}月{d}日{H}:{mm}{dow}',
    'time':   '{tt}{h}點{mm}分',
    'past':   '{num}{unit}{sign}',
    'future': '{num}{unit}{sign}',
    'duration': '{num}{unit}',
    'timeSuffixes': ',秒,分鐘?,點|時,日|號,,月,年',
    'ampm': '上午,下午',
    'modifiers': [
      { 'name': 'day', 'src': '大前天', 'value': -3 },
      { 'name': 'day', 'src': '前天', 'value': -2 },
      { 'name': 'day', 'src': '昨天', 'value': -1 },
      { 'name': 'day', 'src': '今天', 'value': 0 },
      { 'name': 'day', 'src': '明天', 'value': 1 },
      { 'name': 'day', 'src': '後天', 'value': 2 },
      { 'name': 'day', 'src': '大後天', 'value': 3 },
      { 'name': 'sign', 'src': '前', 'value': -1 },
      { 'name': 'sign', 'src': '後', 'value': 1 },
      { 'name': 'shift', 'src': '上|去', 'value': -1 },
      { 'name': 'shift', 'src': '這', 'value':  0 },
      { 'name': 'shift', 'src': '下|明', 'value':  1 }
    ],
    'parse': [
      '{num}{unit}{sign}',
      '{shift}{unit:5-7}',
      '{year?}{month}',
      '{year}'
    ],
    'timeParse': [
      '{day|weekday}',
      '{shift}{weekday}',
      '{year?}{month?}{date}'
    ]
  });


}).call(this);