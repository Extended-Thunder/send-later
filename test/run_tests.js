global.SLTests = {
  UnitTests: [],

  AddTest: function(test_name, test_function, test_args) {
    SLTests.UnitTests.push([test_name, test_function, test_args]);
  },

  RunTests: async function(event, names) {
    let n_fail = 0;
    let n_pass = 0;
    for (const params of SLTests.UnitTests) {
      const name = params[0];
      const func = params[1];
      const args = params[2];

      if (names && names.indexOf(name) === -1) {
        continue;
      }

      await Promise.resolve(func.apply(null, args)).then(result => {
        if (result === true) {
          console.info(`+ TEST ${name} PASS`);
          n_pass += 1;
        } else if (result === false) {
          console.warn(`- TEST ${name} FAIL`);
          n_fail += 1;
        } else {
          console.warn(`- TEST ${name} FAIL ${result}`);
          n_fail += 1;
        }
      }).catch(ex => {
        console.warn(`- TEST ${name} EXCEPTION: ${ex.message}`);
        n_fail += 1;
      });
    }
    if (n_fail === 0) {
      console.info(`\n  All ${n_pass} tests are passing!\n`);
    } else {
      console.info(`\n  ${n_fail}/${n_pass+n_fail} tests failed.\n`);
    }
  }
}

global.DeepCompare = (a, b) => {
  if (a === b) {
    return true;
  } else if (a && a.splice) {
    if (b && b.splice) {
      if (a.length != b.length) {
        console.log(a, '!=', b);
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (!DeepCompare(a[i], b[i])) {
          console.log(a[i], '!=', b[i]);
          return false;
        }
      }
      return true;
    }
    console.log(a, '!=', b);
    return false;
  } else if (b && b.splice) {
    console.log(a, '!=', b);
    return false;
  } else if (a && a.getTime) {
    if (b && b.getTime) {
      if (a.getTime() == b.getTime()) {
        return true;
      } else {
        console.log(a, '!=', b);
        return false;
      }
    } else {
      console.log(a, '!=', b);
      return false;
    }
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = [...Object.keys(a)];
    const bKeys = [...Object.keys(b)];
    if (DeepCompare(aKeys, bKeys)) {
      for (let key of aKeys) {
        if (!DeepCompare(a[key], b[key])) {
          console.log(a[key], '!=', b[key]);
          return false;
        }
      }
    } else {
      console.log(aKeys, '!=',bKeys);
      return false;
    }
    return true;
  }
  return a == b;
};

global.ObjToStr = (obj) => {
  if (typeof obj === 'object') {
    let contents = [];
    for (let [key, value] of Object.entries(obj)) {
      contents.push(`${key}: ${ObjToStr(value)}\n`);
    }

    if (contents.length === 1) {
      return `{ ${contents[0].trim()} }`;
    } else {
      let str = "{";
      for (let c of contents) {
        str += `\n  ${String(c.trim()).replace(/\n/g, '\n  ')},`;
      }
      return str+'\n}';
    }
  } else if (typeof obj === 'string') {
    return `"${obj}"`;
  } else {
    return ""+obj;
  }
};

require('../utils/static.js');

const testPaths = [
  "./adjustdaterestrictionstests.js",
  "./formatrecurtests.js",
  "./nextrecurtests.js",
  "./parserecurtests.js",
  "./mimetests.js",
  "./headers_to_dom_element_tests.js",
  "./datetime_handling_tests.js",
  "./miscellaneoustests.js"
];

for (let i=0; i<testPaths.length; i++) {
  const tests = require(testPaths[i]);
  tests.init();
}

SLTests.RunTests().catch(console.error);
