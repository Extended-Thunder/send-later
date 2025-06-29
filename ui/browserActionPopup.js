function truncateString(s, limit) {
  if (s.length <= limit) {
    return String(s);
  } else {
    return String(s).substring(0, limit - 3) + "...";
  }
}

function formatRecipientList(recipients, limit) {
  let contactList = recipients.map((contact) => {
    let contactName = String(contact).split(/<.*>/)[0].trim();
    return truncateString(contactName, Math.min(limit, 15));
  });

  let ret = contactList[0];
  for (let i = 1; i < contactList.length; i++) {
    let contact = contactList[i];
    if (ret.length + contact.length <= limit - 2) {
      ret += ", " + contact;
    } else {
      let remaining = contactList.length - i;
      return `${ret} +${remaining}`;
    }
  }
  return ret;
}

function formatSchedule(msgData) {
  let schedule = {
    sendAt: new Date(msgData.sendAt),
    recur: SLTools.parseRecurSpec(msgData.recur),
  };
  schedule.recur.cancelOnReply = ["true", "yes"].includes(msgData.cancel);
  schedule.recur.args = msgData.args;
  return SLTools.formatScheduleForUIColumn(schedule);
}

function setCellValue(elt, value, html) {
  if (html) elt.innerHTML = value;
  else elt.textContent = value;
}

function makeRow(scheduleStr, recipientsStr, subjectStr, folderStr, isHtml) {
  let rowElement = document.createElement("div");
  rowElement.classList.add("div-table-row");

  let scheduleCell = document.createElement("div");
  scheduleCell.classList.add("div-table-cell");
  setCellValue(scheduleCell, scheduleStr, isHtml);
  rowElement.appendChild(scheduleCell);

  let recipientCell = document.createElement("div");
  recipientCell.classList.add("div-table-cell");
  setCellValue(recipientCell, recipientsStr, isHtml);
  rowElement.appendChild(recipientCell);

  let subjectCell = document.createElement("div");
  subjectCell.classList.add("div-table-cell");
  setCellValue(subjectCell, subjectStr, isHtml);
  subjectCell.style.minWidth = "40%";
  rowElement.appendChild(subjectCell);

  let folderCell = document.createElement("div");
  folderCell.classList.add("div-table-cell");
  setCellValue(folderCell, folderStr, isHtml);
  rowElement.appendChild(folderCell);

  return rowElement;
}

function makeHeader() {
  return makeRow(
    `<u>${SLTools.i18n.getMessage("sendAtLabel")}</u>`,
    `<u>${SLTools.i18n.getMessage("recipients")}</u>`,
    `<u>${SLTools.i18n.getMessage("subject")}</u>`,
    `<u>${SLTools.i18n.getMessage("folder")}</u>`,
    true,
  );
}

function init() {
  document.getElementById("showPrefsButton").addEventListener("click", () => {
    messenger.runtime
      .sendMessage({
        action: "showPreferences",
      })
      .then(() => window.close());
  });
  document.getElementById("showGuideButton").addEventListener("click", () => {
    messenger.runtime
      .sendMessage({
        action: "showUserGuide",
      })
      .then(() => window.close());
  });
  document.getElementById("showNotesButton").addEventListener("click", () => {
    messenger.runtime
      .sendMessage({
        action: "showReleaseNotes",
      })
      .then(() => window.close());
  });
  document.getElementById("donateButton").addEventListener("click", () => {
    messenger.runtime
      .sendMessage({
        action: "donateLink",
      })
      .then(() => window.close());
  });
  document.getElementById("logButton").addEventListener("click", () => {
    messenger.runtime
      .sendMessage({
        action: "logLink",
      })
      .then(() => window.close());
  });
  messenger.runtime.sendMessage({ action: "getAllSchedules" }).then((res) => {
    let headerAdded = false;
    let scheduleTable = document.getElementById("scheduleTable");
    res.schedules
      .sort(
        (a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime(),
      )
      .forEach((msgData) => {
        if (!headerAdded) {
          scheduleTable.appendChild(makeHeader());
          headerAdded = true;
        }
        scheduleTable.appendChild(
          makeRow(
            truncateString(formatSchedule(msgData), 40),
            formatRecipientList(msgData.recipients, 15),
            truncateString(msgData.subject, 40),
            msgData.folder,
          ),
        );
      });
    if (!headerAdded) {
      scheduleTable.appendChild(
        makeRow(SLTools.i18n.getMessage("noneScheduled"), "", "", ""),
      );
    }
  });
}

window.addEventListener("load", init, false);
