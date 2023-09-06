// WARNING: If you are importing script into an Experiement, then your
// Experiment MUST have a cachePrefs endpoint which takes an object and passes
// it into SLStatic.cachePrefs(...), and the extension's background script must
// call the Experiment's cachePrefs on initialization and every time the
// preferences change.

var SLStatic = {
  i18n: null,
  tempFolderName: "Send-Later-Temp",
  timeRegex: /^(2[0-3]|[01]?\d):?([0-5]\d)$/,
  _prefDefaults: null,
  // setPreferences isn't allowed to modify these
  readWriteFilterPrefs: ["instanceUUID", "releaseNotesVersion"],
  // getPreferences isn't allowed to return these
  readOnlyFilterPrefs: ["releaseNotesVersion"],
  thunderbirdVersion: null,

  async tb115(yes, no) {
    if (!SLStatic.thunderbirdVersion) {
      let browserInfo = await messenger.runtime.getBrowserInfo();
      SLStatic.thunderbirdVersion = parseInt(
        browserInfo.version.split(".")[0],
      );
    }
    if (SLStatic.thunderbirdVersion >= 115) {
      if (yes) {
        if (typeof yes == "function") {
          return yes();
        } else {
          return yes;
        }
      }
    } else {
      if (no) {
        if (typeof no == "function") {
          return no();
        } else {
          return no;
        }
      }
    }
  },

  preferences: {},
  listeningForStorageChanges: false,

  error: console.error,
  warn: console.warn,
  info: console.info,
  log: console.log,
  debug: console.debug,
  trace: console.trace,

  setLogConsoleLevel() {
    level = (this.preferences.logConsoleLevel || "all").toLowerCase();
    SLStatic.debug(`SLStatic.setLogConsoleLevel(${level})`);
    function logThreshold(l) {
      const levels = [
        "all",
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
      ];
      return levels.indexOf(l) >= levels.indexOf(level);
    }
    this.error = logThreshold("error") ? console.error : () => {};
    this.warn = logThreshold("warn") ? console.warn : () => {};
    this.info = logThreshold("info") ? console.info : () => {};
    this.log = logThreshold("log") ? console.log : () => {};
    this.debug = logThreshold("debug") ? console.debug : () => {};
    this.trace = logThreshold("trace") ? console.trace : () => {};
  },

  // Run a function and report any errors to the console, but don't let the
  // error propagate to the caller.
  async nofail(func, ...args) {
    try {
      await func(...args);
    } catch (e) {
      console.error(e);
    }
  },

  async prefDefaults() {
    if (!SLStatic._prefDefaults) {
      SLStatic._prefDefaults = await fetch("/utils/defaultPrefs.json").then(
        (ptxt) => ptxt.json(),
      );
    }
    return SLStatic._prefDefaults;
  },

  async userPrefKeys(readOnly) {
    let prefDefaults = await SLStatic.prefDefaults();
    let filterArray = readOnly
      ? SLStatic.readOnlyFilterPrefs
      : SLStatic.readWriteFilterPrefs;
    return Object.keys(prefDefaults).filter((k) => !filterArray.includes(k));
  },

  getLocale() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale;
    } catch (ex) {
      return SLStatic.i18n.getUILanguage();
    }
  },

  cacheChanged() {
    SLStatic.cachePrefs();
  },

  async cachePrefs(preferences) {
    SLStatic.debug("cachePrefs");
    if (!preferences) {
      if (!SLStatic.listeningForStorageChanges) {
        browser.storage.local.onChanged.addListener(SLStatic.cacheChanged);
        SLStatic.listeningForStorageChanges = true;
      }
      let storage = await browser.storage.local.get(["preferences"]);
      if (storage.preferences) {
        preferences = storage.preferences;
      }
    }
    if (preferences) {
      SLStatic.preferences = preferences;
      SLStatic.setLogConsoleLevel();
    }
  },

  RFC5322: {
    // RFC2822 / RFC5322 formatter
    dayOfWeek: (d) =>
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()],

    day: (d) => d.getDate(),

    month: (d) =>
      [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][d.getMonth()],

    year: (d) => d.getFullYear().toFixed(0),

    date(d) {
      return `${this.day(d)} ${this.month(d)} ${this.year(d)}`;
    },

    time(d) {
      let H = d.getHours().toString().padStart(2, "0");
      let M = d.getMinutes().toString().padStart(2, "0");
      let S = d.getSeconds().toString().padStart(2, "0");
      return `${H}:${M}:${S}`;
    },

    tz(d) {
      let offset = d.getTimezoneOffset() | 0;
      let sign = offset > 0 ? "-" : "+"; // yes, counterintuitive
      let absPad = (n) => Math.trunc(Math.abs(n)).toString().padStart(2, "0");
      return sign + absPad(offset / 60) + absPad(offset % 60);
    },

    format(d) {
      let day = this.dayOfWeek(d);
      let date = this.date(d);
      let time = this.time(d);
      let tz = this.tz(d);
      return `${day}, ${date} ${time} ${tz}`;
    },
  },

  padNum(num, len) {
    let isNegative = num < 0;
    let padLen = len - (isNegative ? 1 : 0);
    let padded = String(Math.abs(num)).padStart(padLen, "0");
    return (isNegative ? "-" : "") + padded;
  },

  flatten(arr) {
    // Flattens an N-dimensional array.
    return arr.reduce(
      (res, item) =>
        res.concat(Array.isArray(item) ? SLStatic.flatten(item) : item),
      [],
    );
  },

  generateUUID() {
    // Thanks to stackexchange for this one
    //    https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    // Note: This will eventually be replaced with a standard uuid javascript
    // module as part of the ecmascript standard.
    const uuid = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16),
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

  convertDate(date) {
    SLStatic.trace(`convertDate(${date})`);
    if (!date) {
      return null;
    } else if (date.raw) {
      date = date.raw;
    }

    if (typeof date === "string") {
      let relativeTo = new Date();
      const localeCode = SLStatic.getLocale();
      let sugarDate;
      for (let locale of [localeCode, localeCode.split("-")[0], "en"]) {
        sugarDate = Sugar.Date.get(relativeTo, date, {
          locale: locale,
          future: true,
        });
        if (sugarDate.getTime()) {
          return new Date(sugarDate.getTime());
        }
      }

      return null;
    } else if (typeof date === "number") {
      return new Date(date);
    } else if (date.getTime) {
      return new Date(date.getTime());
    }
    throw new Error(`Send Later error: unable to parse date format`, date);
  },

  estimateSendTime(scheduledDate, previousLoop, loopMinutes) {
    SLStatic.trace(
      `estimateSendTime(${scheduledDate}, ${previousLoop}, ${loopMinutes})`,
    );
    // Probably redundant but might as well be careful.
    scheduledDate = SLStatic.convertDate(scheduledDate);
    if (!(previousLoop && loopMinutes)) {
      SLStatic.debug(
        "estimateSendTime: mainloop data not set, returning input",
      );
      return scheduledDate;
    }
    let now = new Date();
    if (scheduledDate < now) {
      SLStatic.debug(
        "estimateSendTime: scheduled in past, starting with present",
      );
      scheduledDate = now;
    }

    let delta = scheduledDate.getTime() - previousLoop;
    let modulus = delta % (60000 * loopMinutes);
    let estimate = new Date(scheduledDate.getTime() + modulus);
    SLStatic.debug(
      `estimateSendTime: delta=${delta}, modulus=${modulus}, ` +
        `estimate=${estimate}`,
    );
    return estimate;
  },

  // Round datetime up to the next nearest full minute
  ceilDateTime(dt) {
    SLStatic.trace(`ceilDateTime(${dt})`);
    dt = SLStatic.convertDate(dt);
    return new Date(Math.ceil(dt.getTime() / 60000) * 60000);
  },

  // Round datetime down to the next nearest full minute
  floorDateTime(dt) {
    SLStatic.trace(`floorDateTime(${dt})`);
    dt = SLStatic.convertDate(dt);
    return new Date(Math.floor(dt.getTime() / 60000) * 60000);
  },

  // Round datetime to the nearest full minute
  roundDateTime(dt) {
    SLStatic.trace(`roundDateTime(${dt})`);
    dt = SLStatic.convertDate(dt);
    return new Date(Math.round(dt.getTime() / 60000) * 60000);
  },

  parseableDateTimeFormat(date) {
    SLStatic.trace(`parseableDateTimeFormat(${date})`);
    date = SLStatic.convertDate(date) || new Date();
    return SLStatic.RFC5322.format(date);
  },

  isoDateTimeFormat(date) {
    SLStatic.trace(`isoDateTimeFormat(${date})`);
    date = SLStatic.convertDate(date) || new Date();
    return date.toISOString();
  },

  defaultHumanDateTimeFormat(date) {
    const options = {
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return new Intl.DateTimeFormat([], options).format(date || new Date());
  },

  defaultShortHumanDateTimeFormat(date) {
    SLStatic.trace(`defaultShortHumanDateTimeFormat(${date})`);
    date = SLStatic.convertDate(date);
    const options = {
      hour: "numeric",
      minute: "numeric",
      month: "numeric",
      day: "numeric",
      year: "numeric",
    };
    return new Intl.DateTimeFormat([], options).format(date || new Date());
  },

  customHumanDateTimeFormat(date, fmt) {
    SLStatic.trace(`customHumanDateTimeFormat(${date}, ${fmt})`);
    date = SLStatic.convertDate(date);
    return Sugar.Date.format(date || new Date(), fmt);
  },

  humanDateTimeFormat(date) {
    if (
      this.preferences.customizeDateTime &&
      this.preferences.longDateTimeFormat !== ""
    ) {
      try {
        return this.customHumanDateTimeFormat(
          date,
          this.preferences.longDateTimeFormat,
        );
      } catch (ex) {
        this.warn(ex);
      }
    }
    return this.defaultHumanDateTimeFormat(date);
  },

  shortHumanDateTimeFormat(date) {
    if (
      this.preferences.customizeDateTime &&
      this.preferences.shortDateTimeFormat !== ""
    ) {
      try {
        return this.customHumanDateTimeFormat(
          date,
          this.preferences.shortDateTimeFormat,
        );
      } catch (ex) {
        this.warn(ex);
      }
    }
    return this.defaultShortHumanDateTimeFormat(date);
  },

  // There are definitely some edge cases here, e.g., !undefined == !0, but
  // they're not important for the intended use of this function.
  objectsAreTheSame(a, b) {
    if (typeof a == "object") {
      if (typeof b != "object") {
        return false;
      }
    } else if (typeof b == "object") {
      return false;
    } else {
      return a == b;
    }

    for (let key of Object.keys(a)) {
      if (!b.hasOwnProperty(key)) {
        return false;
      }
      if (!this.objectsAreTheSame(a[key], b[key])) {
        return false;
      }
    }

    for (let key of Object.keys(b)) {
      if (!a.hasOwnProperty(key)) {
        return false;
      }
    }

    return true;
  },

  compare(a, comparison, b, tolerance) {
    if (!tolerance) {
      tolerance = 0;
    }
    switch (comparison) {
      case "<":
        return a - b < tolerance;
      case ">":
        return a - b > tolerance;
      case "<=":
        return a - b <= tolerance;
      case ">=":
        return a - b >= tolerance;
      case "==":
      case "===":
        return Math.abs(a - b) <= tolerance;
      case "!=":
      case "!==":
        return Math.abs(a - b) > tolerance;
      default:
        throw new Error("Unknown comparison: " + comparison);
        break;
    }
  },

  compareDates(a, comparison, b) {
    SLStatic.trace(`compareDates(${a}, ${comparison}, ${b}`);
    a = SLStatic.convertDate(a);
    b = SLStatic.convertDate(b);
    const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return SLStatic.compare(A.getTime(), comparison, B.getTime());
  },

  compareTimes(a, comparison, b, ignoreSec, tolerance) {
    a = SLStatic.convertTime(a);
    b = SLStatic.convertTime(b);
    const A = new Date(
      2000,
      0,
      01,
      a.getHours(),
      a.getMinutes(),
      ignoreSec ? 0 : a.getSeconds(),
    );
    const B = new Date(
      2000,
      0,
      01,
      b.getHours(),
      b.getMinutes(),
      ignoreSec ? 0 : b.getSeconds(),
    );
    return SLStatic.compare(A.getTime(), comparison, B.getTime(), tolerance);
  },

  compareDateTimes(a, comparison, b, ignoreSec, tolerance) {
    SLStatic.trace(
      `compareDateTimes(${a}, ${comparison}, ${b}, ${ignoreSec}, ${tolerance})`,
    );
    const A = SLStatic.convertDate(a);
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
      date = new Date(2000, 0, 2 + +input); // 2000/01/02 Happens to be a Sunday
    }
    return new Intl.DateTimeFormat([], { weekday: style }).format(date);
  },

  parseDateTime(dstr, tstr) {
    // Inputs: dstr (formatted YYYY/MM/DD), tstr (formatted HH:MM)
    const dpts = dstr ? dstr.split(/\D/) : [0, 1, 0];
    const tpts = SLStatic.timeRegex.test(tstr)
      ? SLStatic.timeRegex.exec(tstr)
      : [null, 0, 0];
    return new Date(+dpts[0], --dpts[1], +dpts[2], +tpts[1], +tpts[2]);
  },

  formatTime(datetime, zeropad, human) {
    if (typeof datetime === "number") {
      datetime = new Date(datetime);
    } else if (typeof datetime === "string") {
      datetime = SLStatic.parseDateTime(null, datetime);
    }

    if (datetime.getTime) {
      const hours = ("" + datetime.getHours()).padStart(zeropad ? 2 : 1, "0");
      const minutes = ("" + datetime.getMinutes()).padStart(2, "0");
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
      relativeTo = new Date(Date.now() - 10);
    }
    const dt = (dateTime.getTime() - relativeTo.getTime()) / 1000;
    const DT = Math.abs(dt);
    const L = Sugar.Date.getLocale("en");
    const l = Sugar.Date.getLocale();

    const prettyRound = (n) => {
      if (n % 1 <= 0.3 || n % 1 > 0.7) {
        return Math.round(n).toFixed(0);
      } else {
        return n.toFixed(1);
      }
    };

    let num, u;
    if (DT < 60) {
      num = `${Math.floor(DT)}`;
      u = L.unitMap.seconds;
    } else if (DT < 60 * 2) {
      num = `${Math.round((DT / 60) * 10) / 10}`;
      u = L.unitMap.minutes;
    } else if (DT < 60 * 10) {
      num =
        (DT / 60) % 1 > 0.9
          ? `${Math.ceil(DT / 60)}`
          : `${Math.floor(DT / 60)}`;
      u = L.unitMap.minutes;
    } else if (DT < 60 * 55) {
      num = `${Math.floor(DT / 60)}`;
      u = L.unitMap.minutes;
    } else if (DT < 60 * 60 * 23.7) {
      num = prettyRound(DT / (60 * 60));
      u = L.unitMap.hours;
    } else if (DT <= 60 * 60 * 24 * 364.3) {
      num = prettyRound(DT / (60 * 60 * 24));
      u = L.unitMap.days;
    } else {
      num = prettyRound(DT / (60 * 60 * 24 * 365));
      u = L.unitMap.years;
    }

    const singular = !l.plural || num === "1";
    const unit = singular ? l.units[u] : l.units[8 + u];
    const sign = l[dt > -1 ? "fromNow" : "ago"];
    const format = l[dt > -1 ? "future" : "past"];
    return format.replace(/\{(.*?)\}/g, function (full, match) {
      switch (match) {
        case "num":
          return num;
        case "unit":
          return unit;
        case "sign":
          return sign;
      }
    });
  },

  // Splits a single label string into spans, where the first occurrence
  // of the access key is in its own element, with an underline.
  underlineAccessKey(label, modifier) {
    let idx = label.indexOf(modifier || "&");
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
      span1.textContent = label.substr(0, idx);
      const span2 = document.createElement("SPAN");
      span2.style.textDecoration = "underline";
      span2.textContent = modifier ? label[idx] : label[++idx];
      const span3 = document.createElement("SPAN");
      span3.textContent = label.substr(idx + 1);
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
      SLStatic.debug(
        `User function ${name} (prev: ${prev}, args: ${args}) ` +
          `returned error.`,
        ex,
      );
      return { error: ex.message };
    }

    if (response === undefined) {
      let error = `Send Later: Recurrence function '${name}' did not return a value`;
      SLStatic.warn(error);
      return { error };
    }

    let recvdType;
    if (typeof response === "number") {
      recvdType = "number";
    } else if (response.getTime) {
      recvdType = "date";
    } else if (response.splice) {
      recvdType = "array";
    } else {
      let error = `Recurrence function "${name}" did not return number, Date, or array`;
      SLStatic.warn(error);
      return { error };
    }

    const prevOrNow = prev ? new Date(prev).getTime() : Date.now();

    switch (recvdType) {
      case "number":
        if (response < 0) {
          return { sendAt: null };
        } else {
          return {
            sendAt: new Date(prevOrNow + response * 60 * 1000),
          };
        }
      case "date":
        return { sendAt: response };
      case "array":
        if (response.length < 2) {
          let error = `Array returned by recurrence function "${name}" is too short`;
          SLStatic.warn(error);
          return { error };
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
          let error =
            `Send Later: Array ${response} returned by recurrence ` +
            `function ${name}" did not start with a number or Date`;
          SLStatic.warn(error);
          return { error };
        }
        return {
          sendAt,
          nextspec: response[1],
          nextargs: response[2],
          error: undefined,
        };
    }
  },

  customHdrToScheduleInfo(customHeaders, instanceUUID) {
    let cellText = "";
    let sortValue = (Math.pow(2, 31) - 5) | 0;

    if (!customHeaders["content-type"]) {
      SLStatic.warn("Didn't receive complete headers.");
      return { cellText, sortValue };
    } else if (!customHeaders["x-send-later-at"]) {
      // Do nothing. Leave cell properties as default
      return { cellText, sortValue };
    }

    if (customHeaders["x-send-later-uuid"] !== instanceUUID) {
      cellText = this.i18n.getMessage("incorrectUUID");
      sortValue = (Math.pow(2, 31) - 2) | 0;
    } else {
      const sendAt = new Date(customHeaders["x-send-later-at"]);
      const recurSpec = customHeaders["x-send-later-recur"] || "none";
      let recur = SLStatic.parseRecurSpec(recurSpec);
      recur.cancelOnReply = ["true", "yes"].includes(
        customHeaders["x-send-later-cancel-on-reply"],
      );
      recur.args = customHeaders["x-send-later-args"];
      cellText = SLStatic.formatScheduleForUIColumn({ sendAt, recur });
      // Numbers will be truncated. Be sure this fits in 32 bits
      sortValue = (sendAt.getTime() / 1000) | 0;
    }
    return { cellText, sortValue };
  },

  /* Given a user function and an "unparsed" argument string,
   * this function returns a common schedule object, including
   * `sendAt` and `recur` members.
   */
  parseUfuncToSchedule(name, body, prev, argStr) {
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

    const { sendAt, nextspec, nextargs, error } = this.evaluateUfunc(
      name,
      body,
      prev,
      args,
    );
    this.debug("User function returned:", {
      sendAt,
      nextspec,
      nextargs,
      error,
    });

    if (error) {
      throw new Error(error);
    } else {
      let recur = this.parseRecurSpec(nextspec || "none") || { type: "none" };
      if (recur.type !== "none") recur.args = nextargs || "";

      const schedule = { sendAt, recur };
      this.debug("commands.onCommand received ufunc response:", schedule);
      return schedule;
    }
  },

  formatRecurForUI(recur) {
    if (!recur || recur.type === "none") {
      return "";
    }
    let recurText = "";
    let typeCap = recur.type.charAt(0).toUpperCase() + recur.type.slice(1);
    if (recur.type === "function") {
      // Almost certainly doesn't work for all languages. Need a new translation
      // for "recur according to function $1"
      recurText = this.i18n
        .getMessage("sendwithfunction", [recur.function])
        .replace(/^\S*/, this.i18n.getMessage("recurLabel"));
      if (recur.args) {
        let funcArgsLabel = this.i18n.getMessage(
          "sendlater.prompt.functionargs.label",
        );
        recurText += `\n${funcArgsLabel}: [${recur.args}]`;
      }
    } else if (recur.type === "monthly") {
      recurText = this.i18n.getMessage("recurLabel") + " ";

      let monthlyRecurParts = [];

      if (!recur.multiplier) {
        monthlyRecurParts.push(this.i18n.getMessage(`recur${typeCap}Label`));
      }

      if (recur.monthly_day) {
        const ordDay = this.i18n.getMessage("ord" + recur.monthly_day.week);
        const dayName = SLStatic.getWkdayName(recur.monthly_day.day, "long");
        monthlyRecurParts.push(
          `${this.i18n.getMessage("everymonthly", [ordDay, dayName])}`,
        );
      }

      if (recur.multiplier) {
        monthlyRecurParts.push(
          this.i18n.getMessage("every_" + recur.type, recur.multiplier),
        );
      }

      recurText += monthlyRecurParts.join(", ");
    } else {
      recurText = this.i18n.getMessage("recurLabel") + " ";

      const multiplier = recur.multiplier || 1;
      if (multiplier === 1) {
        recurText += this.i18n.getMessage(`recur${typeCap}Label`);
      } else {
        recurText += this.i18n.getMessage("every_" + recur.type, multiplier);
      }
    }

    if (recur.between) {
      const start = SLStatic.formatTime(recur.between.start, false, true);
      const end = SLStatic.formatTime(recur.between.end, false, true);
      recurText += " " + this.i18n.getMessage("betw_times", [start, end]);
    }

    if (recur.days) {
      const days = recur.days.map((v) => SLStatic.getWkdayName(v));
      let onDays;
      if (/^en/i.test(SLStatic.getLocale())) {
        if (days.length === 1) {
          onDays = days;
        } else if (days.length === 2) {
          onDays = days.join(" and ");
        } else {
          const ndays = days.length;
          days[ndays - 1] = `and ${days[ndays - 1]}`;
          onDays = days.join(", ");
        }
      } else {
        onDays = days.join(", ");
      }
      recurText += `\n${this.i18n.getMessage("sendOnlyOnLabel")} ${onDays}`;
    }

    if (recur.until) {
      let formattedUntil = this.shortHumanDateTimeFormat(recur.until);
      recurText +=
        "\n" + this.i18n.getMessage("until_datetime", formattedUntil);
    }

    if (recur.cancelOnReply) {
      recurText += "\n" + this.i18n.getMessage("cancel_on_reply");
    }

    return recurText.trim();
  },

  formatScheduleForUIColumn(schedule) {
    if (/encrypted/i.test(schedule.contentType)) {
      return (
        "Warning: Message is encrypted and will not be processed by " +
        "Send Later"
      );
    }

    let sendAt = schedule.sendAt;
    let recur = schedule.recur;

    let scheduleText;
    if (recur !== undefined && !sendAt && recur.type === "function") {
      scheduleText = this.i18n.getMessage("sendwithfunction", [
        recur.function,
      ]);
    } else {
      scheduleText = SLStatic.shortHumanDateTimeFormat(sendAt);
    }

    const rTxt = SLStatic.formatRecurForUI(recur).replace(/\n/gm, ". ");
    if (rTxt) {
      scheduleText += ` (${rTxt})`;
    }

    return scheduleText;
  },

  formatScheduleForUI(schedule, previousLoop, loopMinutes) {
    let scheduleText;
    if (!schedule.sendAt && schedule.recur.type === "function") {
      scheduleText = this.i18n.getMessage("sendwithfunction", [
        schedule.recur.function,
      ]);
    } else {
      let sendAt = SLStatic.estimateSendTime(
        schedule.sendAt,
        previousLoop || new Date(Math.floor(Date.now() / 60000) * 60000),
        loopMinutes || 1,
      );

      scheduleText = this.i18n.getMessage("sendAtLabel");
      scheduleText += " " + SLStatic.humanDateTimeFormat(sendAt);
      const fromNow = (sendAt.getTime() - Date.now()) / 1000;
      if (fromNow < 0 && fromNow > -90) {
        scheduleText += ` (${new Sugar.Date(Date.now() + 100).relative()})`;
      } else {
        try {
          scheduleText += ` (${SLStatic.formatRelative(sendAt)})`;
        } catch (ex) {
          SLStatic.warn(ex);
        }
      }
    }

    scheduleText += "\n" + SLStatic.formatRecurForUI(schedule.recur);

    return scheduleText.trim();
  },

  stateSetter(enabled) {
    // closure for enabling/disabling UI components
    return async (element) => {
      try {
        if (["SPAN", "DIV", "LABEL"].includes(element.tagName)) {
          element.style.color = enabled ? "black" : "#888888";
        }
        element.disabled = !enabled;
      } catch (ex) {
        SLStatic.error(ex);
      }
      const enabler = SLStatic.stateSetter(enabled);
      [...element.childNodes].forEach(enabler);
    };
  },

  // Get header's value from raw MIME message content.
  // e.g. "subject: foo bar    baz" returns "foo bar    baz"
  getHeader(content, header) {
    const regex = new RegExp(
      `^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,
      "im",
    );
    let hdrContent = content.split(/\r\n\r\n/m)[0] + "\r\n";
    if (regex.test(hdrContent)) {
      let hdrLine = hdrContent.match(regex)[0];
      // Strip off the header key (everything before the first colon)
      hdrLine = hdrLine.replace(/[^:]*:/m, "");
      // We can assume all CRLF sequences are followed by whitespace,
      // since they matched the regex above. This complies with RFC822:
      // https://datatracker.ietf.org/doc/html/rfc822#section-3.1.1
      hdrLine = hdrLine.replace(/\r\n/gm, "");
      return hdrLine.trim();
    } else {
      return undefined;
    }
  },

  // Replaces the header content with a new value.
  //    replaceAll: operate on all instances of the header (can be regex)
  //    addIfMissing: If the header does not exist
  replaceHeader(content, header, value, replaceAll, addIfMissing) {
    const regexStr = `^${header}:.*(?:\r\n|\n)([ \t].*(?:\r\n|\n))*`;
    const replacement = value ? `${header}: ${value}\r\n` : "";
    const regex = new RegExp(regexStr, replaceAll ? "img" : "im");
    const hdrContent = content.split(/\r\n\r\n/m)[0] + "\r\n";
    const msgContent = content
      .split(/\r\n\r\n/m)
      .slice(1)
      .join("\r\n\r\n");
    if (addIfMissing && !regex.test(hdrContent)) {
      return `${hdrContent.trim()}\r\n${header}: ${value}\r\n\r\n${msgContent}`;
    } else {
      const newHdrs = hdrContent.replace(regex, replacement);
      return `${newHdrs.trim()}\r\n\r\n${msgContent}`;
    }
  },

  appendHeader(content, header, value) {
    const regex = new RegExp(
      `^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,
      "im",
    );
    const hdrContent = content.split(/\r\n\r\n/m)[0] + "\r\n";
    const msgContent = content
      .split(/\r\n\r\n/m)
      .slice(1)
      .join("\r\n\r\n");
    if (regex.test(hdrContent)) {
      const values = hdrContent
        .match(regex)[0]
        .trim()
        .slice(header.length + 1)
        .trim()
        .split(/\r\n/)
        .map((s) => s.trim());
      values.push(value);
      const newHdrs = hdrContent.replace(
        regex,
        `${header}: ${values.join("\r\n ")}\r\n`,
      );
      return `${newHdrs.trim()}\r\n\r\n${msgContent}`;
    } else {
      return `${hdrContent.trim()}\r\n${header}: ${value}\r\n\r\n${msgContent}`;
    }
  },

  prepNewMessageHeaders(content) {
    content = SLStatic.replaceHeader(
      content,
      "Date",
      SLStatic.parseableDateTimeFormat(),
      false,
    );
    content = SLStatic.replaceHeader(
      content,
      "X-Send-Later-[a-zA-Z0-9-]*",
      null,
      true,
    );
    content = SLStatic.replaceHeader(
      content,
      "X-Enigmail-Draft-Status",
      null,
      false,
    );
    content = SLStatic.replaceHeader(content, "Autocrypt", null, false);
    content = SLStatic.replaceHeader(content, "Openpgp", null, false);
    return content;
  },

  parseArgs(argstring) {
    return JSON.parse(`[${argstring || ""}]`);
  },

  unparseArgs(args) {
    // Convert a list into its string representation, WITHOUT the square
    // braces around the entire list.
    let arglist = JSON.stringify(args || [], null, " ");
    arglist = arglist.replace(/\r?\n\s*/g, " "); // Remove newlines
    arglist = arglist.replace(/\[\s*/g, "[").replace(/\s*\]/g, "]"); // Cleanup
    arglist = arglist.replace(/^\[|\]$/g, ""); // Strip outer brackets
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

     Sending can be restricted with any combination of the following:

     - "between HH:MM HH:MM" to indicate a time of day restriction
     - "on # ..." to indicate day of week restrictions
     - "until [date-time]" to indicate when the recurrence terminates
  */

  // recur (object) -> recurSpec (string)
  unparseRecurSpec(recur) {
    let spec = recur.type;

    if (spec === "none") return spec;

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
      spec += " / " + recur.multiplier;
    }

    if (recur.between) {
      const start = SLStatic.formatTime(recur.between.start, false, false);
      const end = SLStatic.formatTime(recur.between.end, false, false);
      spec += ` between ${start} ${end}`;
    }

    if (recur.days) {
      spec += " on " + recur.days.join(" ");
    }

    if (recur.until) {
      spec += ` until ${SLStatic.isoDateTimeFormat(recur.until)}`;
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
    if (
      ![
        "none",
        "minutely",
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "function",
      ].includes(recur.type)
    ) {
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
            day: parseInt(params.shift()),
            week: parseInt(params.shift()),
          };
          if (recur.monthly_day.day < 0 || recur.monthly_day.day > 6) {
            throw new Error("Invalid monthly day argument in " + recurSpec);
          }
          if (recur.monthly_day.week < 1 || recur.monthly_day.week > 5) {
            throw new Error("Invalid monthly week argument in " + recurSpec);
          }
        } else {
          recur.monthly = parseInt(params.shift());
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
          month: parseInt(params.shift()),
          date: parseInt(params.shift()),
        };

        // Check that this month/date combination is possible at all.
        // Use a leap year for this test.
        const test = new Date(2000, recur.yearly.month, recur.yearly.date);
        if (
          test.getMonth() !== recur.yearly.month ||
          test.getDate() !== recur.yearly.date
        ) {
          throw new Error("Invalid yearly date in " + recurSpec);
        }
        break;
      case "function":
        recur.function = params.shift();
        recur.finished = params[0] === "finished";

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
        if (!/^[1-9]\d*$/.test(multiplier)) {
          throw new Error("Invalid multiplier argument in " + recurSpec);
        }
        recur.multiplier = parseInt(multiplier);
        params.splice(slashIndex, 2);
      }
    }

    const btwnIdx = params.indexOf("between");
    if (btwnIdx > -1) {
      const startTimeStr = params[btwnIdx + 1];
      const endTimeStr = params[btwnIdx + 2];

      if (!SLStatic.timeRegex.test(startTimeStr)) {
        throw new Error("Invalid between start in " + recurSpec);
      } else if (!SLStatic.timeRegex.test(endTimeStr)) {
        throw new Error("Invalid between end in " + recurSpec);
      }

      recur.between = {
        start: SLStatic.formatTime(startTimeStr, false, false),
        end: SLStatic.formatTime(endTimeStr, false, false),
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
        recur.days.push(parseInt(day));
      }
      if (!recur.days.length) {
        throw new Error("Day restriction with no days in spec " + recurSpec);
      }
    }
    let untilIndex = params.indexOf("until");
    if (untilIndex > -1) {
      let untilDTstring = params[untilIndex + 1];
      recur.until = new Date(untilDTstring);
      params.splice(untilIndex, 2);
    }
    if (params.length) {
      throw new Error("Extra arguments in " + recurSpec);
    }
    return recur;
  },

  async nextRecurFunction(prev, recurSpec, recur, args) {
    if (!recur.function) {
      throw new Error(
        `Invalid recurrence specification '${recurSpec}': ` +
          "No function defined",
      );
    }

    const funcName = recur.function.replace(/^ufunc:/, "");
    const { ufuncs } = await browser.storage.local.get({ ufuncs: {} });

    prev = new Date(prev);

    if (ufuncs[funcName] === undefined) {
      throw new Error(
        `Invalid recurrence specification '${recurSpec}': ` +
          `${funcName} is not defined.`,
      );
    }

    let nextRecur = SLStatic.evaluateUfunc(
      funcName,
      ufuncs[funcName].body,
      prev,
      args,
    );

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
      if (recur.until) {
        functionSpec.until = recur.until;
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
      const nextRecur = await SLStatic.nextRecurFunction(
        next,
        recurSpec,
        recur,
        args,
      );
      if (nextRecur && nextRecur.sendAt && (recur.between || recur.days)) {
        nextRecur.sendAt = SLStatic.adjustDateForRestrictions(
          nextRecur.sendAt,
          recur.between && recur.between.start,
          recur.between && recur.between.end,
          recur.days,
        );
      }
      if (recur.until && recur.until.getTime() < nextRecur.sendAt.getTime()) {
        SLStatic.debug(
          `Recurrence ending because of "until" restriction: ` +
            `${recur.until} < ${nextRecur.sendAt}`,
        );
        return null;
      }
      return nextRecur;
    }

    if (!now) now = new Date();

    let redo = false;

    if (!recur.multiplier) {
      recur.multiplier = 1;
    }

    while (next <= now || recur.multiplier > 0 || redo) {
      redo = false;
      switch (recur.type) {
        case "minutely":
          next.setMinutes(next.getMinutes() + 1);
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
            if (
              next.getDay() === +recur.monthly_day.day &&
              Math.ceil(next.getDate() / 7) === +recur.monthly_day.week
            ) {
              next.setDate(1);
              next.setMonth(next.getMonth() + 1);
            } else {
            }
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
          throw new Error(
            "Send Later error: unrecognized recurrence type: " + recur.type,
          );
          break;
      }

      recur.multiplier--;
    }

    if (recur.between || recur.days) {
      next = SLStatic.adjustDateForRestrictions(
        next,
        recur.between && recur.between.start,
        recur.between && recur.between.end,
        recur.days,
      );
    }

    if (recur.until && recur.until.getTime() < next.getTime()) {
      SLStatic.debug(
        `Recurrence ending because of "until" restriction: ` +
          `${recur.until} < ${next}`,
      );
      return null;
    }

    return { sendAt: next };
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
  //    want to go to the beginning of the allowed time range on the next valid
  //    day.
  adjustDateForRestrictions(
    sendAt,
    start_time,
    end_time,
    days,
    soonest_valid,
  ) {
    // Copy argument variable to avoid modifying the original
    // (Is this really necessary?)
    sendAt = new Date(sendAt.getTime());
    start_time = SLStatic.convertTime(start_time);
    end_time = SLStatic.convertTime(end_time);

    if (
      start_time &&
      SLStatic.compareTimes(sendAt, "<", start_time, true, 1000)
    ) {
      // 1) If there is a time restriction and the scheduled time is before it,
      // reschedule to the beginning of the time restriction.
      sendAt.setHours(start_time.getHours());
      sendAt.setMinutes(start_time.getMinutes());
    } else if (
      end_time &&
      SLStatic.compareTimes(sendAt, ">", end_time, true, 1000)
    ) {
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
      sendAt.setDate(sendAt.getDate() + 1);
      if (soonest_valid && start_time) {
        // 4) Go to soonest valid time, rather than just skipping days.
        sendAt.setHours(start_time.getHours());
        sendAt.setMinutes(start_time.getMinutes());
      }
    }
    return sendAt;
  },

  parseHeadersForPopupUICache(headers) {
    SLStatic.trace(`parseHeadersForPopupUICache(${headers})`);
    // input elements:
    //   - send-datetime (string)
    //   - recur (radio: once, minutely, daily, ...)
    //   - recur-multiplier (number)
    //   - recur-monthly-byweek (checkbox)
    //   - recur-function-args (text)
    //   - recur-cancelonreply (checkbox)
    //   - sendbetween (checkbox)
    //   - sendbetween-start (time)
    //   - sendbetween-end (time)
    //   - senduntil (checkbox)
    //   - senduntil-date (date)
    //   - senduntil-time (time)
    //   - sendon (checkbox)
    //   - sendon-{saturday|sunday|...} (checkboxes)
    // select elements:
    //   - recurFuncSelect
    //   - recur-monthly-byweek-week
    //   - recur-monthly-byweek-day

    for (let hdrName in headers) {
      if (hdrName.toLowerCase().startsWith("x-send-later")) {
        let hdrVal = headers[hdrName];
        headers[hdrName.toLowerCase()] = Array.isArray(hdrVal)
          ? hdrVal[0]
          : hdrVal;
      }
    }
    let sendAt = new Date(headers["x-send-later-at"]);
    let recurSpec = headers["x-send-later-recur"] || "none";
    let recur = SLStatic.parseRecurSpec(recurSpec);
    recur.cancelOnReply = ["true", "yes"].includes(
      headers["x-send-later-cancel-on-reply"],
    );
    recur.args = headers["x-send-later-args"];

    let dom = {
      "send-datetime": SLStatic.shortHumanDateTimeFormat(sendAt),
    };

    for (let recurType of [
      "once",
      "minutely",
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "function",
    ]) {
      dom[recurType] = recur.type === recurType;
    }

    if (recur.type === "none") {
      dom["once"] = true;
      return dom;
    }

    dom["recur-cancelonreply"] = recur.cancelOnReply;
    if (recur.multiplier) dom["recur-multiplier"] = recur.multiplier;

    dom["recur-function-args"] = recur.args || "";
    if (recur.type === "function" && recur.finished) {
      dom["recur"] = "none";
    } else if (recur.function) {
      dom["recurFuncSelect"] = recur.function;
    }

    if (recur.type === "monthly") {
      if (recur.monthly_day) {
        dom["recur-monthly-byweek"] = true;
        dom["recur-monthly-byweek-day"] = recur.monthly_day.day;
        dom["recur-monthly-byweek-week"] = recur.monthly_day.week;
      } else {
        dom["recur-monthly-byweek"] = false;
      }
    }

    if (recur.between) {
      dom["sendbetween"] = true;
      let start = SLStatic.parseDateTime(null, recur.between.start);
      let end = SLStatic.parseDateTime(null, recur.between.end);
      dom["sendbetween-start"] = SLStatic.formatTime(start, true, true);
      dom["sendbetween-end"] = SLStatic.formatTime(end, true, true);
    } else {
      dom["sendbetween"] = false;
    }

    if (recur.days) {
      dom["sendon"] = true;
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      for (let i = 0; i < 7; i++) {
        dom[`sendon-${dayNames[i]}`] = recur.days.includes(i);
      }
    } else {
      dom["sendon"] = false;
    }

    if (recur.until) {
      dom["senduntil"] = true;
      let isoSendUntil = SLStatic.convertDate(recur.until).toISOString();
      dom["senduntil-date"] = isoSendUntil.substr(0, 10); // YYYY-mm-dd
      dom["senduntil-time"] = isoSendUntil.substr(11, 5); // HH:MM
    } else {
      dom["senduntil"] = false;
    }

    return dom;
  },

  // Original idea:
  // https://thunderbird.topicbox.com/groups/addons/T06356567165277ee-M25e96f2d58e961d6167ad348/charset-problem-when-saving-to-eml-format
  // My improvement to it:
  // https://thunderbird.topicbox.com/groups/addons/T06356567165277ee-Md1002780236b2a1ad92e88bd/charset-problem-when-saving-to-eml-format
  getFileFromRaw(binaryString) {
    let bytes = new Array(binaryString.length);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new File([new Uint8Array(bytes)], "message.eml", {
      type: "message/rfc822",
    });
  },

  // Like messenger.messages.import, but supports IMAP folders.
  // Cribbed from https://github.com/cleidigh/EditEmailSubject-MX/blob/master/
  // src/content/scripts/editemailsubject.mjs, as recommended by John Bieling.
  async messageImport(file, destination, properties) {
    // Operation is piped thru a local folder, since messages.import does not
    // currently work with imap.
    let localAccount = (await messenger.accounts.list(false)).find(
      (account) => account.type == "none",
    );
    let isLocal = localAccount.id == destination.accountId;
    let localFolder;
    if (isLocal) {
      localFolder = destination;
    } else {
      let localFolders = await messenger.folders.getSubFolders(
        localAccount,
        false,
      );
      localFolder = localFolders.find(
        (folder) => folder.name == SLStatic.tempFolderName,
      );
      if (!localFolder) {
        localFolder = await messenger.folders.create(
          localAccount,
          SLStatic.tempFolderName,
        );
      }
    }
    let newMsgHeader = await messenger.messages.import(
      file,
      localFolder,
      properties,
    );

    if (!newMsgHeader) {
      return false;
    }
    SLStatic.debug(`Saved local message ${newMsgHeader.id}`);

    if (isLocal) {
      SLStatic.debug(
        "Destination folder is already local, not moving message",
      );
      return true;
    }

    // Move new message from temp folder to real destination.
    let moved;
    await messenger.messages
      .move([newMsgHeader.id], destination)
      .then(() => {
        moved = true;
      })
      .catch(() => {
        moved = false;
      });
    return moved;
  },

  translationURL(url) {
    let locale = SLStatic.i18n.getUILanguage();
    if (locale.toLowerCase().startsWith("en")) {
      return url;
    } else {
      let [all, before, host, after] = /(.*\/\/)([^/]+)(.*)/.exec(url);
      host =
        host.replaceAll("-", "--").replaceAll(".", "-") + ".translate.goog";
      return before + host + after + `?_x_tr_sl=en&_x_tr_tl=${locale}`;
    }
  },

  telemetryNonce() {
    // Putting a nonce in the telemetry URL prevents identical telemetry
    // requests from getting intercepted by the cache. Making the nonce only
    // change once per minute leverages the cache to protect against the
    // possibility of a bug causing a client to submit the same request many
    // times in short order. This limits the use of telemetry for events that
    // occur frequently whose frequency we care a lot about, but I'm OK with
    // losing that big of signal for the sake of not accidentally DDoS'ing the
    // telemetry server by introducing a bug in the add-on.
    return new Sugar.Date().format("%Y%m%d%H%M").raw;
  },

  telemetrySend(values) {
    console.log("telemetrySend");
    if (!this.preferences.telemetryEnabled) {
      return;
    }
    if (this.preferences.telemetryUUIDEnabled) {
      let uuid = this.preferences.telemetryUUID;
      if (!uuid) {
        uuid = this.generateUUID().slice(1, -1);
        this.preferences.telemetryUUID = uuid;
        // We just let this promise complete in the background because it's not
        // incredibly important if the UUID isn't saved successfully, better
        // luck next time!
        messenger.storage.local.set({ preferences: this.preferences });
      }
      values.uuid = uuid;
    }
    values.locale = this.getLocale();
    values.nonce = this.telemetryNonce();
    if (!this.preferences.telemetryURL) {
      return;
    }
    let query = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      query.append(key, value);
    });
    let url = `${this.preferences.telemetryURL}?${query.toString()}`;
    try {
      let req = new XMLHttpRequest();
      req.addEventListener("load", (event) => {
        SLStatic.debug("telemetrySend successful");
      });
      req.addEventListener("error", (event) => {
        SLStatic.debug("telemetrySend failed", event);
      });

      req.open("GET", url);
      req.send();
      // We don't care about the response. Off it goes into the ether! Hopefully
      // it arrives, but we're not going to wait around to find out!
    } catch (ex) {
      SLStatic.error("telemetrySend failure", ex);
    }
  },

  // changes is an array of two-item arrays, each of which is a key and a value.
  async setPreferences(changes) {
    let { preferences } = await messenger.storage.local.get({
      preferences: {},
    });
    changes.forEach(([key, value]) => {
      preferences[key] = value;
    });
    await messenger.storage.local.set({ preferences });
  },
};

