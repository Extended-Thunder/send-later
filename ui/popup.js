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
  const sendAtDate = document.getElementById("send-date");
  const sendAtTime = document.getElementById("send-time");
  const sendBtwnStart = document.getElementById("sendbetween-start");
  const sendBtwnEnd = document.getElementById("sendbetween-end");
  const recur = [...document.getElementsByName("recur")].reduce((def,elem) =>
    (elem.checked ? elem.value : def), "none");

  const weekdayLimit = document.getElementById("sendon").checked;
  const dayLimit = [...document.getElementsByName("weekdayChecks")].map(
    e => (!weekdayLimit) || e.checked);

  const schedule = {
    sendAt: SLStatic.parseDateTime(sendAtDate.value, sendAtTime.value),
    type: [...document.getElementsByName("recur")].reduce((def,elem) =>
            (elem.checked ? elem.value : def), "none")
  };

  if (sendBtwnStart.value && sendBtwnEnd.value) {
    schedule.between = {
      start: SLStatic.parseDateTime(null,sendBtwnStart.value),
      end: SLStatic.parseDateTime(null,sendBtwnEnd.value)
    };
  }

  const scheduleSendButton = document.getElementById("sendAt");
  try {
    if (SLStatic.validateSchedule(schedule)) {
      let scheduleText = browser.i18n.getMessage("sendAtLabel");
      scheduleText += " " + schedule.sendAt.toLocaleString();
      if (recur !== "none") {
        scheduleText += "<br/>" + browser.i18n.getMessage("recurLabel");
        const recurKey = `recur${recur[0].toUpperCase()}${recur.slice(1)}Label`;
        scheduleText += " " + browser.i18n.getMessage(recurKey);
      }

      if (document.getElementById("sendon").checked) {
        const dayNames = [...Array(7)].map((v,i)=>SLStatic.getWkdayName(i));
        const onDays = dayNames.filter((v,i)=>dayLimit[i]);
        if (onDays.length === 0) {
          throw "Day filter selected but no days chosen.";
        }
        scheduleText += "<br/>" + onDays.join(", ");
      }

      if (document.getElementById("sendbetween").checked) {
        const start = schedule.between.start, end=schedule.between.end;
        const tfmt = (new Intl.DateTimeFormat('default', {hour: 'numeric', minute: 'numeric'}));
        scheduleText += "<br/>";
        scheduleText += browser.i18n.getMessage("sendBtwnLabel").toLowerCase();
        scheduleText += ` ${tfmt.format(start)}-${tfmt.format(end)}`;
      }

      scheduleSendButton.innerHTML = scheduleText;
      scheduleSendButton.disabled = false;
    } else {
      scheduleSendButton.innerHTML = browser.i18n.getMessage("sendAtDefaultLabel");
      scheduleSendButton.disabled = true;
    }
  } catch (e) {
    SLStatic.log(e);
    scheduleSendButton.innerHTML = browser.i18n.getMessage("sendAtDefaultLabel");
    scheduleSendButton.disabled = true;
  }
}

function initPopup() {
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
  document.getElementById("sendon").addEventListener("change",evt=>{
    const ediv = document.getElementById("onlyOnDiv");
    setState(evt.target.checked)(ediv);
  });
  document.getElementById("sendbetween").addEventListener("change",evt=>{
    const ediv = document.getElementById("betweenDiv");
    setState(evt.target.checked)(ediv);
  });
  [...document.getElementsByTagName("INPUT")].forEach(element => {
    if (element.type !== "button") {
      element.addEventListener("change", async evt => parseInputs());
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
}

initPopup();
