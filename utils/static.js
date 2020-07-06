const SLStatic = {
  timeRegex: /^(2[0-3]|1?\d):?([0-5]\d)$/,

  UnitTests: [],

  flatten: function(arr) {
    // Flattens an N-dimensional array.
    return arr.reduce((res, item) => res.concat(
                        Array.isArray(item) ? SLStatic.flatten(item) : item
                      ), []);
  },

  async logger(msg, level, stream) {
    const levels = ["all","trace","debug","info","warn","error","fatal"];
    const output = (stream !== undefined) ? stream : console.log;
    browser.storage.local.get({"preferences":{}}).then(storage => {
      const consoleLogLevel = storage.preferences.logConsoleLevel;
      if (levels.indexOf(level) >= levels.indexOf(consoleLogLevel)) {
        output(`${level.toUpperCase()} [SendLater]:`, ...msg);
      }
    });
  },

  async error(...msg)  { SLStatic.logger(msg, "error", console.error) },
  async warn(...msg)   { SLStatic.logger(msg, "warn",  console.warn) },
  async info(...msg)   { SLStatic.logger(msg, "info",  console.info) },
  async log(...msg)    { SLStatic.logger(msg, "info",  console.log) },
  async debug(...msg)  { SLStatic.logger(msg, "debug", console.debug) },
  async trace(...msg)  { SLStatic.logger(msg, "trace", console.trace) },

  dateTimeFormat: function(thisdate, options) {
    // Takes a date object and format options. If either one is null,
    // then it substitutes defaults.
    const defaults = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZoneName: 'short',
      hour12: false
    };
    const opts = Object.assign(defaults, options);
    const dtfmt = new Intl.DateTimeFormat('default', opts);
    return dtfmt.format(thisdate || (new Date()));
  },

  newUUID: function() {
    // Good enough for this purpose. Code snippet from:
    // stackoverflow.com/questions/105034/how-to-create-guid-uuid/2117523
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  compareTimes: function(a,comparison,b) {
    // Compare time of day, ignoring date.
    const aHrs = a.getHours(), aMins = a.getMinutes();
    const bHrs = b.getHours(), bMins = b.getMinutes();
    switch (comparison) {
      case "<":
        return ((aHrs<bHrs) || (aHrs === bHrs && aMins<bMins));
      case ">":
        return ((aHrs>bHrs) || (aHrs === bHrs && aMins>bMins));
      case "<=":
        return ((aHrs<bHrs) || (aHrs === bHrs && aMins<=bMins));
      case ">=":
        return ((aHrs>bHrs) || (aHrs === bHrs && aMins>=bMins));
      case "===":
        return (aHrs === bHrs && aMins === bMins);
      default:
        throw ("Unknown comparison: "+comparison);
        break;
    }
  },

  getWkdayName: function(i, style) {
    style = style || "long";
    const d = new Date(2000,0,2+(+i)); // 2000/01/02 Happens to be a Sunday
    return (new Intl.DateTimeFormat('default', {weekday:style})).format(d);
  },

  parseDateTime: function(dstr,tstr) {
    const dpts = dstr ? dstr.split(/\D/) : [0,1,0];
    const tpts = SLStatic.timeRegex.test(tstr) ? timeRegex.exec(tstr) :
                                                 [null, 0, 0];
    return new Date(+dpts[0], --dpts[1], +dpts[2], +tpts[1], +tpts[2]);
  },

  formatTime: function(datetime) {
    const hours = (""+t.getHours()).padStart(2,"0");
    const minutes = (""+t.getMinutes()).padStart(2,"0");
    return `${hours}:${minutes}`;
  },

  /* Format:
  First field is none/minutely/daily/weekly/monthly/yearly/function

  If first field is monthly, then it is followed by either one or
  two numbers. If one, then it's a single number for the day of
  the month; otherwise, it's the day of the week followed by its
  place within the month, e.g., "1 3" means the third Monday of
  each month.

  If the first field is yearly, then the second and third fields
  are the month (0-11) and date numbers for the yearly occurrence.

  After all of the above except function, "/ #" indicates a skip
  value, e.g., "/ 2" means every 2, "/ 3" means every 3, etc. For
  example, "daily / 3" means every 3 days, while "monthly 2 2 /
  2" means every other month on the second Tuesday of the month.

  If the first field is function, then the second field is the
  name of a global function which will be called with one
  argument, the previous scheduled send time (as a Date
  object), and an array of arguments returned by the previous
  invocation. It has three legal return values:

    -1 - stop recurring, i.e., don't schedule any later instances
      of this message

    integer 0 or greater - schedule this message the specified
      number of minutes into the future, then stop recurring

    array [integer 0 or greater, recur-spec, ...] - schedule this
      message the specified number of minutes into the future,
      with the specified recurrence specification for instances
      after this one, and pass the remaining items in the array into the
      next invocation of the function as an arguments array

  If the word "finished" appears in the spec anywhere after the function
  name, then it indicates that the specified function should _not_ be
  called again; rather, we're finished scheduling future sends of this
  message, but the function is being preserved in the recurrence
  specification so that it'll be set properly in the dialog if the user
  edits the scheduled message.

  The other fields can be followed by " between YYMM YYMM" to indicate a
  time restriction or " on # ..." to indicate a day restriction.
  */

  unparseRecurSpec: function(parsed) {
    let spec = parsed.type;

    if (parsed.type == "monthly") {
      spec += " ";
      if (parsed.monthly_day)
        spec += parsed.monthly_day.day + " " + parsed.monthly_day.week;
      else
        spec += parsed.monthly;
    } else if (parsed.type == "yearly") {
      spec += " " + parsed.yearly.month + " " + parsed.yearly.date;
    } else if (parsed.type == "function") {
      spec += " " + parsed.function;
      if (parsed.finished)
        spec += " finished";
    }

    if (parsed.multiplier)
      spec += " / " + parsed.multiplier;

    if (parsed.between) {
      spec += " between " + (""+parsed.between.start).padStart(3,'0') +
              " " + (""+parsed.between.end).padStart(3,'0');
    }

    if (parsed.days) {
      spec += " on " + parsed.days.join(' ');
    }

    if (spec == "none") {
      return null;
    }

    return spec;
  },

  ParseRecurSpec: function(spec) {
    const params = spec.split(/\s+/);
    const parsed = {};
    parsed.type = params.shift();
    if (!['none','minutely','daily','weekly','monthly','yearly',
        'function'].includes(parsed.type)) {
      throw "Invalid recurrence type in " + spec;
    }
    switch (parsed.type) {
      case "none":
        break;
      case "monthly":
        if (!/^\d+$/.test(params[0])) {
          throw "Invalid first monthly argument in " + spec;
        }
        if (/^[1-9]\d*$/.test(params[1])) {
          parsed.monthly_day = {
            day: params.shift(),
            week: params.shift()
          };
          if (parsed.monthly_day.day > 6) {
            throw "Invalid monthly day argument in " + spec;
          }
          if (parsed.monthly_day.week > 5) {
            throw "Invalid monthly week argument in " + spec;
          }
        } else {
          parsed.monthly = params.shift();
          if (parsed.monthly > 31)
            throw "Invalid monthly date argument in " + spec;
        }
        break;
      case "yearly":
        if (!/^\d+$/.test(params[0])) {
          throw "Invalid first yearly argument in " + spec;
        }
        if (!/^[1-9]\d*$/.test(params[1])) {
          throw "Invalid second yearly argument in " + spec;
        }
        parsed.yearly = {
          month: params.shift(),
          date: params.shift()
        };
        if (parsed.yearly.month > 11){
          throw "Invalid yearly month argument in " + spec;
        } else if (parsed.yearly.date > 31) {
          throw "Invalid yearly date argument in " + spec;
        }
        break;
      case "function":
        parsed.function = params.shift();
        const finishedIndex = params.indexOf("finished");
        if (finishedIndex > -1) {
          parsed.finished = true;
          params.splice(finishedIndex, 1);
        } else {
          parsed.finished = false;
        }
        break;
      default:
        const slashIndex = params.indexOf("/");
        if (slashIndex > -1) {
            const multiplier = params[slashIndex + 1];
            if (!/^[1-9]\d*$/.test(multiplier)){
              throw "Invalid multiplier argument in " + spec;
            }
            parsed.multiplier = multiplier;
            params.splice(slashIndex, 2);
        }
        break;
    }

    const btwnIdx = params.indexOf("between");
    if (btwnIdx > -1) {
      const startTimeStr = params[btwnIdx + 1];
      const endTimeStr = params[btwnIdx + 2];

      if (! SLStatic.timeRegex.test(startTimeStr)) {
        throw "Invalid between start in " + spec;
      } else if (! SLStatic.timeRegex.test(endTimeStr)) {
        throw "Invalid between end in " + spec;
      }

      parsed.between = {
        start: SLStatic.parseDateTime(null, startTimeStr),
        end: SLStatic.parseDateTime(null, endTimeStr)
      };
      params.splice(btwnIdx, 3);
    }
    const onIndex = params.indexOf("on");
    if (onIndex > -1) {
      parsed.days = [];
      params.splice(onIndex, 1);
      while (/^\d$/.test(params[onIndex])) {
        const day = params.splice(onIndex, 1)[0];
        if (day > 6) {
          throw "Bad restriction day in " + spec;
        }
        parsed.days.push(Number(day));
      }
      if (!parsed.days.length) {
        throw "Day restriction with no days";
      }
    }
    if (params.length) {
      throw "Extra arguments in " + spec;
    }
    return parsed;
  },

  ParseRecurTests: function() {
    function CompareRecurs(a, b) {
        if (!a && !b) return true;
        if (!a || !b) return false;
        if (a.type != b.type) return false;
        if (!a.monthly_day != !b.monthly_day) return false;
        if (a.monthly_day && (a.monthly_day.day != b.monthly_day.day ||
            a.monthly_day.week != b.monthly_day.week))
          return false;
        if (a.monthly != b.monthly) return false;
        if (!a.yearly != !b.yearly) return false;
        if (a.yearly && (a.yearly.month != b.yearly.month ||
            a.yearly.date != b.yearly.date))
          return false;
        if (a.function != b.function) return false;
        if (a.multiplier != b.multiplier) return false;
        if (!a.between != !b.between) return false;
        if (a.between && (a.between.start != b.between.start ||
            a.between.end != b.between.end))
          return false;
        if (!a.days != !b.days) return false;
        if (String(a.days) != String(b.days)) return false;
        return true;
    }

    function ParseRecurGoodTest(spec, expected) {
      const out = SLStatic.ParseRecurSpec(spec);
      if (CompareRecurs(out, expected)) {
        return true;
      } else {
        return ("expected " + JSON.stringify(expected) + ", got " +
                JSON.stringify(out));
      }
    }

    const goodTests = [
      ["none", null],
      ["minutely", { type: "minutely" }],
      ["daily", { type: "daily" }],
      ["weekly", { type: "weekly" }],
      ["monthly 3", { type: "monthly", monthly: 3 }],
      ["monthly 0 3", { type: "monthly", monthly_day: { day: 0, week: 3 } }],
      ["yearly 10 5", { type: "yearly", yearly: { month: 10, date: 5 } }],
      ["function froodle", { type: "function", "function": "froodle" }],
      ["minutely / 5", { type: "minutely", multiplier: 5 }],
      ["minutely between 830 1730", { type: "minutely", between: { start: 830,
        end: 1730 } }],
      ["minutely on 1 2 3 4 5", { type: "minutely", days: [1, 2, 3, 4, 5] }]
    ];
    for (const test of goodTests) {
      SLStatic.AddTest("ParseRecurSpec " + test[0], ParseRecurGoodTest, test);
    }

    function ParseRecurBadTest(spec, expected) {
      try {
        const out = SLStatic.ParseRecurSpec(spec);
        return "expected exception, got " + JSON.stringify(out);
      } catch (ex) {
        if (!ex.match(expected)) {
          return "exception " + ex + " did not match " + expected;
        } else {
          return true;
        }
      }
    }

    const badTests = [
      ["bad-recurrence-type", "Invalid recurrence type"],
      ["none extra-arg", "Extra arguments"],
      ["monthly bad", "Invalid first monthly argument"],
      ["monthly 7 3", "Invalid monthly day argument"],
      ["monthly 4 6", "Invalid monthly week argument"],
      ["monthly 32", "Invalid monthly date argument"],
      ["yearly bad", "Invalid first yearly argument"],
      ["yearly 10 bad", "Invalid second yearly argument"],
      ["yearly 20 3", "Invalid yearly month argument"],
      ["yearly 10 40", "Invalid yearly date argument"],
      ["function", "Invalid function recurrence spec"],
      ["function foo bar", "Invalid function recurrence spec"],
      ["daily / bad", "Invalid multiplier argument"],
      ["minutely between 11111 1730", "Invalid between start"],
      ["daily between 1100 17305", "Invalid between end"],
      ["daily extra-argument", "Extra arguments"],
      ["minutely on bad", "Day restriction with no days"],
      ["minutely on", "Day restriction with no days"],
      ["minutely on 8", "Bad restriction day"]
    ];
    for (const test of badTests) {
      SLStatic.AddTest("ParseRecurSpec " + test[0], ParseRecurBadTest, test);
    }
  },

  NextRecurTests: function() {
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

    SLStatic.AddTest("NextRecurDate daily", NextRecurNormalTest,
                     ["1/1/2012", "daily", "1/1/2012", "1/2/2012"]);
    SLStatic.AddTest("NextRecurDate weekly", NextRecurNormalTest,
                     ["1/2/2012", "weekly", "1/10/2012", "1/16/2012"]);
    SLStatic.AddTest("NextRecurDate monthly 5", NextRecurNormalTest,
                     ["1/5/2012", "monthly 5", "1/5/2012", "2/5/2012"]);
    SLStatic.AddTest("NextRecurDate monthly 30", NextRecurNormalTest,
                     ["3/1/2012", "monthly 30", "3/1/2012", "3/30/2012"]);
    SLStatic.AddTest("NextRecurDate monthly 0 3", NextRecurNormalTest,
                     ["4/15/2012", "monthly 0 3", "4/15/2012", "5/20/2012"]);
    SLStatic.AddTest("NextRecurDate monthly 0 5", NextRecurNormalTest,
                     ["1/29/2012", "monthly 0 5", "1/30/2012", "4/29/2012"]);
    SLStatic.AddTest("NextRecurDate yearly 1 29", NextRecurNormalTest,
                     ["2/29/2012", "yearly 1 29", "2/29/2012", "3/1/2013"]);
    SLStatic.AddTest("NextRecurDate yearly 1 29 / 3", NextRecurNormalTest,
                     ["3/1/2013", "yearly 1 29 / 3", "3/1/2013", "2/29/2016"]);
    SLStatic.AddTest("NextRecurDate minutely timely", NextRecurNormalTest,
                     ["1/1/2012 11:26:37", "minutely", "1/1/2012 11:26:50",
                     "1/1/2012 11:27:37"]);
    SLStatic.AddTest("NextRecurDate minutely late", NextRecurNormalTest,
                     ["1/1/2012 11:26:37", "minutely", "1/1/2012 11:29:50",
                     "1/1/2012 11:30:37"]);
    SLStatic.AddTest("NextRecurDate minutely / 5 timely", NextRecurNormalTest,
                     ["1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:26:50",
                     "1/1/2012 11:31:37"]);
    SLStatic.AddTest("NextRecurDate minutely / 5 late", NextRecurNormalTest,
                     ["1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:35:05",
                     "1/1/2012 11:35:37"]);

    SLStatic.AddTest("NextRecurDate nonexistent function",
                     NextRecurExceptionTest, ["10/3/2012", "function foo",
                     "10/3/2012", "is not defined"]);
    SLStatic.AddTest("NextRecurDate bad function type", NextRecurExceptionTest,
                     ["10/3/2012", "function Sendlater3Util", "10/3/2012",
                     "is not a function"]);

    SLStatic.AddTest("NextRecurDate function doesn't return a value",
                     NextRecurFunctionExceptionTest,
                     ["10/3/2012", "function Test1", "10/3/2012", "Test1",
                      (()=>undefined), "did not return a value"]);
    SLStatic.AddTest("NextRecurDate function doesn't return number or array",
                     NextRecurFunctionExceptionTest,
                     ["10/3/2012", "function Test2", "10/3/2012", "Test2",
                     (()=>"foo"), "did not return number or array" ]);
    SLStatic.AddTest("NextRecurDate function returns too-short array",
                     NextRecurFunctionExceptionTest,
                     ["10/3/2012", "function Test3", "10/3/2012", "Test3",
                     (()=>new Array()), "is too short"]);
    SLStatic.AddTest("NextRecurDate function did not start with a number",
                     NextRecurFunctionExceptionTest,
                     ["10/3/2012", "function Test4", "10/3/2012", "Test4",
                     (()=>new Array("monthly", "extra")),
                     "did not start with a number"]);
    SLStatic.AddTest("NextRecurDate function finished recurring",
                     NextRecurFunctionTest,
                     ["10/3/2012", "function Test5", "10/3/2012", null, "Test5",
                     (()=>-1), null]);

    const d1 = new Date();
    d1.setTime((new Date("10/3/2012")).getTime() + 5 * 60 * 1000);
    SLStatic.AddTest("NextRecurDate function returning minutes",
                     NextRecurFunctionTest,
                     ["10/3/2012", "function Test6", "10/4/2012", null, "Test6",
                     (()=>5), [d1, null]]);

    const d2 = new Date();
    d2.setTime((new Date("10/3/2012")).getTime() + 7 * 60 * 1000);
    SLStatic.AddTest("NextRecurDate function returning array",
                     NextRecurFunctionTest,
                     ["10/3/2012", "function Test7", "10/4/2012", null, "Test7",
                     (()=>new Array(7, "monthly 5")), [d2, "monthly 5"]]);
    SLStatic.AddTest("NextRecurDate function returning array with args",
                     NextRecurFunctionTest,
                     ["10/3/2012", "function Test8", "10/4/2012", ["froodle"],
                     "Test8", ((prev,args)=>{
                       if (args[0] != "froodle") {
                         throw "bad args: " + args;
                       } else {
                         return [7, "monthly 5", "freeble"];
                       }
                     }), [d2, "monthly 5", "freeble"]]);

    SLStatic.AddTest("NextRecurDate between before", NextRecurNormalTest,
                     ["3/1/2016 17:00", "minutely / 600 between 0900 1700",
                     "3/1/2016 17:01", "3/2/2016 9:00"]);
    SLStatic.AddTest("NextRecurDate between after", NextRecurNormalTest,
                     ["3/1/2016 16:45", "minutely / 60 between 0900 1700",
                     "3/1/2016 16:45", "3/2/2016 9:00"]);
    SLStatic.AddTest("NextRecurDate between ok", NextRecurNormalTest,
                     ["3/1/2016 12:45", "minutely / 60 between 0900 1700",
                     "3/1/2016 12:46", "3/1/2016 13:45"]);

    SLStatic.AddTest("NextRecurDate day match", NextRecurNormalTest,
                     ["3/1/2016 12:45", "minutely on 2", "3/1/2016 12:45",
                     "3/1/2016 12:46"]);
    SLStatic.AddTest("NextRecurDate day no match", NextRecurNormalTest,
                     ["3/1/2016 12:45", "minutely on 4 5 6", "3/1/2016 12:45",
                     "3/3/2016 12:46"]);
  },

  NextRecurFunction: function(next, recurSpec, recur, args, saveFunction) {
    const funcName = recur.function;
    let nextRecur;
    if (funcName.startsWith("ufunc:")) {
      throw "ufunc recurrence not yet implemented.";
      //nextRecur = sl3uf.callByName(funcName.slice(6), next, args);
    } else {
      const func = window[funcName];
      if (typeof(func) == "undefined") {
        throw new Error("Send Later: Invalid recurrence specification " +
                        `'${recurSpec}': ${funcName} is not defined.`);
      } else if (typeof(func) != "function") {
        throw new Error("Send Later: Invalid recurrence specification " +
                        `'${recurSpec}': ${funcName} is not a function.`);
      } else {
        nextRecur = func(next, args);
      }
    }
    if (!next)
      next = new Date();
    if (!nextRecur)
      throw new Error(`Send Later: Recurrence function '${funcName}' did not` +
                      " return a value");
    if (typeof(nextRecur) == "number") {
      if (nextRecur == -1)
        return null;
      next.setTime(next.getTime() + nextRecur * 60 * 1000);
      nextRecur = [next, null];
    }
    if (nextRecur.getTime) {
      nextRecur = [nextRecur, null];
    }

    if (!nextRecur.splice)
      throw new Error("Send Later: Recurrence function '" + funcName +
                      "' did not return number or array");
    if (nextRecur.length < 2)
      throw new Error("Send Later: Array returned by recurrence " +
                      "function '" + funcName + "' is too short");
    if (typeof(nextRecur[0]) != "number" &&
        !(nextRecur[0] && nextRecur[0].getTime))
      throw new Error("Send Later: Array " + nextRecur +
                      " returned by recurrence function '" + funcName +
                      "' did not start with a number or Date");
    if (!nextRecur[0].getTime) {
      next.setTime(next.getTime() + nextRecur[0] * 60 * 1000);
      nextRecur[0] = next;
    }

    if (!nextRecur[1] && saveFunction)
      nextRecur[1] = "function " + funcName + " finished";

    if (!nextRecur[1] && (recur.between || recur.days))
      nextRecur[1] = "none";

    if (nextRecur[1]) {
      // Merge restrictions from old spec into this one.
      const functionSpec = SLStatic.ParseRecurSpec(nextRecur[1]);
      if (recur.between)
        functionSpec.between = recur.between;
      if (recur.days)
        functionSpec.days = recur.days;
      nextRecur[1] = SLStatic.unparseRecurSpec(functionSpec);
    }

    return nextRecur;
  },

  NextRecurDate: function(next, recurSpec, now, args) {
    // Make sure we don't modify our input!
    next = new Date(next.getTime());
    const recur = SLStatic.ParseRecurSpec(recurSpec);

    if (recur.type == "none")
      return null;

    if (recur.type == "function") {
      if (recur.finished) {
        return null;
      }
      const results = SLStatic.NextRecurFunction(next, recurSpec, recur, args);
      if (results && results[0] && (recur.between || recur.days))
        results[0] = SLStatic.AdjustDateForRestrictions(
                            results[0], recur.between && recur.between.start,
                            recur.between && recur.between.end, recur.days);
      return results;
    }

    if (!now)
      now = new Date();

    let redo = false;

    if (!recur.multiplier) {
      recur.multiplier = 1;
    }

    while ((next <= now) || (recur.multiplier > 0) || redo) {
      redo = false;
      switch (recur.type) {
        case "minutely":
          next.setMinutes(next.getMinutes() + 1)
          break;
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "monthly":
          // Two different algorithms are in play here, depending on
          // whether we're supposed to schedule on a day of the month or
          // a weekday of a week of the month.
          //
          // If the former, then either the current day of the month is
          // the same as the one we want, in which case we just move to
          // the next month, or it's not, in which case the "correct"
          // month didn't have that day (i.e., it's 29, 30, or 31 on a
          // month without that many days), so we ended up rolling
          // over. In that case, we set the day of the month of the
          // _current_ month, because we're already in the right month.
          //
          // If the latter, then first check if we're at the correct
          // weekday and week of the month. If so, then go to the first
          // day of the next month. After that, move forward to the
          // correct week of the month and weekday.  If that pushes us
          // past the end of the month, that means the month in question
          // doesn't have, e.g., a "5th Tuesday", so we need to set the
          // redo flag indicating that we need to go through the loop
          // again because we didn't successfully find a date.

          if (recur.monthly) {
            if (next.getDate() == recur.monthly)
              next.setMonth(next.getMonth() + 1);
            else
              next.setDate(recur.monthly);
          } else {
            if ((next.getDay() == recur.monthly_day.day) &&
                (Math.ceil(next.getDate() / 7) == recur.monthly_day.week)) {
              next.setDate(1);
              next.setMonth(next.getMonth() + 1);
            }
            next.setDate((recur.monthly_day.week - 1) * 7 + 1);
            while (next.getDay() != recur.monthly_day.day) {
              next.setDate(next.getDate() + 1);
            }
            if (Math.ceil(next.getDate() / 7) != recur.monthly_day.week) {
              redo = true;
            }
          }
          break;
        case "yearly":
          next.setFullYear(next.getFullYear() + 1);
          next.setMonth(recur.yearly.month);
          next.setDate(recur.yearly.date);
          break;
        default:
          throw ("Send Later internal error: unrecognized recurrence type: " +
                 recur.type);
          break;
      }

      recur.multiplier--;
    }

    if (recur.between || recur.days) {
      next = SLStatic.AdjustDateForRestrictions(next,
                      (recur.between && recur.between.start),
                      (recur.between && recur.between.end), recur.days);
    }

    return next;
  },

  FormatRecur: function(recurSpec, cancelOnReply) {
    const fragments = [];

    if (recurSpec) {
      const recur = SLStatic.ParseRecurSpec(recurSpec);

      if (recur.type === "function") {
        if (!recur.finished) {
          fragments.push("function " + recur.function.replace(/^ufunc:/, ""));
        }
      } else if (recur.type !== "none") {
        if (!recur.multiplier) {
          recur.multiplier = 1;
        }

        if (recur.multiplier == 1) {
          fragments.push(browser.i18n.getMessage(recur.type));
        } else {
          fragments.push(browser.i18n.getMessage("every_" + recur.type,
                                                  recur.multiplier));
        }
      }

      if (recur.monthly_day) {
        const ordDay = browser.i18n.getMessage("ord" + recur.monthly_day.week);
        const dayName = SLStatic.getWkdayName(recur.monthly_day.day, "long");
        fragments.push(browser.i18n.getMessage("everymonthly_short",
                                                ordDay, dayName));
      }

      if (recur.between) {
        const start = SLStatic.formatTime(recur.between.start);
        const end = SLStatic.formatTime(recur.between.end);
        fragments.push(browser.i18n.getMessage("betw_times", start, end));
      }

      if (recur.days) {
        let days = [];
        for (const day of recur.days) {
          days.push(browser.i18n.getMessage("only_on_day" + day));
        }
        days = days.join(", ");
        fragments.push(browser.i18n.getMessage("only_on_days", days));
      }
    }

    if (cancelOnReply != "") {
      fragments.push(browser.i18n.getMessage("cancel_on_reply"));
    }

    return fragments.join(", ");
  },

  FormatRecurTests: function() {
    function FormatRecurTest(spec, expected) {
      const out = SLStatic.FormatRecur(spec);
      if (out == expected) {
        return true;
      } else {
        return "expected " + expected + ", got " + out;
      }
    }

    const tests = [
      ["minutely", "minutely"],
      ["daily", "daily"],
      ["weekly", "weekly"],
      ["monthly 3", "monthly"],
      ["monthly 0 3", "monthly, 3rd Sunday"],
      ["yearly 10 5", "yearly"],
      ["function froodle", "function"],
      ["minutely / 5", "every 5 minutes"],
      ["minutely between 830 1730", "minutely betw. 8:30 and 17:30"],
      ["minutely on 1 2 3", "minutely on Monday, Tuesday, Wednesday"]
    ];
    for (const test of tests) {
      SLStatic.AddTest("FormatRecur " + test[0], FormatRecurTest, test);
    }
  },

  RecurHeader: function(sendat, recur, cancelOnReply, args) {
    const header = {}
    if (recur) {
      header['X-Send-Later-Recur'] = recur;
      if (args) {
        header['X-Send-Later-Args'] = JSON.stringify(args);
      }
    }
    if (cancelOnReply != "") {
      header['X-Send-Later-Cancel-On-Reply'] = cancelOnReply;
    }
    return header;
  },

  // dt is a Date object for the scheduled send time we need to adjust.
  // start_time and end_time are numbers like YYMM, e.g., 10:00am is
  // 1000, 5:35pm is 1735, or null if there is no time restriction.
  // days is an array of numbers, with 0 being Sunday and 6 being Saturday,
  // or null if there is no day restriction.
  // Algorithm:
  // 1) Copy args so we don't modify them.
  // 2) If there is a time restriction and the scheduled time is before it,
  //    change it to the beginning of the time restriction.
  // 3) If there is a time restriction and the scheduled time is after it,
  //    change it to the beginning of the time restriction the next day.
  // 4) If there is a day restriction and the scheduled day isn't in it,
  //    change the day to the smallest day in the restriction that is larger
  //    than the scheduled day, or if there is none, then the smallest day in
  //    the restriction overall.
  AdjustDateForRestrictions: function(dt, start_time, end_time, days) {
    // 1)
    dt = new Date(dt);
    if (!days) {
      days = [];
    }
    const scheduled_time = dt.getHours() * 100 + dt.getMinutes();
    // 2)
    if (start_time && scheduled_time < start_time) {
      dt.setHours(Math.floor(start_time / 100));
      dt.setMinutes(start_time % 100);
    }
    // 3)
    else if (end_time && scheduled_time > end_time) {
      dt.setDate(dt.getDate() + 1);
      dt.setHours(Math.floor(start_time / 100));
      dt.setMinutes(start_time % 100);
    }
    // 4)
    if (days.length && days.indexOf(dt.getDay()) === -1) {
      const current_day = dt.getDay();
      let want_day;
      for (let i = current_day + 1; i <= 6; i++) {
        if (days.indexOf(i) != -1) {
          want_day = i;
          break;
        }
      }
      if (!want_day) {
        for (let i = 0; i < current_day; i++) {
          if (days.indexOf(i) != -1) {
            want_day = i;
            break;
          }
        }
      }
      while (dt.getDay() != want_day) {
        dt.setDate(dt.getDate() + 1);
      }
    }
    return dt;
  },

  AdjustDateForRestrictionsTests: function() {
    function NormalTest(dt, start_time, end_time, days, expected) {
      const orig_dt = new Date(dt);
      let orig_days;
      if (days) {
        orig_days = days.slice();
      }
      const result = SLStatic.AdjustDateForRestrictions(dt, start_time,
                                                        end_time, days);
      if (orig_dt.getTime() != dt.getTime()) {
        throw "AdjustDateForRestrictions modified dt!";
      }
      if (orig_days && String(orig_days) != String(days)) {
        throw "AdjustedDateForRestrictions modified days!";
      }
      return expected.getTime() == result.getTime();
    }

    SLStatic.AddTest("AdjustDateForRestrictions no-op", NormalTest,
                     [new Date("1/1/2016 10:37:00"), null, null, null,
                      new Date("1/1/2016 10:37:00")]);
    SLStatic.AddTest("AdjustDateForRestrictions before start", NormalTest,
                     [new Date("1/1/2016 05:30:37"), 830, 1700, null,
                      new Date("1/1/2016 08:30:37")]);
    SLStatic.AddTest("AdjustDateForRestrictions after end", NormalTest,
                     [new Date("1/1/2016 18:30:37"), 830, 1700, null,
                      new Date("1/2/2016 08:30:37")]);
    SLStatic.AddTest("AdjustDateForRestrictions OK time", NormalTest,
                     [new Date("1/1/2016 12:37:00"), 830, 1700, null,
                     new Date("1/1/2016 12:37:00")]);
    SLStatic.AddTest("AdjustDateForRestrictions start edge", NormalTest,
                     [new Date("1/1/2016 8:30:00"), 830, 1700, null,
                      new Date("1/1/2016 8:30:00")]);
    SLStatic.AddTest("AdjustDateForRestrictions end edge", NormalTest,
                     [new Date("1/1/2016 17:00:00"), 830, 1700, null,
                      new Date("1/1/2016 17:00:00")]);
    SLStatic.AddTest("AdjustDateForRestrictions OK day", NormalTest,
                     [new Date("1/1/2016 8:30:00"), null, null, [5],
                      new Date("1/1/2016 8:30:00")]);
    SLStatic.AddTest("AdjustDateForRestrictions later day", NormalTest,
                     [new Date("1/1/2016 8:30:00"), null, null, [6],
                      new Date("1/2/2016 8:30:00")]);
    SLStatic.AddTest("AdjustDateForRestrictions earlier day", NormalTest,
                     [new Date("1/1/2016 8:30:00"), null, null, [1, 2, 3],
                      new Date("1/4/2016 8:30:00")]);
  },

  AddTest: function(test_name, test_function, test_args) {
    SLStatic.UnitTests.push([test_name, test_function, test_args]);
  },

  RunTests: function(event, names) {
    for (const params of SLStatic.UnitTests) {
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
