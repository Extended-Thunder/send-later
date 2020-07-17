// initialize popup window
const SLPopup = {
  async debugSchedule() {
    // Dump current header values to console.
    const inputs = SLPopup.objectifyFormValues();
    const schedule = SLPopup.parseInputs(inputs);
    if (schedule && !schedule.err) {
      hdr = {
        'send-at': SLStatic.dateTimeFormat(schedule.sendAt),
        'recur': SLStatic.unparseRecurSpec(schedule.recur),
        'args': schedule.recur.args,
        'cancel-on-reply': schedule.recur.cancelOnReply
      }
      const debugMsg = Object.keys(hdr).reduce((msg,name) => {
        msg.push(`${name}: ${hdr[name]}`); return msg;
      },[]).join("\n    ");
      console.debug(`DEBUG [SendLater]: Header values:\n    ${debugMsg}`);
    }
  },

  scheduleSendWithDelay(delay) {
      return (async (event) => {
        SLStatic.debug(`Scheduling message in ${delay} minutes`);

        const tabs = await browser.tabs.query({ active:true, currentWindow:true });
        const msg = { tabId: tabs[0].id };
        if (delay === 0) {
          msg.action = "doSendNow";
          msg.sendAt = null;
        } else {
          msg.action = "doSendLater";
          msg.sendAt = new Date();
          msg.sendAt.setTime(msg.sendAt.getTime() + delay * 60 * 1000);
        }

        browser.runtime.sendMessage(msg);

        setTimeout((() => window.close()), 150);
      });
  },

  domElementsAsArray() {
    return [...document.querySelectorAll("*")];
  },

  objectifyDOMElements() {
    const dom = SLPopup.domElementsAsArray();
    return dom.reduce((obj,item) => {
      obj[item.id] = item;
      return obj;
    }, {});
  },

  objectifyFormValues() {
    const domArray = SLPopup.domElementsAsArray();
    const inputs = domArray.reduce((obj,item) => {
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
    domArray.forEach(el => {
      if (el.type === "radio" && el.name && !inputs.radio[el.name]) {
        inputs.radio[el.name] = [...document.getElementsByName(el.name)].reduce(
          (def,elem) => (elem.checked ? elem.value : def), undefined);
      }
      if (el.type === "checkbox" && el.name && !inputs.groups[el.name]) {
        inputs.groups[el.name] =
          [...document.getElementsByName(el.name)].reduce((obj,elem) => {
            obj.ids.push(elem.id);
            obj.vals.push(elem.checked);
            return obj;
          }, { ids:[], vals:[] });
      }
    });
    return inputs;
  },

  parseInputs(inputs) {
    // Parse send date and time
    const sendAtDate = inputs["send-date"];
    const sendAtTime = inputs["send-time"];
    if (!sendAtDate || !sendAtTime) {
      return;
    }
    const sendAt = SLStatic.parseDateTime(sendAtDate, sendAtTime);
    if (SLStatic.compareTimes(sendAt, '<', new Date(), true)) {
      return { err: browser.i18n.getMessage("errorDateInPast") };
    }

    // Construct a recur object { type: "...", multiplier: "...", ... }
    const recur = { type: inputs.radio.recur };
    if (recur.type !== "none") {
      recur.cancelOnReply = inputs[`recur-cancelonreply`];

      if (recur.type !== "function") {
        recur.multiplier = inputs[`recur-multiplier`];
      }
    }
    switch (recur.type) {
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
          recur.monthly_day = {
            day: +inputs["recur-monthly-byweek-day"],
            week: +inputs["recur-monthly-byweek-week"]
          };
        } else {
          recur.monthly = sendAt.getDate();
        }
        break;
      case "yearly":
        recur.yearly = {
          month: sendAt.getMonth(),
          date: sendAt.getDate()
        };
        break;
      case "function":
        recur.function = inputs["recurFuncSelect"];
        recur.finished = false;
        try {
          recur.args = SLStatic.unparseArgs(
                          SLStatic.parseArgs(inputs["recur-function-args"]));
        } catch (ex) {
          console.warn(ex);
          return { err: ("<b>" + browser.i18n.getMessage("InvalidArgsTitle")
                        + ":</b> "
                        + browser.i18n.getMessage("InvalidArgsBody")) };
        }
        break;
      default:
        SLStatic.error(`unrecognized recurrence type <${recur.type}>`);
        break;
    }

    if (inputs["sendbetween"]) {
      const start = inputs["sendbetween-start"];
      const end = inputs["sendbetween-end"];
      if (start && end) {
        const between = {
          start: SLStatic.parseDateTime(null,start),
          end: SLStatic.parseDateTime(null,end)
        };
        if (SLStatic.compareTimes(between.start,'>=',between.end)) {
          return { err: ("<b>" + browser.i18n.getMessage("endTimeWarningTitle")
                        + ":</b> "
                        + browser.i18n.getMessage("endTimeWarningBody")) };
        } else {
          recur.between = between;
        }
      }
    }

    if (inputs["sendon"]) {
      const dayLimit = inputs.groups["weekdayChecks"].vals;
      recur.days = [...Array(7)].reduce((obj,item,idx) => {
        if (dayLimit[idx]) {
          obj.push(idx);
        }
        return obj;
      }, []);
      if (recur.days.length === 0) {
        return { err: ("<b>" + browser.i18n.getMessage("missingDaysWarningTitle")
                      + ":</b> "
                      + browser.i18n.getMessage("missingDaysWarningBody")) };
      }
    }

    const schedule = { sendAt, recur };
    return schedule;
  },

  async setScheduleButton(schedule) {
    const sendScheduleButton = document.getElementById("sendScheduleButton");

    if (schedule.err) {
      sendScheduleButton.innerHTML = schedule.err;
      sendScheduleButton.disabled = true;
      return false;
    } else {
      browser.storage.local.get({ "preferences": {} }).then(storage => {
        const logConsoleLevel = storage.preferences.logConsoleLevel;
        if (["debug", "trace", "all"].includes(logConsoleLevel)) {
          SLPopup.debugSchedule();
        }
      });
    }

    try {
      const sendAt = schedule.sendAt;
      const recurSpec = schedule.recur;
      const enabler = SLStatic.stateSetter(true);
      const disabler = SLStatic.stateSetter(false);

      if (recurSpec.type === "function") {
        disabler(document.getElementById("sendAtTimeDateDiv"));
        sendScheduleButton.innerHTML =
          browser.i18n.getMessage("sendwithfunction", [recurSpec.function]);
        sendScheduleButton.disabled = false;
        return true;
      } else {
        enabler(document.getElementById("sendAtTimeDateDiv"));

        let scheduleText = browser.i18n.getMessage("sendAtLabel");
        scheduleText += " " + SLStatic.dateTimeFormat(sendAt);
        //let scheduleText = moment(sendAt).calendar();

        if (recurSpec.type !== "none" && recurSpec.type !== "function") {
          scheduleText += "<br/>" + browser.i18n.getMessage("recurLabel") + " ";
          if (recurSpec.monthly_day) {
            const ordDay = browser.i18n.getMessage("ord" + recurSpec.monthly_day.week);
            const dayName = SLStatic.getWkdayName(recurSpec.monthly_day.day, "long");
            scheduleText += browser.i18n.getMessage(
              "sendlater.prompt.every.label").toLowerCase() + " " +
              browser.i18n.getMessage("everymonthly_short", [ordDay, dayName]);
          } else {
            scheduleText += browser.i18n.getMessage("every_"+recurSpec.type,
                                                    (recurSpec.multiplier || 1));
          }

          if (recurSpec.between) {
            const start = SLStatic.formatTime(recurSpec.between.start);
            const end = SLStatic.formatTime(recurSpec.between.end);
            //scheduleText += "<br/>"
            scheduleText += " "
            scheduleText += browser.i18n.getMessage("betw_times", [start, end]);
          }

          if (recurSpec.days) {
            // TODO: internationalize this
            const days = recurSpec.days.map(v=>SLStatic.getWkdayName(v));
            let onDays;
            if (days.length === 1) {
              onDays = days;
            } else if (days.length === 2) {
              onDays = days.join(" and ");
            } else {
              const ndays = days.length;
              days[ndays-1] = `and ${days[ndays-1]}`;
              onDays = days.join(", ");
            }
            scheduleText += "<br/>"+browser.i18n.getMessage("only_on_days",onDays);
          }
        }

        if (recurSpec.cancelOnReply) {
          scheduleText += "<br/>" + browser.i18n.getMessage("cancel_on_reply");
        }

        sendScheduleButton.innerHTML = scheduleText;
        sendScheduleButton.disabled = false;
        return true;
      }
    } catch (e) { SLStatic.log(e) }

    sendScheduleButton.textContent = moment.localeData().invalidDate();
    sendScheduleButton.disabled = true;
    return false;
  },

  async saveDefaults() {
    const defaults = {};
    const dom = SLPopup.objectifyDOMElements();
    Object.keys(dom).forEach(key => {
      const element = dom[key];
      if (element.tagName === "INPUT" || element.tagName === "SELECT") {
        if (element.type === "button" || ["send-date", "send-time"].includes(element.id)) {
          // do nothing
        } else if (element.type === "radio" || element.type === "checkbox") {
          defaults[element.id] = element.checked;
        } else if (element.tagName === "SELECT" ||
                  ["number","text","date","time"].includes(element.type)) {
          defaults[element.id] = element.value;
        } else {
          throw (`Unrecognized element <${element.tagName} type=${element.type}...>`);
        }
      }
    });
    SLStatic.debug("Saving default values",defaults);
    browser.storage.local.set({ defaults });
  },

  async clearDefaults() {
    SLStatic.debug("Clearing default dialog values");
    browser.storage.local.set({ defaults: {} });
  },

  async applyDefaults() {
    browser.storage.local.get({defaults:{},ufuncs:{}}).then(storage => {
      const dom = SLPopup.objectifyDOMElements();

      const recurFuncSelect = dom['recurFuncSelect'];
      [...Object.keys(storage.ufuncs)].sort().forEach(funcName => {
        if (funcName !== "ReadMeFirst" && funcName !== "newFunctionName") {
          const newOpt = document.createElement('option');
          newOpt.id = `ufunc-${funcName}`;
          newOpt.value = funcName;
          newOpt.textContent = funcName;
          recurFuncSelect.appendChild(newOpt);
        }
      });

      SLStatic.stateSetter(recurFuncSelect.length > 0)(recurFuncSelect);

      if (storage.defaults && storage.defaults.daily !== undefined) {
        SLStatic.debug("Applying default values",storage.defaults);
        Object.keys(dom).forEach(key => {
          const element = dom[key];
          if (element.tagName === "INPUT" || element.tagName === "SELECT") {
            const defaultValue = storage.defaults[element.id];
            if (defaultValue === undefined || element.type === "button" ||
                ["send-date","send-time"].includes(element.id)) {
              return;
            } else if (element.type === "radio" || element.type === "checkbox") {
              element.checked = (storage.defaults[element.id]);
            } else if (element.tagName === "SELECT" ||
                      ["number","text","date","time"].includes(element.type)) {
              element.value = (storage.defaults[element.id]);
            } else {
              throw (`Unrecognized element <${element.tagName} type=${element.type}...>`);
            }
          }
        });
      }

      const fmtDate = new Intl.DateTimeFormat('en-CA',
        { year: "numeric", month: "2-digit", day: "2-digit" });
      const fmtTime = new Intl.DateTimeFormat('default',
        { hour: "2-digit", minute: "2-digit", hour12: false });

      const soon = new Date(Date.now()+600000);
      dom["send-date"].value = fmtDate.format(soon);
      dom["send-time"].value = fmtTime.format(soon);

      const inputs = SLPopup.objectifyFormValues();
      const schedule = SLPopup.parseInputs(inputs);

      // Trigger some fake events to activate listeners
      SLStatic.stateSetter(dom["sendon"].checked)(dom["onlyOnDiv"]);
      SLStatic.stateSetter(dom["sendbetween"].checked)(dom["betweenDiv"]);
      dom['once'].dispatchEvent(new Event('change'));
    });
  },

  async attachListeners() {
    const dom = SLPopup.objectifyDOMElements();

    SLStatic.stateSetter(dom["sendon"].checked)(dom["onlyOnDiv"]);
    SLStatic.stateSetter(dom["sendbetween"].checked)(dom["betweenDiv"]);
    dom["sendon"].addEventListener("change",async evt =>
      SLStatic.stateSetter(evt.target.checked)(dom["onlyOnDiv"]));
    dom["sendbetween"].addEventListener("change", async evt =>
      SLStatic.stateSetter(evt.target.checked)(dom["betweenDiv"])
    );
    Object.keys(dom).forEach(key => {
      const element = dom[key];
      if ((element.tagName === "INPUT" || element.tagName === "SELECT") &&
            (element.type !== "button")) {
        element.addEventListener("change", async evt => {
          const inputs = SLPopup.objectifyFormValues();
          const schedule = SLPopup.parseInputs(inputs);
          if (schedule) {
            SLPopup.setScheduleButton(schedule);
          }
        });
      }
    });
    [...document.getElementsByName("recur")].forEach(element =>
      element.addEventListener("change", async evt => {
        const localeData = moment.localeData();
        const specs = ["minutely","daily","weekly","monthly","yearly","function"];
        const recurrence = specs.find(s => dom[s].checked);
        const specDiv = dom['recurrence-spec'];
        if (recurrence) {
          const timeArgs = dom['recur-time-args-div'];
          const funcArgs = dom['recur-function-args-div'];
          const sendAt = SLStatic.parseDateTime(dom["send-date"].value,
                                                dom["send-time"].value);

          timeArgs.style.display = (recurrence === "function") ? "none" : "block";
          funcArgs.style.display = (recurrence === "function") ? "block" : "none";

          if (recurrence !== "function") {
            let pluralTxt = browser.i18n.getMessage(`plural_${recurrence}`);
            if (recurrence === "yearly") {
              const dateTxt = SLStatic.dateTimeFormat(sendAt,
                {month: "long", day: "numeric", hour: "numeric",
                  minute: "numeric"}, "default");
              pluralTxt += ", " + browser.i18n.getMessage("only_on_days", dateTxt);
            } else if (recurrence === "monthly") {
              const dayOrd = localeData.ordinal(sendAt.getDate());
              pluralTxt += ", " + browser.i18n.getMessage("only_on_days", dayOrd);
            } else if (recurrence === "weekly") {
              const dateTxt = localeData.weekdays()[sendAt.getDay()];
              pluralTxt += ", " + browser.i18n.getMessage("only_on_days", dateTxt);
            } else if (recurrence === "daily") {
              const atText = " at "; // TODO: translate this.
              const timeTxt = SLStatic.dateTimeFormat(sendAt,
                  {hour: "numeric", minute: "numeric" }, "default");
              pluralTxt += atText + timeTxt;
            }
            dom["recurperiod_plural"].textContent = pluralTxt;
          }

          specDiv.style.display = "block";

          dom['monthly-options-div'].style.display =
              (recurrence === "monthly") ? "" : "none";
          dom['recur-multiply'].style.display =
              (recurrence === "monthly") ? "" : "none";

          dom['section-between'].style.display =
            (recurrence === "minutely" || recurrence === "function") ?
              "" : "none";

          dom['recur-limits'].style.display = "block";
        } else {
          specDiv.style.display = "none";
          dom['recur-limits'].style.display = "none";
        }
      }));

    dom["save-defaults"].addEventListener("click", SLPopup.saveDefaults);
    dom["clear-defaults"].addEventListener("click", SLPopup.clearDefaults);

    dom["sendScheduleButton"].addEventListener("click", async evt => {
      const tabs = await browser.tabs.query({ active:true, currentWindow:true });
      const inputs = SLPopup.objectifyFormValues();
      const schedule = SLPopup.parseInputs(inputs);
      if (schedule && !schedule.err) {
        const message = {
          tabId: tabs[0].id,
          action: "doSendLater",
          sendAt: schedule.sendAt,
          recurSpec: SLStatic.unparseRecurSpec(schedule.recur),
          args: schedule.recur.args,
          cancelOnReply: schedule.recur.cancelOnReply
        };
        SLStatic.debug(message);
        browser.runtime.sendMessage(message);
        setTimeout((() => window.close()), 150);
      }
    });

    browser.storage.local.get({ "preferences": {} }).then(storage => {
      const quick1val = storage.preferences.quickOptions1Value || 15;
      const quick2val = storage.preferences.quickOptions2Value || 30;
      const quick3val = storage.preferences.quickOptions3Value || 120;

      const quick1el = dom["quick-delay-1"];
      const quick2el = dom["quick-delay-2"];
      const quick3el = dom["quick-delay-3"];

      quick1el.value = moment(new Date(Date.now()+60000*quick1val)).fromNow();
      quick2el.value = moment(new Date(Date.now()+60000*quick2val)).fromNow();
      quick3el.value = moment(new Date(Date.now()+60000*quick3val)).fromNow();

      quick1el.addEventListener("click", SLPopup.scheduleSendWithDelay(quick1val));
      quick2el.addEventListener("click", SLPopup.scheduleSendWithDelay(quick2val));
      quick3el.addEventListener("click", SLPopup.scheduleSendWithDelay(quick3val));
    });

    dom["sendNow"].addEventListener("click", SLPopup.scheduleSendWithDelay(0));
  },

  init() {
    SLPopup.applyDefaults().then(() => {
      SLPopup.attachListeners();
    });
  }
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
