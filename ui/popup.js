// changes is an array of two-item arrays, each of which is a key and a value.
async function setPreferences(changes) {
  let { preferences } = await messenger.storage.local.get({
    preferences: {},
  });
  changes.forEach(([key, value]) => {
    preferences[key] = value;
  });
  await messenger.storage.local.set({ preferences });
}

function stateSetter(enabled) {
  // closure for enabling/disabling UI components
  return async (element) => {
    try {
      if (["SPAN", "DIV", "LABEL"].includes(element.tagName)) {
        element.style.color = enabled ? "black" : "#888888";
      }
      element.disabled = !enabled;
    } catch (ex) {
      SLTools.error(ex);
    }
    const enabler = stateSetter(enabled);
    [...element.childNodes].forEach(enabler);
  };
}

// Splits a single label string into spans, where the first occurrence
// of the access key is in its own element, with an underline.
function underlineAccessKey(label, modifier) {
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
}

// There are definitely some edge cases here, e.g., !undefined == !0, but
// they're not important for the intended use of this function.
function objectsAreTheSame(a, b) {
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
    if (!objectsAreTheSame(a[key], b[key])) {
      return false;
    }
  }

  for (let key of Object.keys(b)) {
    if (!a.hasOwnProperty(key)) {
      return false;
    }
  }

  return true;
}

function parseableHumanDateTimeFormat(date) {
  let formatted = SLTools.shortHumanDateTimeFormat(date);
  let parsed;
  try {
    parsed = SLTools.convertDate(formatted);
  } catch (ex) {}
  if (parsed) {
    return formatted;
  }
  return date.toISOString();
}

