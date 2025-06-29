// Class for abstracting the idea that a message is locked and can't be sent
// again. Uses local storage as the persistent lock cache. The key of each
// value in the cache is a message idea and a date. The value is an array
// containing a lock type and an x-send-later-at date value. Search for
// ".lock(" below to find out the lock types that are used. The lock type
// "true" is the generic "This message was sent successfully so if we see it
// again the Drafts folder is probably corrupt" lock type; others indicate
// different errors which do NOT mean that the Drafts folder is corrupt.
//
// Because we enforce not delivering messages with x-send-later-at values more
// than 180 days in the past, we can prune any lock cache entries with dates
// older than that. This prevents the lock cache from growing without bound
// forever.
class Locker {
  static locks;
  static newLocks;

  constructor() {
    if (!Locker.locks) {
      return (async () => {
        let changed = false;
        let storage = await messenger.storage.local.get({ lock: {} });
        Locker.locks = storage.lock;
        // Convert old style lock cache to new one.
        if (!Locker.locks["migrated"]) {
          for (let lock of Object.keys(Locker.locks)) {
            Locker.locks[lock] = [Locker.locks[lock], new Date()];
          }
          Locker.locks["migrated"] = 1;
          changed = true;
        }
        let cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        for (let lockId of Object.keys(Locker.locks)) {
          let value = Locker.locks[lockId];
          if (typeof value != "object") {
            // "migrated" key
            continue;
          }
          if (value[1] < cutoff) {
            changed = true;
            delete Locker.locks[lockId];
          }
        }
        if (changed) {
          await messenger.storage.local.set({ lock: Locker.locks });
        }
        return this;
      })();
    }
  }

  async lock(hdr, full, reason) {
    let msgId = hdr.headerMessageId;
    let date = hdr.date;
    let id = `${msgId}/${date}`;
    let sendAt = full.headers["x-send-later-at"][0];
    Locker.locks[id] = [reason || true, new Date(sendAt)];
    if (Locker.newLocks) {
      Locker.newLocks[id] = Locker.locks[id];
    }
    return await messenger.storage.local.set({ lock: Locker.locks });
  }

  isLocked(hdr, full) {
    let msgId = hdr.headerMessageId;
    let date = hdr.date;
    let id = `${msgId}/${date}`;
    let it = Locker.locks[id];
    if (it) {
      if (Locker.newLocks) {
        Locker.newLocks[id] = Locker.locks[id];
      }
      return it[0];
    }
    return false;
  }
}

async function* getMessages(list) {
  let page = await list;
  for (let message of page.messages) {
    yield message;
  }

  while (page.id) {
    page = await messenger.messages.continueList(page.id);
    for (let message of page.messages) {
      yield message;
    }
  }
}

async function* getMessageIds(list) {
  for await (let message of getMessages(list)) yield message.id;
}

// Set of message ID's which are scheduled
const scheduledMsgCache = new Set();
// Set of message ID's which are not scheduled
const _unscheduledMsgCache = new Set();
const unscheduledMsgCache = {
  has: function (key) {
    let ret = _unscheduledMsgCache.has(key);
    SLTools.trace(`unscheduledMsgCache.has(${key}) = ${ret}`);
    return ret;
  },
  add: function (key) {
    let ret = _unscheduledMsgCache.add(key);
    SLTools.trace(`unscheduledMsgCache.add(${key}) = ${ret}`);
    return ret;
  },
  delete: function (key) {
    let ret = _unscheduledMsgCache.delete(key);
    SLTools.trace(`unscheduledMsgCache.delete(${key}) = ${ret}`);
    return ret;
  },
  clear: function () {
    let ret = _unscheduledMsgCache.clear();
    SLTools.trace(`unscheduledMsgCache.clear() = ${ret}`);
    return ret;
  },
};

// Count draft messages containing the correct `x-send-later-uuid` header.
async function countActiveScheduledMessages() {
  const preferences = await SLTools.getPrefs();
  let isScheduled = await SLTools.forAllDrafts(
    async (msgHdr) => {
      let msgId = msgHdr.id;
      SLTools.debug(`countActiveScheduledMessages: Checking message ${msgId}`);
      if (scheduledMsgCache.has(msgId)) {
        SLTools.debug(
          `countActiveScheduledMessages: msg ${msgId} found in scheduled cache`,
          msgHdr,
        );
        return true;
      } else if (unscheduledMsgCache.has(msgId)) {
        SLTools.debug(
          `countActiveScheduledMessages: msg ${msgId} found in unscheduled cache`,
        );
        return false;
      } else {
        let fullMsg = await messenger.messages.getFull(msgId);
        let uuid = (fullMsg.headers["x-send-later-uuid"] || [])[0];
        let instanceUuid = preferences.instanceUUID;
        if (uuid == instanceUuid) {
          scheduledMsgCache.add(msgId);
          SLTools.debug(
            `countActiveScheduledMessages: msg ${msgId} added to scheduled cache`,
            msgHdr,
          );
          return true;
        } else {
          SLTools.debug(
            `countActiveScheduledMessages: msg ${msgId} added to unscheduled cache` +
              ` (uuid="${uuid}", instanceUuid="${instanceUuid}")`,
          );
          unscheduledMsgCache.add(msgId);
          return false;
        }
      }
    },
    true, // Running sequentially seems to give slightly better performance.
    undefined,
    preferences,
  );
  return isScheduled.filter((x) => x).length;
}

async function updateShortcuts(preferences) {
  for (let i = 1; i <= 3; i++) {
    let shortcutName = `send-later-shortcut-${i}`;
    let shortcutPref = `quickOptions${i}Key`;
    let shortcutValue = preferences[shortcutPref];
    let shortcutKey = shortcutValue.length ? `Ctrl+Alt+${shortcutValue}` : "";
    try {
      await messenger.commands.update({
        name: shortcutName,
        shortcut: shortcutKey,
      });
      SLTools.debug(`Set ${shortcutName} to ${shortcutKey}`);
    } catch (ex) {
      SLTools.error(
        `Error binding ${shortcutName} to ${shortcutKey}: ${ex}`,
        ex,
      );
    }
  }
}

// Like messenger.messages.import, but supports IMAP folders.
// Cribbed from https://github.com/cleidigh/EditEmailSubject-MX/blob/master/
// src/content/scripts/editemailsubject.mjs, as recommended by John Bieling.
async function messageImport(file, destination, properties) {
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
      await SLTools.tb128(localAccount.id, localAccount),
      false,
    );
    localFolder = localFolders.find(
      (folder) => folder.name == SLTools.tempFolderName,
    );
    if (!localFolder) {
      localFolder = await messenger.folders.create(
        localAccount,
        SLTools.tempFolderName,
      );
    }
  }
  let newMsgHeader = await messenger.messages.import(
    file,
    await SLTools.tb128(localFolder.id, localFolder),
    properties,
  );

  if (!newMsgHeader) {
    return false;
  }
  SLTools.debug(`Saved local message ${newMsgHeader.id}`);

  if (isLocal) {
    SLTools.debug("Destination folder is already local, not moving message");
    return true;
  }

  // Move new message from temp folder to real destination.
  let moved;
  try {
    await messenger.messages
      .move([newMsgHeader.id], destination.id)
      .then(() => {
        moved = true;
      });
  } catch (ex) {
    moved = false;
  }
  return moved;
}

