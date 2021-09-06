
var SLStatic = {
  i18n: null,

  timeRegex: /^(2[0-3]|[01]?\d):?([0-5]\d)$/,

  previousLoop: new Date(),

  // Indicator to signify a preference migration
  // Migration 1: import options from legacy prefbranch
  // Migration 2: update format for defaultPrefs.json
  // Migration 3: indicate that "sanity check" has been performed
  // Migration 4: add instanceUUID
  // Migration 5: add accelerator shortcut options
  CURRENT_LEGACY_MIGRATION: 5,

  // HTML element IDs correspond to preference keys, localization strings, and
  // keys of preference values in local storage.
  prefInputIds: ["checkTimePref", "sendDoesDelay", "sendDelay", "sendDoesSL",
                 "altBinding", "markDraftsRead", "showColumn", "showHeader",
                 "showStatus", "blockLateMessages", "lateGracePeriod",
                 "sendUnsentMsgs", "enforceTimeRestrictions", "logDumpLevel",
                 "logConsoleLevel", "quickOptions1Label",
                 "quickOptions1funcselect", "quickOptions1Args",
                 "quickOptions2Label", "quickOptions2funcselect",
                 "quickOptions2Args", "quickOptions3Label",
                 "quickOptions3funcselect", "quickOptions3Args",
                 "accelCtrlfuncselect", "accelCtrlArgs",
                 "accelShiftfuncselect", "accelShiftArgs"],

  logConsoleLevel: null,

  async fetchLogConsoleLevel() {
    try {
      const { preferences } = await browser.storage.local.get({"preferences": {}});
      this.logConsoleLevel = (preferences.logConsoleLevel || "all").toLowerCase();
    } catch {}
  },

  logger(msg, level, stream) {
    let logConsoleLevel = "all";
    if (typeof this.logConsoleLevel === "string") {
      logConsoleLevel = this.logConsoleLevel;
    } else {
      this.fetchLogConsoleLevel();
    }

    const levels = ["all","trace","debug","info","warn","error","fatal"];
    if (levels.indexOf(level) >= levels.indexOf(logConsoleLevel)) {
      const output = stream || console.log;
      output(`${level.toUpperCase()} [SendLater]:`, ...msg);
    }
  },

  error(...msg)  { SLStatic.logger(msg, "error", console.error) },
  warn(...msg)   { SLStatic.logger(msg, "warn",  console.warn) },
  info(...msg)   { SLStatic.logger(msg, "info",  console.info) },
  log(...msg)    { SLStatic.logger(msg, "info",  console.log) },
  debug(...msg)  { SLStatic.logger(msg, "debug", console.debug) },
  trace(...msg)  { SLStatic.logger(msg, "trace", console.trace) },

  RFC5322: {
    // RFC2822 / RFC5322 formatter
    dayOfWeek: (d) => ["Sun", "Mon", "Tue", "Wed",
                      "Thu", "Fri", "Sat"][d.getDay()],

    day: (d) => d.getDate(),

    month: (d) => ["Jan", "Feb", "Mar", "Apr",
                  "May", "Jun", "Jul", "Aug",
                  "Sep", "Oct", "Nov", "Dec"][d.getMonth()],

    year: (d) => d.getFullYear().toFixed(0),

    date(d) {
      return `${this.day(d)} ${this.month(d)} ${this.year(d)}`;
    },

    time(d) {
      let H = d.getHours().toString().padStart(2,'0');
      let M = d.getMinutes().toString().padStart(2,'0');
      let S = d.getSeconds().toString().padStart(2,'0');
      return `${H}:${M}:${S}`;
    },

    tz(d) {
      let offset = d.getTimezoneOffset()|0;
      let sign = offset > 0 ? '-' : '+'; // yes, counterintuitive
      let hrs = Math.floor(Math.abs(offset/60)).toFixed(0);
      let mins = Math.abs(offset%60).toFixed(0);
      return sign + hrs.padStart(2,'0') + mins.padStart(2,'0');
    },

    format(d) {
      let day = this.dayOfWeek(d);
      let date = this.date(d);
      let time = this.time(d);
      let tz = this.tz(d);
      return `${day}, ${date} ${time} ${tz}`;
    }
  },

  flatten(arr) {
    // Flattens an N-dimensional array.
    return arr.reduce((res, item) => res.concat(
                        Array.isArray(item) ? SLStatic.flatten(item) : item
                      ), []);
  },

  generateUUID() {
    // Thanks to stackexchange for this one
    //    https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    // Note: This will eventually be replaced with a standard uuid javascript module
    // as part of the ecmascript standard.
    const uuid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
    return `{${uuid}}`;
  },

  convertTime(t) {
    if (!t) {
      return null;
    } else if (typeof t === "string") {
      return SLStatic.parseDateTime(null, t) || new Date(t);
    } else if (typeof t === "number") {
      if (t < 2401) {
        return SLStatic.parseDateTime(null, `${t}`);
      } else {
        return new Date(t);
      }
    } else if (t.getTime) {
      return new Date(t.getTime());
    } else {
      throw new Error(`Send Later error: unable to parse time format ${t}`);
    }
  },

  convertDate(date, compareToLoop) {
    if (!date) {
      return null;
    } else if (date.raw) {
      date = date.raw;
    }

    if (typeof date === "string") {
      let relativeTo = new Date();
      if (compareToLoop) {
        // Because Send Later does not necessarily start its main loop on the minute,
        // it's a little tricky to process relative times, and present them to the user
        // in a logical way. For example, if right now is 10:25:53, and the main loop
        // will execute at 14 seconds past the minute, then should input like
        // "5 minutes from now" be rounded to 10:30 or 10:31?
        //
        // It seems most logical to round up in these cases, so that's what we'll do.
        const rSec = relativeTo.getSeconds(),
              pSec = SLStatic.previousLoop.getSeconds();
        if (rSec > pSec) {
          const tdiff = rSec-pSec;
          relativeTo = new Date(relativeTo.getTime() + 60000 - tdiff*1000);
        }
      }
      const localeCode = SLStatic.i18n.getUILanguage();
      let sugarDate = Sugar.Date.get(
        relativeTo, date, {locale: localeCode, future: true}
      );
      if (!sugarDate.getTime()) {
        // If that didn't work, try 'en' locale.
        sugarDate = Sugar.Date.get(
          relativeTo, date, {locale: "en", future: true}
        );
      }

      if (sugarDate.getTime()) {
        return new Date(sugarDate.getTime());
      } else {
        return null;
      }
    } else if (typeof date === "number") {
      return new Date(date);
    } else if (date.getTime) {
      return new Date(date.getTime());
    }
    throw new Error(`Send Later error: unable to parse date format`, date);
  },

  parseableDateTimeFormat(date) {
    date = SLStatic.convertDate(date)||(new Date());
    return SLStatic.RFC5322.format(date);
  },

  humanDateTimeFormat(date) {
    date = SLStatic.convertDate(date);
    const options = {
      hour: "numeric", minute: "numeric", weekday: "short",
      month: "short", day: "numeric", year: "numeric"
    }
    return new Intl.DateTimeFormat([], options).format(date||(new Date()));
  },

  shortHumanDateTimeFormat(date) {
    date = SLStatic.convertDate(date);
    const options = {
      hour: "numeric", minute: "numeric",
      month: "numeric", day: "numeric", year: "numeric"
    }
    return new Intl.DateTimeFormat([], options).format(date||(new Date()));
  },

  compare(a, comparison, b, tolerance) {
    if (!tolerance) {
      tolerance = 0;
    }
    switch (comparison) {
      case "<":
        return (a-b) < tolerance;
      case ">":
        return (a-b) > tolerance;
      case "<=":
        return (a-b) <= tolerance;
      case ">=":
        return (a-b) >= tolerance;
      case "==":
      case "===":
        return Math.abs(a-b) <= tolerance;
      case "!=":
      case "!==":
        return Math.abs(a-b) > tolerance;
      default:
        throw new Error("Unknown comparison: "+comparison);
        break;
    }
  },

  compareDates(a,comparison,b) {
    a = SLStatic.convertDate(a); b = SLStatic.convertDate(b);
    const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return SLStatic.compare(A.getTime(),comparison,B.getTime());
  },

  compareTimes(a,comparison, b, ignoreSec, tolerance) {
    a = SLStatic.convertTime(a); b = SLStatic.convertTime(b);
    const A = new Date(2000, 0, 01, a.getHours(), a.getMinutes(),
                        (ignoreSec ? 0 : a.getSeconds()));
    const B = new Date(2000, 0, 01, b.getHours(), b.getMinutes(),
                        (ignoreSec ? 0 : b.getSeconds()));
    return SLStatic.compare(A.getTime(), comparison, B.getTime(), tolerance);
  },

  compareDateTimes(a, comparison, b, ignoreSec, tolerance) {
    const A = SLStatic.convertDate(a)
    const B = SLStatic.convertDate(b);
    A.setMilliseconds(0);
    B.setMilliseconds(0);
    if (ignoreSec) {
      A.setSeconds(0);
      B.setSeconds(0);
    }
    return SLStatic.compare(A.getTime(), comparison, B.getTime(), tolerance);
  },

  getWkdayName(input, style) {
    style = style || "long";
    let date;
    if (input.getTime) {
      date = input;
    } else {
      date = new Date(2000,0,2+(+input)); // 2000/01/02 Happens to be a Sunday
    }
    return (new Intl.DateTimeFormat([], {weekday:style})).format(date);
  },

  parseDateTime(dstr,tstr) {
    // Inputs: dstr (formatted YYYY/MM/DD), tstr (formatted HH:MM)
    const dpts = dstr ? dstr.split(/\D/) : [0,1,0];
    const tpts = SLStatic.timeRegex.test(tstr) ?
                    SLStatic.timeRegex.exec(tstr) : [null, 0, 0];
    return new Date(+dpts[0], --dpts[1], +dpts[2], +tpts[1], +tpts[2]);
  },

  formatTime(datetime,zeropad,human) {
    if (typeof datetime === "number") {
      datetime = new Date(datetime);
    } else if (typeof datetime === "string") {
      datetime = SLStatic.parseDateTime(null,datetime);
    }

    if (datetime.getTime) {
      const hours = (""+datetime.getHours()).padStart((zeropad?2:1),"0");
      const minutes = (""+datetime.getMinutes()).padStart(2,"0");
      if (human) {
        return `${hours}:${minutes}`;
      } else {
        return `${hours}${minutes}`;
      }
    } else {
      SLStatic.debug(`Unable to parse datetime`, datetime);
      return null;
    }
  },

  formatRelative(dateTime, relativeTo) {
    if (!relativeTo) {
      relativeTo = new Date(Date.now()-10);
    }
    const dt = (dateTime.getTime() - relativeTo.getTime())/1000;
    const DT = Math.abs(dt);
    const L = Sugar.Date.getLocale('en');
    const l = Sugar.Date.getLocale();

    const prettyRound = (n) => {
      if (n%1 < 0.3 || n%1 > 0.7) {
        return Math.round(n).toFixed(0);
      } else {
        return n.toFixed(1);
      }
    };

    let num, u;
    if (DT < 60) {
      num = `${Math.floor(DT)}`;
      u=L.unitMap.seconds;
    } else if (DT < 60*55) {
      num = `${Math.floor(DT/(60))}`;
      u=L.unitMap.minutes;
    } else if (DT < 60*60*23.7) {
      num = prettyRound(DT/(60*60));
      u=L.unitMap.hours;
    } else if (DT <= 60*60*24*364.3) {
      num = prettyRound(DT/(60*60*24));
      u=L.unitMap.days;
    } else {
      num = prettyRound(DT/(60*60*24*365));
      u=L.unitMap.years;
    }

    const singular = !l.plural || num === "1";
    const unit = singular ? l.units[u] : l.units[8 + u];
    const sign = l[dt > -1 ? 'fromNow' : 'ago'];
    const format = l[dt > -1 ? 'future' : 'past'];
    return format.replace(/\{(.*?)\}/g, function(full, match) {
      switch(match) {
        case 'num': return num;
        case 'unit': return unit;
        case 'sign': return sign;
      }
    });
  },

  // Splits a single label string into spans, where the first occurrence
  // of the access key is in its own element, with an underline.
  underlineAccessKey(label, modifier) {
    let idx = label.indexOf(modifier||"&");
    if (idx === -1 && modifier) {
      modifier = modifier.toLowerCase();
      idx = label.toLowerCase().indexOf(modifier);
    }

    if (idx === -1) {
      const spanner = document.createElement("SPAN");
      spanner.textContent = label;
      return [spanner];
    } else {
      const span1 = document.createElement("SPAN");
      span1.textContent = label.substr(0,idx);
      const span2 = document.createElement("SPAN");
      span2.style.textDecoration = "underline";
      span2.textContent = modifier ? label[idx] : label[++idx];
      const span3 = document.createElement("SPAN");
      span3.textContent = label.substr(idx+1);
      return [span1, span2, span3];
    }
  },

  evaluateUfunc(name, body, prev, args) {
    const funcStr = `
      let next, nextspec, nextargs;
      ${body};
      return([next, nextspec, nextargs]);
    `;

    let response;
    try {
      const FUNC = Function.apply(null, ["specname", "prev", "args", funcStr]);
      response = FUNC(name, prev, args);
    } catch (ex) {
      SLStatic.debug(`User function ${name} (prev: ${prev}, args: ${args}) returned error.`,ex);
      return { error: ex.message };
    }

    if (response === undefined) {
      throw new Error(`Send Later: Recurrence function '${name}' did not` +
                      " return a value.");
    }

    let recvdType;
    if (typeof(response) === "number") {
      recvdType = "number";
    } else if (response.getTime) {
      recvdType = "date";
    } else if (response.splice) {
      recvdType = "array";
    } else {
      throw `Recurrence function "${name}" did not return number, Date, or array`;
    }

    const prevOrNow = prev ? (new Date(prev)).getTime() : Date.now();

    switch (recvdType) {
      case "number":
        if (response < 0) {
          return { sendAt: null };
        } else {
          return {
            sendAt: new Date(prevOrNow + response * 60 * 1000)
          };
        }
      case "date":
        return { sendAt: response };
      case "array":
        if (response.length < 2) {
          throw new Error(`Array returned by recurrence function "${name}" is too short`);
        }
        let sendAt;
        if (typeof response[0] === "number") {
          if (response[0] < 0) {
            return { sendAt: null };
          } else {
            sendAt = new Date(prevOrNow + response[0] * 60 * 1000);
          }
        } else if (response[0].getTime) {
          sendAt = response[0];
        } else {
          throw new Error(`Send Later: Array ${response} returned by recurrence function ` +
                `"${name}" did not start with a number or Date`);
        }
        return {
          sendAt,
          nextspec: response[1],
          nextargs: response[2],
          error: undefined
        };
    }
  },

  /* Given a user function and an "unparsed" argument string,
   * this function returns a common schedule object, including
   * `sendAt` and `recur` members.
   */
  parseUfuncToSchedule (name, body, prev, argStr) {
    let args = null;
    if (argStr) {
      try {
        argStr = this.unparseArgs(this.parseArgs(argStr));
        args = this.parseArgs(argStr);
      } catch (ex) {
        this.warn(ex);
        let errTitle = this.i18n.getMessage("InvalidArgsTitle");
        let errBody = this.i18n.getMessage("InvalidArgsBody");
        return { err: `${errTitle}: ${errBody}` };
      }
    }

    const { sendAt, nextspec, nextargs, error } =
      this.evaluateUfunc(name, body, prev, args);
    this.debug("User function returned:",
              {sendAt, nextspec, nextargs, error});

    if (error) {
      throw new Error(error);
    } else {
      let recur = this.parseRecurSpec(nextspec || "none") || { type: "none" };
      if (recur.type !== "none")
        recur.args = nextargs || "";

      const schedule = { sendAt, recur };
      this.debug("commands.onCommand received ufunc response:", schedule);
      return schedule;
    }
  },

  formatRecurForUI(recur) {
    if (!recur) {
      return "";
    }
    let recurText = "";
    if (recur.type === "function") {
      // Almost certainly doesn't work for all languages. Need a new translation
      // for "recur according to function $1"
      recurText = this.i18n.getMessage("sendwithfunction",
                                  [recur.function]).replace(/^\S*/,
                                    this.i18n.getMessage("recurLabel"));
      recurText += "\n";
      if (recur.args) {
        recurText += this.i18n.getMessage("sendlater.prompt.functionargs.label") +
          `: [${recur.args}]`;
      }
    } else if (recur.type === "monthly") {
      recurText = this.i18n.getMessage("recurLabel") + " ";

      let monthlyRecurParts = [];

      if (!recur.multiplier) {
        monthlyRecurParts.push(this.i18n.getMessage(recur.type));
      }

      if (recur.monthly_day) {
        const ordDay = this.i18n.getMessage("ord" + recur.monthly_day.week);
        const dayName = SLStatic.getWkdayName(recur.monthly_day.day, "long");
        monthlyRecurParts.push(`${this.i18n.getMessage("everymonthly", [ordDay, dayName])}`);
      }

      if (recur.multiplier) {
        monthlyRecurParts.push(this.i18n.getMessage("every_"+recur.type, recur.multiplier));
      }

      recurText += monthlyRecurParts.join(", ");
    } else if (recur.type !== "none") {
      recurText = this.i18n.getMessage("recurLabel") + " ";

      const multiplier = (recur.multiplier || 1);
      if (multiplier === 1) {
        recurText += this.i18n.getMessage(recur.type);
      } else {
        recurText += this.i18n.getMessage("every_"+recur.type, multiplier);
      }
    }

    if (recur.between) {
      const start = SLStatic.formatTime(recur.between.start,false,true);
      const end = SLStatic.formatTime(recur.between.end,false,true);
      recurText += " " + this.i18n.getMessage("betw_times", [start, end]);
    }

    if (recur.days) {
      const days = recur.days.map(v=>SLStatic.getWkdayName(v));
      let onDays;
      if (/en/i.test(SLStatic.i18n.getUILanguage())) {
        if (days.length === 1) {
          onDays = days;
        } else if (days.length === 2) {
          onDays = days.join(" and ");
        } else {
          const ndays = days.length;
          days[ndays-1] = `and ${days[ndays-1]}`;
          onDays = days.join(", ");
        }
      } else {
        onDays = days.join(", ");
      }
      recurText += `\n${this.i18n.getMessage("sendOnlyOnLabel")} ${onDays}`;
    }

    if (recur.cancelOnReply) {
      recurText += "\n" + this.i18n.getMessage("cancel_on_reply");
    }

    return recurText.trim();
  },

  formatScheduleForUIColumn(schedule) {
      if ((/encrypted/i).test(schedule.contentType)) {
        return "Warning: Message is encrypted and will not be processed by Send Later";
      }

      let sendAt = schedule.sendAt;
      let recur = schedule.recur;

      let scheduleText;
      if (recur !== undefined && !sendAt && (recur.type === "function")) {
        scheduleText = this.i18n.getMessage("sendwithfunction",
                                                [recur.function]);
      } else {
        scheduleText = SLStatic.shortHumanDateTimeFormat(sendAt);
      }

      const rTxt = SLStatic.formatRecurForUI(recur).replace(/\n/gm,". ");
      if (rTxt) {
        scheduleText += ` (${rTxt})`;
      }

      return scheduleText;
  },

  formatScheduleForUI(schedule) {
    const sendAt = schedule.sendAt;
    sendAt.setSeconds(this.previousLoop.getSeconds());
    const recur = schedule.recur;

    let scheduleText;
    if (!sendAt && (recur.type === "function")) {
      scheduleText = this.i18n.getMessage("sendwithfunction",
                                              [recur.function]);
    } else {
      scheduleText = this.i18n.getMessage("sendAtLabel");
      scheduleText += " " + SLStatic.humanDateTimeFormat(sendAt);
      const fromNow = (sendAt.getTime()-Date.now())/1000;
      if (fromNow < 0 && fromNow > -90) {
        scheduleText += ` (${(new Sugar.Date(Date.now()+100)).relative()})`;
      } else {
        try {
          scheduleText += ` (${SLStatic.formatRelative(sendAt)})`;
          //scheduleText += ` (${(new Sugar.Date(sendAt)).relative()})`;
        } catch (ex) {
          SLStatic.warn(ex);
        }
      }
    }

    scheduleText += "\n" + SLStatic.formatRecurForUI(recur);

    return scheduleText.trim();
  },

  stateSetter(enabled) {
    // closure for enabling/disabling UI components
    return (async element => {
        try{
          if (["SPAN","DIV","LABEL"].includes(element.tagName)) {
            element.style.color = enabled ? "black" : "#888888";
          }
          element.disabled = !enabled;
        } catch (ex) {
          SLStatic.error(ex);
        }
        const enabler = SLStatic.stateSetter(enabled);
        [...element.childNodes].forEach(enabler);
      });
  },

  getHeader(content, header) {
    // Get header's value (e.g. "subject: foo bar    baz" returns "foo bar    baz")
    const regex = new RegExp(`^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,'im');
    const hdrContent = content.split(/\r\n\r\n/m)[0]+'\r\n';
    if (regex.test(hdrContent)) {
      const hdrLine = hdrContent.match(regex)[0];
      return hdrLine.replace(/[^:]*:/m,"").trim();
    } else {
      return undefined;
    }
  },

  replaceHeader(content, header, value, replaceAll, addIfMissing) {
    // Replaces the header content with a new value.
    //    replaceAll: operate on all instances of the header (can be regex)
    //    addIfMissing: If the header does not exist
    const regexStr = `^${header}:.*(?:\r\n|\n)([ \t].*(?:\r\n|\n))*`;
    const replacement = (value) ? `${header}: ${value}\r\n` : '';
    const regex = new RegExp(regexStr, (replaceAll ? 'img' : 'im'));
    const hdrContent = content.split(/\r\n\r\n/m)[0]+'\r\n';
    const msgContent = content.split(/\r\n\r\n/m).slice(1).join('\r\n\r\n');
    if (addIfMissing && !regex.test(hdrContent)) {
      return `${hdrContent.trim()}\r\n${header}: ${value}\r\n\r\n${msgContent}`;
    } else {
      const newHdrs = hdrContent.replace(regex, replacement);
      return `${newHdrs.trim()}\r\n\r\n${msgContent}`;
    }
  },

  appendHeader(content, header, value) {
    const regex = new RegExp(`^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,'im');
    const hdrContent = content.split(/\r\n\r\n/m)[0]+'\r\n';
    const msgContent = content.split(/\r\n\r\n/m).slice(1).join('\r\n\r\n');
    if (regex.test(hdrContent)) {
      const values = hdrContent.match(regex)[0].trim().slice(
        header.length+1).trim().split(/\r\n/).map(s=>s.trim());
      values.push(value);
      const newHdrs = hdrContent.replace(regex, `${header}: ${values.join("\r\n ")}\r\n`);
      return `${newHdrs.trim()}\r\n\r\n${msgContent}`;
    } else {
      return `${hdrContent.trim()}\r\n${header}: ${value}\r\n\r\n${msgContent}`;
    }
  },

  prepNewMessageHeaders(content) {
    content = SLStatic.replaceHeader(content, "Date", SLStatic.parseableDateTimeFormat(), false);
    content = SLStatic.replaceHeader(content, "X-Send-Later-[a-zA-Z0-9-]*", null, true);
    content = SLStatic.replaceHeader(content, "X-Enigmail-Draft-Status", null, false);
    content = SLStatic.replaceHeader(content, "Openpgp", null, false);
    return content;
  },

  parseArgs(argstring) {
    return JSON.parse(`[${argstring||""}]`);
  },

  unparseArgs(args) {
    // Convert a list into its string representation, WITHOUT the square
    // braces around the entire list.
    let arglist = JSON.stringify(args||[], null, ' ');
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

  The other fields can be followed by " between HH:MM HH:MM" to indicate a
  time restriction or " on # ..." to indicate a day restriction.
  */

  // recur (object) -> recurSpec (string)
  unparseRecurSpec(recur) {
    let spec = recur.type;

    if (recur.type === "monthly") {
      spec += " ";
      if (recur.monthly_day) {
        spec += recur.monthly_day.day + " " + recur.monthly_day.week;
      } else {
        spec += recur.monthly;
      }
    } else if (recur.type === "yearly") {
      spec += " " + recur.yearly.month + " " + recur.yearly.date;
    } else if (recur.type === "function") {
      spec += " " + recur.function;
      if (recur.finished) {
        spec += " finished";
      }
    }

    if (recur.multiplier) {
      if (recur.type === "none") {
        throw new Error("Cannot use multiplier with one-off schedule.");
      }
      spec += " / " + recur.multiplier;
    }

    if (recur.between) {
      const start = SLStatic.formatTime(recur.between.start, false, false);
      const end = SLStatic.formatTime(recur.between.end, false, false);
      spec += ` between ${start} ${end}`;
    }

    if (recur.days) {
      spec += " on " + recur.days.join(' ');
    }

    return spec;
  },

  // recurSpec (string) -> recur (object)
  parseRecurSpec(recurSpec) {
    if (!recurSpec) {
      return { type: "none" };
    }

    const params = recurSpec.split(/\s+/);
    const recur = {};
    recur.type = params.shift();
    if (!['none','minutely','daily','weekly','monthly','yearly',
        'function'].includes(recur.type)) {
      throw new Error("Invalid recurrence type in " + recurSpec);
    }
    switch (recur.type) {
      case "none":
        /* pass */
        break;
      case "monthly":
        if (!/^\d+$/.test(params[0])) {
          throw new Error("Invalid first monthly argument in " + recurSpec);
        }
        if (/^[1-9]\d*$/.test(params[1])) {
          recur.monthly_day = {
            day: params.shift(),
            week: params.shift()
          };
          if (recur.monthly_day.day < 0 || recur.monthly_day.day > 6) {
            throw new Error("Invalid monthly day argument in " + recurSpec);
          }
          if (recur.monthly_day.week < 1 || recur.monthly_day.week > 5) {
            throw new Error("Invalid monthly week argument in " + recurSpec);
          }
        } else {
          recur.monthly = params.shift();
          if (recur.monthly > 31)
            throw new Error("Invalid monthly date argument in " + recurSpec);
        }
        break;
      case "yearly":
        if (!/^\d+$/.test(params[0])) {
          throw "Invalid first yearly argument in " + recurSpec;
        }
        if (!/^[1-9]\d*$/.test(params[1])) {
          throw "Invalid second yearly argument in " + recurSpec;
        }
        recur.yearly = {
          month: +params.shift(),
          date: +params.shift()
        };

        // Check that this month/date combination is possible at all.
        // Use a leap year for this test.
        const test = new Date(2000, recur.yearly.month, recur.yearly.date);
        if ((test.getMonth() !== recur.yearly.month) ||
            (test.getDate() !== recur.yearly.date)) {
          throw new Error("Invalid yearly date in " + recurSpec);
        }
        break;
      case "function":
        recur.function = params.shift();
        const finishedIndex = params.indexOf("finished");
        recur.finished = (params[0] === "finished");

        if (!recur.function) {
          throw new Error("Invalid function recurrence spec");
        }
        break;
      default:
        break;
    }

    if (recur.type !== "function") {
      const slashIndex = params.indexOf("/");
      if (slashIndex > -1) {
          const multiplier = params[slashIndex + 1];
          if (!/^[1-9]\d*$/.test(multiplier)){
            throw new Error("Invalid multiplier argument in " + recurSpec);
          }
          recur.multiplier = +multiplier;
          params.splice(slashIndex, 2);
      }
    }

    const btwnIdx = params.indexOf("between");
    if (btwnIdx > -1) {
      const startTimeStr = params[btwnIdx + 1];
      const endTimeStr = params[btwnIdx + 2];

      if (! SLStatic.timeRegex.test(startTimeStr)) {
        throw new Error("Invalid between start in " + recurSpec);
      } else if (! SLStatic.timeRegex.test(endTimeStr)) {
        throw new Error("Invalid between end in " + recurSpec);
      }

      recur.between = {
        start: SLStatic.formatTime(startTimeStr, false, false),
        end: SLStatic.formatTime(endTimeStr, false, false)
      };
      params.splice(btwnIdx, 3);
    }
    const onIndex = params.indexOf("on");
    if (onIndex > -1) {
      recur.days = [];
      params.splice(onIndex, 1);
      while (/^\d$/.test(params[onIndex])) {
        const day = params.splice(onIndex, 1)[0];
        if (day > 6) {
          throw new Error("Bad restriction day in " + recurSpec);
        }
        recur.days.push(Number(day));
      }
      if (!recur.days.length) {
        throw new Error("Day restriction with no days in spec "+recurSpec);
      }
    }
    if (params.length) {
      throw new Error("Extra arguments in " + recurSpec);
    }
    return recur;
  },

  async nextRecurFunction(prev, recurSpec, recur, args) {
    if (!recur.function) {
      throw new Error(`Invalid recurrence specification '${recurSpec}': ` +
                      "No function defined");
    }

    const funcName = recur.function.replace(/^ufunc:/, "");
    const { ufuncs } = await browser.storage.local.get({ ufuncs: {} });

    prev = new Date(prev);

    if (ufuncs[funcName] === undefined) {
      throw new Error(`Invalid recurrence specification '${recurSpec}': ` +
                      `${funcName} is not defined.`);
    }

    let nextRecur = SLStatic.evaluateUfunc(funcName, ufuncs[funcName].body, prev, args);

    if (!nextRecur) {
      return null;
    }

    if (!nextRecur.nextspec && (recur.between || recur.days)) {
      nextRecur.nextspec = "none";
    }

    if (nextRecur.nextspec) {
      // Merge restrictions from old spec into this one.
      const functionSpec = SLStatic.parseRecurSpec(nextRecur.nextspec);
      if (recur.between) {
        functionSpec.between = recur.between;
      }
      if (recur.days) {
        functionSpec.days = recur.days;
      }
      nextRecur.nextspec = SLStatic.unparseRecurSpec(functionSpec);
    }

    return nextRecur;
  },

  async nextRecurDate(next, recurSpec, now, args) {
    // Make sure we don't modify our input!
    next = new Date(next.getTime());
    const recur = SLStatic.parseRecurSpec(recurSpec);

    if (recur.type === "none") {
      return null;
    }

    if (recur.type === "function") {
      if (recur.finished) {
        return null;
      }
      const nextRecur = await SLStatic.nextRecurFunction(next, recurSpec, recur, args);
      if (nextRecur && nextRecur.sendAt && (recur.between || recur.days)) {
        nextRecur.sendAt = SLStatic.adjustDateForRestrictions(
          nextRecur.sendAt, recur.between && recur.between.start,
          recur.between && recur.between.end, recur.days
        );
      }
      return nextRecur;
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
            if (next.getDate() === +recur.monthly) {
              next.setMonth(next.getMonth() + 1);
            } else {
              next.setDate(recur.monthly);
            }
          } else {
            if ((next.getDay() === +recur.monthly_day.day) &&
                (Math.ceil(next.getDate() / 7) === +recur.monthly_day.week)) {
              next.setDate(1);
              next.setMonth(next.getMonth() + 1);
            } else {}
            next.setDate((recur.monthly_day.week - 1) * 7 + 1);
            while (next.getDay() !== +recur.monthly_day.day) {
              next.setDate(next.getDate() + 1);
            }
            if (Math.ceil(next.getDate() / 7) !== +recur.monthly_day.week) {
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
          throw new Error("Send Later error: unrecognized recurrence type: " +
                 recur.type);
          break;
      }

      recur.multiplier--;
    }

    if (recur.between || recur.days) {
      next = SLStatic.adjustDateForRestrictions(next,
                      (recur.between && recur.between.start),
                      (recur.between && recur.between.end), recur.days);
    }

    return next;
  },

  // sendAt is a Date object for the scheduled send time we need to adjust.
  // start_time and end_time are numbers like HHMM, e.g., 10:00am is
  // 1000, 5:35pm is 1735, or null if there is no time restriction.
  // days is an array of numbers, with 0 being Sunday and 6 being Saturday,
  // or null if there is no day restriction. soonest_valid indicates
  // whether we should skip to the same time within the next valid day, or
  // to the soonest time that satisfies all the conditions.
  // Algorithm:
  // 1) If there is a time restriction and the scheduled time is before it,
  //    change it to the beginning of the time restriction.
  // 2) If there is a time restriction and the scheduled time is after it,
  //    change it to the beginning of the time restriction the next day.
  // 3) If there is a day restriction and the scheduled day isn't in it,
  //    change the day to the smallest day in the restriction that is larger
  //    than the scheduled day, or if there is none, then the smallest day in
  //    the restriction overall.
  // 4) If this is a one-off schedule and the assigned day is not valid, then we
  //    want to go to the beginning of the allowed time range on the next valid day.
  adjustDateForRestrictions(sendAt, start_time, end_time, days, soonest_valid) {
    // Copy argument variable to avoid modifying the original
    // (Is this really necessary?)
    sendAt = new Date(sendAt.getTime());
    start_time = SLStatic.convertTime(start_time);
    end_time = SLStatic.convertTime(end_time);

    if (start_time && SLStatic.compareTimes(sendAt, '<', start_time, true, 1000)) {
      // 1) If there is a time restriction and the scheduled time is before it,
      // reschedule to the beginning of the time restriction.
      sendAt.setHours(start_time.getHours());
      sendAt.setMinutes(start_time.getMinutes());
    } else if (end_time && SLStatic.compareTimes(sendAt, '>', end_time, true, 1000)) {
      // 2) If there is a time restriction and the scheduled time is after it,
      // reschedule to the beginning of the time restriction the next day.
      sendAt.setDate(sendAt.getDate() + 1); // works on end of month, too.
      sendAt.setHours(start_time.getHours());
      sendAt.setMinutes(start_time.getMinutes());
    }
    // 3) If there is a day restriction and the scheduled day isn't in it, then
    // increment the scheduled date by 1 day at a time until it reaches the
    // next unrestricted day.
    while (days && !days.includes(sendAt.getDay())) {
      sendAt.setDate(sendAt.getDate()+1);
      if (soonest_valid && start_time) {
        // 4) Go to soonest valid time, rather than just skipping days.
        sendAt.setHours(start_time.getHours());
        sendAt.setMinutes(start_time.getMinutes());
      }
    }
    return sendAt;
  }
}

/*
We need to mock certain functions depending on the execution context. We made it
to this point either through the extension itself, or through an experiment context,
or via a Node-based unit test.
*/

// First, we need access to the i18n localization strings. This is trivial if
// we are inside of the extension context, but from outside of that context we
// need to access the extension, or create a mock translation service.
if (SLStatic.i18n === null) {
  if (typeof browser !== "undefined" && browser.i18n) {
    // We're in the extension context.
    SLStatic.i18n = browser.i18n;
  } else if (typeof require === "undefined") {
    // We're in an overlay context.
    try {
      const ext = window.ExtensionParent.GlobalManager.extensionMap.get("sendlater3@kamens.us");
      SLStatic.i18n = {
        getUILanguage() {
          return ext.localeData.selectedLocale;
        },
        getMessage(messageName, substitutions = [], options = {}) {
          try {
            messageName = messageName.toLowerCase();

            let messages, str;

            const selectedLocale = ext.localeData.selectedLocale;
            if (ext.localeData.messages.has(selectedLocale)) {
              messages = ext.localeData.messages.get(selectedLocale);
              if (messages.has(messageName)) {
                str = messages.get(messageName);
              }
            }

            if (str === undefined) {
              SLStatic.warn(`Unable to find message ${messageName} in locale ${selectedLocale}`);
              for (let locale of ext.localeData.availableLocales) {
                if (ext.localeData.messages.has(locale)) {
                  messages = ext.localeData.messages.get(locale);
                  if (messages.has(messageName)) {
                    str = messages.get(messageName);
                    break;
                  }
                }
              }
            }

            if (str === undefined) {
              str = messageName;
            }

            if (!str.includes("$")) {
              return str;
            }

            if (!Array.isArray(substitutions)) {
              substitutions = [substitutions];
            }

            let replacer = (matched, index, dollarSigns) => {
              if (index) {
                // This is not quite Chrome-compatible. Chrome consumes any number
                // of digits following the $, but only accepts 9 substitutions. We
                // accept any number of substitutions.
                index = parseInt(index, 10) - 1;
                return index in substitutions ? substitutions[index] : "";
              }
              // For any series of contiguous `$`s, the first is dropped, and
              // the rest remain in the output string.
              return dollarSigns;
            };
            return str.replace(/\$(?:([1-9]\d*)|(\$+))/g, replacer);
          } catch (e) {
            console.warn("Unable to get localized message.",e);
          }
          return "";
        },
      };
    } catch (e) {
      SLStatic.warn("Unable to load i18n from extension.",e);
    }
  } else {
    // We're in a node process (unit test).
    SLStatic.i18n = {
      getUILanguage() {
        return "en-US";
      },
      getMessage(key, args) {
        if (typeof args !== "object") {
          args = [args];
        }
        try {
          let msg;
          if (typeof window !== "undefined" &&
              typeof window.localeMessages === "object") {
            // browser environment
            msg = localeMessages[key].message;
          } else {
            // node.js environment
            msg = global.localeMessages[key].message;
          }
          return msg.replace(/\$\d/g, (i) => args[--i[1]] );
        } catch (e) {
          console.warn(e);
          return key;
        }
      }
    };
  }
}

/*
Unit and functional tests require other mocked browser objects. Since we don't
need to worry about polluting the global namespace in a unit test, we'll just
create a mock global browser object here.
*/
if (typeof browser === "undefined" && typeof require !== "undefined") {
  var browserMocking = true;
  SLStatic.mockStorage = {};
  var Sugar = require("./sugar-custom.js");

  console.info("Defining mock browser object for Node unit tests.");
  var browser = {
    storage: {
      local: {
        async get(key) {
          if (typeof key === "string") {
            const keyobj = {};
            keyobj[key] = {};
            key = keyobj;
          }
          const ret = {};
          Object.keys(key).forEach(key => {
            if (SLStatic.mockStorage[key]) {
              ret[key] = SLStatic.mockStorage[key];
            } else {
              ret[key] = { };
            }
          });

          return ret;
        },
        async set (item) {
          console.log("mock storage", SLStatic.mockStorage);
          Object.assign(SLStatic.mockStorage, item);
          console.log("mock storage", SLStatic.mockStorage);
        }
      }
    },
    runtime: {
      sendMessage(...args) {
        console.debug("Sent message to background script",args);
      }
    },
    SL3U: {
      saveAsDraft(){},
      sendNow(batch){},
      setHeader (key,value){},
      getHeader(key){return key;},
      getLegacyPref(name, dtype, def){return null;}
    }
  }

  if (typeof window === 'undefined') {
    // Make this file node.js-aware for browserless unit testing
    const fs = require('fs'),
          path = require('path'),
          filePath = path.join(__dirname, '..', '_locales','en','messages.json');;
    const contents = fs.readFileSync(filePath, {encoding: 'utf-8'});
    global.localeMessages = JSON.parse(contents);
    global.SLStatic = SLStatic;
    global.browser = browser;
  } else {
    // We're in a non-addon browser environment (functional tests)
    fetch("/_locales/en/messages.json").then(
      response => response.json()
    ).then(locale => {
      window.localeMessages = locale;
    });
  }

  SLStatic.mockStorage.ufuncs = {
    ReadMeFirst: {help: "Any text you put here will be displayed as a tooltip when you hover over the name of the function in the menu. You can use this to document what the function does and what arguments it accepts.", body: "// Send the first message now, subsequent messages once per day.\nif (! prev)\n    next = new Date();\nelse {\n    var now = new Date();\n    next = new Date(prev); // Copy date argument so we don't modify it.\n    do {\n        next.setDate(next.getDate() + 1);\n    } while (next < now);\n    // ^^^ Don't try to send in the past, in case Thunderbird was asleep at\n    // the scheduled send time.\n}\nif (! args) // Send messages three times by default.\n    args = [3];\nnextargs = [args[0] - 1];\n// Recur if we haven't done enough sends yet.\nif (nextargs[0] > 0)\n    nextspec = \"function \" + specname;"},
    BusinessHours: {help:"Send the message now if it is during business hours, or at the beginning of the next work day. You can change the definition of work days (default: Mon - Fri) by passing in an array of work-day numbers as the first argument, where 0 is Sunday and 6 is Saturday. You can change the work start or end time (default: 8:30 - 17:30) by passing in an array of [H, M] as the second or third argument. Specify “null” for earlier arguments you don't change. For example, “null, [9, 0], [17, 0]” changes the work hours without changing the work days.",body:"// Defaults\nvar workDays = [1, 2, 3, 4, 5]; // Mon - Fri; Sun == 0, Sat == 6\nvar workStart = [8, 30]; // Start of the work day as [H, M]\nvar workEnd = [17, 30]; // End of the work day as [H, M]\nif (args && args[0])\n    workDays = args[0];\nif (args && args[1])\n    workStart = args[1];\nif (args && args[2])\n    workEnd = args[2];\nif (prev)\n    // Not expected in normal usage, but used as the current time for testing.\n    next = new Date(prev);\nelse\n    next = new Date();\n// If we're past the end of the workday or not on a workday, move to the work\n// start time on the next day.\nwhile ((next.getHours() > workEnd[0]) ||\n       (next.getHours() == workEnd[0] && next.getMinutes() > workEnd[1]) ||\n       (workDays.indexOf(next.getDay()) == -1)) {\n    next.setDate(next.getDate() + 1);\n    next.setHours(workStart[0]);\n    next.setMinutes(workStart[1]);\n}\n// If we're before the beginning of the workday, move to its start time.\nif ((next.getHours() < workStart[0]) ||\n    (next.getHours() == workStart[0] && next.getMinutes() < workStart[1])) {\n    next.setHours(workStart[0]);\n    next.setMinutes(workStart[1]);\n}"},
    DaysInARow: {help:"Send the message now, and subsequently once per day at the same time, until it has been sent three times. Specify a number as an argument to change the total number of sends.",body:"// Send the first message now, subsequent messages once per day.\nif (! prev)\n    next = new Date();\nelse {\n    var now = new Date();\n    next = new Date(prev); // Copy date argument so we don't modify it.\n    do {\n        next.setDate(next.getDate() + 1);\n    } while (next < now);\n    // ^^^ Don't try to send in the past, in case Thunderbird was asleep at\n    // the scheduled send time.\n}\nif (! args) // Send messages three times by default.\n    args = [3];\nnextargs = [args[0] - 1];\n// Recur if we haven't done enough sends yet.\nif (nextargs[0] > 0)\n    nextspec = \"function \" + specname;"},
    Delay: {help:"Simply delay message by some number of minutes. First argument is taken as the delay time.", body:"next = new Date(Date.now() + args[0]*60000);"}
  };
}

try {
  const UILocale = SLStatic.i18n.getUILanguage();
  Sugar.Date.setLocale(UILocale.split("-")[0]);
} catch (ex) {
  console.warn("[SendLater]: Unable to set date Sugar.js locale", ex);
}
