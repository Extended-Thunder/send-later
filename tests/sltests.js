const SLTests = {
  UnitTests: [],

  AddTest: function(test_name, test_function, test_args) {
    SLTests.UnitTests.push([test_name, test_function, test_args]);
  },

  RunTests: function(event, names) {
    for (const params of SLTests.UnitTests) {
      const name = params[0];
      const func = params[1];
      const args = params[2];

      if (names && names.indexOf(name) == -1) {
        continue;
      }

      let result;
      try {
        result = func.apply(null, args);
      } catch (ex) {
        console.warn(`TEST ${name} EXCEPTION: ${ex.message}`);
        continue;
      }
      if (result === true) {
        console.info(`TEST ${name} PASS`);
      } else if (result === false) {
        console.warn(`TEST ${name} FAIL`);
      } else {
        console.warn(`TEST ${name} FAIL ${result}`);
      }
    }
  }
}

setTimeout(() => {
  ParseRecurTests();
  NextRecurTests();
  FormatRecurTests();
  AdjustDateForRestrictionsTests();
  SLTests.RunTests();
},0);