// Original idea:
// https://thunderbird.topicbox.com/groups/addons/T06356567165277ee-M25e96f2d58e961d6167ad348/charset-problem-when-saving-to-eml-format
// My improvement to it:
// https://thunderbird.topicbox.com/groups/addons/T06356567165277ee-Md1002780236b2a1ad92e88bd/charset-problem-when-saving-to-eml-format
function getFileFromRaw(binaryString) {
  let bytes = new Array(binaryString.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new File([new Uint8Array(bytes)], "message.eml", {
    type: "message/rfc822",
  });
}

/* Given a user function and an "unparsed" argument string,
 * this function returns a common schedule object, including
 * `sendAt` and `recur` members.
 */
function parseUfuncToSchedule(name, body, prev, argStr) {
  let args = null;
  if (argStr) {
    try {
      argStr = SLTools.unparseArgs(SLTools.parseArgs(argStr));
      args = SLTools.parseArgs(argStr);
    } catch (ex) {
      SLTools.warn(ex);
      let errTitle = SLTools.i18n.getMessage("InvalidArgsTitle");
      let errBody = SLTools.i18n.getMessage("InvalidArgsBody");
      return { err: `${errTitle}: ${errBody}` };
    }
  }

  const { sendAt, nextspec, nextargs, error } = SLTools.evaluateUfunc(
    name,
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
    let recur = SLTools.parseRecurSpec(nextspec || "none") || { type: "none" };
    if (recur.type !== "none") recur.args = nextargs || "";

    const schedule = { sendAt, recur };
    SLTools.debug("commands.onCommand received ufunc response:", schedule);
    return schedule;
  }
}

function customHdrToScheduleInfo(customHeaders, instanceUUID) {
  let cellText = "";
  let sortValue = (Math.pow(2, 31) - 5) | 0;

  if (!customHeaders["content-type"]) {
    SLTools.warn("Didn't receive complete headers.");
    return { cellText, sortValue };
  } else if (!customHeaders["x-send-later-at"]) {
    // Do nothing. Leave cell properties as default
    return { cellText, sortValue };
  }

  if (customHeaders["x-send-later-uuid"] !== instanceUUID) {
    cellText = SLTools.i18n.getMessage("incorrectUUID");
    sortValue = (Math.pow(2, 31) - 2) | 0;
  } else {
    const sendAt = new Date(customHeaders["x-send-later-at"]);
    const recurSpec = customHeaders["x-send-later-recur"] || "none";
    let recur = SLTools.parseRecurSpec(recurSpec);
    recur.cancelOnReply = ["true", "yes"].includes(
      customHeaders["x-send-later-cancel-on-reply"],
    );
    recur.args = customHeaders["x-send-later-args"];
    cellText = SLTools.formatScheduleForUIColumn({ sendAt, recur });
    // Numbers will be truncated. Be sure this fits in 32 bits
    sortValue = (sendAt.getTime() / 1000) | 0;
  }
  return { cellText, sortValue };
}

// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
  prefCache: {},
  windowCreatedResolver: null,

  // Track the status of Send Later's main loop. This helps
  // resolve sub-minute accuracy for very short scheduled times
  // (e.g. "Send in 38 seconds" ...). Only affects UI
  // elements in which a relative time is displayed.
  previousLoop: null,
  loopMinutes: 1,
  // Time for each loop over and above the interval time
  loopExcessTimes: [],

  // Cause current compose window to send immediately
  // (after some pre-send checks)
  async checkDoSendNow(options) {
    if (options.first) {
      let messageArgs = [
        messenger.i18n.getMessage("sendNowLabel"),
        messenger.i18n.getMessage("sendAtLabel"),
      ];
      let preferences = await SLTools.getPrefs();
      if (preferences.showSendNowAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("SendNowConfirmMessage", messageArgs),
          messenger.i18n.getMessage("ConfirmAgain"),
          true,
        ).catch((err) => {
          SLTools.trace(err);
        });
        if (result.check === false) {
          preferences.showSendNowAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLTools.debug(`User canceled send now.`);
          return false;
        }
      } else if (options.changed && preferences.showChangedAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("PopupChangedConfirmMessage", messageArgs),
          messenger.i18n.getMessage("ConfirmAgain"),
          true,
        ).catch((err) => {
          SLTools.trace(err);
        });
        if (result.check === false) {
          preferences.showChangedAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLTools.debug(`User canceled send now.`);
          return false;
        }
      }
    }
    return true;
  },

  async doSendNow(tabId, options, fromMenuCommand) {
    await messenger.compose.sendMessage(tabId, { mode: "sendNow" });
    return true;
  },

  // Use built-in send later function (after some pre-send checks)
  async checkDoPlaceInOutbox(options) {
    if (options.first) {
      let messageArgs = [
        messenger.i18n.getMessage("sendlater.prompt.sendlater.label"),
        messenger.i18n.getMessage("sendAtLabel"),
      ];
      let preferences = await SLTools.getPrefs();
      if (preferences.showOutboxAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("OutboxConfirmMessage", messageArgs),
          messenger.i18n.getMessage("ConfirmAgain"),
          true,
        ).catch((err) => {
          SLTools.trace(err);
        });
        if (result.check === false) {
          preferences.showOutboxAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLTools.debug(`User canceled put in outbox.`);
          return false;
        }
      } else if (options.changed && preferences.showChangedAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("PopupChangedConfirmMessage", messageArgs),
          messenger.i18n.getMessage("ConfirmAgain"),
          true,
        ).catch((err) => {
          SLTools.trace(err);
        });
        if (result.check === false) {
          preferences.showChangedAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLTools.debug(`User canceled put in outbox.`);
          return false;
        }
      }
    }
    return true;
  },

  async doPlaceInOutbox(tabId, options, fromMenuCommand) {
    await messenger.compose.sendMessage(tabId, { mode: "sendLater" });
    return true;
  },

  // Sends composed message according to user function (specified
  // by name), and arguments (specified as an "unparsed" string).
  async quickSendWithUfunc(funcName, funcArgs, tabId) {
    if (!tabId) {
      let tab = await SLTools.getActiveComposeTab();
      if (tab) {
        tabId = tab.id;
      }
    }
    if (!(await SendLater.schedulePrecheck())) {
      return false;
    }
    if (tabId) {
      let { ufuncs } = await messenger.storage.local.get({ ufuncs: {} });
      let funcBody = ufuncs[funcName].body;
      let schedule = parseUfuncToSchedule(funcName, funcBody, null, funcArgs);
      let options = {
        sendAt: schedule.sendAt,
        recurSpec: SLTools.unparseRecurSpec(schedule.recur),
        args: schedule.recur.args,
        cancelOnReply: false,
      };
      await SendLater.scheduleSendLater(tabId, options);
    }
  },

  async schedulePrecheck() {
    if (!(await SLTools.tb128(true, false))) {
      let tab = await SLTools.getActiveComposeTab();
      let composeDetails = await messenger.compose.getComposeDetails(tab.id);
      if (composeDetails.deliveryStatusNotification) {
        let extensionName = messenger.i18n.getMessage("extensionName");
        let dsnName = messenger.i18n.getMessage("DSN");
        let title = messenger.i18n.getMessage("noDsnTitle", [
          dsnName,
          extensionName,
        ]);
        let text = messenger.i18n.getMessage("noDsnText", [
          dsnName,
          extensionName,
        ]);
        SLTools.alert(title, text);
        return false;
      }
    }
    return true;
  },

  // Go through the process of handling pre-send checks, assigning custom
  // header fields, and saving the message to Drafts.
  async scheduleSendLater(tabId, options, fromMenuCommand) {
    let now = new Date();
    SLTools.debug(`Pre-send check initiated at ${now}`);
    let encryptionStatus =
      await messenger.SL3U.signingOrEncryptingMessage(tabId);
    SLTools.telemetrySend({
      event: "encryptionStatus",
      encryptionStatus: encryptionStatus,
    });
    if (encryptionStatus.endsWith("-error")) {
      let name = messenger.i18n.getMessage("extensionName");
      let title = messenger.i18n.getMessage("IncompatibleEncryptionTitle", [
        name,
      ]);
      let errorKey = `IncompatibleEncryption-${encryptionStatus}-Text`;
      let text = messenger.i18n.getMessage(errorKey, [name]);
      SLTools.alert(title, text);
      return false;
    }
    let check = await messenger.SL3U.GenericPreSendCheck();
    if (!check) {
      SLTools.warn(`Canceled via pre-send checks (check initiated at ${now})`);
      return;
    }
    // let windowId = await messenger.tabs.get(tabId).then(
    //   tab => tab.windowId);
    // let originalDraftMsg = await messenger.SL3U.findAssociatedDraft(
    //   windowId);

    const preferences = await SLTools.getPrefs();

    SLTools.info(`Scheduling send later: ${tabId} with options`, options);

    // Expand mailing lists into individual recipients
    await SLTools.expandRecipients(tabId);

    let customHeaders = [
      { name: "X-Send-Later-Uuid", value: preferences.instanceUUID },
    ];

    // Determine time at which this message should be sent
    let sendAt;
    if (options.sendAt !== undefined) {
      sendAt = new Date(options.sendAt);
    } else if (options.delay !== undefined) {
      sendAt = new Date(Date.now() + options.delay * 60000);
    } else {
      SLTools.error("scheduleSendLater requires scheduling information");
      return;
    }

    sendAt = SLTools.parseableDateTimeFormat(sendAt);
    customHeaders.push({ name: "X-Send-Later-At", value: sendAt });
    if (preferences.scheduledDateField) {
      customHeaders.push({ name: "Date", value: sendAt });
    }

    if (options.recurSpec) {
      customHeaders.push({
        name: "X-Send-Later-Recur",
        value: options.recurSpec,
      });
      if (options.cancelOnReply) {
        customHeaders.push({
          name: "X-Send-Later-Cancel-On-Reply",
          value: "yes",
        });
      }
    }

    if (options.args) {
      customHeaders.push({ name: "X-Send-Later-Args", value: options.args });
    }

    // When Thunderbird saves an existing draft, it preserves its message ID
    // (the RFC message ID, not the internal TB message ID). This causes
    // problems, especially with Gmail. Setting Message-ID to an empty value
    // here forces Thunderbird to generate a new Message ID when saving the
    // message.
    customHeaders.push({ name: "message-id", value: "" });

    let composeDetails = await messenger.compose.getComposeDetails(tabId);
    // // // Merge the new custom headers into the original headers
    // // // Note: this shouldn't be necessary, but it appears that
    // // // `setComposeDetails` does not preserve existing headers.
    // // for (let hdr of composeDetails.customHeaders) {
    // //   if (!hdr.name.toLowerCase().startsWith("x-send-later")) {
    // //     customHeaders.push(hdr);
    // //   }
    // // }
    // // composeDetails.customHeaders = customHeaders;
    // // SLTools.info("Saving message with details:", composeDetails);
    // // await messenger.compose.setComposeDetails(tabId, composeDetails);
    //
    // The setComposeDetails method seems to drop all unsupported headers
    // (which is most of the headers). This breaks things like replies
    // which need to retain the "in-reply-to" header (for example).
    for (let hdr of customHeaders) {
      await messenger.SL3U.setHeader(tabId, hdr.name, hdr.value);
    }

    // Save the message as a draft
    let saveProperties = await messenger.compose.saveMessage(tabId, {
      mode: "draft",
    });
    if (!saveProperties.messages.length) {
      throw new Error(
        "Failed to save draft, no exception thrown by Thunderbird",
      );
    }

    // The "real" draft, as opposed to the FCC, is always first.
    let msg = saveProperties.messages[0];

    // Optionally mark the saved message as "read"
    if (preferences.markDraftsRead) {
      await messenger.messages.update(msg.id, { read: true });
    }

    // Some servers, most notably Gmail but perhaps others as well, don't
    // refresh the content of the saved message properly when the new message
    // is saved and the old one is deleted. This seems to be true even when
    // we replace the Message-ID in the message as we do above. This also seems
    // to be different from the bug which sometimes causes the local Thunderbird
    // to display the old content for a message even though the server has the
    // new content; in this case it appears that even the server doesn't show
    // the new content, as evidenced by looking at the draft on mail.google.com.
    // Cleaning the Drafts folder after saving the message seems to solve this.
    SendLater.addToDraftsToClean(msg.folder, true);

    let targetFolder = await SLTools.getTargetSubfolder(preferences, msg);
    if (targetFolder) {
      await messenger.messages.move([msg.id], targetFolder.id);
      // Message ID has changed so we want to make sure not to use the old one!
      // If we forget and try to later on in the function this should cause an
      // error.
      msg.id = null;
      msg.folder = targetFolder;
      SendLater.addToDraftsToClean(msg.folder, true);
    }

    SendLater.cleanDrafts();

    if (preferences.ignoredAccounts && preferences.ignoredAccounts.length) {
      let identity = await messenger.identities.get(composeDetails.identityId);
      let accountId = identity.accountId;
      if (preferences.ignoredAccounts.includes(accountId)) {
        preferences.ignoredAccounts = preferences.ignoredAccounts.filter(
          (a) => a != accountId,
        );
        await messenger.storage.local.set({ preferences });
        SLTools.info(
          `Reactivating ${accountId} because message scheduled in it`,
        );
      }
    }
    // Close the composition tab
    await messenger.tabs.remove(tabId);

    // If message was a reply or forward, update the original message
    // to show that it has been replied to or forwarded.
    if (!fromMenuCommand && composeDetails.relatedMessageId) {
      if (composeDetails.type == "reply") {
        SLTools.debug("This is a reply message. Setting original 'replied'");
        await messenger.SL3U.setDispositionState(
          composeDetails.relatedMessageId,
          "replied",
        );
      } else if (composeDetails.type == "forward") {
        SLTools.debug("This is a fwd message. Setting original 'forwarded'");
        await messenger.SL3U.setDispositionState(
          composeDetails.relatedMessageId,
          "forwarded",
        );
      }
    }

    // If the message was already saved as a draft (and made it into the
    // unscheduledMsgCache while being composed), then it will be ignored when
    // checking for scheduled messages. We should be able to remove it from the
    // unscheduledMsgCache here, but there seems to be a bug in Thunderbird
    // where the message ID reported to us is not the actual saved message.
    // Also, if the user is using a drafts folder then we no longer have the
    // actual message ID of the draft because it changed when we moved it and
    // we haven't searched and found the new ID.
    // Best option right now seems to be invalidating and regenerating the
    // entire unscheduledMsgCache.
    if (!fromMenuCommand) {
      unscheduledMsgCache.clear();
      // It seems that a delay is required for messages.getFull to successfully
      // access the recently saved message.
      setTimeout(SendLater.updateStatusIndicator, 1000);
    }
    // // Different workaround:
    // function touchDraftMsg(draftId) {
    //   unscheduledMsgCache.delete(draftId);
    //   scheduledMsgCache.add(draftId);
    //   if (preferences.markDraftsRead)
    //     await messenger.messages.update(draftId, { read: true });
    // }
    // if (originalDraftMsg)
    //   touchDraftMsg(originalDraftMsg.id);
    // if (composeDetails.type == "draft" && composeDetails.relatedMessageId)
    //   touchDraftMsg(composeDetails.relatedMessageId);
    // await messenger.SL3U.findAssociatedDraft(windowId).then(
    //   newDraftMsg => touchDraftMsg(newDraftMsg.id)
    // );
    return true;
  },

  draftsToClean: [],

  addToDraftsToClean(folder, force) {
    if (
      !SendLater.draftsToClean.some(
        (f) => f.accountId == folder.accountId && f.path == folder.path,
      )
    ) {
      SLTools.debug("Adding folder to draftsToClean:", folder);
      SendLater.draftsToClean.push(folder);
    } else {
      SLTools.debug("Clean is already queued for:", folder);
    }
    if (force) SendLater.draftsToClean.slforce = true;
  },

  // There are two different race conditions we're concerned about here. First,
  // while we're waiting for all of the drafts folders we're cleaning to become
  // idle, someone else could call cleanDrafts a second time. Second, while
  // we're awaiting for something in the loop of cleaning all the folders,
  // someone could add another folder to the list.
  // To address the first, any time cleanDrafts is invoked it needs to await
  // for the prior running invocation to finish. We set this up in a loop that
  // keeps awaiting until there's nothing to wait for, because if multiple
  // invocations are awaiting for it to finish before they start, one of them
  // could regain control before we do and start another clean cycle.
  // To address the second, we make the list of drafts to clean local before we
  // start the cleaning process, and reinitialize the shared list to an empty
  // array, so if someone else adds a folder to the list once we've started
  // cleaning it'll get picked up in the next invocation of cleanDrafts.

  // This is just used so that different invocations of cleanDrafts can be
  // distinguished from each other in the logs.
  cdid: 0,
  cleanDraftsPromise: null,

  async cleanDrafts() {
    let _id = SendLater.cdid++;
    SLTools.trace(`cleanDrafts[${_id}]: start`);
    let waited;
    while (SendLater.cleanDraftsPromise) {
      waited = true;
      SLTools.debug(
        `cleanDrafts[${_id}]: waiting for previous clean to finish`,
      );
      await SendLater.cleanDraftsPromise;
    }
    if (waited) SLTools.debug(`cleanDrafts[${_id}]: finished waiting`);
    SendLater.cleanDraftsPromise = SendLater.cleanDraftsReal();
    await SendLater.cleanDraftsPromise;
    SendLater.cleanDraftsPromise = null;
    SLTools.trace(`cleanDrafts[${_id}]: end`);
  },

  async cleanDraftsReal() {
    draftsToClean = SendLater.draftsToClean;
    SendLater.draftsToClean = [];
    if (!draftsToClean.length) return;
    if (draftsToClean.slforce || SendLater.prefCache.compactDrafts) {
      await messenger.SL3U.waitUntilIdle(draftsToClean);
      for (let folder of draftsToClean) {
        SLTools.debug("Cleaning folder:", folder);
        await messenger.SL3U.expungeOrCompactFolder(folder);
      }
    } else {
      SLTools.debug("Not cleaning folders, preference is disabled");
    }
  },

  async deleteMessage(hdr) {
    SendLater.addToDraftsToClean(hdr.folder);
    let account = await messenger.accounts.get(hdr.folder.accountId, false);
    let accountType = account.type;
    let succeeded;
    try {
      await messenger.messages
        .delete(
          [hdr.id],
          await SLTools.tb137({ deletePermanently: true }, true),
        )
        .then(() => {
          succeeded = true;
          SLTools.info("Deleted message", hdr.id);
          scheduledMsgCache.delete(hdr.id);
          unscheduledMsgCache.delete(hdr.id);
        });
    } catch (ex) {
      SLTools.error(`Error deleting message ${hdr.id}`, ex);
    }
    return succeeded;
  },

  checkEncryption(contentType, originalMsgId, msgHdr) {
    if (/encrypted/i.test(contentType)) {
      SLTools.debug(
        `Message ${originalMsgId} is encrypted, and will not ` +
          `be processed by Send Later.`,
      );
      unscheduledMsgCache.add(msgHdr.id);
      return false;
    }
    return true;
  },

  async checkLocked(
    preferences,
    locker,
    originalMsgId,
    msgHdr,
    msgLockId,
    fullMsg,
  ) {
    let locked = locker.isLocked(msgHdr, fullMsg);
    if (!locked) return true;
    const msgSubject = msgHdr.subject;
    if (locked === true) {
      if (preferences.optOutResendWarning === true) {
        SLTools.debug(
          `Encountered previously sent message ` +
            `"${msgSubject}" ${msgLockId}.`,
        );
      } else {
        SLTools.error(
          `Attempted to resend message "${msgSubject}" ${msgLockId}.`,
        );
        const result = await SLTools.alertCheck(
          null,
          messenger.i18n.getMessage("CorruptFolderError", [
            msgHdr.folder.path,
          ]) +
            "\n\n" +
            messenger.i18n.getMessage("CorruptFolderErrorDetails", [
              msgSubject,
              originalMsgId,
            ]),
          null,
          true,
        );
        if (result.check === false) {
          preferences.optOutResendWarning = true;
          await messenger.storage.local.set({ preferences });
        }
      }
    }
    return false;
  },

  async checkLate(preferences, locker, nextSend, msgHdr, fullMsg) {
    // Respect late message blocker
    // We enforce a maximum grace period of six months even when one isn't
    // specified in the user's preferences, for safety.
    let maxGracePeriod = 60 * 24 * 180; // minutes
    let lateGracePeriod;
    if (preferences.blockLateMessages) {
      lateGracePeriod = Math.min(preferences.lateGracePeriod, maxGracePeriod);
    } else {
      lateGracePeriod = maxGracePeriod;
    }
    let lateness = (Date.now() - nextSend.getTime()) / 60000;
    if (lateness <= lateGracePeriod) return true;
    SLTools.warn(`Grace period exceeded for message ${msgHdr.id}`);
    if (locker.isLocked(msgHdr, fullMsg) != "late") {
      let units, newLateness;
      if (lateness / 60 / 24 / 365 > 1) {
        lateness = Math.floor(lateness / 60 / 24 / 365);
        units = "year";
      } else if (lateness / 60 / 24 / 30 > 1) {
        lateness = Math.floor(lateness / 60 / 24 / 30);
        units = "month";
      } else if (lateness / 60 / 24 / 7 > 1) {
        lateness = Math.floor(lateness / 60 / 24 / 7);
        units = "week";
      } else if (lateness / 60 / 24 > 1) {
        lateness = Math.floor(lateness / 60 / 24);
        units = lateness == 1 ? "day" : "dai"; // ugh
      } else {
        lateness = Math.floor(lateness);
        units = "minute";
      }
      units = SLTools.i18n.getMessage(
        lateness == 1 ? `single_${units}` : `plural_${units}ly`,
      );
      const msgSubject = msgHdr.subject;
      const warningMsg = messenger.i18n.getMessage("BlockedLateMessage2", [
        msgSubject,
        msgHdr.folder.path,
        lateness,
        units,
      ]);
      const warningTitle = messenger.i18n.getMessage(
        "ScheduledMessagesWarningTitle",
      );
      SLTools.alert(warningTitle, warningMsg);
      await locker.lock(msgHdr, fullMsg, "late");
    }
    return false;
  },

  async checkTimeRestrictions(
    preferences,
    recur,
    skipping,
    originalMsgId,
    msgHdr,
  ) {
    if (!preferences.enforceTimeRestrictions) return true;
    // Respect "until" preference
    if (recur.until) {
      if (SLTools.compareTimes(Date.now(), ">", recur.until)) {
        (skipping ? SLTools.error : SLTools.debug)(
          `Message ${msgHdr.id} ${originalMsgId} past ` +
            `"until" restriction. Skipping.`,
        );
        return false;
      }
    }

    // Respect "send between" preference
    if (!skipping && recur.between) {
      if (
        SLTools.compareTimes(Date.now(), "<", recur.between.start) ||
        SLTools.compareTimes(Date.now(), ">", recur.between.end)
      ) {
        // Skip message this time, but don't explicitly reschedule it.
        SLTools.debug(
          `Message ${msgHdr.id} ${originalMsgId} outside of ` +
            `sendable time range. Skipping.`,
          recur.between,
        );
        return false;
      }
    }

    // Respect "only on days of week" preference
    if (!skipping && recur.days) {
      const today = new Date().getDay();
      if (!recur.days.includes(today)) {
        // Reschedule for next valid time.
        const start_time = recur.between && recur.between.start;
        const end_time = recur.between && recur.between.end;
        let nextRecurAt = SLTools.adjustDateForRestrictions(
          new Date(),
          start_time,
          end_time,
          recur.days,
          false,
        );
        while (nextRecurAt < new Date()) {
          nextRecurAt = new Date(nextRecurAt.getTime() + 60000);
        }

        const this_wkday = new Intl.DateTimeFormat("default", {
          weekday: "long",
        });
        SLTools.info(
          `Message ${msgHdr.id} not scheduled to send on ` +
            `${this_wkday.format(new Date())}. Rescheduling ` +
            `for ${nextRecurAt}`,
        );

        let newMsgContent = await messenger.messages.getRaw(msgHdr.id);

        newMsgContent = SLTools.replaceHeader(
          newMsgContent,
          "X-Send-Later-At",
          SLTools.parseableDateTimeFormat(nextRecurAt),
          false,
        );

        if (preferences.scheduledDateField) {
          newMsgContent = SLTools.replaceHeader(
            newMsgContent,
            "Date",
            SLTools.parseableDateTimeFormat(nextRecurAt),
            false /* replaceAll */,
            true /* addIfMissing */,
          );
        }

        let file = getFileFromRaw(newMsgContent);
        let success = await messageImport(file, msgHdr.folder, {
          new: false,
          read: preferences.markDraftsRead,
        });

        if (success) {
          SLTools.debug(
            `Rescheduled message ${originalMsgId}. Deleting original.`,
          );
          await SendLater.deleteMessage(msgHdr);
        } else {
          SLTools.error("Unable to schedule next recurrence.");
        }
        return false;
      }
    }
    return true;
  },

  async doSendMessage(
    preferences,
    options,
    locker,
    originalMsgId,
    msgHdr,
    msgLockId,
    fullMsg,
  ) {
    // Initiate send from draft message
    SLTools.info(`Sending message ${originalMsgId}.`);

    // "Why do we have to iterate through local accounts?" you ask. "Isn't
    // there just one Local Folders account?" Well, sure, that's normally the
    // case, but it's apparently possible to have multiple local accounts. See,
    // for example, https://addons.thunderbird.net/thunderbird/addon/
    // localfolder/. So we need to find the local account that has the Outbox
    // in it.
    let outboxFolder;
    let localAccounts = (await messenger.accounts.list(false)).filter(
      (account) => account.type == "none",
    );
    for (let localAccount of localAccounts) {
      let localFolders = await messenger.folders.getSubFolders(
        await SLTools.tb128(localAccount.id, localAccount),
      );
      for (let localFolder of localFolders) {
        if (localFolder.type == "outbox") {
          outboxFolder = localFolder;
          break;
        }
      }
      if (outboxFolder) break;
    }
    if (!outboxFolder) {
      SLTools.error("Could not find outbox folder to deliver message");
      return false;
    }
    let content = await SLTools.prepNewMessageHeaders(
      await messenger.messages.getRaw(msgHdr.id),
    );

    const identityId =
      options.identityId ?? (await findBestIdentity(msgHdr, fullMsg));
    content = SLTools.replaceHeader(
      content,
      "X-Identity-Key",
      identityId,
      true,
      true,
    );

    let file = getFileFromRaw(content);
    let success = await messageImport(file, outboxFolder, {
      new: false,
      read: true,
    });

    SLTools.telemetrySend({
      event: "delivery",
      successful: success,
    });

    if (success) {
      if (preferences.sendUnsentMsgs) {
        setTimeout(messenger.SL3U.queueSendUnsentMessages, 1000);
      }
      await locker.lock(msgHdr, fullMsg, true);
      SLTools.debug(`Locked message <${msgLockId}> from re-sending.`);
    } else {
      SLTools.error(
        `Something went wrong while sending message ${originalMsgId}`,
      );
    }

    return success;
  },

  async doNextRecur(
    preferences,
    locker,
    originalMsgId,
    msgHdr,
    recur,
    nextSend,
    msgRecurSpec,
    args,
  ) {
    let nextRecur;
    if (recur.type !== "none") {
      nextRecur = await SLTools.nextRecurDate(
        nextSend,
        msgRecurSpec,
        new Date(),
        args,
      );
    }

    if (!nextRecur) return false;

    try {
      let nextRecurAt = nextRecur.sendAt;
      let nextRecurSpec = nextRecur.nextspec;
      let nextRecurArgs = nextRecur.nextargs;
      while (nextRecurAt < new Date()) {
        nextRecurAt = new Date(nextRecurAt.getTime() + 60000);
      }
      SLTools.info(`Scheduling next recurrence of message ${originalMsgId}`, {
        nextRecurAt,
        nextRecurSpec,
        nextRecurArgs,
      });

      let newMsgContent = await messenger.messages.getRaw(msgHdr.id);

      newMsgContent = SLTools.replaceHeader(
        newMsgContent,
        "Date",
        SLTools.parseableDateTimeFormat(
          SendLater.prefCache.scheduledDateField ? nextRecurAt : Date.now(),
        ),
        false /* replaceAll */,
        true /* addIfMissing */,
      );

      newMsgContent = SLTools.replaceHeader(
        newMsgContent,
        "X-Send-Later-At",
        SLTools.parseableDateTimeFormat(nextRecurAt),
        false,
      );

      if (typeof nextRecurSpec === "string") {
        newMsgContent = SLTools.replaceHeader(
          newMsgContent,
          "X-Send-Later-Recur",
          nextRecurSpec,
          false,
          true,
        );
      }

      if (typeof nextRecurArgs === "object") {
        newMsgContent = SLTools.replaceHeader(
          newMsgContent,
          "X-Send-Later-Args",
          SLTools.unparseArgs(nextRecurArgs),
          false,
          true,
        );
      }

      let file = getFileFromRaw(newMsgContent);
      let success = await messageImport(file, msgHdr.folder, {
        new: false,
        read: preferences.markDraftsRead,
      });

      SLTools.telemetrySend({ event: "scheduleNext", successful: success });
      if (success) {
        SLTools.info(
          `Scheduled next occurrence of message ` +
            `<${originalMsgId}>. Deleting original.`,
        );
      } else {
        throw new Error("Unable to schedule next recurrence.");
      }
    } catch (ex) {
      await locker.lock(msgHdr, fullMsg, "rescheduling");
      SLTools.error("Error scheduling next recurrence", ex);
      let title = SLTools.i18n.getMessage("RescheduleErrorTitle");
      let text = SLTools.i18n.getMessage("RescheduleErrorText", [msgSubject]);
      SLTools.alert(title, text);
      return true;
    }
    await SendLater.deleteMessage(msgHdr);
    return true;
  },

  // Given a MessageHeader object, identify whether the message is
  // scheduled, and due to be sent. If so, make sure it qualifies for
  // sending (not encrypted, not sent previously, not past the late
  // message limit), and then send it. If it was a recurring message,
  // handle rescheduling its next recurrence, otherwise just delete
  // the draft copy.
  // TODO: Break this up into more manageable parts. This function is
  // ridiculously long.
  async possiblySendMessage(msgHdr, options, locker) {
    SLTools.trace("possiblySendMessage", msgHdr, options, locker);
    let msgId = msgHdr.id;
    let logPrefix = `possiblySendMessage(${msgId}): `;
    let throttleStart = Date.now();

    if (!options) {
      options = {};
    }
    let skipping = options.skipping;
    if (!locker) {
      locker = await new Locker();
    }

    // Determines whether or not a particular draft message is due to be sent
    if (unscheduledMsgCache.has(msgId)) {
      SLTools.debug(`${logPrefix}unscheduledMsgCache.has returns true`);
      return;
    }

    SLTools.debug(`Checking message ${msgId}.`);
    const fullMsg =
      options.messageFull || (await messenger.messages.getFull(msgId));

    if (!fullMsg.headers.hasOwnProperty("x-send-later-at")) {
      unscheduledMsgCache.add(msgId);
      SLTools.debug(`${logPrefix}no x-send-later-at`);
      return;
    }

    const originalMsgId = msgHdr.headerMessageId;
    const contentType = fullMsg.contentType;
    const msgSendAt = (fullMsg.headers["x-send-later-at"] || [])[0];
    const msgUUID = (fullMsg.headers["x-send-later-uuid"] || [])[0];
    const msgRecurSpec = (fullMsg.headers["x-send-later-recur"] || [])[0];
    const msgRecurArgs = (fullMsg.headers["x-send-later-args"] || [])[0];
    const msgLockId = `${originalMsgId}/${msgHdr.date}`;

    const nextSend = new Date(msgSendAt);

    if (!SendLater.checkEncryption(contentType, originalMsgId, msgHdr)) {
      SLTools.debug(`${logPrefix}checkEncryption returns false`);
      return;
    }

    let preferences = await SLTools.getPrefs();

    if (!preferences.sendWhileOffline && !window.navigator.onLine) {
      SLTools.debug(
        `${logPrefix}Send Later is configured to disable sending while offline. Skipping.`,
      );
      return;
    }

    if (!msgUUID) {
      SLTools.debug(
        `${logPrefix}Message <${originalMsgId}> has no uuid header.`,
      );
      unscheduledMsgCache.add(msgId);
      return;
    }

    if (msgUUID !== preferences.instanceUUID) {
      (skipping ? SLTools.error : SLTools.debug)(
        `${logPrefix}Message <${originalMsgId}> is scheduled by a ` +
          `different Thunderbird instance.`,
      );
      unscheduledMsgCache.add(msgId);
      return;
    }

    if (
      !(await SendLater.checkLocked(
        preferences,
        locker,
        originalMsgId,
        msgHdr,
        msgLockId,
        fullMsg,
      ))
    ) {
      SLTools.debug(`${logPrefix}checkLocked returns false`);
      return;
    }

    if (!skipping && Date.now() < nextSend.getTime()) {
      SLTools.debug(
        `${logPrefix}Message ${msgId} not due for send until ` +
          `${SLTools.humanDateTimeFormat(nextSend)}`,
      );
      return;
    }

    const recur = SLTools.parseRecurSpec(msgRecurSpec);
    const args = msgRecurArgs ? SLTools.parseArgs(msgRecurArgs) : null;

    if (
      !(
        skipping ||
        (await SendLater.checkLate(
          preferences,
          locker,
          nextSend,
          msgHdr,
          fullMsg,
        ))
      )
    ) {
      SLTools.debug(`${logPrefix}checkLate returns false`);
      return;
    }

    if (
      !(await SendLater.checkTimeRestrictions(
        preferences,
        recur,
        skipping,
        originalMsgId,
        msgHdr,
      ))
    ) {
      SLTools.debug(`${logPrefix}checkTimeRestrictions returns false`);
      return;
    }

    if (
      !(
        skipping ||
        (await SendLater.doSendMessage(
          preferences,
          options,
          locker,
          originalMsgId,
          msgHdr,
          msgLockId,
          fullMsg,
        ))
      )
    ) {
      SLTools.debug(`${logPrefix}doSendMessage returns false`);
      return;
    }

    if (
      !(await SendLater.doNextRecur(
        preferences,
        locker,
        originalMsgId,
        msgHdr,
        recur,
        nextSend,
        msgRecurSpec,
        args,
      )) &&
      !skipping
    ) {
      SLTools.info(
        `${logPrefix}No recurrences for message <${originalMsgId}>. Deleting original.`,
      );
      await SendLater.deleteMessage(msgHdr);
    }

    if (!skipping && preferences.throttleDelay) {
      SLTools.debug(
        `${logPrefix}Throttling send rate: ${
          preferences.throttleDelay / 1000
        }s`,
      );
      let throttleDelta = Date.now() - throttleStart;
      let delay = preferences.throttleDelay - throttleDelta;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    SLTools.debug(`${logPrefix}returning true at end of function`);
    return true;
  },

  async updatePreferences() {
    let { preferences, ufuncs } = await messenger.storage.local.get({
      preferences: {},
      ufuncs: {},
    });

    // (Re-)load the built-in user functions
    if (!ufuncs.ReadMeFirst) {
      ufuncs.ReadMeFirst = {
        help: messenger.i18n.getMessage("EditorReadMeHelp"),
        body: messenger.i18n.getMessage("EditorReadMeCode"),
      };
    }
    if (!ufuncs.BusinessHours) {
      ufuncs.BusinessHours = {
        help: messenger.i18n.getMessage("BusinessHoursHelp"),
        body: messenger.i18n.getMessage("_BusinessHoursCode"),
      };
    }
    if (!ufuncs.DaysInARow) {
      ufuncs.DaysInARow = {
        help: messenger.i18n.getMessage("DaysInARowHelp"),
        body: messenger.i18n.getMessage("DaysInARowCode"),
      };
    }
    if (!ufuncs.Delay) {
      ufuncs.Delay = {
        help: messenger.i18n.getMessage("DelayFunctionHelp"),
        body: "next = new Date(Date.now() + args[0]*60000);",
      };
    }

    let prefDefaults = await SLTools.prefDefaults();

    // Pick up any new properties from defaults
    for (let prefName of Object.getOwnPropertyNames(prefDefaults)) {
      if (preferences[prefName] === undefined) {
        const prefValue = prefDefaults[prefName][1];
        SLTools.info(`Added new preference ${prefName}: ${prefValue}`);
        preferences[prefName] = prefValue;
      }
    }

    if (preferences.instanceUUID) {
      SLTools.info(`This instance's UUID: ${preferences.instanceUUID}`);
    } else {
      let instance_uuid = SLTools.generateUUID();
      SLTools.info(`Generated new UUID: ${instance_uuid}`);
      preferences.instanceUUID = instance_uuid;
    }

    // Needed for the time being for the Mail Merge add-on
    messenger.SL3U.setLegacyPref(
      "instance.uuid",
      "string",
      preferences.instanceUUID,
    );

    if (preferences.checkTimePref_isMilliseconds) {
      preferences.checkTimePref /= 60000;
      delete preferences.checkTimePref_isMilliseconds;
    }

    if (typeof preferences.checkTimePref == "string") {
      // 2023-09-01 Old versions of the code didn't handle this properly. We
      // can presumably eventually delete this backward compatibility fix.
      let value = Number(preferences.checkTimePref);
      if (isNaN(value)) {
        SLTools.error(
          `Invalid value ${preferences.checkTimePref} for checkTimePref ` +
            `preference, reverting to default value 1`,
        );
        value = 1;
      }
      preferences.checkTimePref = value;
    }

    await messenger.storage.local.set({ preferences, ufuncs });
  },

  async updateStatusIndicator(nActive, waitFor) {
    SLTools.debug(`updateStatusIndicator(${nActive})`);
    if (waitFor) {
      SLTools.debug("updateStatusIndicator waiting");
      await waitFor;
      SLTools.debug("updateStatusIndicator done waiting");
    }
    let extName = messenger.i18n.getMessage("extensionName");
    if (nActive == undefined) nActive = await countActiveScheduledMessages();
    if (nActive) {
      await messenger.browserAction.setTitle({
        title: `${extName} [${messenger.i18n.getMessage("PendingMessage", [
          nActive,
        ])}]`,
      });
      await messenger.browserAction.setBadgeText({ text: String(nActive) });
    } else {
      await messenger.browserAction.setTitle({
        title: `${extName} [${messenger.i18n.getMessage("IdleMessage")}]`,
      });
      await messenger.browserAction.setBadgeText({ text: null });
    }
  },

  // This function sets the quit notifications to enabled or disabled. If
  // enabled, it checks to see if there are any active scheduled messages. If
  // there are, it sets the quit requested and quit granted alerts. If there
  // are no active scheduled messages, it removes the quit requested and quit
  // granted observers.
  async setQuitNotificationsEnabled(enabled, prefs, nActive) {
    if (enabled) {
      if (!prefs) prefs = await SLTools.getPrefs();
      enabled =
        prefs.askQuit && prefs.sendDrafts && (prefs.checkTimePref || 0) > 0;
    }
    if (enabled) {
      if (nActive == undefined) nActive = await countActiveScheduledMessages();
      enabled = nActive > 0;
    }
    if (!enabled) {
      await messenger.quitter.removeQuitRequestedObserver();
      await messenger.quitter.removeQuitGrantedObserver();
      return;
    }
    let appName = (await messenger.runtime.getBrowserInfo()).name;
    let extensionName = messenger.i18n.getMessage("extensionName");
    let title =
      messenger.i18n.getMessage("scheduledMessagesWarningTitle") +
      " - " +
      extensionName;
    let requestWarning = messenger.i18n.getMessage(
      "scheduledMessagesWarningQuitRequested",
      appName,
    );
    let grantedWarning = messenger.i18n.getMessage(
      "ScheduledMessagesWarningQuit",
      appName,
    );
    await messenger.quitter.setQuitRequestedAlert(title, requestWarning);
    await messenger.quitter.setQuitGrantedAlert(title, grantedWarning);
  },

  async init() {
    SLTools.startupLogVersionInfo();

    // Add listeners to the various events we care about
    messenger.alarms.onAlarm.addListener(alarmsListener);
    messenger.windows.onCreated.addListener(SendLater.onWindowCreatedListener);
    messenger.SL3U.onKeyCode.addListener(SendLater.onUserCommandKeyListener);
    messenger.runtime.onMessageExternal.addListener(
      SendLater.onMessageExternalListener,
    );
    messenger.runtime.onMessage.addListener(
      SendLater.onRuntimeMessageListenerasync,
    );
    messenger.messageDisplay.onMessageDisplayed.addListener(
      SendLater.onMessageDisplayedListener,
    );
    messenger.commands.onCommand.addListener(SendLater.onCommandListener);
    messenger.composeAction.onClicked.addListener(
      SendLater.clickComposeListener,
    );

    // Perform any necessary preference updates
    await this.updatePreferences();

    let preferences = await SLTools.getPrefs();
    SendLater.prefCache = preferences;

    // Update shortcut key bindings
    await updateShortcuts(preferences);

    messenger.messages.onNewMailReceived.addListener(
      SendLater.onNewMailReceivedListener,
    );

    // Set custom DB headers preference, if not already set.
    try {
      await messenger.SL3U.setCustomDBHeaders([
        "x-send-later-at",
        "x-send-later-recur",
        "x-send-later-args",
        "x-send-later-cancel-on-reply",
        "x-send-later-uuid",
        "content-type",
      ]);
    } catch (ex) {
      SLTools.error("SL3U.setCustomDBHeaders", ex);
    }

    // Clear the current message settings cache
    await messenger.storage.local.set({ scheduleCache: {} });

    try {
      await messenger.SL3U.setLogConsoleLevel(preferences.logConsoleLevel);

      let nActive = await countActiveScheduledMessages();
      await SendLater.updateStatusIndicator(nActive);
      await SendLater.setQuitNotificationsEnabled(true, preferences, nActive);

      await messenger.browserAction.setLabel({
        label: preferences.showStatus
          ? messenger.i18n.getMessage("sendlater3header.label")
          : "",
      });
    } catch (ex) {
      SLTools.error(ex);
    }

    // Attach to all existing msgcompose windows
    try {
      await messenger.SL3U.hijackComposeWindowKeyBindings();
    } catch (ex) {
      SLTools.error("SL3U.hijackComposeWindowKeyBindings", ex);
    }

    // This listener should be added *after* all of the storage-related
    // initialization is complete. It ensures that subsequent changes to storage
    // take effect immediately.
    messenger.storage.local.onChanged.addListener(
      SendLater.storageChangedListener,
    );

    this.scheduleMenuId = await messenger.menus.create({
      contexts: ["message_list"],
      title: messenger.i18n.getMessage("menuScheduleMsg"),
    });
    this.skipMenuId = await messenger.menus.create({
      contexts: ["message_list"],
      title: messenger.i18n.getMessage("menuSkipMsg"),
    });
    this.claimMenuId = await messenger.menus.create({
      contexts: ["message_list"],
      title: messenger.i18n.getMessage("menuClaimMsg"),
    });
    this.menuVisible = true;
    messenger.menus.onClicked.addListener(async (info, tab) => {
      SendLater.menuClickHandler(info, tab);
    });
    messenger.menus.onShown.addListener(async (info, tab) => {
      SendLater.checkMenu(info, tab);
    });

    let slVersionString = messenger.runtime.getManifest().version;
    let oldVersion = preferences.releaseNotesVersion;

    if (
      preferences.showBetaAlert &&
      slVersionString != oldVersion &&
      (await SLTools.isOnBetaChannel())
    ) {
      let title = messenger.i18n.getMessage("betaThankYouTitle");
      let extensionName = messenger.i18n.getMessage("extensionName");
      let text = messenger.i18n.getMessage("betaThankYouText", [
        extensionName,
      ]);
      SLTools.alertCheck(title, text, null, true).then(async (result) => {
        if (result.check === false) {
          let preferences = await SLTools.getPrefs();
          preferences.showBetaAlert = false;
          await messenger.storage.local.set({ preferences });
        }
      });
    }

    if (preferences.releaseNotesShow) {
      SLTools.debug("Checking if release notes should be displayed");
      let slVersion = slVersionString.split(".").map((n) => {
        return parseInt(n);
      });
      if (!oldVersion) {
        oldVersion = "0.0.0";
      }
      oldVersion = oldVersion.split(".").map((n) => {
        return parseInt(n);
      });
      if (
        !oldVersion.length ||
        slVersion[0] > oldVersion[0] ||
        (slVersion[0] == oldVersion[0] && slVersion[1] > oldVersion[1])
      ) {
        SLTools.debug("Displaying release notes");
        await SendLater.onRuntimeMessageListenerasync(
          { action: "showReleaseNotes" },
          {},
        );
      } else {
        SLTools.debug("Release notes display not needed");
      }
    } else {
      SLTools.debug("Release notes display not wanted");
    }

    preferences.releaseNotesVersion = slVersionString;
    await messenger.storage.local.set({
      preferences,
    });

    if (!preferences.telemetryAsked) {
      await messenger.windows.create({
        url: "ui/telemetry.html",
        type: "popup",
        allowScriptsToClose: true,
      });
    }

    await SLTools.ufuncCompatibilityWarning();
  },

  async menuClickHandler(info, tab) {
    SLTools.trace("SendLater.scheduleSelectedMessages", info, tab);
    let messageIds = await Array.fromAsync(
      getMessageIds(info.selectedMessages),
    );
    if (!messageIds.length) return;
    if (info.menuItemId == this.scheduleMenuId) {
      let queryString = messageIds.map((id) => `messageId=${id}`).join("&");
      await messenger.windows.create({
        allowScriptsToClose: true,
        type: "popup",
        url: `ui/popup.html?${queryString}`,
      });
    } else if (info.menuItemId == this.skipMenuId) {
      await SendLater.handleMessageCommand(
        SendLater.doSkipNextOccurrence,
        {
          messageChecker: SendLater.checkSkipNextOccurrence,
          batchMode: true,
        },
        null,
        messageIds,
      );
    } else if (info.menuItemId == this.claimMenuId) {
      await SendLater.handleMessageCommand(
        SendLater.doClaimMessage,
        {
          messageChecker: SendLater.checkClaimMessage,
          batchMode: true,
        },
        null,
        messageIds,
      );
    } else {
      SLTools.error(`Unrecognized menu item ID ${info.menuItemId}`);
    }
  },

  async checkMenu(info, tab) {
    SLTools.trace("SendLater.checkScheduleMenu", info, tab);
    if (!(info && info.displayedFolder)) return;
    let visible = info.displayedFolder.type == "drafts";
    if (SendLater.menuVisible != visible) {
      SLTools.debug(`Making menu items ${visible ? "" : "in"}visible`);
      for (let menuId of [
        this.scheduleMenuId,
        this.skipMenuId,
        this.claimMenuId,
      ]) {
        await messenger.menus.update(menuId, { visible: visible });
      }
      await messenger.menus.refresh();
      SendLater.menuVisible = visible;
    }
  },

  async storageChangedListener(changes) {
    // You *must not* log anything in a storage changed listener until you've
    // confirmed that the stuff you care about has actually changed, or you will
    // cause an infinite logging loop when local storage logging is enabled,
    // because in that case logging causes storage to change!
    if (changes.preferences) {
      SLTools.debug("Propagating changes from local storage");
      const preferences = changes.preferences.newValue;
      if (preferences.checkTimePref) {
        rescheduleDeferred("mainLoop", preferences.checkTimePref * 60000);
      }
      SendLater.prefCache = preferences;

      await messenger.SL3U.setLogConsoleLevel(preferences.logConsoleLevel);
      await SendLater.setQuitNotificationsEnabled(true, preferences);
      await messenger.browserAction.setLabel({
        label: preferences.showStatus
          ? messenger.i18n.getMessage("sendlater3header.label")
          : "",
      });

      await updateShortcuts(preferences);
    }
  },

  // When user opens a new messagecompose window, we need to do several things
  // to ensure that it behaves as they expect. namely, we need to override the
  // window's send and sendlater menu items, we need to ensure the toolbar is
  // visible, and we need to check whether they're editing a previously
  // scheduled draft.
  async onWindowCreatedListener(window) {
    if (window.type != "messageCompose") {
      SLTools.debug("Not a messageCompose window");
      return;
    }

    let resolver = SendLater.windowCreatedResolver;
    SendLater.windowCreatedResolver = null;
    try {
      await SendLater.setUpWindow(window);
      if (resolver) {
        resolver(true);
      }
    } catch (ex) {
      if (resolver) {
        resolver(false);
      }
      throw ex;
    }
  },

  async setUpWindow(window) {
    // Wait for window to fully load
    window = await messenger.windows.get(window.id, { populate: true });
    SLTools.info("Opened new window", window);

    // Bind listeners to overlay components like File>Send,
    // Send Later, and keycodes like Ctrl+enter, etc.
    try {
      await messenger.SL3U.hijackComposeWindowKeyBindings(window.id);
    } catch (ex) {
      SLTools.error("SL3U.hijackComposeWindowKeyBindings", ex);
    }

    let tab = window.tabs[0];
    let cd = await messenger.compose.getComposeDetails(tab.id);
    SLTools.debug("Opened window with composeDetails", cd);

    // Check if we're editing an existing draft message
    if (cd.type != "draft") {
      SLTools.debug("Not editing an existing draft");
      return;
    }

    let originalMsg = await messenger.SL3U.findAssociatedDraft(window.id);
    if (originalMsg) {
      let originalMsgPart = await messenger.messages.getFull(originalMsg.id);
      scheduledMsgCache.delete(originalMsg.id);
      unscheduledMsgCache.add(originalMsg.id);

      // Check if original message has x-send-later headers
      if (originalMsgPart.headers.hasOwnProperty("x-send-later-at")) {
        let { preferences, scheduleCache } = await messenger.storage.local.get(
          {
            preferences: {},
            scheduleCache: {},
          },
        );

        // Re-save message (drops x-send-later headers by default
        // because they are not loaded when editing as draft).
        let { messages } = await messenger.compose.saveMessage(tab.id, {
          mode: "draft",
        });
        let msg = messages[0];

        // https://bugzilla.mozilla.org/show_bug.cgi?id=1855487
        //
        // This is a workaround for a TB bug. If we're editing a draft in a
        // subfolder of the main Drafts folder, then when we save the draft
        // above it sometimes gets saved to the server without the Send Later
        // headers as expected, but TB doesn't realize that, i.e., it's still
        // got the SL headers in the message database and if you view the
        // message source you'll see them, even though they're not in the copy
        // on the server! However, if we wait until the message is visible in
        // the drafts folder and then save it again, the new save overwrites
        // the old one _and_ the headers go away like they're supposed to.
        if (originalMsg.folder.path != msg.folder.path) {
          let found = await SLTools.waitForMessage(msg);
          ({ messages } = await messenger.compose.saveMessage(tab.id, {
            mode: "draft",
          }));
          if (!found && messages[0].id != msg.id) {
            SendLater.deleteMessage(msg);
          }
          msg = messages[0];
        }

        // Courtesy of https://bugzilla.mozilla.org/show_bug.cgi?id=263114, if
        // the draft we're editing started in a subfolder than TB may not
        // delete the original draft automatically.
        if (msg.id != originalMsg.id) {
          try {
            SendLater.deleteMessage(originalMsg);
          } catch (ex) {}
        }

        await SendLater.updateStatusIndicator();

        // Set popup scheduler defaults based on original message
        scheduleCache[window.id] = SLTools.parseHeadersForPopupUICache(
          originalMsgPart.headers,
        );
        SLTools.debug(
          `Schedule cache item added for window ${window.id}:`,
          scheduleCache[window.id],
        );
        await messenger.storage.local.set({ scheduleCache });

        // Alert the user about what just happened
        if (preferences.showEditAlert) {
          let draftSaveWarning = messenger.i18n.getMessage("draftSaveWarning");
          let result = await SLTools.alertCheck(
            null,
            draftSaveWarning,
            null,
            true,
          );
          let preferences = await SLTools.getPrefs();
          preferences.showEditAlert = result.check;
          await messenger.storage.local.set({ preferences });
        }
      }
    }
  },

  async openPopup() {
    if (!(await SendLater.schedulePrecheck())) {
      return false;
    }
    SLTools.info("Opening popup");

    async function detachedPopup() {
      let tab = (await browser.tabs.query({ currentWindow: true }))[0];
      let params = {
        allowScriptsToClose: true,
        type: "popup",
        url: `ui/popup.html?tabId=${tab.id}`,
      };
      if (
        SendLater.prefCache.detachedPopupWindowWidth &&
        SendLater.prefCache.detachedPopupWindowHeight
      ) {
        params.width = SendLater.prefCache.detachedPopupWindowWidth;
        params.height = SendLater.prefCache.detachedPopupWindowHeight;
      }
      if (!(await messenger.windows.create(params))) {
        SLTools.error("standalone scheduling pop-up failed to open");
      }
    }

    await SLTools.tb128(
      async () => {
        if (SendLater.prefCache.detachedPopup) return await detachedPopup();
        // The onClicked event on the compose action button doesn't fire if a
        // pop-up is configured, so we have to set and open the popup here and
        // then immediately unset the popup so that we can catch the key binding
        // if the user clicks again with a modifier.
        messenger.composeAction.setPopup({ popup: "ui/popup.html" });
        try {
          if (!(await messenger.composeAction.openPopup())) {
            SLTools.info(
              "composeAction pop-up failed to open, trying standalone",
            );
            await detachedPopup();
          }
        } finally {
          messenger.composeAction.setPopup({ popup: null });
        }
      },
      async () => {
        await detachedPopup();
      },
    );
  },

  // Custom events that are attached to user actions within
  // composition windows. These events occur when the user activates
  // the built-in send or send later using either key combinations
  // (e.g. ctrl+shift+enter), or click the file menu buttons.
  async onUserCommandKeyListener(keyid) {
    SLTools.info(`Received keycode ${keyid}`);
    switch (keyid) {
      case "key_altShiftEnter": {
        if (SendLater.prefCache.altBinding) {
          await SendLater.openPopup();
        } else {
          SLTools.info(
            "Ignoring Alt+Shift+Enter on account of user preferences",
          );
        }
        break;
      }
      case "key_sendLater": {
        // User pressed ctrl+shift+enter
        SLTools.debug("Received Ctrl+Shift+Enter.");
        if (SendLater.prefCache.altBinding) {
          SLTools.info(
            "Passing Ctrl+Shift+Enter along to builtin send " +
              "later because user bound alt+shift+enter instead.",
          );
          let curTab = await SLTools.getActiveComposeTab();
          if (curTab) {
            await messenger.compose.sendMessage(curTab.id, {
              mode: "sendLater",
            });
          }
        } else {
          await SendLater.openPopup();
        }
        break;
      }
      case "cmd_sendLater": {
        // User clicked the "Send Later" menu item, which should always
        // open the Send Later popup.
        await SendLater.openPopup();
        break;
      }
      case "cmd_sendNow":
      case "cmd_sendButton":
      case "key_send": {
        if (
          SendLater.prefCache.sendDoesSL &&
          !(await SendLater.messageWhitelisted())
        ) {
          if (!(await SendLater.schedulePrecheck())) {
            return false;
          }
          await SendLater.openPopup();
        } else if (
          SendLater.prefCache.sendDoesDelay &&
          !(await SendLater.messageWhitelisted())
        ) {
          if (!(await SendLater.schedulePrecheck())) {
            return false;
          }
          // Schedule with delay.
          const sendDelay = SendLater.prefCache.sendDelay;
          SLTools.info(`Scheduling Send Later ${sendDelay} minutes from now.`);
          let curTab = await SLTools.getActiveComposeTab();
          if (curTab) {
            await SendLater.scheduleSendLater(curTab.id, { delay: sendDelay });
          }
        } else {
          let curTab = await SLTools.getActiveComposeTab();
          if (curTab) {
            if (keyid == "key_send") {
              await messenger.SL3U.SendMessageWithCheck(curTab.id);
            } else {
              await messenger.compose.sendMessage(curTab.id, {
                mode: "sendNow",
              });
            }
          }
        }
        break;
      }
      default: {
        SLTools.error(`Unrecognized keycode ${keyid}`);
      }
    }
  },

  async messageWhitelisted() {
    if (!SendLater.prefCache.whitelistName) return false;
    let addressBook = (await messenger.addressBooks.list(false)).find(
      (b) => b.name == SendLater.prefCache.whitelistName,
    );
    if (!addressBook) {
      SLTools.warn(`Could not find address book ${addressBook}`);
      return false;
    }
    addressBook = await messenger.addressBooks.get(addressBook.id, true);
    let whitelist = SendLater.addressBookToEmails(addressBook);
    let tab = await SLTools.getActiveComposeTab();
    let cd = await messenger.compose.getComposeDetails(tab.id);
    SLTools.debug("Recipients:", cd.bcc, cd.cc, cd.to);
    return (
      (await SendLater.recipientsWhitelisted(whitelist, cd.bcc)) &&
      (await SendLater.recipientsWhitelisted(whitelist, cd.cc)) &&
      (await SendLater.recipientsWhitelisted(whitelist, cd.to))
    );
  },

  addressBookToEmails(addressBook) {
    SLTools.debug("addressBookToEmails", addressBook);
    return addressBook.contacts.map(SendLater.contactToEmails).flat();
  },

  contactToEmails(contact) {
    let vcard = contact.properties.vCard;
    vcard = new ICAL.Component(ICAL.parse(vcard));
    SLTools.debug("contactToEmails: vcard=", vcard);
    return vcard.getAllProperties("email").map((e) => e.jCal[3]);
  },

  async recipientToEmails(recipient) {
    if (typeof recipient == "string") {
      // Name <email> or just email
      let match = /<([^<]+)>$/.exec(recipient);
      if (!match) return [recipient];
      return [match[1]];
    } else if (typeof recipient == "object") {
      // id, type == contact or mailingList
      if (recipient.type == "mailingList") return false;
      else if (recipient.type != "contact") return false;
      let contact = await messenger.contacts.get(recipient.id);
      if (!contact) return undefined;
      return SendLater.contactToEmails(contact);
    }
    return undefined;
  },

  async recipientsWhitelisted(whitelist, recipients) {
    if (Array.isArray(recipients)) {
      for (let recipient of recipients) {
        let ret = await SendLater.recipientsWhitelisted(whitelist, recipient);
        if (!ret) return false;
      }
      return true;
    }
    let emails = await SendLater.recipientToEmails(recipients);
    if (!emails) return false;
    return emails.some((e) => whitelist.includes(e));
  },

  async setPreferencesMessage(new_prefs) {
    let prefKeys = await SLTools.userPrefKeys(false);
    let old_prefs = await SLTools.getPrefs();
    for (const prop in new_prefs) {
      if (!prefKeys.includes(prop)) {
        throw new Error(
          `Property ${prop} is not a valid Send Later preference.`,
        );
      }
      if (
        prop in old_prefs &&
        typeof old_prefs[prop] != "undefined" &&
        typeof new_prefs[prop] != "undefined" &&
        typeof old_prefs[prop] != typeof new_prefs[prop]
      ) {
        throw new Error(
          `Type of ${prop} is invalid: new ` +
            `${typeof new_prefs[prop]} vs. current ` +
            `${typeof old_prefs[prop]}.`,
        );
      }
      old_prefs[prop] = new_prefs[prop];
    }
    await messenger.storage.local.set({ preferences: old_prefs });
    return old_prefs;
  },

  // Allow other extensions to access local preferences
  onMessageExternalListener(message, sender, sendResponse) {
    switch (message.action) {
      case "getUUID": {
        // Return Promise for the instanceUUID.
        return SLTools.getPrefs()
          .then((preferences) => preferences.instanceUUID)
          .catch((ex) => SLTools.error(ex));
      }
      case "getPreferences": {
        // Return Promise for the allowed preferences.
        let prefKeysPromise = SLTools.userPrefKeys(true);
        let prefsPromise = SLTools.getPrefs();
        return Promise.all([prefKeysPromise, prefsPromise])
          .then(([prefKeys, prefs]) => {
            prefs = Object.entries(prefs);
            prefs = prefs.filter(([key, value]) => prefKeys.includes(key));
            prefs = Object.fromEntries(prefs);
            return prefs;
          })
          .catch((ex) => SLTools.error(ex));
      }
      case "setPreferences": {
        // Return Promise for updating the allowed preferences.
        return SendLater.setPreferencesMessage(message.preferences).catch(
          (ex) => SLTools.error(ex),
        );
      }
      case "parseDate": {
        SLTools.trace("onMessageExternalListener.parseDate");
        // Return Promise for the Date. Since this is a sync operation, the
        // Promise is already fulfilled. But it still has to be a Promise, or
        // sendResponse() has to be used instead. Promise syntax is preferred.
        try {
          const date = SLTools.convertDate(message["value"]);
          if (date) {
            const dateStr = SLTools.parseableDateTimeFormat(date.getTime());
            return Promise.resolve(dateStr);
          }
        } catch (ex) {
          SLTools.debug("Unable to parse date/time", ex);
        }
        break;
      }
      default: {
        SLTools.warn(`Unrecognized operation <${message.action}>.`);
      }
    }
    return false;
  },

  async checkSkipNextOccurrence(options) {
    // Is the user sure they want to do this?
    if (options.first) {
      let preferences = await SLTools.getPrefs();
      if (preferences.showSkipAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("SkipConfirmMessage"),
          messenger.i18n.getMessage("ConfirmAgain"),
          true,
        ).catch((err) => {
          SLTools.trace(err);
        });
        if (result.check === false) {
          preferences.showSkipAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLTools.debug(`User canceled occurrence skip.`);
          return false;
        }
      }
    }
    // Is this a recurring message?
    let recurHeader = (options.messageFull.headers["x-send-later-recur"] ||
      [])[0];
    let recur = SLTools.parseRecurSpec(recurHeader);
    if (recur.type == "none") {
      let title = messenger.i18n.getMessage("cantSkipSingletonTitle");
      let text = messenger.i18n.getMessage("cantSkipSingletonText", [
        options.messageHeader.subject,
      ]);
      await SLTools.alert(title, text);
      return false;
    }
    // Does the message have another recurrence in the future?
    let sendAtHeader = (options.messageFull.headers["x-send-later-at"] ||
      [])[0];
    if (!sendAtHeader) {
      // This should never happen so not bothering with a user message.
      SLTools.error(
        `Message ${options.messageId} (${options.messageHeader.subject}) ` +
          `has recur header but no at header?`,
      );
      return false;
    }
    let argsHeader = (options.messageFull.headers["x-send-later-args"] ||
      [])[0];
    let args = argsHeader ? SLTools.parseArgs(msgRecurArgs) : null;
    let sendAt = new Date(sendAtHeader);
    let now = new Date();
    if (now < sendAt) {
      now = sendAt;
    }
    let nextRecur = await SLTools.nextRecurDate(
      sendAt,
      recurHeader,
      now,
      args,
    );
    if (!nextRecur || !nextRecur.sendAt) {
      let title = messenger.i18n.getMessage("cantSkipPastLastTitle");
      let text = messenger.i18n.getMessage("cantSkipPastLastText", [
        options.messageHeader.subject,
      ]);
      await SLTools.alert(title, text);
      return false;
    }
    return true;
  },

  async doSkipNextOccurrence(tabId, options, fromMenuCommand) {
    SLTools.trace("doSkipNextOccurrence", tabId, options, fromMenuCommand);
    if (tabId || !fromMenuCommand) {
      SLTools.error("Unsupported doSkipNextOccurrence call from window");
      return false;
    }
    options.skipping = true;
    return await SendLater.possiblySendMessage(options.messageHeader, options);
  },

  async checkClaimMessage(options) {
    let preferences = await SLTools.getPrefs();
    if (!preferences.sendWhileOffline && !window.navigator.onLine) {
      SLTools.warn(
        "Send Later is configured to disable sending while offline. Skipping.",
      );
      return false;
    }
    return true;
  },

  // Claim a message previously scheduled by a different instance of Send Later
  // without changing anything else about it.
  async doClaimMessage(tabId, options, fromMenuCommand) {
    if (tabId || !fromMenuCommand) {
      SLTools.error("Unsupported doClaimMessages call from window");
      return false;
    }

    let msgHdr = options.messageHeader;
    SLTools.debug(`Claiming message ${msgHdr.id}`);

    let originalMsgId = msgHdr.headerMessageId;
    let fullMsg = options.messageFull;
    if (!fullMsg.headers.hasOwnProperty("x-send-later-at")) {
      SLTools.warn(`Can't claim unscheduled message ${originalMsgId}`);
      unscheduledMsgCache.add(msgHdr.id);
      return false;
    }
    let contentType = fullMsg.contentType;
    if (/encrypted/i.test(contentType)) {
      SLTools.warn(
        `Message ${originalMsgId} is encrypted, and will not ` +
          `be processed by Send Later.`,
      );
      unscheduledMsgCache.add(msgHdr.id);
      return false;
    }
    let msgUUID = (fullMsg.headers["x-send-later-uuid"] || [])[0];
    if (!msgUUID) {
      SLTools.warn(`Message <${originalMsgId}> has no uuid header.`);
      unscheduledMsgCache.add(msgHdr.id);
      return false;
    }
    let preferences = await SLTools.getPrefs();
    if (msgUUID == preferences.instanceUUID) {
      SLTools.warn(
        `Message <${originalMsgId}> is already owned by this Thunderbird ` +
          `instance.`,
      );
      return false;
    }

    let newMsgContent = await messenger.messages.getRaw(msgHdr.id);
    newMsgContent = SLTools.replaceHeader(
      newMsgContent,
      "X-Send-Later-UUID",
      preferences.instanceUUID,
      true,
      true,
    );

    newMsgContent = SLTools.replaceHeader(
      newMsgContent,
      "X-Identity-Key",
      options.identityId,
      true,
      true,
    );

    let file = getFileFromRaw(newMsgContent);
    let success = await messageImport(file, msgHdr.folder, {
      new: false,
      read: preferences.markDraftsRead,
    });

    if (success) {
      SLTools.debug(`Claimed message ${originalMsgId}. Deleting original.`);
      await SendLater.deleteMessage(msgHdr);
      return true;
    } else {
      SLTools.error(`Unable to claim message ${originalMsgId}.`);
      return;
    }
  },

  async handleMessageCommand(command, options, tabId, messageIds) {
    SLTools.trace("handleMessageCommand", command, options, tabId, messageIds);
    options.first = true;
    if (messageIds) {
      let total = messageIds.length;
      let successful = 0;
      for (let messageId of messageIds) {
        let message = await messenger.messages.get(messageId);
        options.messageFull = await messenger.messages.getFull(messageId);
        let identityId = await findBestIdentity(message, options.messageFull);
        options.identityId = identityId;
        options.messageId = messageId;
        options.messageHeader = message;
        // The message checker, if there is one, should return true to proceed
        // or false to stop processing any further messages. Individual message
        // commands should return false to indicate they were unsuccessful.
        if (
          options.messageChecker &&
          !(await options.messageChecker(options))
        ) {
          break;
        }
        let tab;
        if (!options.batchMode) {
          let promise = new Promise((r) => {
            SendLater.windowCreatedResolver = r;
          });
          tab = await messenger.compose.beginNew(messageId, {
            identityId: identityId,
          });
          if (!(await promise)) {
            break;
          }
        }
        if (await command(options.batchMode ? null : tab.id, options, true)) {
          if (!options.batchMode) await SendLater.deleteMessage(message);
          successful++;
        } else {
          break;
        }
        options.first = false;
      }
      if (messageIds.length > 1) {
        let title = messenger.i18n.getMessage("resultsTitle");
        let text;
        if (total == successful) {
          text = messenger.i18n.getMessage("resultsAllSuccess");
        } else {
          text = messenger.i18n.getMessage("resultsPartialSuccess", [
            successful,
            total,
          ]);
        }
        SLTools.alert(title, text);
      }
      scheduledMsgCache.clear();
      unscheduledMsgCache.clear();
      setTimeout(SendLater.updateStatusIndicator, 1000);
      return total == successful;
    } else if (
      !options.messageChecker ||
      (await options.messageChecker(options))
    ) {
      // N.B. In window mode the message checker doesn't get the message ID,
      // message header, or full message.
      return await command(tabId, options);
    } else {
      return false;
    }
  },

  async getSchedule(hdr) {
    let draftMsg = await messenger.messages.getFull(hdr.id);
    function getHeader(name) {
      return (draftMsg.headers[name] || [])[0];
    }
    if (getHeader("x-send-later-at")) {
      let folderPath = hdr.folder.path;
      let accountId = hdr.folder.accountId;
      let account = await messenger.accounts.get(accountId, false);
      let accountName = account.name;
      let fullFolderName = accountName + folderPath;
      scheduledMsgCache.add(hdr.id);
      return {
        sendAt: getHeader("x-send-later-at"),
        recur: getHeader("x-send-later-recur"),
        args: getHeader("x-send-later-args"),
        cancel: getHeader("x-send-later-cancel-on-reply"),
        subject: hdr.subject,
        recipients: hdr.recipients,
        folder: fullFolderName,
      };
    } else {
      unscheduledMsgCache.add(hdr.id);
      scheduledMsgCache.delete(hdr.id);
      return null;
    }
  },

  // Various extension components communicate with
  // the background script via these runtime messages.
  // e.g. the options page and the scheduler dialog.
  async onRuntimeMessageListenerasync(message, sender) {
    if (!message.action)
      // Not intended for us!
      return;

    const response = {};
    switch (message.action) {
      case "alert": {
        SLTools.alert(message.title, message.text);
        break;
      }
      case "doSendNow": {
        SLTools.debug("User requested send immediately.");
        await SendLater.handleMessageCommand(
          SendLater.doSendNow,
          {
            messageChecker: SendLater.checkDoSendNow,
            changed: message.changed,
          },
          message.tabId,
          message.messageIds,
        );
        break;
      }
      case "doPlaceInOutbox": {
        SLTools.debug("User requested system send later.");
        await SendLater.handleMessageCommand(
          SendLater.doPlaceInOutbox,
          {
            messageChecker: SendLater.checkDoPlaceInOutbox,
            changed: message.changed,
          },
          message.tabId,
          message.messageIds,
        );
        break;
      }
      case "doSendLater": {
        SLTools.debug("User requested send later.");
        const options = {
          sendAt: message.sendAt,
          recurSpec: message.recurSpec,
          args: message.args,
          cancelOnReply: message.cancelOnReply,
        };
        await SendLater.handleMessageCommand(
          SendLater.scheduleSendLater,
          options,
          message.tabId,
          message.messageIds,
        );
        break;
      }
      case "getMainLoopStatus": {
        response.previousLoop =
          SendLater.previousLoop && SendLater.previousLoop.getTime();
        response.loopMinutes = SendLater.loopMinutes;
        if (SendLater.loopMinutes && SendLater.loopExcessTimes) {
          let a = SendLater.loopExcessTimes;
          response.averageLoopMinutes =
            SendLater.loopMinutes +
            a.reduce((a, b) => a + b) / a.length / 60000;
        } else {
          response.averageLoopTimes = null;
        }
        break;
      }
      case "getScheduleText": {
        try {
          const dispMsgHdr =
            await messenger.messageDisplay.getDisplayedMessage(message.tabId);
          const fullMsg = await messenger.messages.getFull(dispMsgHdr.id);

          const preferences = await SLTools.getPrefs();

          const msgSendAt = (fullMsg.headers["x-send-later-at"] || [])[0];
          const msgUuid = (fullMsg.headers["x-send-later-uuid"] || [])[0];
          const msgRecur = (fullMsg.headers["x-send-later-recur"] || [])[0];
          const msgArgs = (fullMsg.headers["x-send-later-args"] || [])[0];
          const msgCancelOnReply = (fullMsg.headers[
            "x-send-later-cancel-on-reply"
          ] || [])[0];

          if (!msgSendAt) {
            response.err = "Message is not scheduled by Send Later.";
            break;
          } else if (msgUuid !== preferences.instanceUUID) {
            response.err = messenger.i18n.getMessage("incorrectUUID");
            break;
          }

          const sendAt = new Date(msgSendAt);
          const recurSpec = msgRecur || "none";
          const recur = SLTools.parseRecurSpec(recurSpec);
          recur.cancelOnReply = ["true", "yes"].includes(msgCancelOnReply);
          recur.args = msgArgs;
          response.scheduleTxt = SLTools.formatScheduleForUI(
            { sendAt, recur },
            SendLater.previousLoop,
            SendLater.loopMinutes,
          );
        } catch (ex) {
          response.err = ex.message;
        }

        break;
      }
      case "getAllSchedules": {
        response.schedules = await SLTools.forAllDrafts(
          async (draftHdr) => {
            if (unscheduledMsgCache.has(draftHdr.id)) {
              SLTools.debug(
                "Ignoring unscheduled message",
                draftHdr.id,
                draftHdr,
              );
              return null;
            }
            return await SendLater.getSchedule(draftHdr);
          },
          false, // non-sequential
        ).then((r) => r.filter((x) => x != null));
        break;
      }
      case "showPreferences": {
        messenger.runtime.openOptionsPage();
        break;
      }
      case "showUserGuide": {
        let url = SLTools.translationURL(await SLTools.userGuideLink());
        messenger.tabs.create({ url });
        break;
      }
      case "showReleaseNotes": {
        let url = SLTools.translationURL(
          await SLTools.userGuideLink("release-notes"),
        );
        messenger.tabs.create({ url });
        break;
      }
      case "donateLink": {
        let url = SLTools.translationURL(
          await SLTools.userGuideLink("#support-send-later"),
        );
        messenger.tabs.create({ url });
        break;
      }
      case "logLink": {
        let url = SLTools.translationURL(
          await SLTools.userGuideLink("#support-send-later"),
        );
        messenger.tabs.create({ url: "ui/log.html" });
        break;
      }
      default: {
        SLTools.warn(`Unrecognized operation <${message.action}>.`);
      }
    }
    SLTools.debug(`${message.action} action:`, response);
    return response;
  },

  // Listen for incoming messages, and check if they are in response to a
  // scheduled message with a 'cancel-on-reply' header.
  async onNewMailReceivedListener(folder, messagelist) {
    let skipFolders = [
      "sent",
      "trash",
      "templates",
      "archives",
      "junk",
      "outbox",
      "drafts",
    ];
    if (skipFolders.includes(folder.type)) {
      SLTools.debug(
        `Skipping onNewMailReceived for folder type ${folder.type}`,
      );
      return;
    }
    SLTools.debug("Received messages in folder", folder, ":", messagelist);

    for await (let rcvdHdr of getMessages(messagelist)) {
      let rcvdMsg = await messenger.messages.getFull(rcvdHdr.id);
      SLTools.debug("Got message", rcvdHdr, rcvdMsg);
      let inReplyTo = (rcvdMsg.headers["in-reply-to"] || [])[0];
      if (inReplyTo) {
        await SLTools.forAllDrafts(async (draftHdr) => {
          if (!unscheduledMsgCache.has(draftHdr.id)) {
            SLTools.debug(
              "Comparing",
              rcvdHdr,
              "to",
              draftHdr,
              inReplyTo,
              "?=",
              `<${draftHdr.headerMessageId}>`,
            );
            if (inReplyTo == `<${draftHdr.headerMessageId}>`) {
              let draftMsg = await messenger.messages.getFull(draftHdr.id);
              let cancelOnReply = (draftMsg.headers[
                "x-send-later-cancel-on-reply"
              ] || [])[0];
              if (["true", "yes"].includes(cancelOnReply)) {
                SLTools.info(
                  `Received response to message ${inReplyTo}.`,
                  `Deleting scheduled draft ${draftHdr.id}`,
                );
                await SendLater.deleteMessage(draftHdr);
              }
            }
          }
        });
      }
    }
  },

  // When a new message is displayed, check whether it is scheduled and
  // choose whether to show the messageDisplayAction button and the header.
  async onMessageDisplayedListener(tab, hdr) {
    SLTools.trace("onMessageDisplayedListener");
    if (!hdr) {
      // No, this shouldn't happen, but it does. It looks like this happens
      // if Thunderbird is in the process of displaying a message when the
      // user switches to a different folder.
      SLTools.debug("onMessageDisplayedListener: no hdr");
      return;
    }
    // TODO currently only display the Send Later header on messages in the
    // 3pane window. It would be nice to also display it when a draft is
    // opened in a separate tab or window.
    let headerName = messenger.i18n.getMessage("sendlater3header.label");
    await messenger.messageDisplayAction.disable(tab.id);
    if (await SLTools.isDraftsFolder(hdr.folder)) {
      SLTools.debug("onMessageDisplayedListener: isDraftsFolder is true");
      // Add header row
      const preferences = await SLTools.getPrefs();
      const instanceUUID = preferences.instanceUUID;
      let msgParts = await messenger.messages.getFull(hdr.id);
      let hdrs = {
        "content-type": msgParts.contentType,
      };
      for (let hdrName in msgParts.headers) {
        hdrs[hdrName] = msgParts.headers[hdrName][0];
      }
      const { cellText } = customHdrToScheduleInfo(hdrs, instanceUUID);
      if (preferences.showHeader === true && cellText !== "") {
        try {
          SLTools.trace("Calling addCustomHdrRow");
          await messenger.headerView.addCustomHdrRow(
            tab.id,
            headerName,
            cellText,
          );
        } catch (ex) {
          SLTools.error("headerView.addCustomHdrRow", ex);
        }
      } else {
        SLTools.trace("Calling removeCustomHdrRow");
        await messenger.headerView.removeCustomHdrRow(tab.id, headerName);
      }

      let msg = await messenger.messages.getFull(hdr.id);
      if (msg.headers["x-send-later-uuid"] == instanceUUID) {
        await messenger.messageDisplayAction.enable(tab.id);
      }
    } else {
      SLTools.debug("onMessageDisplayedListener: isDraftsFolder is false");
      await messenger.headerView.removeCustomHdrRow(tab.id, headerName);
    }
  },

  // Global key shortcuts (defined in manifest) are handled here.
  async onCommandListener(cmd) {
    const cmdId = /send-later-shortcut-([123])/.exec(cmd)[1];

    if (["1", "2", "3"].includes(cmdId)) {
      const preferences = await SLTools.getPrefs();
      const funcName = preferences[`quickOptions${cmdId}funcselect`];
      if (!funcName) {
        SLTools.info(`Can't execute empty shortcut ${cmdId}`);
        return;
      }
      const funcArgs = preferences[`quickOptions${cmdId}Args`];
      SLTools.info(`Executing shortcut ${cmdId}: ${funcName}(${funcArgs})`);
      await SendLater.quickSendWithUfunc(funcName, funcArgs);
    }
  },

  // Compose action button (emulate accelerator keys)
  async clickComposeListener(tab, info) {
    let mod = info.modifiers.length === 1 ? info.modifiers[0] : undefined;
    if (mod === "Command")
      // MacOS compatibility
      mod = "Ctrl";

    if (["Ctrl", "Shift"].includes(mod)) {
      const preferences = await SLTools.getPrefs();
      const funcName = preferences[`accel${mod}funcselect`];
      const funcArgs = preferences[`accel${mod}Args`];
      SLTools.info(
        `Executing accelerator Click+${mod}: ${funcName}(${funcArgs})`,
      );
      await SendLater.quickSendWithUfunc(funcName, funcArgs, tab.id);
    } else {
      // The onClicked event on the compose action button doesn't fire if a
      // pop-up is configured, so we have to set and open the popup here and
      // then immediately unset the popup so that we can catch the key binding
      // if the user clicks again with a modifier.
      await SendLater.openPopup();
    }
  },

  // Fully disable the extension without actually removing it. The UI elements
  // will still be visible, but they will be disabled and show a message
  // indicating that the extension is disabled. This is important for cases
  // where the extension failed to fully intialize, so that the user doesn't
  // get a false impression that the extension is working.
  async disable() {
    SLTools.warn("Disabling Send Later.");
    await SLTools.nofail(clearDeferred, "mainLoop");
    await SLTools.nofail(SendLater.setQuitNotificationsEnabled, false);
    await SLTools.nofail(messenger.browserAction.disable);
    await SLTools.nofail(messenger.browserAction.setTitle, {
      title:
        `${messenger.i18n.getMessage("extensionName")} ` +
        `[${messenger.i18n.getMessage("DisabledMessage")}]`,
    });
    await SLTools.nofail(messenger.browserAction.setBadgeText, {
      text: null,
    });
    await SLTools.nofail(messenger.composeAction.disable);
    await SLTools.nofail(messenger.messageDisplayAction.disable);
    await SLTools.nofail(messenger.messageDisplayAction.setPopup, {
      popup: null,
    });
    await SLTools.nofail(
      messenger.alarms.onAlarm.removeListener,
      alarmsListener,
    );
    await SLTools.nofail(
      messenger.windows.onCreated.removeListener,
      SendLater.onWindowCreatedListener,
    );
    await SLTools.nofail(
      messenger.SL3U.onKeyCode.removeListener,
      SendLater.onUserCommandKeyListener,
    );
    await SLTools.nofail(
      messenger.runtime.onMessageExternal.removeListener,
      SendLater.onMessageExternalListener,
    );
    await SLTools.nofail(
      messenger.runtime.onMessage.removeListener,
      SendLater.onRuntimeMessageListenerasync,
    );
    await SLTools.nofail(
      messenger.messages.onNewMailReceived.removeListener,
      SendLater.onNewMailReceivedListener,
    );
    await SLTools.nofail(
      messenger.messageDisplay.onMessageDisplayed.removeListener,
      SendLater.onMessageDisplayedListener,
    );
    await SLTools.nofail(
      messenger.commands.onCommand.removeListener,
      SendLater.onCommandListener,
    );
    await SLTools.nofail(
      messenger.composeAction.onClicked.removeListener,
      SendLater.clickComposeListener,
    );
    await SLTools.nofail(
      messenger.storage.local.onChanged.removeListener,
      SendLater.storageChangedListener,
    );
    SLTools.warn("Disabled.");
  },
}; // End SendLater object

