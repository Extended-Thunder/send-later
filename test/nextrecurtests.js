exports.init = function() {

  async function NextRecurNormalTest(sendat, recur, now, expected) {
    let result;
    try {
      result = await SLStatic.nextRecurDate(new Date(sendat), recur, new Date(now));
    } catch (ex) {
      return "Unexpected error: " + ex;
    }
    expected = new Date(expected);
    if (result.getTime() == expected.getTime()) {
      return true;
    } else {
      return `Expected ${expected}, got ${result}`;
    }
  }

  async function NextRecurExceptionTest(sendat, recur, now, expected) {
    let result;
    try {
      result = await SLStatic.nextRecurDate(new Date(sendat), recur, new Date(now));
      return "Expected exception, got " + result;
    } catch (ex) {
      if ((ex+"").indexOf(expected) !== -1) {
        return true;
      } else {
        return `Expected exception matching ${expected}, got ${ex.message}`;
      }
    }
  }

  async function NextRecurFunctionTest(sendat, recur, now, args, func_name,
                                       func, expected) {
    SLStatic.mockStorage.ufuncs[func_name] = (func === undefined) ? undefined : {body:func};
    let result;
    try {
      now = new Date(now);
      sendat = new Date(sendat);
      result = await SLStatic.nextRecurDate(sendat, recur, now, args);
      delete SLStatic.mockStorage.ufuncs[func_name];
    } catch (ex) {
      delete SLStatic.mockStorage.ufuncs[func_name];
      return "Unexpected error: " + ex.message;
    }
    if (DeepCompare(result, expected)) {
      return true;
    } else {
      return `Expected ${expected}, got ${result}`;
    }
  }

  async function NextRecurFunctionExceptionTest(sendat, recur, now, func_name,
                                                func, expected) {
    SLStatic.mockStorage.ufuncs[func_name] = (func === undefined) ? undefined : {body:func};
    try {
      let result;
      result = await SLStatic.nextRecurDate(new Date(sendat), recur, new Date(now));
      delete SLStatic.mockStorage.ufuncs[func_name];
      return "Expected exception, got " + result;
    } catch (ex) {
      delete SLStatic.mockStorage.ufuncs[func_name];
      if ((ex+"").indexOf(expected) !== -1) {
        return true;
      } else {
        return `Expected exception matching ${expected}, got ${ex.message}`;
      }
    }
  }

  SLTests.AddTest("nextRecurDate daily", NextRecurNormalTest,
                   ["1/1/2012", "daily", "1/1/2012", "1/2/2012"]);
  SLTests.AddTest("nextRecurDate weekly", NextRecurNormalTest,
                   ["1/2/2012", "weekly", "1/10/2012", "1/16/2012"]);
  SLTests.AddTest("nextRecurDate monthly 5", NextRecurNormalTest,
                   ["1/5/2012", "monthly 5", "1/5/2012", "2/5/2012"]);
  SLTests.AddTest("nextRecurDate monthly 30", NextRecurNormalTest,
                   ["3/1/2012", "monthly 30", "3/1/2012", "3/30/2012"]);
  SLTests.AddTest("nextRecurDate monthly 0 3", NextRecurNormalTest,
                   ["4/15/2012", "monthly 0 3", "4/15/2012", "5/20/2012"]);
  SLTests.AddTest("nextRecurDate monthly 0 5", NextRecurNormalTest,
                   ["1/29/2012", "monthly 0 5", "1/30/2012", "4/29/2012"]);
  SLTests.AddTest("nextRecurDate yearly 1 29", NextRecurNormalTest,
                   ["2/29/2012", "yearly 1 29", "2/29/2012", "3/1/2013"]);
  SLTests.AddTest("nextRecurDate yearly 1 29 / 3", NextRecurNormalTest,
                   ["3/1/2013", "yearly 1 29 / 3", "3/1/2013", "2/29/2016"]);
  SLTests.AddTest("nextRecurDate minutely timely", NextRecurNormalTest,
                   ["1/1/2012 11:26:37", "minutely", "1/1/2012 11:26:50",
                   "1/1/2012 11:27:37"]);
  SLTests.AddTest("nextRecurDate minutely late", NextRecurNormalTest,
                   ["1/1/2012 11:26:37", "minutely", "1/1/2012 11:29:50",
                   "1/1/2012 11:30:37"]);
  SLTests.AddTest("nextRecurDate minutely / 5 timely", NextRecurNormalTest,
                   ["1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:26:50",
                   "1/1/2012 11:31:37"]);
  SLTests.AddTest("nextRecurDate minutely / 5 late", NextRecurNormalTest,
                   ["1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:35:05",
                   "1/1/2012 11:35:37"]);

  SLTests.AddTest("nextRecurDate nonexistent function",
                   NextRecurExceptionTest, ["10/3/2012", "function foo",
                   undefined, "is not defined"]);

  SLTests.AddTest("nextRecurDate function doesn't return a value",
                   NextRecurFunctionExceptionTest,
                   ["10/3/2012", "function Test1", "10/3/2012", "Test1",
                    'return undefined', "did not return a value"]);
  SLTests.AddTest("nextRecurDate function doesn't return number or array",
                   NextRecurFunctionExceptionTest,
                   ["10/3/2012", "function Test2", "10/3/2012", "Test2",
                   'return "foo"', "did not return number, Date, or array" ]);
  SLTests.AddTest("nextRecurDate function returns too-short array",
                   NextRecurFunctionExceptionTest,
                   ["10/3/2012", "function Test3", "10/3/2012", "Test3",
                   'return new Array()', "is too short"]);
  SLTests.AddTest("nextRecurDate function did not start with a number",
                   NextRecurFunctionExceptionTest,
                   ["10/3/2012", "function Test4", "10/3/2012", "Test4",
                   'return new Array("monthly", "extra");',
                   "did not start with a number"]);
  SLTests.AddTest("nextRecurDate function finished recurring",
                   NextRecurFunctionTest,
                   ["10/3/2012", "function Test5", "10/3/2012", null, "Test5",
                   "return -1;", { sendAt: null }]);

  const d1 = new Date();
  d1.setTime((new Date("10/3/2012")).getTime() + 5 * 60 * 1000);
  SLTests.AddTest("nextRecurDate function returning minutes",
                   NextRecurFunctionTest,
                   ["10/3/2012", "function Test6", "10/4/2012", null, "Test6",
                   'return 5', { sendAt: d1 }]);

  const d2 = new Date();
  d2.setTime((new Date("10/3/2012")).getTime() + 7 * 60 * 1000);
  SLTests.AddTest("nextRecurDate function returning array",
                   NextRecurFunctionTest,
                   ["10/3/2012", "function Test7", "10/4/2012", null, "Test7",
                   'return (new Array(7, "monthly 5"));', {sendAt: d2,
                    nextspec: "monthly 5", nextargs: undefined, error: undefined}]);
  SLTests.AddTest("nextRecurDate function returning array with args",
                   NextRecurFunctionTest,
                   ["10/3/2012", "function Test8", "10/4/2012", ["froodle"],
                   "Test8",
                   'if (args[0] !== "froodle") { throw `bad args: ${args}`; }' +
                   'else { return [7, "monthly 5", "freeble"]; }',
                   {sendAt: d2, nextspec: "monthly 5", nextargs:"freeble",
                    error:undefined}]);

  SLTests.AddTest("nextRecurDate between before", NextRecurNormalTest,
                   ["3/1/2016 17:00", "minutely / 600 between 0900 1700",
                   "3/1/2016 17:01", "3/2/2016 9:00"]);
  SLTests.AddTest("nextRecurDate between after", NextRecurNormalTest,
                   ["3/1/2016 16:45", "minutely / 60 between 0900 1700",
                   "3/1/2016 16:45", "3/2/2016 9:00"]);
  SLTests.AddTest("nextRecurDate between ok", NextRecurNormalTest,
                   ["3/1/2016 12:45", "minutely / 60 between 0900 1700",
                   "3/1/2016 12:46", "3/1/2016 13:45"]);

  SLTests.AddTest("nextRecurDate day match", NextRecurNormalTest,
                   ["3/1/2016 12:45", "minutely on 2", "3/1/2016 12:45",
                   "3/1/2016 12:46"]);
  SLTests.AddTest("nextRecurDate day no match", NextRecurNormalTest,
                   ["3/1/2016 12:45", "minutely on 4 5 6", "3/1/2016 12:45",
                   "3/3/2016 12:46"]);
}
