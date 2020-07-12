// initialize popup window
const initialize = () => {
  function doSendDelay(delay) {
      return (async (event) => {
        SLStatic.debug(`Scheduling message in ${delay} minutes`);

        const tabs = await browser.tabs.query({ active:true, currentWindow:true });
        const msg = { tabId: tabs[0].id };
        if (delay === 0) {
          msg.action = "doSendNow";
          msg.sendTime = null;
        } else {
          msg.action = "doSendLater";
          msg.sendTime = new Date();
          msg.sendTime.setTime(msg.sendTime.getTime() + delay * 60 * 1000);
        }

        browser.runtime.sendMessage(msg);

        setTimeout((() => window.close()), 150);
      });
  }

  function parseInputs() {
    // Parse send date and time
    const sendAtDate = document.getElementById("send-date");
    const sendAtTime = document.getElementById("send-time");
    if (!sendAtDate.value || !sendAtTime.value) {
      return;
    }
    const sendAt = SLStatic.parseDateTime(sendAtDate.value, sendAtTime.value);
    if (SLStatic.compareTimes(sendAt, '<', new Date(), true)) {
      return { err: browser.i18n.getMessage("errorDateInPast") };
    }

    // Construct a recur object { type: "...", multiplier: "...", ... }
    const recur = {
      type: [...document.getElementsByName("recur")].reduce((def,elem) =>
              (elem.checked ? elem.value : def), "none")
    };
    if (recur.type !== "none") {
      const cancelonreply = document.getElementById(`recur-cancelonreply`);
      recur.cancelOnReply = cancelonreply.checked;

      if (recur.type !== "function") {
        recur.multiplier = document.getElementById(`recur-multiplier`).value;
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
        if (document.getElementById("recur-monthly-byweek").checked) {
          recur.monthly_day = {
            day: +document.getElementById("recur-monthly-byweek-day").value,
            week: +document.getElementById("recur-monthly-byweek-week").value
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
        recur.function = document.getElementById("recurFunction").value;
        recur.finished = false;
        recur.args = document.getElementById("recur-function-args").value;
        break;
      default:
        SLStatic.error(`unrecognized recurrence type <${recur.type}>`);
        break;
    }

    if (document.getElementById("sendbetween").checked) {
      const start = document.getElementById("sendbetween-start");
      const end = document.getElementById("sendbetween-end");
      if (start.value && end.value) {
        const between = {
          start: SLStatic.parseDateTime(null,start.value),
          end: SLStatic.parseDateTime(null,end.value)
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

    if (document.getElementById("sendon").checked) {
      const dayNames = [...Array(7)].map((v,i)=>SLStatic.getWkdayName(i));
      const dayLimit = [...document.getElementsByName("weekdayChecks")].map(
        e => e.checked);
      recur.days = dayNames.filter((v,i)=>dayLimit[i]);
      if (recur.days.length === 0) {
        return { err: ("<b>" + browser.i18n.getMessage("missingDaysWarningTitle")
                      + ":</b> "
                      + browser.i18n.getMessage("missingDaysWarningBody")) };
      }
    }

    const schedule = { sendAt, recur };
    return schedule;
  }

  function setScheduleButton(schedule) {
    const scheduleSendButton = document.getElementById("sendAt");

    if (schedule.err) {
      scheduleSendButton.innerHTML = schedule.err;
      scheduleSendButton.disabled = true;
      return false;
    }

    try {
      const sendAt = schedule.sendAt;
      const recurSpec = schedule.recur;

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
            browser.i18n.getMessage("everymonthly_short", ordDay, dayName);
        } else {
          scheduleText += browser.i18n.getMessage("every_"+recurSpec.type,
                                                  (recurSpec.multiplier || 1));
        }

        if (recurSpec.between) {
          const start = SLStatic.formatTime(recurSpec.between.start);
          const end = SLStatic.formatTime(recurSpec.between.end);
          //scheduleText += "<br/>"
          scheduleText += " "
          scheduleText += browser.i18n.getMessage("betw_times", start, end);
        }

        if (recurSpec.days) {
          // TODO: internationalize this
          let onDays;
          if (recurSpec.days.length === 1) {
            onDays = recurSpec.days[0];
          } else if (recurSpec.days.length === 2) {
            onDays = recurSpec.days.join(" and ");
          } else {
            const ndays = recurSpec.days.length;
            recurSpec.days[ndays-1] = `and ${recurSpec.days[ndays-1]}`;
            onDays = recurSpec.days.join(", ");
          }
          scheduleText += "<br/>"+browser.i18n.getMessage("only_on_days",onDays);
        }
      }

      if (recurSpec.cancelOnReply) {
        scheduleText += "<br/>" + browser.i18n.getMessage("cancel_on_reply");
      }

      scheduleSendButton.innerHTML = scheduleText;
      scheduleSendButton.disabled = false;
      return true;
    } catch (e) { SLStatic.log(e) }

    scheduleSendButton.textContent = moment.localeData().invalidDate();
    scheduleSendButton.disabled = true;
    return false;
  }

  function saveDefaults() {
    const defaults = {};
    [...document.getElementsByTagName("INPUT"),
     ...document.getElementsByTagName("SELECT")].forEach(element => {
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
    });
    SLStatic.debug("Setting default values",defaults);
    browser.storage.local.set({ defaults });
  }

  async function applyDefaults() {
    browser.storage.local.get("defaults").then(storage => {
      if (!storage.defaults) {
        return;
      }
      SLStatic.debug("Applying default values",storage.defaults);
      [...document.getElementsByTagName("INPUT"),
       ...document.getElementsByTagName("SELECT")].forEach(element => {
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
      });

      const fmtDate = new Intl.DateTimeFormat('en-CA',
        { year: "numeric", month: "2-digit", day: "2-digit" });
      const fmtTime = new Intl.DateTimeFormat('default',
        { hour: "2-digit", minute: "2-digit", hour12: false });

      const soon = new Date(Date.now()+600000);
      document.getElementById("send-date").value = fmtDate.format(soon);
      document.getElementById("send-time").value = fmtTime.format(soon);

      setScheduleButton(parseInputs());
    });
  }

  function setState(enabled) {
    return (async element => {
        try{
          if (["SPAN","DIV","LABEL"].includes(element.tagName)) {
            element.style.color = enabled ? "black" : "#888888";
          }
          element.disabled = !enabled;
        } catch (ex) {
          SLStatic.error(ex);
        }
        const enabler = setState(enabled);
        [...element.childNodes].forEach(enabler);
      });
  }

  function attachListeners() {
    const functionSelect = document.getElementById("recurFunction");
    setState(functionSelect.length > 0)(
      document.getElementById("function-recur-radio")
    );
    setState(document.getElementById("sendon").checked)(
      document.getElementById("onlyOnDiv")
    );
    setState(document.getElementById("sendbetween").checked)(
      document.getElementById("betweenDiv")
    );
    document.getElementById("sendon").addEventListener("change",async evt=>{
      const ediv = document.getElementById("onlyOnDiv");
      setState(evt.target.checked)(ediv);
    });
    document.getElementById("sendbetween").addEventListener("change", async evt=>{
      const ediv = document.getElementById("betweenDiv");
      setState(evt.target.checked)(ediv);
    });
    [...document.getElementsByTagName("INPUT")].forEach(element => {
      if (element.type !== "button") {
        element.addEventListener("change", async evt => {
          const schedule = parseInputs();
          if (schedule) {
            setScheduleButton(schedule);
          }
        });
      }
    });
    [...document.getElementsByName("recur")].forEach(element =>
      element.addEventListener("change", async evt => {
        const localeData = moment.localeData();
        const specs = ["minutely","daily","weekly","monthly","yearly","function"];
        const recurrence = specs.find(s => document.getElementById(s).checked);
        const specDiv = document.getElementById('recurrence-spec');
        if (recurrence) {
          const timeArgs = document.getElementById('recur-time-args-div');
          const funcArgs = document.getElementById('recur-function-args-div');
          const sendAtDateInput = document.getElementById("send-date");
          const sendAtTimeInput = document.getElementById("send-time");
          const sendAt = SLStatic.parseDateTime(sendAtDateInput.value,
                                                sendAtTimeInput.value);

          timeArgs.style.display = (recurrence === "function") ? "none" : "block";
          funcArgs.style.display = (recurrence === "function") ? "block" : "none";

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
          const plural = document.getElementById("recurperiod_plural");
          plural.textContent = pluralTxt;

          specDiv.style.display = "block";

          document.getElementById('monthly-options-div').style.display =
              (recurrence === "monthly") ? "" : "none";
          document.getElementById('recur-multiply').style.display =
              (recurrence === "monthly") ? "" : "none";

          document.getElementById('section-between').style.display =
              (recurrence === "minutely") ? "" : "none";

          document.getElementById('recur-limits').style.display = "block";
        } else {
          specDiv.style.display = "none";
          document.getElementById('recur-limits').style.display = "none";
        }
      }));

    // ["save-defaults", "clear-defaults"].forEach(id =>
    //   document.getElementById(id).addEventListener("click",
    //     async evt => {
    //       // Logical nand
    //       const clear = document.getElementById("clear-defaults");
    //       const save = document.getElementById("save-defaults");
    //       clear.checked &= (evt.target.id === 'clear-defaults') || !save.checked;
    //       save.checked &= (evt.target.id === 'save-defaults') || !clear.checked;
    //     }));
    document.getElementById("save-defaults").addEventListener("click", evt => {
      saveDefaults();
    });

    document.getElementById("clear-defaults").addEventListener("click", evt => {
      SLStatic.debug("Clearing default dialog values");
      browser.storage.local.set({ defaults: {} });
    });

    document.getElementById("sendAt").addEventListener("click", async evt => {
      const tabs = await browser.tabs.query({ active:true, currentWindow:true });
      const schedule = parseInputs();
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

      const quick1el = document.getElementById("quick-delay-1");
      const quick2el = document.getElementById("quick-delay-2");
      const quick3el = document.getElementById("quick-delay-3");

      quick1el.value = moment(new Date(Date.now()+60000*quick1val)).fromNow();
      quick2el.value = moment(new Date(Date.now()+60000*quick2val)).fromNow();
      quick3el.value = moment(new Date(Date.now()+60000*quick3val)).fromNow();

      quick1el.addEventListener("click", doSendDelay(quick1val));
      quick2el.addEventListener("click", doSendDelay(quick2val));
      quick3el.addEventListener("click", doSendDelay(quick3val));
    });

    document.getElementById("sendNow").addEventListener("click", doSendDelay(0));

    // document.getElementById("cancel").addEventListener("click", async (event) => {
    //   browser.runtime.sendMessage({ action: "cancel" });
    //   setTimeout((() => window.close()), 150);
    // });
  }
  attachListeners();
  applyDefaults();
};

// For testing purposes, because the browser mock script needs to
// asynchronously load translations.
function waitAndInit() {
  if (browser.i18n.getMessage("recurMonthlyLabel") === "recurMonthlyLabel") {
    setTimeout(waitAndInit, 10);
  } else {
    initialize();
  }
}
waitAndInit()