async function mainLoop() {
  SLTools.debug("Entering main loop.");

  try {
    clearDeferred("mainLoop");
  } catch (ex) {
    SLTools.error(ex);
  }

  try {
    // We do this clean at both the beginning and end of the main loop
    // because at the beginning there may be cleaning needed as a result of
    // messages that were edited or scheduled in the interim, and at the end
    // there may be cleaning needed as a result of messages sent and/or
    // rescheduled during the main loop.
    await SendLater.cleanDrafts();

    let preferences = await SLTools.getPrefs();
    let interval = preferences.checkTimePref || 0;
    let now = new Date();
    if (SendLater.loopMinutes && SendLater.previousLoop) {
      SendLater.loopExcessTimes.push(
        now - SendLater.previousLoop - SendLater.loopMinutes * 60000,
      );
      SendLater.loopExcessTimes = SendLater.loopExcessTimes.slice(-10);
    }
    SendLater.loopMinutes = interval;

    if (interval > 0) {
      SendLater.previousLoop = now;
      // Possible refresh icon options (↻ \u8635); or (⟳ \u27F3)
      // or (⌛ \u231B) (e.g. badgeText = "\u27F3")
      let extName = messenger.i18n.getMessage("extensionName");
      let isActiveMessage = messenger.i18n.getMessage("CheckingMessage");
      // We do not await for this here because it takes an indeterminatee
      // amount of time to run when the Thunderbird window is minimized.
      // [noawait]
      let enablePromise = messenger.browserAction.enable();
      // noawait (indeterminate, see above)
      let titlePromise = messenger.browserAction.setTitle({
        title: `${extName} [${isActiveMessage}]`,
      });

      let throttleDelay = preferences.throttleDelay;

      try {
        if (preferences.sendDrafts) {
          let locker = await new Locker();
          await SLTools.forAllDrafts(
            (message) => SendLater.possiblySendMessage(message, {}, locker),
            throttleDelay > 0,
            // If we are doing a throttle delay then forAllDrafts needs to wait
            // long enough for it to elapse. The "+ 10" we're adding to the
            // throttleDelay is to avoid the race condition of the forAllDrafts
            // timeout finishing just a wee bit before we finish throttling.
            throttleDelay ? Math.max(5000, throttleDelay + 10) : undefined,
            preferences,
          );
        }
        let nActive = await countActiveScheduledMessages();
        // noawait (indeterminate, see above)
        SendLater.updateStatusIndicator(
          nActive,
          Promise.all([enablePromise, titlePromise]),
        );
        await SendLater.setQuitNotificationsEnabled(
          true,
          preferences,
          nActive,
        );

        await SendLater.cleanDrafts();
        setDeferred("mainLoop", 60000 * interval, mainLoop);
        SLTools.debug(`Next main loop iteration in ${60 * interval} seconds.`);
      } catch (err) {
        SLTools.error(err);
        let nActive = await countActiveScheduledMessages();
        await SendLater.updateStatusIndicator(nActive);
        await SendLater.setQuitNotificationsEnabled(
          true,
          preferences,
          nActive,
        );

        setDeferred("mainLoop", 60000, mainLoop);
        SLTools.debug(`Next main loop iteration in 1 minute.`);
      }
    } else {
      SendLater.previousLoop = null;
      let extName = messenger.i18n.getMessage("extensionName");
      let disabledMsg = messenger.i18n.getMessage("DisabledMessage");
      await messenger.browserAction.disable();
      await messenger.browserAction.setTitle({
        title: `${extName} [${disabledMsg}]`,
      });
      await messenger.browserAction.setBadgeText({ text: null });

      setDeferred("mainLoop", 60000, mainLoop);
      SLTools.debug(`Next main loop iteration in 1 minute.`);
    }
  } catch (ex) {
    SLTools.error(ex);

    setDeferred("mainLoop", 60000, mainLoop);
    SLTools.debug(`Next main loop iteration in 1 minute.`);
  }
}

