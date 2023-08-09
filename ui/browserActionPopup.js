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
    recur: SLStatic.parseRecurSpec(msgData.recur),
  };
  schedule.recur.cancelOnReply = ["true", "yes"].includes(msgData.cancel);
  schedule.recur.args = msgData.args;
  return SLStatic.formatScheduleForUIColumn(schedule);
}

function makeRow(scheduleStr, recipientsStr, subjectStr) {
  let scheduleCell = document.createElement("div");
  scheduleCell.classList.add("div-table-cell");
  scheduleCell.textContent = scheduleStr;

  let recipientCell = document.createElement("div");
  recipientCell.classList.add("div-table-cell");
  recipientCell.textContent = recipientsStr;

  let subjectCell = document.createElement("div");
  subjectCell.classList.add("div-table-cell");
  subjectCell.textContent = subjectStr;
  subjectCell.style.minWidth = "40%";

  let rowElement = document.createElement("div");
  rowElement.classList.add("div-table-row");
  rowElement.appendChild(scheduleCell);
  rowElement.appendChild(recipientCell);
  rowElement.appendChild(subjectCell);

  return rowElement;
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
  document
    .getElementById("contactAuthorButton")
    .addEventListener("click", () => {
      messenger.runtime
        .sendMessage({
          action: "contactAuthor",
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
  messenger.runtime.sendMessage({ action: "getAllSchedules" }).then((res) => {
    res.schedules
      .sort(
        (a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime(),
      )
      .forEach((msgData) => {
        document
          .getElementById("scheduleTable")
          .appendChild(
            makeRow(
              truncateString(formatSchedule(msgData), 40),
              formatRecipientList(msgData.recipients, 15),
              truncateString(msgData.subject, 40),
            ),
          );
      });
  });
}

window.addEventListener("load", init, false);
