const SLStatic = {
  timeRegex: /^(2[0-3]|[01]?\d):?([0-5]\d)$/,

  async logger(msg, level, stream) {
    const levels = ["all","trace","debug","info","warn","error","fatal"];
    const { prefs } = await browser.storage.local.get({"preferences": {}});
    if (levels.indexOf(level) >= levels.indexOf(prefs.logConsoleLevel)) {
      const output = stream || console.log;
      output(`${level.toUpperCase()} [SendLater]:`, ...msg);
    }
  },

  async error(...msg)  { SLStatic.logger(msg, "error", console.error) },
  async warn(...msg)   { SLStatic.logger(msg, "warn",  console.warn) },
  async info(...msg)   { SLStatic.logger(msg, "info",  console.info) },
  async log(...msg)    { SLStatic.logger(msg, "info",  console.log) },
  async debug(...msg)  { SLStatic.logger(msg, "debug", console.debug) },
  async trace(...msg)  { SLStatic.logger(msg, "trace", console.trace) },

  flatten: function(arr) {
    // Flattens an N-dimensional array.
    return arr.reduce((res, item) => res.concat(
                        Array.isArray(item) ? SLStatic.flatten(item) : item
                      ), []);
  },

  dateTimeFormat: function(thisdate, opts, locale) {
    const defaults = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
      hour12: false
    };
    const fm = new Intl.DateTimeFormat((locale || 'en-GB'), (opts || defaults));
    return fm.format(thisdate || (new Date()));
  },

  compareTimes: function(a,comparison,b) {
    // Compare time of day, ignoring date.
    const aHrs = a.getHours(), aMins = a.getMinutes();
    const bHrs = b.getHours(), bMins = b.getMinutes();
    const aSec = a.getSeconds(), bSec = b.getSeconds();
    switch (comparison) {
      case "<":
        return ((aHrs<bHrs) || (aHrs === bHrs && aMins<bMins) ||
                (aHrs === bHrs && aMins === bMins && aSec < bSec));
      case ">":
        return ((aHrs>bHrs) || (aHrs === bHrs && aMins>bMins) ||
                (aHrs === bHrs && aMins === bMins && aSec > bSec));
      case "<=":
        return ((aHrs<bHrs) || (aHrs === bHrs && aMins<=bMins) ||
                (aHrs === bHrs && aMins === bMins && aSec <= bSec));
      case ">=":
        return ((aHrs>bHrs) || (aHrs === bHrs && aMins>=bMins) ||
                (aHrs === bHrs && aMins === bMins && aSec >= bSec));
      case "==":
      case "===":
        return (aHrs === bHrs && aMins === bMins && aSec === bSec);
      case "!=":
      case "!==":
        return !SLStatic.compareTimes(a,"===",b);
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
    const tpts = SLStatic.timeRegex.test(tstr) ?
                    SLStatic.timeRegex.exec(tstr) : [null, 0, 0];
    return new Date(+dpts[0], --dpts[1], +dpts[2], +tpts[1], +tpts[2]);
  },

  formatTime: function(datetime) {
    if (typeof datetime === "string" || typeof datetime === "number") {
      datetime = SLStatic.parseDateTime(null, (""+datetime));
    }
    const hours = datetime.getHours();
    const minutes = (""+datetime.getMinutes()).padStart(2,"0");
    return `${hours}:${minutes}`;
  },

  newUUID: function() {
    // Good enough for this purpose. Code snippet from:
    // stackoverflow.com/questions/105034/how-to-create-guid-uuid/2117523
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  parseArgs: function(argstring) {
    return JSON.parse(`[${argstring}]`);
  },

  unparseArgs: function(args) {
    // Convert a list into its string representation, WITHOUT the square
    // braces around the entire list.
    let arglist = JSON.stringify(args, null, ' ');
    arglist = arglist.replace(/\r?\n\s*/g,' '); // Remove newlines from stringify
    arglist = arglist.replace(/\[\s*/g,'[').replace(/\s*\]/g,']'); // Cleanup
    arglist = arglist.replace(/^\[|\]$/g, ''); // Strip outer brackets
    return arglist;
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

  The other fields can be followed by " between HHMM HHMM" to indicate a
  time restriction or " on # ..." to indicate a day restriction.
  */

  unparseRecurSpec: function(parsed) {
    let spec = parsed.type;

    if (parsed.type === "monthly") {
      spec += " ";
      if (parsed.monthly_day) {
        spec += parsed.monthly_day.day + " " + parsed.monthly_day.week;
      } else {
        spec += parsed.monthly;
      }
    } else if (parsed.type === "yearly") {
      spec += " " + parsed.yearly.month + " " + parsed.yearly.date;
    } else if (parsed.type === "function") {
      spec += " " + parsed.function;
      if (parsed.finished)
        spec += " finished";
    }

    if (parsed.multiplier) {
      spec += " / " + parsed.multiplier;
    }

    if (parsed.between) {
      const start = SLStatic.formatTime(parsed.between.start);
      const end = SLStatic.formatTime(parsed.between.end);
      spec += ` between ${start} ${end}`;
    }

    if (parsed.days) {
      spec += " on " + parsed.days.join(' ');
    }

    if (spec === "none") {
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
        if (params.length) {
          throw "Extra arguments in " + spec;
        } else {
          return null;
        }
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
          month: +params.shift(),
          date: +params.shift()
        };

        // Check that this month/date combination is possible at all.
        // Use a leap year for this test.
        const test = new Date(2000, parsed.yearly.month-1, parsed.yearly.date);
        if (test.getMonth() !== parsed.yearly.month-1) {
          throw "Invalid yearly date in " + spec;
        }
        break;
      case "function":
        parsed.function = params.shift();
        const finishedIndex = params.indexOf("finished");
        parsed.finished = (params[0] === "finished");

        if (!parsed.function) {
          throw "Invalid function recurrence spec";
        }
        break;
      default:
        break;
    }

    if (parsed.type !== "function") {
      const slashIndex = params.indexOf("/");
      if (slashIndex > -1) {
          const multiplier = params[slashIndex + 1];
          if (!/^[1-9]\d*$/.test(multiplier)){
            throw "Invalid multiplier argument in " + spec;
          }
          parsed.multiplier = +multiplier;
          params.splice(slashIndex, 2);
      }
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
        start: SLStatic.formatTime(startTimeStr),
        end: SLStatic.formatTime(endTimeStr)
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

  NextRecurFunction: function(next, recurSpec, recur, args, saveFunction) {
    const funcName = recur.function;
    let nextRecur;
    if (funcName.startsWith("ufunc:")) {
      throw "ufunc recurrence not yet implemented.";
      //nextRecur = sl3uf.callByName(funcName.slice(6), next, args);
    } else {
      // Yes, I realize this is terrible. I'll fix it later.
      const func = eval(funcName);
      if (typeof(func) === 'undefined') {
        throw new Error("Send Later: Invalid recurrence specification " +
                        `'${recurSpec}': ${funcName} is not defined.`);
      } else if (typeof(func) !== "function") {
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

        if (recur.multiplier === 1) {
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
          days.push(browser.i18n.getMessage(`only_on_day${day}`));
        }
        days = days.join(", ");
        fragments.push(browser.i18n.getMessage("only_on_days", days));
      }
    }

    if (cancelOnReply) {
      fragments.push(browser.i18n.getMessage("cancel_on_reply"));
    }

    return fragments.join(" ");
  },

  // dt is a Date object for the scheduled send time we need to adjust.
  // start_time and end_time are numbers like HHMM, e.g., 10:00am is
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
  AdjustDateForRestrictions: function(sendAt, start_time, end_time, days) {
    let dt = new Date(sendAt.getTime());
    start_time = start_time && SLStatic.parseDateTime(null,start_time);
    end_time = end_time && SLStatic.parseDateTime(null,end_time);

    if (start_time && SLStatic.compareTimes(dt, '<', start_time)) {
      // If there is a time restriction and the scheduled time is before it,
      // reschedule to the beginning of the time restriction.
      dt.setHours(start_time.getHours());
      dt.setMinutes(start_time.getMinutes());
    } else if (end_time && SLStatic.compareTimes(dt, '>', end_time)) {
      // If there is a time restriction and the scheduled time is after it,
      // reschedule to the beginning of the time restriction the next day.
      dt.setDate(dt.getDate() + 1); // works on end of month, too.
      dt.setHours(start_time.getHours());
      dt.setMinutes(start_time.getMinutes());
    }
    // If there is a day restriction and the scheduled day isn't in it, then
    // increment the scheduled date by 1 day at a time until it reaches the
    // next unrestricted day.
    while (days && !days.includes(dt.getDay())) {
      dt.setDate(dt.getDate()+1);
    }
    return dt;
  }
}

if (typeof window === 'undefined') {
  // Make this file node.js-aware for browserless unit testing
  global.SLStatic = SLStatic;
}
