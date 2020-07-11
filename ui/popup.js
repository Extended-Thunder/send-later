// initialize popup window
(() => {
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
    const sendAt = SLStatic.parseDateTime(sendAtDate.value, sendAtTime.value);

    // Parse recurrence spec
    const recur = {
      type: [...document.getElementsByName("recur")].reduce((def,elem) =>
              (elem.checked ? elem.value : def), "none")
    };
    switch (recur.type) {
      case "none":
        break;
      case "minutely":
        recur.multiplier =
          document.getElementById(`recur-${recur.type}-multiplier`).value;
        recur.cancelOnReply =
          document.getElementById(`recur-${recur.type}-cancelonreply`).checked;
        break;
      case "daily":
        recur.multiplier =
          document.getElementById(`recur-${recur.type}-multiplier`).value;
        recur.cancelOnReply =
          document.getElementById(`recur-${recur.type}-cancelonreply`).checked;
        break;
      case "weekly":
        recur.multiplier =
          document.getElementById(`recur-${recur.type}-multiplier`).value;
        recur.cancelOnReply =
          document.getElementById(`recur-${recur.type}-cancelonreply`).checked;
        break;
      case "monthly":
        if (document.getElementById("recur-monthly-byweek").checked) {
          recur.monthly_day = {
            day: document.getElementById("recur-monthly-byweek-day").value,
            week: document.getElementById("recur-monthly-byweek-week").value
          };
        } else {
          recur.monthly = document.getElementById("recur-monthly-day").value;
        }
        recur.multiplier =
          document.getElementById(`recur-${recur.type}-multiplier`).value;
        recur.cancelOnReply =
          document.getElementById(`recur-${recur.type}-cancelonreply`).checked;
        break;
      case "yearly":
        recur.yearly = {
          month: document.getElementById("recur-yearly-month").value,
          day: document.getElementById("recur-yearly-day").value
        };
        recur.multiplier =
          document.getElementById(`recur-${recur.type}-multiplier`).value;
        recur.cancelOnReply =
          document.getElementById(`recur-${recur.type}-cancelonreply`).checked;
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
      recur.between = {
        start: SLStatic.parseDateTime(null,start.value),
        end: SLStatic.parseDateTime(null,end.value)
      };
    }

    if (document.getElementById("sendon").checked) {
      const dayNames = [...Array(7)].map((v,i)=>SLStatic.getWkdayName(i));
      const dayLimit = [...document.getElementsByName("weekdayChecks")].map(
        e => e.checked);
      recur.days = dayNames.filter((v,i)=>dayLimit[i]);
      if (recur.days.length === 0) {
        throw "Day filter selected but no days chosen.";
      }
    }

    const schedule = { sendAt, recur };
    return schedule;
  }

  function setScheduleButton(schedule) {
    const scheduleSendButton = document.getElementById("sendAt");

    try {
      const sendAt = schedule.sendAt;
      const recurSpec = schedule.recur;

      let scheduleText = browser.i18n.getMessage("sendAtLabel") + " " +
                            SLStatic.dateTimeFormat(sendAt);

      if (recurSpec.type !== "none" && recurSpec.type !== "function") {
        scheduleText += "<br/>" + browser.i18n.getMessage("recurLabel");
        console.log(recurSpec);
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
          scheduleText += "<br/>on "
          if (recurSpec.days.length === 1) {
            scheduleText += recurSpec.days[0];
          } else if (recurSpec.days.length === 2) {
            scheduleText += recurSpec.days.join(" and ");
          } else {
            const ndays = recurSpec.days.length;
            recurSpec.days[ndays-1] = `and ${recurSpec.days[ndays-1]}`;
            scheduleText += recurSpec.days.join(", ");
          }
        }
      }

      scheduleSendButton.innerHTML = scheduleText;
      scheduleSendButton.disabled = false;
    } catch (e) {
      SLStatic.log(e);
      scheduleSendButton.textContent = browser.i18n.getMessage("entervalid");
      scheduleSendButton.disabled = true;
    }
  }

  const setState = function(enabled) {
    return (async element => {
        try{
          element.disabled = !enabled;
        } catch (ex) {
          SLStatic.err(ex);
        }
        const enabler = setState(enabled);
        [...element.childNodes].forEach(enabler);
      });
  }

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
        setScheduleButton(schedule);
      });
    }
  });
  [...document.getElementsByName("recur")].forEach(element =>
    element.addEventListener("change", async evt => {
      const specs = ["minutely","daily","weekly","monthly","yearly","function"];
      for (const spec of specs) {
        const specDiv = document.getElementById(`${spec}-recurrence-spec`);
        specDiv.style.display = document.getElementById(spec).checked;
      }
    }));

  document.getElementById("sendAt").addEventListener("click", async evt => {
    const tabs = await browser.tabs.query({ active:true, currentWindow:true });
    const schedule = parseInputs();
    const message = {
      tabId: tabs[0].id,
      action: "doSendLater",
      sendAt: schedule.sendAt,
      recurSpec: SLStatic.unparseRecurSpec(schedule.recur),
      args: schedule.recur.args,
      cancelOnReply: schedule.recur.cancelOnReply
    };
    browser.runtime.sendMessage(message);
    setTimeout((() => window.close()), 150);
  });

  document.getElementById("sendNow").addEventListener("click", doSendDelay(0));
  document.getElementById("delay15").addEventListener("click", doSendDelay(15));
  document.getElementById("delay30").addEventListener("click", doSendDelay(30));
  document.getElementById("delay120").addEventListener("click", doSendDelay(120));

  document.getElementById("cancel").addEventListener("click", async (event) => {
    browser.runtime.sendMessage({ action: "cancel" });
    setTimeout((() => window.close()), 150);
  });
})();
