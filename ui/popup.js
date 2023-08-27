// initialize popup window
const SLPopup = {
  buttonUpdater: null,

  previousLoop: new Date(),
  loopMinutes: 1,

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
        `x-send-later-at: ${SLStatic.parseableDateTimeFormat(
          schedule.sendAt,
        )}`,
        `x-send-later-recur: ${SLStatic.unparseRecurSpec(schedule.recur)}`,
        `x-send-later-args: ${schedule.recur.args}`,
        `x-send-later-cancel-on-reply: ${cancelOnReply}`,
      ];
    }
  },

  doSendWithSchedule(schedule) {
    if (schedule && !schedule.err) {
      const message = {
        messageIds: SLPopup.messageIds,
        tabId: SLPopup.tabId,
        action: "doSendLater",
        sendAt: schedule.sendAt,
        recurSpec: SLStatic.unparseRecurSpec(schedule.recur),
        args: schedule.recur.args,
        cancelOnReply: schedule.recur.cancelOnReply,
      };
      SLStatic.debug(message);
      browser.runtime
        .sendMessage(message)
        .then(() => window.close())
        .catch(SLStatic.error);
      // setTimeout((() => window.close()), 150);
    }
  },

  doSendNow() {
    const message = {
      messageIds: SLPopup.messageIds,
      tabId: SLPopup.tabId,
      action: "doSendNow",
    };
    SLStatic.debug(message);
    browser.runtime
      .sendMessage(message)
      .then(() => window.close())
      .catch((err) => SLStatic.error(err));
  },

  doPlaceInOutbox() {
    const message = {
      messageIds: SLPopup.messageIds,
      tabId: SLPopup.tabId,
      action: "doPlaceInOutbox",
    };
    SLStatic.debug(message);
    browser.runtime
      .sendMessage(message)
      .then(() => window.close())
      .catch((err) => SLStatic.trace(err));
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
        argStr = SLStatic.unparseArgs(SLStatic.parseArgs(argStr));
        args = SLStatic.parseArgs(argStr);
      } catch (ex) {
        SLStatic.warn(ex);
        return {
          err:
            browser.i18n.getMessage("InvalidArgsTitle") +
            ": " +
            browser.i18n.getMessage("InvalidArgsBody"),
        };
      }
    }

    const body = SLPopup.ufuncs[funcName].body;

    const { sendAt, nextspec, nextargs, error } = SLStatic.evaluateUfunc(
      funcName,
      body,
      prev,
      args,
    );
    SLStatic.debug("User function returned:", {
      sendAt,
      nextspec,
      nextargs,
      error,
    });

    if (error) {
      throw new Error(error);
    } else {
      let recur = SLStatic.parseRecurSpec(nextspec || "none") || {
        type: "none",
      };
      if (recur.type !== "none") {
        recur.args = nextargs || "";
      }
      const schedule = { sendAt, recur };
      SLStatic.debug("Popup.js received ufunc response: ", schedule);
      return schedule;
    }
  },

  parseInputs(inputs) {
    SLStatic.debug("parseInputs:", inputs);
    // Construct a recur object { type: "...", multiplier: "...", ... }
    const recurType = inputs.radio.recur;

    const sendAtDate = inputs["send-date"];
    const sendAtTime = inputs["send-time"];
    let sendAt, schedule;

    if (
      /\d\d\d\d.\d\d.\d\d/.test(sendAtDate) &&
      /\d\d.\d\d/.test(sendAtTime)
    ) {
      sendAt = SLStatic.parseDateTime(sendAtDate, sendAtTime);
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

    if (SLStatic.compareDateTimes(schedule.sendAt, "<", new Date(), true)) {
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
        SLStatic.error(
          `unrecognized recurrence type <${schedule.recur.type}>`,
        );
        break;
    }

    if (inputs["sendbetween"]) {
      const start = inputs["sendbetween-start"];
      const end = inputs["sendbetween-end"];
      if (start && end) {
        const between = {
          start: SLStatic.convertTime(start),
          end: SLStatic.convertTime(end),
        };
        if (SLStatic.compareTimes(between.start, ">=", between.end)) {
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
    schedule.sendAt = SLStatic.adjustDateForRestrictions(
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
        sendUntil = SLStatic.parseDateTime(untilDate, untilTime);
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
      const sendAt = SLStatic.parseDateTime(
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
          const dateTxt = SLStatic.getWkdayName(sendAt);
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
      const scheduleText = SLStatic.formatScheduleForUI(
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
        // SLStatic.stateSetter(schedule.recur.type !== "function")(
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
        SLStatic.debug("scheduleText", scheduleText);
      }
    } catch (ex) {
      SLStatic.debug(ex);
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
      SLStatic.warn(
        `Cannot set help text. Unrecognized function: ${funcName}`,
      );
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

  cacheSchedule() {
    SLStatic.debug("Caching current input values");
    browser.storage.local
      .get({ scheduleCache: {} })
      .then(({ scheduleCache }) => {
        browser.windows.getCurrent().then((cwin) => {
          scheduleCache[cwin.id] = SLPopup.serializeInputs();
          browser.storage.local.set({ scheduleCache });
        });
      })
      .catch(SLStatic.error);
  },

  saveDefaults() {
    const defaults = SLPopup.serializeInputs();
    SLStatic.debug("Saving default values", defaults);
    const saveDefaultsElement = document.getElementById("save-defaults");
    browser.storage.local
      .set({ defaults })
      .then(() => {
        SLPopup.showCheckMark(saveDefaultsElement, "green");
      })
      .catch((err) => {
        SLStatic.error(err);
        SLPopup.showCheckMark(saveDefaultsElement, "red");
      });
  },

  clearDefaults() {
    SLStatic.debug("Clearing default values");
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
        SLStatic.error(err);
        SLPopup.showCheckMark(clrDefaultsElement, "red");
      });
  },

  async applyDefaults() {
    const storage = await browser.storage.local.get({
      defaults: {},
      scheduleCache: {},
    });

    const cwin = await browser.windows.getCurrent();
    const defaults = storage.scheduleCache[cwin.id] || storage.defaults;

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
      SLStatic.debug("Applying default values", defaults);
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
            SLStatic.warn(
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
          SLStatic.log(err);
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
        SLStatic.log(err);
      }
    }

    SLStatic.stateSetter(dom["sendon"].checked)(dom["onlyOnDiv"]);
    SLStatic.stateSetter(dom["sendbetween"].checked)(dom["betweenDiv"]);
    SLStatic.stateSetter(dom["senduntil"].checked)(dom["untilDiv"]);

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
    SLStatic.trace("parseSugarDate");
    const dom = SLPopup.objectifyDOMElements();
    let sendAtString = dom["send-datetime"].value;
    if (sendAtString) {
      try {
        let sendAt = SLStatic.convertDate(sendAtString);

        if (!SLStatic.timeRegex.test(sendAtString)) {
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
          let actualSendAt = SLStatic.estimateSendTime(
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
        SLStatic.debug("Unable to parse user input", ex);
      }
    }
    dom["send-date"].value = "";
    dom["send-time"].value = "";
  },

  attachListeners() {
    const dom = SLPopup.objectifyDOMElements();

    let priorInputs = undefined;

    const onInput = (evt) => {
      SLStatic.debug("onInput: entering");
      switch (evt.target.id) {
        case "send-date":
        case "send-time":
          if (dom["send-date"].value && dom["send-time"].value) {
            const sendAt = SLStatic.parseDateTime(
              dom["send-date"].value,
              dom["send-time"].value,
            );
            dom["send-datetime"].value =
              SLStatic.shortHumanDateTimeFormat(sendAt);
          }
          break;
        case "send-datetime":
          SLPopup.parseSugarDate();
          break;
        default:
          break;
      }

      const inputs = SLPopup.objectifyFormValues();
      if (SLStatic.objectsAreTheSame(inputs, priorInputs)) {
        SLStatic.debug("onInput: redundant, returning");
        return;
      }
      priorInputs = inputs;
      const schedule = SLPopup.parseInputs(inputs);

      SLStatic.stateSetter(dom["sendon"].checked)(dom["onlyOnDiv"]);
      SLStatic.stateSetter(dom["sendbetween"].checked)(dom["betweenDiv"]);
      SLStatic.stateSetter(dom["senduntil"].checked)(dom["untilDiv"]);

      SLStatic.stateSetter(dom["recurFuncSelect"].length > 0)(
        dom["function-recur-radio"],
      );
      SLStatic.stateSetter(dom["function"].checked)(dom["recurFuncSelect"]);

      SLStatic.stateSetter(dom["recur-monthly-byweek"].checked)(
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

      SLPopup.cacheSchedule();

      const hdrs = SLPopup.debugSchedule();
      // Would be useful for debugging, but doesn't seem to work in a popup.
      // const scheduleButton = document.getElementById("sendScheduleButton");
      // scheduleButton.title = hdrs.join(' | ');
      SLStatic.debug(`Header values:\n    ${hdrs.join("\n    ")}`);
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
    dom["recur-function-args"], addEventListener("keyup", onInput);

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
        const funcArgs = preferences[`quickOptions${i}Args`];

        const quickBtn = dom[`quick-opt-${i}`];
        const quickBtnLabel = preferences[`quickOptions${i}Label`];
        const accelIdx = quickBtnLabel.indexOf("&");
        if (accelIdx === -1) {
          quickBtn.textContent = quickBtnLabel;
        } else {
          quickBtn.accessKey = quickBtnLabel[accelIdx + 1];
          const contents = SLStatic.underlineAccessKey(quickBtnLabel);
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
            SLStatic.debug(`Executing shortcut ${i}`);
            const schedule = SLPopup.evaluateUfunc(funcName, null, funcArgs);
            SLPopup.doSendWithSchedule(schedule);
          }
        });
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        const inputs = SLPopup.objectifyFormValues();
        const schedule = SLPopup.parseInputs(inputs);
        SLPopup.doSendWithSchedule(schedule);
      }
    });

    (() => {
      const label = browser.i18n.getMessage("sendNowLabel");
      const accessKey = browser.i18n.getMessage(
        "sendlater.prompt.sendnow.accesskey",
      );
      const contents = SLStatic.underlineAccessKey(label, accessKey);

      dom["sendNow"].accessKey = accessKey;
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
      const contents = SLStatic.underlineAccessKey(label, accessKey);

      dom["placeInOutbox"].accessKey = accessKey;
      dom["placeInOutbox"].textContent = "";
      for (let span of contents) {
        dom["placeInOutbox"].appendChild(span);
      }
    })();

    setTimeout(() => document.getElementById("send-datetime").select(), 50);
  },

  async init() {
    SLStatic.trace("SLPopup.init", window.location);
    document.title = browser.i18n.getMessage("extensionName");

    await SLStatic.cachePrefs();

    const { ufuncs } = await browser.storage.local.get({ ufuncs: {} });
    SLPopup.ufuncs = ufuncs;

    const mainLoop = await browser.runtime
      .sendMessage({
        action: "getMainLoopStatus",
      })
      .catch(SLStatic.warn);

    if (mainLoop) {
      if (mainLoop.previousLoop)
        SLPopup.previousLoop = new Date(mainLoop.previousLoop);
      if (mainLoop.loopMinutes) SLPopup.loopMinutes = mainLoop.loopMinutes;
    }

    SLPopup.attachListeners();

    SLPopup.applyDefaults();

    let queryString = new URLSearchParams(window.location.search);
    let messageIds = queryString
      .getAll("messageId")
      .map((str) => parseInt(str));

    if (messageIds.length) {
      SLPopup.messageIds = messageIds;
      SLPopup.tabId = null;
    } else {
      SLPopup.messageIds = null;
      let tabIdString = queryString.get("tabId");
      if (tabIdString) {
        SLPopup.tabId = parseInt(tabIdString);
      } else {
        SLPopup.tabId = await browser.tabs
          .query({
            active: true,
            currentWindow: true,
          })
          .then((tabs) => tabs[0].id);
      }
    }

    SLStatic.debug("Initialized popup window");
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