let deferredObjects = {};

function alarmsListener(alarm, checking) {
  SLTools.debug(`alarmsListener: alarm=${alarm.name}, checking=${checking}`);
  let func;
  switch (alarm.name) {
    case "mainLoop":
      func = mainLoop;
      break;
    default:
      throw new Error(`Unknown alarm: ${alarm.name}`);
  }
  if (checking) {
    return true;
  }
  if (!deferredObjects[alarm.name].triggered) {
    SLTools.debug(`alarms.Listener: triggered ${alarm.name}`);
    deferredObjects[alarm.name].triggered = true;
    func();
  } else {
    SLTools.debug(`alarmsListener: ${alarm.name} already triggered`);
  }
}

function setDeferred(name, timeout, func) {
  SLTools.debug(`setDeferred(${name}, ${timeout})`);
  if (deferredObjects[name] && !deferredObjects[name].triggered) {
    clearDeferred(name);
  }
  // Alarms' granularity is a minimum of one minute, but timeouts can run more
  // frequently than that. We use a timeout to try to get the best granularity,
  // and an alarm because timeouts don't run reliably when Thunderbird windows
  // are minimized (ugh).
  if (!alarmsListener({ name }, true)) {
    throw new Error(`Unknown alarm: ${name}`);
  }
  let timeoutId;
  let response = {
    scheduledAt: new Date(),
    timeout: timeout,
    name: name,
    func: func,
  };
  if (timeout >= 60000) {
    response.timeoutId = undefined;
  } else {
    response.timeoutId = setTimeout(() => {
      if (!response.triggered) {
        SLTools.debug(`setDeferred timeout callback for ${name}`);
        response.triggered = true;
        func();
      } else {
        SLTools.debug(`setDeferred timeout ${name} already triggered`);
      }
    }, timeout);
  }
  messenger.alarms.create(name, { delayInMinutes: timeout / 1000 / 60 });
  deferredObjects[name] = response;
  SLTools.debug(`setDeferred(${name}) success`);
}

