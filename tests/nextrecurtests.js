function NextRecurTests() {
  function DeepCompare(a, b) {
    if (a && a.splice) {
      if (b && b.splice) {
        if (a.length != b.length) {
          return false;
        }
        for (let i = 0; i < a.length; i++) {
          if (!DeepCompare(a[i], b[i])) {
            return false;
          }
        }
        return true;
      }
      return false;
    }
    if (b && b.splice) {
      return false;
    }
    if (a && a.getTime) {
      if (b && b.getTime) {
        return a.getTime() == b.getTime();
      }
      return false;
    }
    return a == b;
  }

  function NextRecurNormalTest(sendat, recur, now, expected) {
    let result;
    try {
      result = SLStatic.NextRecurDate(new Date(sendat), recur, new Date(now));
    } catch (ex) {
      return "Unexpected error: " + ex;
    }
    expected = new Date(expected);
    if (result.getTime() == expected.getTime()) {
      return true;
    } else {
      return "expected " + expected + ", got " + result;
    }
  }

  function NextRecurExceptionTest(sendat, recur, now, expected) {
    let result;
    try {
      result = SLStatic.NextRecurDate(new Date(sendat), recur, new Date(now));
      return "Expected exception, got " + result;
    } catch (ex) {
      if (ex.message.match(expected)) {
        return true;
      } else {
        return `Expected exception matching ${expected}, got ${ex.message}`;
      }
    }
  }

  function NextRecurFunctionTest(sendat, recur, now, args, func_name,
                                 func, expected) {
    window[func_name] = func;
    let result;
    try {
      now = new Date(now);
      sendat = new Date(sendat);
      result = SLStatic.NextRecurDate(sendat, recur, now, args);
      delete window[func_name];
    } catch (ex) {
      delete window[func_name];
      return "Unexpected error: " + ex.message;
    }
    if (DeepCompare(result, expected)) {
      return true;
    } else {
      return `Expected ${expected}, got ${result}`;
    }
  }

  function NextRecurFunctionExceptionTest(sendat, recur, now, func_name,
                                          func, expected) {
    window[func_name] = func;
    try {
      let result;
      result = SLStatic.NextRecurDate(new Date(sendat), recur, new Date(now));
      delete window[func_name];
      return "Expected exception, got " + result;
    } catch (ex) {
      delete window[func_name];
      if (ex.message.match(expected)) {
        return true;
      } else {
        return `Expected exception matching ${expected}, got ${ex.message}`;
      }
    }
  }

  SLTests.AddTest("NextRecurDate daily", NextRecurNormalTest,
                   ["1/1/2012", "daily", "1/1/2012", "1/2/2012"]);
  SLTests.AddTest("NextRecurDate weekly", NextRecurNormalTest,
                   ["1/2/2012", "weekly", "1/10/2012", "1/16/2012"]);
  SLTests.AddTest("NextRecurDate monthly 5", NextRecurNormalTest,
                   ["1/5/2012", "monthly 5", "1/5/2012", "2/5/2012"]);
  SLTests.AddTest("NextRecurDate monthly 30", NextRecurNormalTest,
                   ["3/1/2012", "monthly 30", "3/1/2012", "3/30/2012"]);
  SLTests.AddTest("NextRecurDate monthly 0 3", NextRecurNormalTest,
                   ["4/15/2012", "monthly 0 3", "4/15/2012", "5/20/2012"]);
  SLTests.AddTest("NextRecurDate monthly 0 5", NextRecurNormalTest,
                   ["1/29/2012", "monthly 0 5", "1/30/2012", "4/29/2012"]);
  SLTests.AddTest("NextRecurDate yearly 1 29", NextRecurNormalTest,
                   ["2/29/2012", "yearly 1 29", "2/29/2012", "3/1/2013"]);
  SLTests.AddTest("NextRecurDate yearly 1 29 / 3", NextRecurNormalTest,
                   ["3/1/2013", "yearly 1 29 / 3", "3/1/2013", "2/29/2016"]);
  SLTests.AddTest("NextRecurDate minutely timely", NextRecurNormalTest,
                   ["1/1/2012 11:26:37", "minutely", "1/1/2012 11:26:50",
                   "1/1/2012 11:27:37"]);
  SLTests.AddTest("NextRecurDate minutely late", NextRecurNormalTest,
                   ["1/1/2012 11:26:37", "minutely", "1/1/2012 11:29:50",
                   "1/1/2012 11:30:37"]);
  SLTests.AddTest("NextRecurDate minutely / 5 timely", NextRecurNormalTest,
                   ["1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:26:50",
                   "1/1/2012 11:31:37"]);
  SLTests.AddTest("NextRecurDate minutely / 5 late", NextRecurNormalTest,
                   ["1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:35:05",
                   "1/1/2012 11:35:37"]);

  SLTests.AddTest("NextRecurDate nonexistent function",
                   NextRecurExceptionTest, ["10/3/2012", "function foo",
                   "10/3/2012", "is not defined"]);
  SLTests.AddTest("NextRecurDate bad function type", NextRecurExceptionTest,
                   ["10/3/2012", "function Sendlater3Util", "10/3/2012",
                   "is not a function"]);

  SLTests.AddTest("NextRecurDate function doesn't return a value",
                   NextRecurFunctionExceptionTest,
                   ["10/3/2012", "function Test1", "10/3/2012", "Test1",
                    (()=>undefined), "did not return a value"]);
  SLTests.AddTest("NextRecurDate function doesn't return number or array",
                   NextRecurFunctionExceptionTest,
                   ["10/3/2012", "function Test2", "10/3/2012", "Test2",
                   (()=>"foo"), "did not return number or array" ]);
  SLTests.AddTest("NextRecurDate function returns too-short array",
                   NextRecurFunctionExceptionTest,
                   ["10/3/2012", "function Test3", "10/3/2012", "Test3",
                   (()=>new Array()), "is too short"]);
  SLTests.AddTest("NextRecurDate function did not start with a number",
                   NextRecurFunctionExceptionTest,
                   ["10/3/2012", "function Test4", "10/3/2012", "Test4",
                   (()=>new Array("monthly", "extra")),
                   "did not start with a number"]);
  SLTests.AddTest("NextRecurDate function finished recurring",
                   NextRecurFunctionTest,
                   ["10/3/2012", "function Test5", "10/3/2012", null, "Test5",
                   (()=>-1), null]);

  const d1 = new Date();
  d1.setTime((new Date("10/3/2012")).getTime() + 5 * 60 * 1000);
  SLTests.AddTest("NextRecurDate function returning minutes",
                   NextRecurFunctionTest,
                   ["10/3/2012", "function Test6", "10/4/2012", null, "Test6",
                   (()=>5), [d1, null]]);

  const d2 = new Date();
  d2.setTime((new Date("10/3/2012")).getTime() + 7 * 60 * 1000);
  SLTests.AddTest("NextRecurDate function returning array",
                   NextRecurFunctionTest,
                   ["10/3/2012", "function Test7", "10/4/2012", null, "Test7",
                   (()=>new Array(7, "monthly 5")), [d2, "monthly 5"]]);
  SLTests.AddTest("NextRecurDate function returning array with args",
                   NextRecurFunctionTest,
                   ["10/3/2012", "function Test8", "10/4/2012", ["froodle"],
                   "Test8", ((prev,args)=>{
                     if (args[0] != "froodle") {
                       throw "bad args: " + args;
                     } else {
                       return [7, "monthly 5", "freeble"];
                     }
                   }), [d2, "monthly 5", "freeble"]]);

  SLTests.AddTest("NextRecurDate between before", NextRecurNormalTest,
                   ["3/1/2016 17:00", "minutely / 600 between 0900 1700",
                   "3/1/2016 17:01", "3/2/2016 9:00"]);
  SLTests.AddTest("NextRecurDate between after", NextRecurNormalTest,
                   ["3/1/2016 16:45", "minutely / 60 between 0900 1700",
                   "3/1/2016 16:45", "3/2/2016 9:00"]);
  SLTests.AddTest("NextRecurDate between ok", NextRecurNormalTest,
                   ["3/1/2016 12:45", "minutely / 60 between 0900 1700",
                   "3/1/2016 12:46", "3/1/2016 13:45"]);

  SLTests.AddTest("NextRecurDate day match", NextRecurNormalTest,
                   ["3/1/2016 12:45", "minutely on 2", "3/1/2016 12:45",
                   "3/1/2016 12:46"]);
  SLTests.AddTest("NextRecurDate day no match", NextRecurNormalTest,
                   ["3/1/2016 12:45", "minutely on 4 5 6", "3/1/2016 12:45",
                   "3/3/2016 12:46"]);
}
