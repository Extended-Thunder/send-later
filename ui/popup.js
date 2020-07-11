// initialize popup window
const initialize = () => {
  function doSendDelay(delay) {
      return (async (event) => {
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
    if (sendAt.getTime() < Date.now()) {
      return { err: browser.i18n.getMessage("errorDateInPast") };
    }

    // Parse recurrence spec
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
      // TODO
        // if (document.getElementById("recur-monthly-byweek").checked) {
        //   recur.monthly_day = {
        //     day: document.getElementById("recur-monthly-byweek-day").value,
        //     week: document.getElementById("recur-monthly-byweek-week").value
        //   };
        // } else {
        //   recur.monthly = document.getElementById("recur-monthly-day").value;
        // }
        break;
      case "yearly":
      // TODO
        // recur.yearly = {
        //   month: document.getElementById("recur-yearly-month").value,
        //   day: document.getElementById("recur-yearly-day").value
        // };
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
          return { err: browser.i18n.getMessage("endTimeWarningBody") };
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
        return { err: browser.i18n.getMessage("missingDaysWarningTitle") };
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

      let scheduleText = browser.i18n.getMessage("sendAtLabel") + " " +
                            SLStatic.dateTimeFormat(sendAt);

      if (recurSpec.type !== "none" && recurSpec.type !== "function") {
        scheduleText += "<br/>" + browser.i18n.getMessage("recurLabel");
        scheduleText += " " + browser.i18n.getMessage("every_"+recurSpec.type,
                                                  (recurSpec.multiplier || 1));
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

      scheduleSendButton.innerHTML = scheduleText;
      scheduleSendButton.disabled = false;
      return true;
    } catch (e) { SLStatic.log(e) }

    scheduleSendButton.textContent = browser.i18n.getMessage("entervalid");
    scheduleSendButton.disabled = true;
    return false;
  }

  const setState = function(enabled) {
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
      const specs = ["minutely","daily","weekly","monthly","yearly","function"];
      const recurrence = specs.find(s => document.getElementById(s).checked);
      const specDiv = document.getElementById('recurrence-spec');
      if (recurrence) {
        const timeArgs = document.getElementById('recur-time-args-div');
        const funcArgs = document.getElementById('recur-function-args-div');

        timeArgs.style.display = (recurrence === "function") ? "none" : "block";
        funcArgs.style.display = (recurrence === "function") ? "block" : "none";

        const plural = document.getElementById("recurperiod_plural");
        plural.textContent = browser.i18n.getMessage(`plural_${recurrence}`);

        specDiv.style.display = "block";
      } else {
        specDiv.style.display = "none";
      }
    }));

  ["save-defaults", "clear-defaults"].forEach(id =>
    document.getElementById(id).addEventListener("click",
      async evt => {
        // Logical nand
        const clear = document.getElementById("clear-defaults");
        const save = document.getElementById("save-defaults");
        clear.checked &= (evt.target.id === 'clear-defaults') || !save.checked;
        save.checked &= (evt.target.id === 'save-defaults') || !clear.checked;
      }));

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

  document.getElementById("sendNow").addEventListener("click", doSendDelay(0));
  document.getElementById("delay15").addEventListener("click", doSendDelay(15));
  document.getElementById("delay30").addEventListener("click", doSendDelay(30));
  document.getElementById("delay120").addEventListener("click", doSendDelay(120));

  document.getElementById("cancel").addEventListener("click", async (event) => {
    browser.runtime.sendMessage({ action: "cancel" });
    setTimeout((() => window.close()), 150);
  });

  document.getElementById("send-date").valueAsDate = new Date();
  document.getElementById("send-time").value = SLStatic.formatTime(
                                                  new Date(Date.now()+600000));

  setScheduleButton(parseInputs());
};

// For testing purposes, because the browser mock script needs to
// asynchronously load translations.
function waitAndInit() {
  if (browser.i18n.getMessage("delay120Label") === "delay120Label") {
    setTimeout(waitAndInit, 10);
  } else {
    initialize();
  }
}
waitAndInit()