async function rescheduleDeferred(name, timeout) {
  // If the specified alarm is currently scheduled, recalculate when it should
  // be scheduled for based on the specified new timeout and reschedule as
  // needed.
  let deferred = deferredObjects[name];
  if (!deferred) {
    SLTools.debug(`rescheduleDeferred: unrecognized time ${name}`);
    return;
  }
  if (deferred.triggered) {
    SLTools.debug(`rescheduleDeferred: ${name} already triggered`);
    return;
  }
  if (timeout == deferred.timeout) {
    SLTools.debug(`rescheduleDeferred: ${name} no change`);
    return;
  }
  let scheduledAt = deferred.scheduledAt;
  let now = new Date();
  let msSinceScheduled = now - scheduledAt;
  let msLeft = timeout - msSinceScheduled;
  if (msLeft < 0) {
    msLeft = 1;
  }
  let func = deferred.func;
  clearDeferred(name);
  setDeferred(name, msLeft, func);
  // Gross but effective
  deferred = deferredObjects[name];
  deferred.scheduledAt = scheduledAt;
  deferred.timeout = timeout;
  SLTools.debug(
    `rescheduleDeferred moved ${name} to ${new Date(now.getTime() + msLeft)}`,
  );
}

async function clearDeferred(name) {
  SLTools.debug(`clearDeferred(${name})`);
  let deferredObj = deferredObjects[name];
  if (!deferredObj) {
    SLTools.debug("clearDeferred: no timer to clear");
    return;
  }
  deferredObj.triggered = true;
  clearTimeout(deferredObj.timeoutId);
  await messenger.alarms.clear(deferredObj.name);
}

