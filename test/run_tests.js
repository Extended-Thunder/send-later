global.SLTests = {
  UnitTests: [],

  AddTest: function(test_name, test_function, test_args) {
    SLTests.UnitTests.push([test_name, test_function, test_args]);
  },

  RunTests: function(event, names) {
    require('./mock_browser.js');

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
        console.warn(`- TEST ${name} EXCEPTION: ${ex.message}`);
        continue;
      }
      if (result === true) {
        console.info(`+ TEST ${name} PASS`);
      } else if (result === false) {
        console.warn(`- TEST ${name} FAIL`);
      } else {
        console.warn(`- TEST ${name} FAIL ${result}`);
      }
    }
  }
}

require('../utils/static.js');

const testPaths = [
  "./adjustdaterestrictionstests.js",
  "./formatrecurtests.js",
  "./nextrecurtests.js",
  "./parserecurtests.js",
  "./miscellaneoustests.js"
];

for (let i=0; i<testPaths.length; i++) {
  const tests = require(testPaths[i]);
  tests.init();
}

SLTests.RunTests();