/*
  We need to mock certain functions depending on the execution context. We made
  it to this point either through the extension itself, or through an
  experiment context, or via a Node-based unit test.
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
      let EP;
      if (typeof ExtensionParent !== "undefined") {
        EP = ExtensionParent;
      } else if (
        typeof window !== "undefined" &&
        typeof window.ExtensionParent !== "undefined"
      ) {
        EP = window.ExtensionParent;
      } else {
        var { ExtensionParent } = ChromeUtils.import(
          "resource://gre/modules/ExtensionParent.jsm",
        );
        EP = ExtensionParent;
      }
      const ext = EP.GlobalManager.getExtension("sendlater3@kamens.us");

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
              SLStatic.warn(
                `Unable to find message ${messageName} in ` +
                  `locale ${selectedLocale}`,
              );
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
                // This is not quite Chrome-compatible. Chrome consumes any
                // number of digits following the $, but only accepts 9
                // substitutions. We accept any number of substitutions.
                index = parseInt(index, 10) - 1;
                return index in substitutions ? substitutions[index] : "";
              }
              // For any series of contiguous `$`s, the first is dropped, and
              // the rest remain in the output string.
              return dollarSigns;
            };
            return str.replace(/\$(?:([1-9]\d*)|(\$+))/g, replacer);
          } catch (e) {
            console.warn("Unable to get localized message.", e);
          }
          return "";
        },
      };
    } catch (e) {
      SLStatic.warn("Unable to load i18n from extension.", e);
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
          if (
            typeof window !== "undefined" &&
            typeof window.localeMessages === "object"
          ) {
            // browser environment
            msg = localeMessages[key].message;
          } else {
            // node.js environment
            msg = global.localeMessages[key].message;
          }
          return msg.replace(/\$\d/g, (i) => args[--i[1]]);
        } catch (e) {
          console.warn(e);
          return key;
        }
      },
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
          Object.keys(key).forEach((key) => {
            if (SLStatic.mockStorage[key]) {
              ret[key] = SLStatic.mockStorage[key];
            } else {
              ret[key] = {};
            }
          });

          return ret;
        },
        async set(item) {
          console.log("mock storage", SLStatic.mockStorage);
          Object.assign(SLStatic.mockStorage, item);
          console.log("mock storage", SLStatic.mockStorage);
        },
      },
    },
    runtime: {
      sendMessage(...args) {
        console.debug("Sent message to background script", args);
      },
    },
    SL3U: {
      async getLegacyPref(name, dtype, def) {
        return null;
      },
      async setHeader(tabId, name, value) {
        return null;
      },
    },
  };

  if (typeof window === "undefined") {
    // Make this file node.js-aware for browserless unit testing
    const fs = require("fs"),
      path = require("path"),
      filePath = path.join(__dirname, "..", "_locales", "en", "messages.json");
    const contents = fs.readFileSync(filePath, { encoding: "utf-8" });
    global.localeMessages = JSON.parse(contents);
    global.SLStatic = SLStatic;
    global.browser = browser;
  } else {
    // We're in a non-addon browser environment (functional tests)
    fetch("/_locales/en/messages.json")
      .then((response) => response.json())
      .then((locale) => {
        window.localeMessages = locale;
      });
  }

  SLStatic.mockStorage.ufuncs = {
    ReadMeFirst: {
      help: `Any text you put here will be displayed as a tooltip when you \
hover over the name of the function in the menu. You can use this to document \
what the function does and what arguments it accepts.`,
      body: `\
// Send the first message now, subsequent messages once per day.
if (! prev)
  next = new Date();
else {
  var now = new Date();
  next = new Date(prev); // Copy date argument so we don't modify it.
  do {
    next.setDate(next.getDate() + 1);
  } while (next < now);
  // ^^^ Don't try to send in the past, in case Thunderbird was asleep at
  // the scheduled send time.
}
if (! args) // Send messages three times by default.
  args = [3];
nextargs = [args[0] - 1];
// Recur if we haven't done enough sends yet.
if (nextargs[0] > 0)
  nextspec = \"function \" + specname;";
`,
    },
    BusinessHours: {
      help: `Send the message now if it is during business hours, or at the \
beginning of the next work day. You can change the definition of work days \
(default: Mon - Fri) by passing in an array of work-day numbers as the first \
argument, where 0 is Sunday and 6 is Saturday. You can change the work start \
or end time (default: 8:30 - 17:30) by passing in an array of [H, M] as the \
second or third argument. Specify “null” for earlier arguments you don't \
change. For example, “null, [9, 0], [17, 0]” changes the work hours without \
changing the work days.`,
      body: `\
// Defaults
var workDays = [1, 2, 3, 4, 5]; // Mon - Fri; Sun == 0, Sat == 6
var workStart = [8, 30]; // Start of the work day as [H, M]
var workEnd = [17, 30]; // End of the work day as [H, M]
if (args && args[0])
  workDays = args[0];
if (args && args[1])
  workStart = args[1];
if (args && args[2])
  workEnd = args[2];
if (prev)
  // Not expected in normal usage, but used as the current time for testing.
  next = new Date(prev);
else
  next = new Date();

if (workDays.length == 0 || !workDays.every(d => (d >= 0) && (d <= 6)))
  return undefined;

// If we're past the end of the workday or not on a workday, move to the work
// start time on the next day.
while ((next.getHours() > workEnd[0]) ||
       (next.getHours() == workEnd[0] && next.getMinutes() > workEnd[1]) ||
       (workDays.indexOf(next.getDay()) == -1)) {
  next.setDate(next.getDate() + 1);
  next.setHours(workStart[0]);
  next.setMinutes(workStart[1]);
}
// If we're before the beginning of the workday, move to its start time.
if ((next.getHours() < workStart[0]) ||
    (next.getHours() == workStart[0] && next.getMinutes() < workStart[1])) {
  next.setHours(workStart[0]);
  next.setMinutes(workStart[1]);
}
`,
    },
    DaysInARow: {
      help: `Send the message now, and subsequently once per day at the same \
time, until it has been sent three times. Specify a number as an argument to \
change the total number of sends.`,
      body: `\
// Send the first message now, subsequent messages once per day.
if (! prev)
  next = new Date();
else {
  var now = new Date();
  next = new Date(prev); // Copy date argument so we don't modify it.
  do {
    next.setDate(next.getDate() + 1);
  } while (next < now);
  // ^^^ Don't try to send in the past, in case Thunderbird was asleep at
  // the scheduled send time.
}
if (! args) // Send messages three times by default.
  args = [3];
nextargs = [args[0] - 1];
// Recur if we haven't done enough sends yet.
if (nextargs[0] > 0)
  nextspec = \"function \" + specname;
`,
    },
    Delay: {
      help: `Simply delay message by some number of minutes. First argument \
is taken as the delay time.`,
      body: "next = new Date(Date.now() + args[0]*60000);",
    },
  };
}

try {
  const locale = SLStatic.getLocale();
  try {
    Sugar.Date.setLocale(locale);
  } catch (ex) {
    console.warn(`Error setting Sugar locale to ${locale}: ${ex}`, ex);
    let fallback = locale.split("-")[0];
    try {
      Sugar.Date.setLocale(fallback);
    } catch (ex) {
      console.warn(
        `[SendLater]: Error setting Sugar locale to ${fallback}: ${ex}`,
        ex,
      );
    }
  }
} catch (ex) {
  console.warn(`[SendLater]: Unable to set date Sugar.js locale: ${ex}`, ex);
}

if (browser) {
  SLStatic.cachePrefs();
}