async function findBestIdentity(message, messageFull) {
  // First try to find the author of the message in the account associated
  // with the folder it's in. If that fails, save the default identity for
  // that account and try to find the author in the identities of all other
  // accounts. If that fails, return the default identity of the account
  // associated with the folder.
  let author = message.author;
  let keyIdentityId = messageFull?.headers["x-identity-key"]?.at(0);
  if (keyIdentityId) {
    let keyIdentity = await messenger.identities.get(keyIdentityId);
    if (keyIdentity && exactIdentityMatch(author, keyIdentity)) {
      return keyIdentityId;
    }
  }
  let account = await messenger.accounts.get(message.folder.accountId, false);
  let primaryAccountId = account.id;
  let nameMatchId = null;
  let emailMatchId = null;
  for (let identity of account.identities) {
    // There really should be a way to parse From lines in the TB API.
    if (exactIdentityMatch(author, identity)) {
      return identity.id;
    } else if (!nameMatchId && nameIdentityMatch(author, identity)) {
      nameMatchId = identity.id;
    } else if (!emailMatchId && emailIdentityMatch(author, identity)) {
      emailMatchId = identity.id;
    }
  }
  if (nameMatchId || emailMatchId) {
    return nameMatchId || emailMatchId;
  }
  let primaryIdentityId = account.identities.length
    ? account.identities[0].id
    : undefined;
  for (account of await messenger.accounts.list(false)) {
    if (account.id == primaryAccountId) {
      continue;
    }
    for (let identity of account.identities) {
      if (exactIdentityMatch(author, identity)) {
        return identity.id;
      } else if (!nameMatchId && nameIdentityMatch(author, identity)) {
        nameMatchId = identity.id;
      } else if (!emailMatchId && emailIdentityMatch(author, identity)) {
        emailMatchId = identity.id;
      }
    }
    if (nameMatchId) {
      return nameMatchId;
    }
  }
  if (nameMatchId || emailMatchId) {
    return nameMatchId || emailMatchId;
  }
  return primaryIdentityId;
}

function exactIdentityMatch(author, identity) {
  if (identity.name && identity.email) {
    return author == `${identity.name} <${identity.email}>`;
  } else if (identity.email) {
    return author == identity.email || author == `<${identity.email}>`;
  }
  return false;
}

function nameIdentityMatch(author, identity) {
  if (identity.name && identity.email) {
    return (
      author.startsWith(identity.name) &&
      author.endsWith(`<${identity.email}>`)
    );
  }
  return false;
}

function emailIdentityMatch(author, identity) {
  if (identity.email) {
    return author == identity.email || author.includes(`<${identity.email}>`);
  }
  return false;
}

SendLater.init()
  .then(mainLoop)
  .catch((err) => {
    SLTools.error("Error initializing Send Later", err);
    SendLater.disable();
  });