// initialize popup window
const SLPopup = {
  buttonUpdater: null,
  zoom: 100,
  previousLoop: null,
  loopMinutes: 1,
  initialized: false,
  changed: false,

  // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1850454
  // Won't work for everyone, but will work for a lot of people.
  sendNowCode: null,
  placeInOutboxCode: null,

  debugSchedule() {
    const inputs = SLPopup.objectifyFormValues();
    const schedule = SLPopup.parseInputs(inputs);
    if (!schedule) {
      return null;
    } else if (schedule.err) {
      return [schedule.err];
    } else {
      let cancelOnReply = schedule.recur.cancelOnReply ? "yes" : "no";
      return [
        `x-send-later-at: ${SLTools.parseableDateTimeFormat(schedule.sendAt)}`,
        `x-send-later-recur: ${SLTools.unparseRecurSpec(schedule.recur)}`,
        `x-send-later-args: ${schedule.recur.args}`,
        `x-send-later-cancel-on-reply: ${cancelOnReply}`,
      ];
    }
  },

  windowPrefName(which) {
    // Note that if you change this logic you also need to change the code in
    // background.js that sets the window dimensions on creation.
    return (
      (SLPopup.attachedWindow ? "attached" : "detached") +
      "PopupWindow" +
      which
    );
  },

  setFontSize(style) {
    style = (style || "").trim();
    if (!style) {
      return `font-size: ${SLPopup.zoom}%;`;
    }
    let re = /\s*font-size\s*:\s*\d+%\s*;?/;
    let match = re.exec(style);
    if (match) {
      style = style.replace(re, `font-size: ${SLPopup.zoom}%;`);
      return style;
    }
    if (!style.endsWith(";")) {
      style += "; ";
    }
    style += `font-size: ${SLPopup.zoom}%;`;
    return style;
  },

  setZoom() {
    for (let tagName of ["body", "button", "input"]) {
      let tags = document.getElementsByTagName(tagName);
      for (let tag of tags) {
        old_style = tag.getAttribute("style");
        new_style = SLPopup.setFontSize(old_style);
        tag.setAttribute("style", new_style);
      }
    }
  },

  async saveZoom() {
    SLTools.debug(`saveSoom: ${SLPopup.zoom}`);
    let prefName = SLPopup.windowPrefName("Zoom");
    await setPreferences([[prefName, SLPopup.zoom]]);
  },

  async saveDimensions() {
    if (!SLPopup.messageTabId) {
      return;
    }
    if (SLPopup.attachedWindow) {
      return;
    }
    await setPreferences([
      [SLPopup.windowPrefName("Width"), window.innerWidth],
      [SLPopup.windowPrefName("Height"), window.innerHeight],
    ]);
  },

  restoreZoom() {
    // Restore Zoom from preferences. If dimensions were saved, they're
    // restored when the window is created, not here.
    let zoom = SLTools.preferences[SLPopup.windowPrefName("Zoom")] || 100;
    SLPopup.zoom = Math.max(zoom, 10); // Window shouldn't be invisible
    SLTools.debug(`restoreZoom: ${SLPopup.zoom}`);
    SLPopup.setZoom();
  },

  async zoomIn() {
    SLPopup.zoom += 10;
    SLTools.debug(`zoomIn: ${SLPopup.zoom}`);
    SLPopup.setZoom();
    await SLPopup.saveZoom();
  },

  async zoomOut() {
    let zoom = SLPopup.zoom - 10;
    SLPopup.zoom = Math.max(zoom, 10);
    SLTools.debug(`zoomOut: ${SLPopup.zoom}`);
    SLPopup.setZoom();
    await SLPopup.saveZoom();
  },

  async doSendWithSchedule(schedule) {
    await SLPopup.saveDimensions();
    if (schedule && !schedule.err) {
      const message = {
        messageIds: SLPopup.messageIds,
        tabId: SLPopup.messageTabId,
        action: "doSendLater",
        sendAt: schedule.sendAt,
        recurSpec: SLTools.unparseRecurSpec(schedule.recur),
        args: schedule.recur.args,
        cancelOnReply: schedule.recur.cancelOnReply,
      };
      SLTools.debug(message);
      try {
        await browser.runtime.sendMessage(message).then(() => window.close());
      } catch (ex) {
        SLTools.error(ex);
      }
      // setTimeout((() => window.close()), 150);
    }
  },

  async doSendNow() {
    await SLPopup.saveDimensions();
    const message = {
      messageIds: SLPopup.messageIds,
      tabId: SLPopup.messageTabId,
      action: "doSendNow",
      changed: SLPopup.changed,
    };
    SLTools.debug(message);
    try {
      await browser.runtime.sendMessage(message).then(() => window.close());
    } catch (ex) {
      SLTools.error(ex);
    }
  },

  async doPlaceInOutbox() {
    await SLPopup.saveDimensions();
    const message = {
      messageIds: SLPopup.messageIds,
      tabId: SLPopup.messageTabId,
      action: "doPlaceInOutbox",
      changed: SLPopup.changed,
    };
    SLTools.debug(message);
    try {
      await browser.runtime.sendMessage(message).then(() => window.close());
    } catch (ex) {
      SLTools.trace(ex);
    }
  },

  domElementsAsArray() {
    return [...document.querySelectorAll("*")];
  },

  objectifyDOMElements() {
    const dom = SLPopup.domElementsAsArray();
    return dom.reduce((obj, item) => {
      obj[item.id] = item;
      return obj;
    }, {});
  },

  objectifyFormValues() {
    const domArray = SLPopup.domElementsAsArray();
    const inputs = domArray.reduce((obj, item) => {
      if (item.tagName === "INPUT" || item.tagName === "SELECT") {
        if (item.type === "checkbox" || item.type === "radio") {
          obj[item.id] = item.checked;
        } else {
          obj[item.id] = item.value;
        }
      }
      return obj;
    }, {});
    inputs.radio = {};
    inputs.groups = {};
    domArray.forEach((el) => {
      if (el.type === "radio" && el.name && !inputs.radio[el.name]) {
        inputs.radio[el.name] = [
          ...document.getElementsByName(el.name),
        ].reduce((def, elem) => (elem.checked ? elem.value : def), undefined);
      }
      if (el.type === "checkbox" && el.name && !inputs.groups[el.name]) {
        inputs.groups[el.name] = [
          ...document.getElementsByName(el.name),
        ].reduce(
          (obj, elem) => {
            obj.ids.push(elem.id);
            obj.vals.push(elem.checked);
            return obj;
          },
          { ids: [], vals: [] },
        );
      }
    });
    return inputs;
  },

  evaluateUfunc(funcName, prev, argStr) {
    let args = null;

    if (argStr) {
      try {
        argStr = SLTools.unparseArgs(SLTools.parseArgs(argStr));
        args = SLTools.parseArgs(argStr);
      } catch (ex) {
        SLTools.warn(ex);
        return {
          err:
            browser.i18n.getMessage("InvalidArgsTitle") +
            ": " +
            browser.i18n.getMessage("InvalidArgsBody"),
        };
      }
    }

    const body = SLPopup.ufuncs[funcName].body;

    const { sendAt, nextspec, nextargs, error } = SLTools.evaluateUfunc(
      funcName,
      body,
      prev,
      args,
    );
    SLTools.debug("User function returned:", {
      sendAt,
      nextspec,
      nextargs,
      error,
    });

    if (error) {
      throw new Error(error);
    } else {
      let recur = SLTools.parseRecurSpec(nextspec || "none") || {
        type: "none",
      };
      if (recur.type !== "none") {
        recur.args = nextargs || "";
      }
      const schedule = { sendAt, recur };
      SLTools.debug("Popup.js received ufunc response: ", schedule);
      return schedule;
    }
  },

  parseInputs(inputs) {
    SLTools.debug("parseInputs:", inputs);
    // Construct a recur object { type: "...", multiplier: "...", ... }
    const recurType = inputs.radio.recur;

    // If the user has typed a send time into send-datetime, it may be more
    // precise than what's in the date-picker and time-picker, so we prefer it.
    try {
      sendAt = SLTools.convertDate(inputs["send-datetime"]);
    } catch (ex) {}
    if (!sendAt) {
      const sendAtDate = inputs["send-date"];
      const sendAtTime = inputs["send-time"];
      let sendAt, schedule;

      if (
        /\d\d\d\d.\d\d.\d\d/.test(sendAtDate) &&
        /\d\d.\d\d/.test(sendAtTime)
      ) {
        sendAt = SLTools.parseDateTime(sendAtDate, sendAtTime);
      }
    }

    if (recurType === "function") {
      try {
        const funcName = inputs["recurFuncSelect"];
        let argStr = inputs["recur-function-args"];
        schedule = SLPopup.evaluateUfunc(funcName, sendAt, argStr);
        if (schedule.sendAt.getTime() < new Date().getTime() - 60000) {
          return { err: browser.i18n.getMessage("errorDateInPast") };
        }
      } catch (ex) {
        return { err: ex.message };
      }
    } else {
      schedule = {
        sendAt,
        recur: { type: recurType },
      };
    }

    if (!schedule.sendAt) {
      return { err: browser.i18n.getMessage("entervalid") };
    }

    if (SLTools.compareDateTimes(schedule.sendAt, "<", new Date(), true)) {
      return { err: browser.i18n.getMessage("errorDateInPast") };
    }

    if (schedule.recur.type !== "none") {
      schedule.recur.cancelOnReply = inputs[`recur-cancelonreply`];

      if (schedule.recur.type !== "function") {
        schedule.recur.multiplier = parseInt(inputs[`recur-multiplier`]);
      }
    }
    schedule.recur.type = schedule.recur.type || "none";
    switch (schedule.recur.type) {
      case "none":
        break;
      case "minutely":
        break;
      case "daily":
        break;
      case "weekly":
        break;
      case "monthly":
        if (inputs["recur-monthly-byweek"]) {
          schedule.recur.monthly_day = {
            day: +inputs["recur-monthly-byweek-day"],
            week: +inputs["recur-monthly-byweek-week"],
          };
        } else {
          schedule.recur.monthly = schedule.sendAt.getDate();
        }
        break;
      case "yearly":
        schedule.recur.yearly = {
          month: schedule.sendAt.getMonth(),
          date: schedule.sendAt.getDate(),
        };
        break;
      case "function":
        break;
      default:
        SLTools.error(`unrecognized recurrence type <${schedule.recur.type}>`);
        break;
    }

    if (inputs["sendbetween"]) {
      const start = inputs["sendbetween-start"];
      const end = inputs["sendbetween-end"];
      if (start && end) {
        const between = {
          start: SLTools.convertTime(start),
          end: SLTools.convertTime(end),
        };
        if (SLTools.compareTimes(between.start, ">=", between.end)) {
          return {
            err:
              browser.i18n.getMessage("endTimeWarningTitle") +
              ": " +
              browser.i18n.getMessage("endTimeWarningBody"),
          };
        } else {
          schedule.recur.between = between;
        }
      }
    }

    if (inputs["sendon"]) {
      const dayLimit = inputs.groups["weekdayChecks"].vals;
      schedule.recur.days = [...Array(7)].reduce((obj, item, idx) => {
        if (dayLimit[idx]) {
          obj.push(idx);
        }
        return obj;
      }, []);
      if (schedule.recur.days.length === 0) {
        return {
          err:
            browser.i18n.getMessage("missingDaysWarningTitle") +
            ": " +
            browser.i18n.getMessage("missingDaysWarningBody"),
        };
      }
    }

    // Adjust for restrictions
    const use_soonest_valid = schedule.recur.type === "none";
    const start_time = schedule.recur.between && schedule.recur.between.start;
    const end_time = schedule.recur.between && schedule.recur.between.end;
    schedule.sendAt = SLTools.adjustDateForRestrictions(
      schedule.sendAt,
      start_time,
      end_time,
      schedule.recur.days,
      use_soonest_valid,
    );

    if (inputs["senduntil"]) {
      const untilDate = inputs["senduntil-date"];
      const untilTime = inputs["senduntil-time"];
      if (
        /^\d\d\d\d.\d\d.\d\d$/.test(untilDate) &&
        /^\d\d.\d\d$/.test(untilTime)
      ) {
        sendUntil = SLTools.parseDateTime(untilDate, untilTime);
        if (sendUntil.getTime() <= Date.now()) {
          return {
            err:
              browser.i18n.getMessage("invalidUntilWarningTitle") +
              ": " +
              browser.i18n.getMessage("invalidUntilWarning_inPast"),
          };
        } else if (sendUntil.getTime() < schedule.sendAt) {
          return {
            err:
              browser.i18n.getMessage("invalidUntilWarningTitle") +
              ": " +
              browser.i18n.getMessage("invalidUntilWarning_tooSoon"),
          };
        } else {
          schedule.recur.until = sendUntil;
        }
      }
    }

    return schedule;
  },

  updateRecurrenceInputs() {
    const dom = SLPopup.objectifyDOMElements();

    const specs = [
      "minutely",
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "function",
    ];
    const recurrence = specs.find((s) => dom[s].checked);
    const specDiv = dom["recurrence-spec"];

    if (recurrence) {
      const sendAt = SLTools.parseDateTime(
        dom["send-date"].value,
        dom["send-time"].value,
      );

      if (recurrence !== "function") {
        // Setup the plural text (e.g. every [] minutes)
        let pluralTxt = browser.i18n.getMessage(`plural_${recurrence}`);
        if (recurrence === "yearly") {
          // ... , on [RECUR DATE]
          const dateTxt = new Intl.DateTimeFormat([], {
            month: "long",
            day: "numeric",
          }).format(sendAt);
          pluralTxt += ", " + browser.i18n.getMessage("only_on_days", dateTxt);
        } else if (recurrence === "monthly") {
          // ... (ORDINAL [at ....])
          const dayOrd = new Sugar.Date(sendAt).format("{do}");
          pluralTxt += ` (${dayOrd}`;
        } else if (recurrence === "weekly") {
          // ... , on [RECUR WEEKDAY]
          const dateTxt = SLTools.getWkdayName(sendAt);
          pluralTxt += ", " + browser.i18n.getMessage("only_on_days", dateTxt);
        }

        if (recurrence !== "minutely") {
          // ... at [RECUR TIME]
          const timeMarker = Sugar.Date.getLocale().timeMarkers[0];
          const timeStr = new Intl.DateTimeFormat([], {
            hour: "numeric",
            minute: "numeric",
          }).format(sendAt);
          pluralTxt += ` ${timeMarker} ${timeStr}`;
        }

        if (recurrence === "monthly") {
          pluralTxt += ")";
        }

        dom["recurperiod_plural"].textContent = pluralTxt;
      }

      specDiv.style.display = "block";
    } else {
      specDiv.style.display = "none";
    }
  },

  setScheduleButton(schedule) {
    if (SLPopup.buttonUpdater) {
      clearTimeout(SLPopup.buttonUpdater);
    }

    const sendScheduleButton = document.getElementById("sendScheduleButton");

    if (schedule.err) {
      sendScheduleButton.textContent = schedule.err;
      sendScheduleButton.disabled = true;
      return false;
    }

    try {
      const scheduleText = SLTools.formatScheduleForUI(
        schedule,
        SLPopup.previousLoop,
        SLPopup.loopMinutes,
      );
      if (scheduleText) {
        sendScheduleButton.textContent = "";
        scheduleText.split("\n").forEach((segment) => {
          const lineNode = document.createElement("DIV");
          lineNode.style.display = "block";
          lineNode.style.margin = "0px";
          lineNode.style.width = "100%";
          lineNode.style.textAlign = "center";
          lineNode.textContent = segment.trim();
          sendScheduleButton.appendChild(lineNode);
        });
        // stateSetter(schedule.recur.type !== "function")(
        //   document.getElementById("sendAtTimeDateDiv"));
        sendScheduleButton.disabled = false;

        // Update the button text between 0.5 and 30 seconds in the
        // future, depending on how far out the schedule time is.
        const fromNow = schedule.sendAt.getTime() - Date.now();
        SLPopup.buttonUpdater = setTimeout(
          () => {
            SLPopup.parseSugarDate();
            const newInputs = SLPopup.objectifyFormValues();
            const newSchedule = SLPopup.parseInputs(newInputs);
            SLPopup.setScheduleButton(newSchedule);
          },
          Math.min(Math.max(500, fromNow / 60), 30000),
        );
        return true;
      } else {
        SLTools.debug("scheduleText", scheduleText);
      }
    } catch (ex) {
      SLTools.debug(ex);
    }
    sendScheduleButton.textContent = browser.i18n.getMessage("entervalid");
    sendScheduleButton.disabled = true;
    return false;
  },

  loadFunctionHelpText() {
    const funcName = document.getElementById("recurFuncSelect").value;
    if (SLPopup.ufuncs[funcName]) {
      const helpTxt = SLPopup.ufuncs[funcName].help;
      const funcHelpDiv = document.getElementById("funcHelpDiv");
      funcHelpDiv.textContent = helpTxt;
    } else {
      SLTools.warn(`Cannot set help text. Unrecognized function: ${funcName}`);
    }
  },

  serializeInputs() {
    const inputs = {};
    const dom = SLPopup.objectifyDOMElements();
    Object.keys(dom).forEach((key) => {
      const element = dom[key];
      if (element.tagName === "INPUT" || element.tagName === "SELECT") {
        if (
          element.type === "button" ||
          ["send-date", "send-time"].includes(element.id)
        ) {
          // do nothing
        } else if (element.type === "radio" || element.type === "checkbox") {
          inputs[element.id] = element.checked;
        } else if (
          element.tagName === "SELECT" ||
          ["number", "text", "date", "time"].includes(element.type)
        ) {
          inputs[element.id] = element.value;
        } else {
          throw (
            `Unrecognized element <${element.tagName} ` +
            `type=${element.type}...>`
          );
        }
      }
    });
    return inputs;
  },

  async cacheSchedule() {
    SLTools.debug("Caching current input values");
    let scheduleCache = await browser.storage.local.get({ scheduleCache: {} });
    let windowId = SLPopup.messageWindowId;
    if (!windowId) return;
    scheduleCache[windowId] = SLPopup.serializeInputs();
    await browser.storage.local.set({ scheduleCache });
  },

  saveDefaults() {
    const defaults = SLPopup.serializeInputs();
    SLTools.debug("Saving default values", defaults);
    const saveDefaultsElement = document.getElementById("save-defaults");
    browser.storage.local
      .set({ defaults })
      .then(() => {
        SLPopup.showCheckMark(saveDefaultsElement, "green");
      })
      .catch((err) => {
        SLTools.error(err);
        SLPopup.showCheckMark(saveDefaultsElement, "red");
      });
  },

  clearDefaults() {
    SLTools.debug("Clearing default values");
    const clrDefaultsElement = document.getElementById("clear-defaults");
    browser.storage.local
      .set({
        defaults: {},
        scheduleCache: {},
      })
      .then(() => {
        SLPopup.showCheckMark(clrDefaultsElement, "green");
      })
      .catch((err) => {
        SLTools.error(err);
        SLPopup.showCheckMark(clrDefaultsElement, "red");
      });
  },

  async applyDefaults(tabId) {
    const storage = await browser.storage.local.get({
      defaults: {},
      scheduleCache: {},
    });

    const windowId = SLPopup.messageWindowId;
    let defaults;

    if (windowId) {
      SLTools.debug(
        `scheduleCache[${windowId}] =`,
        storage.scheduleCache[windowId],
      );
      defaults = storage.scheduleCache[windowId];
    }

    defaults = defaults || storage.defaults;

    const dom = SLPopup.objectifyDOMElements();

    const recurFuncSelect = dom["recurFuncSelect"];
    [...Object.keys(SLPopup.ufuncs)].sort().forEach((funcName) => {
      if (funcName !== "ReadMeFirst" && funcName !== "newFunctionName") {
        const newOpt = document.createElement("option");
        newOpt.id = `ufunc-${funcName}`;
        newOpt.value = funcName;
        newOpt.textContent = funcName;
        recurFuncSelect.appendChild(newOpt);
      }
    });

    if (defaults && defaults.daily !== undefined) {
      SLTools.debug("Applying default values", defaults);
      for (let key in dom) {
        const element = dom[key];
        if (element.tagName === "INPUT" || element.tagName === "SELECT") {
          const defaultValue = defaults[element.id];
          if (
            defaultValue === undefined ||
            element.type === "button" ||
            ["send-date", "send-time"].includes(element.id)
          ) {
            continue;
          } else if (element.type === "radio" || element.type === "checkbox") {
            element.checked = defaults[element.id];
          } else if (
            element.tagName === "SELECT" ||
            ["number", "text", "date", "time"].includes(element.type)
          ) {
            element.value = defaults[element.id];
          } else {
            SLTools.warn(
              `Unrecognized element <${element.tagName} ` +
                `type=${element.type}...>`,
            );
          }
        }
        try {
          let evt = document.createEvent("HTMLEvents");
          evt.initEvent("change", false, true);
          element.dispatchEvent(evt);
        } catch (err) {
          SLTools.error(err);
        }
      }
    } else {
      const soon = new Sugar.Date(Date.now() + 5 * 60 * 1000);
      dom["send-datetime"].value = soon.relative();
      try {
        let evt = document.createEvent("HTMLEvents");
        evt.initEvent("change", false, true);
        dom["send-datetime"].dispatchEvent(evt);
      } catch (err) {
        SLTools.error(err);
      }
    }

    stateSetter(dom["sendon"].checked)(dom["onlyOnDiv"]);
    stateSetter(dom["sendbetween"].checked)(dom["betweenDiv"]);
    stateSetter(dom["senduntil"].checked)(dom["untilDiv"]);

    SLPopup.loadFunctionHelpText();

    // Trigger some fake events to activate listeners
    dom["send-datetime"].dispatchEvent(new Event("change"));
  },

  showCheckMark(element, color) {
    // Appends a checkmark as element's last sibling. Disappears after a
    // timeout (1.5 sec). If is already displayed, then restart timeout.
    const checkmark = document.createElement("span");
    checkmark.textContent = String.fromCharCode(0x2714);
    checkmark.style.color = color;
    checkmark.className = "success_icon";

    const p = element.parentNode;
    if (p.lastChild.className === "success_icon") {
      p.replaceChild(checkmark, p.lastChild);
    } else {
      p.appendChild(checkmark);
    }
    setTimeout(() => checkmark.remove(), 1500);
  },

  parseSugarDate() {
    SLTools.trace("parseSugarDate");
    const dom = SLPopup.objectifyDOMElements();
    let sendAtString = dom["send-datetime"].value;
    if (sendAtString) {
      try {
        let sendAt = SLTools.convertDate(sendAtString);

        if (sendAt && !SLTools.timeRegex.test(sendAtString)) {
          // The time was specified indirectly, and the user is assuming we
          // make a reasonable interpretation of their input.
          // For instance, if they request 1 minute from now, but it is
          // currently 58 seconds past the minute, we don't want to set
          // the schedule for the following minute. We should check that
          // their message will actually be sent at (or very close to)
          // the intended scheduled time. If the actual send would be more
          // than a few seconds sooner than intended, we'll round up to the
          // next minute.

          let intendedSendAt = sendAt;
          let actualSendAt = SLTools.estimateSendTime(
            intendedSendAt,
            SLPopup.previousLoop,
            SLPopup.loopMinutes,
          );

          if (actualSendAt.getTime() < intendedSendAt.getTime() - 5000) {
            sendAt = new Date(intendedSendAt.getTime() + 60000);
          }
        }

        if (sendAt) {
          const sugarSendAt = new Sugar.Date(sendAt);
          dom["send-date"].value = sugarSendAt.format("%Y-%m-%d");
          dom["send-time"].value = sugarSendAt.format("%H:%M");
          return sendAt;
        }
      } catch (ex) {
        SLTools.debug("Unable to parse user input", ex);
      }
    }
    dom["send-date"].value = "";
    dom["send-time"].value = "";
  },

  attachListeners() {
    const dom = SLPopup.objectifyDOMElements();

    let priorInputs = undefined;

    const onInput = (evt) => {
      SLTools.debug("onInput: entering");
      switch (evt.target.id) {
        case "send-date":
        case "send-time":
          if (dom["send-date"].value && dom["send-time"].value) {
            const sendAt = SLTools.parseDateTime(
              dom["send-date"].value,
              dom["send-time"].value,
            );
            dom["send-datetime"].value = parseableHumanDateTimeFormat(sendAt);
          }
          break;
        case "send-datetime":
          SLPopup.parseSugarDate();
          break;
        default:
          break;
      }

      const inputs = SLPopup.objectifyFormValues();
      if (objectsAreTheSame(inputs, priorInputs)) {
        SLTools.debug("onInput: redundant, returning");
        return;
      }
      if (SLPopup.initialized) {
        SLPopup.changed = true;
      }
      priorInputs = inputs;
      const schedule = SLPopup.parseInputs(inputs);

      stateSetter(dom["sendon"].checked)(dom["onlyOnDiv"]);
      stateSetter(dom["sendbetween"].checked)(dom["betweenDiv"]);
      stateSetter(dom["senduntil"].checked)(dom["untilDiv"]);

      stateSetter(dom["recurFuncSelect"].length > 0)(
        dom["function-recur-radio"],
      );
      stateSetter(dom["function"].checked)(dom["recurFuncSelect"]);

      stateSetter(dom["recur-monthly-byweek"].checked)(
        dom["recur-monthly-byweek-options"],
      );

      dom["cancel-on-reply-div"].style.display =
        schedule.recur && schedule.recur.type !== "none" ? "" : "none";

      if (dom["function"].checked) {
        dom["recur-time-args-div"].style.display = "none";
        dom["recur-function-args-div"].style.display = "block";
        dom["showHideFunctionHelp"].style.display = "inline-block";
      } else {
        dom["recur-time-args-div"].style.display = "block";
        dom["recur-function-args-div"].style.display = "none";
        dom["funcHelpDiv"].style.display = "none";
        dom["showHideFunctionHelp"].style.display = "none";
      }

      dom["monthly-options-div"].style.display = dom["monthly"].checked
        ? ""
        : "none";

      SLPopup.setScheduleButton(schedule);

      SLPopup.cacheSchedule().catch(SLTools.error);

      const hdrs = SLPopup.debugSchedule();
      // Would be useful for debugging, but doesn't seem to work in a popup.
      // const scheduleButton = document.getElementById("sendScheduleButton");
      // scheduleButton.title = hdrs.join(' | ');
      SLTools.debug(`Header values:\n    ${hdrs.join("\n    ")}`);
    };

    Object.keys(dom).forEach((key) => {
      const element = dom[key];
      if (element.type !== "button") {
        if (element.tagName === "INPUT" || element.tagName === "SELECT") {
          element.addEventListener("change", onInput);
        }
      }
    });

    dom["send-datetime"].addEventListener("keyup", onInput);
    dom["recur-function-args"].addEventListener("keyup", onInput);

    [...document.getElementsByName("recur")].forEach((element) =>
      element.addEventListener("change", SLPopup.updateRecurrenceInputs),
    );

    dom["sendNow"].addEventListener("click", SLPopup.doSendNow);
    dom["placeInOutbox"].addEventListener("click", SLPopup.doPlaceInOutbox);
    dom["sendScheduleButton"].addEventListener("click", () => {
      const inputs = SLPopup.objectifyFormValues();
      const schedule = SLPopup.parseInputs(inputs);
      SLPopup.doSendWithSchedule(schedule);
    });

    dom["recurFuncSelect"].addEventListener(
      "change",
      SLPopup.loadFunctionHelpText,
    );

    dom["showHideFunctionHelp"].addEventListener("click", () => {
      const currentState = dom["funcHelpDiv"].style.display === "block";
      dom["funcHelpDiv"].style.display = currentState ? "none" : "block";
    });

    dom["save-defaults"].addEventListener("click", SLPopup.saveDefaults);
    dom["clear-defaults"].addEventListener("click", SLPopup.clearDefaults);

    browser.storage.local.get({ preferences: {} }).then(({ preferences }) => {
      for (let i = 1; i < 4; i++) {
        const funcName = preferences[`quickOptions${i}funcselect`];
        const quickBtn = dom[`quick-opt-${i}`];
        if (!funcName) {
          quickBtn.parentElement.remove();
          continue;
        }
        const funcArgs = preferences[`quickOptions${i}Args`];

        const quickBtnLabel = preferences[`quickOptions${i}Label`];
        const accelIdx = quickBtnLabel.indexOf("&");
        if (accelIdx === -1) {
          quickBtn.textContent = quickBtnLabel;
        } else {
          quickBtn.accessKey = quickBtnLabel[accelIdx + 1];
          const contents = underlineAccessKey(quickBtnLabel);
          quickBtn.textContent = "";
          for (let span of contents) {
            quickBtn.appendChild(span);
          }
        }
        quickBtn.addEventListener("click", () => {
          const schedule = SLPopup.evaluateUfunc(funcName, null, funcArgs);
          SLPopup.doSendWithSchedule(schedule);
        });
        document.addEventListener("keydown", (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === i.toString()) {
            // Note: also catches Ctrl+Alt+{i}
            event.preventDefault();
            SLTools.debug(`Executing shortcut ${i}`);
            const schedule = SLPopup.evaluateUfunc(funcName, null, funcArgs);
            SLPopup.doSendWithSchedule(schedule);
          }
        });
      }
    });

    document.addEventListener("keydown", function (event) {
      if (
        ["-", "_", "=", "+"].includes(event.key) &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        ["-", "_"].includes(event.key) ? SLPopup.zoomOut() : SLPopup.zoomIn();
      } else if (event.key === "Enter") {
        // Enter on a button should activate the button.
        if (event.target.tagName.toLowerCase() != "button") {
          event.preventDefault();
          const inputs = SLPopup.objectifyFormValues();
          const schedule = SLPopup.parseInputs(inputs);
          SLPopup.doSendWithSchedule(schedule);
        }
      } else if (event.key == "Dead" && event.ctrlKey && event.altKey) {
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1850454
        if (event.code == SLPopup.sendNowCode) {
          SLTools.telemetrySend({
            event: "sendNowDeadKey",
            code: event.code,
          });
          event.preventDefault();
          SLPopup.doSendNow();
        } else if (event.code == SLPopup.placeInOutboxCode) {
          SLTools.telemetrySend({
            event: "placeInOutboxDeadKey",
            code: event.code,
          });
          event.preventDefault();
          SLPopup.doPlaceInOutbox();
        } else {
          SLTools.telemetrySend({
            event: "unrecognizedDeadKey",
            code: event.code,
            sendNowCode: SLPopup.sendNowCode,
            placeInOutboxCode: SLPopup.placeInOutboxCode,
          });
        }
      }
    });

    (() => {
      const label = browser.i18n.getMessage("sendNowLabel");
      const accessKey = browser.i18n.getMessage(
        "sendlater.prompt.sendnow.accesskey",
      );
      const contents = underlineAccessKey(label, accessKey);

      dom["sendNow"].accessKey = accessKey;
      SLPopup.sendNowCode = `Key${accessKey.toUpperCase()}`;
      dom["sendNow"].textContent = "";
      for (let span of contents) {
        dom["sendNow"].appendChild(span);
      }
    })();
    (() => {
      const label = browser.i18n.getMessage(
        "sendlater.prompt.sendlater.label",
      );
      const accessKey = browser.i18n.getMessage(
        "sendlater.prompt.sendlater.accesskey",
      );
      const contents = underlineAccessKey(label, accessKey);

      dom["placeInOutbox"].accessKey = accessKey;
      SLPopup.placeInOutboxCode = `Key${accessKey.toUpperCase()}`;
      dom["placeInOutbox"].textContent = "";
      for (let span of contents) {
        dom["placeInOutbox"].appendChild(span);
      }
    })();

    setTimeout(() => document.getElementById("send-datetime").select(), 50);
  },

  async init() {
    await SLTools.cachePrefs();
    SLTools.trace("SLPopup.init", window.location);

    // This happens asynchronously in tools.js, but we need to make sure
    // prefs are available, so let's just make sure.
    await SLTools.cachePrefs();

    const { ufuncs } = await browser.storage.local.get({ ufuncs: {} });
    SLPopup.ufuncs = ufuncs;

    const mainLoop = await browser.runtime
      .sendMessage({
        action: "getMainLoopStatus",
      })
      .catch(SLTools.warn);

    if (mainLoop) {
      if (mainLoop.previousLoop)
        SLPopup.previousLoop = new Date(mainLoop.previousLoop);
      SLPopup.loopMinutes =
        mainLoop.averageLoopMinutes || mainLoop.loopMinutes;
    }

    SLPopup.attachListeners();

    let queryString = new URLSearchParams(window.location.search);
    let messageIds = queryString
      .getAll("messageId")
      .map((str) => parseInt(str));

    if (messageIds.length) {
      SLPopup.messageIds = messageIds;
      SLPopup.messageTabId = null;
    } else {
      SLPopup.messageIds = null;
      let tabIdString = queryString.get("tabId");
      if (tabIdString) {
        SLPopup.attachedWindow = false;
        SLPopup.messageTabId = parseInt(tabIdString);
      } else {
        SLPopup.attachedWindow = true;
        SLPopup.messageTabId = await browser.tabs
          .query({
            active: true,
            currentWindow: true,
          })
          .then((tabs) => tabs[0].id);
      }
    }

    if (SLPopup.messageTabId) {
      SLPopup.messageWindowId = (
        await messenger.tabs.get(SLPopup.messageTabId)
      ).windowId;

      messenger.windows.onRemoved.addListener((windowId) => {
        if (windowId == SLPopup.messageWindowId) {
          try {
            window.close();
          } catch {}
        }
      });
    }

    await SLPopup.applyDefaults();

    SLPopup.restoreZoom();
    SLPopup.initialized = true;
    SLTools.makeContentsVisible();
    SLTools.debug("Initialized popup window");
  },
};

// For testing purposes, because the browser mock script needs to
// asynchronously load translations.
function waitAndInit() {
  if (browser.i18n.getMessage("recurMonthlyLabel") === "recurMonthlyLabel") {
    setTimeout(waitAndInit, 10);
  } else {
    SLPopup.init();
  }
}

window.addEventListener("load", waitAndInit, false);
