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
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showSendNowAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled send now.`);
          return false;
        }
      } else if (options.changed && preferences.showChangedAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("PopupChangedConfirmMessage", messageArgs),
          messenger.i18n.getMessage("ConfirmAgain"),
          true,
        ).catch((err) => {
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showChangedAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled send now.`);
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
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showOutboxAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled put in outbox.`);
          return false;
        }
      } else if (options.changed && preferences.showChangedAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("PopupChangedConfirmMessage", messageArgs),
          messenger.i18n.getMessage("ConfirmAgain"),
          true,
        ).catch((err) => {
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showChangedAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled put in outbox.`);
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
    if (tabId) {
      let { ufuncs } = await messenger.storage.local.get({ ufuncs: {} });
      let funcBody = ufuncs[funcName].body;
      let schedule = SLStatic.parseUfuncToSchedule(
        funcName,
        funcBody,
        null,
        funcArgs,
      );
      let options = {
        sendAt: schedule.sendAt,
        recurSpec: SLStatic.unparseRecurSpec(schedule.recur),
        args: schedule.recur.args,
        cancelOnReply: false,
      };
      await SendLater.scheduleSendLater(tabId, options);
    }
  },

  // Go through the process of handling pre-send checks, assigning custom
  // header fields, and saving the message to Drafts.
  async scheduleSendLater(tabId, options, fromMenuCommand) {
    let now = new Date();
    SLStatic.debug(`Pre-send check initiated at ${now}`);
    let encryptionStatus =
      await messenger.SL3U.signingOrEncryptingMessage(tabId);
    SLStatic.telemetrySend({
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
      SLStatic.warn(
        `Canceled via pre-send checks (check initiated at ${now})`,
      );
      return;
    }
    // let windowId = await messenger.tabs.get(tabId).then(
    //   tab => tab.windowId);
    // let originalDraftMsg = await messenger.SL3U.findAssociatedDraft(
    //   windowId);

    const preferences = await SLTools.getPrefs();

    SLStatic.info(`Scheduling send later: ${tabId} with options`, options);

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
      SLStatic.error("scheduleSendLater requires scheduling information");
      return;
    }

    sendAt = SLStatic.parseableDateTimeFormat(sendAt);
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
    // // SLStatic.info("Saving message with details:", composeDetails);
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
    if (saveProperties.messages.length != 1) {
      // TODO: Look into whether this could be a problem for
      // SendLater (possibility for duplicates?)
      SLStatic.error(`Saved ${saveProperties.messages.length} messages.`);
    } else {
      let msg = saveProperties.messages[0];
      let targetFolder = await SLTools.getTargetSubfolder(preferences, msg);
      if (targetFolder) {
        await messenger.messages.move([msg.id], targetFolder);
        // It appears that the message ID stays the same after the move.
      }
    }

    if (preferences.ignoredAccounts && preferences.ignoredAccounts.length) {
      let identity = await messenger.identities.get(composeDetails.identityId);
      let accountId = identity.accountId;
      if (preferences.ignoredAccounts.includes(accountId)) {
        preferences.ignoredAccounts = preferences.ignoredAccounts.filter(
          (a) => a != accountId,
        );
        await messenger.storage.local.set({ preferences });
        SLStatic.info(
          `Reactivating ${accountId} because message scheduled in it`,
        );
      }
    }
    // Close the composition tab
    await messenger.tabs.remove(tabId);

    // Optionally mark the saved message as "read"
    if (preferences.markDraftsRead) {
      for (let msg of saveProperties.messages) {
        await messenger.messages.update(msg.id, { read: true });
      }
    }

    // If message was a reply or forward, update the original message
    // to show that it has been replied to or forwarded.
    if (!fromMenuCommand && composeDetails.relatedMessageId) {
      if (composeDetails.type == "reply") {
        SLStatic.debug("This is a reply message. Setting original 'replied'");
        await messenger.SL3U.setDispositionState(
          composeDetails.relatedMessageId,
          "replied",
        );
      } else if (composeDetails.type == "forward") {
        SLStatic.debug("This is a fwd message. Setting original 'forwarded'");
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
    // Best option right now seems to be invalidating and regenerating the
    // entire unscheduledMsgCache.
    if (!fromMenuCommand) {
      SLTools.unscheduledMsgCache.clear();
      // It seems that a delay is required for messages.getFull to successfully
      // access the recently saved message.
      setTimeout(SendLater.updateStatusIndicator, 1000);
    }
    // // Different workaround:
    // function touchDraftMsg(draftId) {
    //   SLTools.unscheduledMsgCache.delete(draftId);
    //   SLTools.scheduledMsgCache.add(draftId);
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

  async deleteMessage(hdr) {
    let account = await messenger.accounts.get(hdr.folder.accountId, false);
    let accountType = account.type;
    SLStatic.info(`accountType=${accountType}`);
    let succeeded;
    if (!accountType.startsWith("owl")) {
      await messenger.messages
        .delete([hdr.id], true)
        .then(() => {
          succeeded = true;
          SLStatic.info("Deleted message", hdr.id);
          SLTools.scheduledMsgCache.delete(hdr.id);
          SLTools.unscheduledMsgCache.delete(hdr.id);
        })
        .catch((ex) => {
          SLStatic.error(`Error deleting message ${hdr.id}`, ex);
        });
    } else {
      // When we're talking to an Owl Exchange account, the code simply
      // above... stops. Neither the code inside the `then` block nor the code
      // inside the `catch` block is called. In fact, the code flow just stops
      // and nothing after it gets executed. Basically, the extension is hung
      // at that point. I have no idea what's going on here. Since it's likely
      // to be a problem inside the Owl code, I've asked the author of Owl for
      // assistance figuring it out. He may have no idea either :shrug:. In the
      // meantime we just have to do delete asynchronously, and we can't log
      // "Deleted message" because we don't know for certain that the message
      // was in fact deleted.
      messenger.messages
        .delete([hdr.id], true)
        .then(() => {
          succeeded = true;
        })
        .catch((ex) => {
          SLStatic.error(`Error deleting message ${hdr.id}`, ex);
        });
      SLTools.scheduledMsgCache.delete(hdr.id);
      SLTools.unscheduledMsgCache.delete(hdr.id);
    }
    return succeeded;
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
    if (!options) {
      options = {};
    }
    let skipping = options.skipping;
    if (!locker) {
      locker = await new Locker();
    }

    // Determines whether or not a particular draft message is due to be sent
    if (SLTools.unscheduledMsgCache.has(msgHdr.id)) {
      return;
    }

    SLStatic.debug(`Checking message ${msgHdr.id}.`);
    const fullMsg =
      options.messageFull || (await messenger.messages.getFull(msgHdr.id));

    if (!fullMsg.headers.hasOwnProperty("x-send-later-at")) {
      SLTools.unscheduledMsgCache.add(msgHdr.id);
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

    if (/encrypted/i.test(contentType)) {
      SLStatic.debug(
        `Message ${originalMsgId} is encrypted, and will not ` +
          `be processed by Send Later.`,
      );
      SLTools.unscheduledMsgCache.add(msgHdr.id);
      return;
    }

    let { preferences } = await messenger.storage.local.get({
      preferences: {},
    });

    if (!preferences.sendWhileOffline && !window.navigator.onLine) {
      SLStatic.debug(
        "Send Later is configured to disable sending while offline. Skipping.",
      );
      return;
    }

    if (!msgUUID) {
      SLStatic.debug(`Message <${originalMsgId}> has no uuid header.`);
      SLTools.unscheduledMsgCache.add(msgHdr.id);
      return;
    }

    if (msgUUID !== preferences.instanceUUID) {
      (skipping ? SLStatic.error : SLStatic.debug)(
        `Message <${originalMsgId}> is scheduled by a ` +
          `different Thunderbird instance.`,
      );
      SLTools.unscheduledMsgCache.add(msgHdr.id);
      return;
    }

    let locked = locker.isLocked(msgHdr, fullMsg);
    if (locked) {
      const msgSubject = msgHdr.subject;
      if (locked === true) {
        if (preferences.optOutResendWarning === true) {
          SLStatic.debug(
            `Encountered previously sent message ` +
              `"${msgSubject}" ${msgLockId}.`,
          );
        } else {
          SLStatic.error(
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
      return;
    }

    if (!skipping && Date.now() < nextSend.getTime()) {
      SLStatic.debug(
        `Message ${msgHdr.id} not due for send until ` +
          `${SLStatic.humanDateTimeFormat(nextSend)}`,
      );
      return;
    }

    const recur = SLStatic.parseRecurSpec(msgRecurSpec);
    const args = msgRecurArgs ? SLStatic.parseArgs(msgRecurArgs) : null;

    // Respect late message blocker
    if (!skipping) {
      // We enforce a maximum grace period of six months even when one isn't
      // specified in the user's preferences, for safety.
      let maxGracePeriod = 60 * 24 * 180; // minutes
      let lateGracePeriod;
      if (preferences.blockLateMessages) {
        lateGracePeriod = Math.min(
          preferences.lateGracePeriod,
          maxGracePeriod,
        );
      } else {
        lateGracePeriod = maxGracePeriod;
      }
      let lateness = (Date.now() - nextSend.getTime()) / 60000;
      if (lateness > lateGracePeriod) {
        SLStatic.warn(`Grace period exceeded for message ${msgHdr.id}`);
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
          units = SLStatic.i18n.getMessage(
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
        return;
      }
    }

    if (preferences.enforceTimeRestrictions) {
      // Respect "until" preference
      if (recur.until) {
        if (SLStatic.compareTimes(Date.now(), ">", recur.until)) {
          (skipping ? SLStatic.error : SLStatic.debug)(
            `Message ${msgHdr.id} ${originalMsgId} past ` +
              `"until" restriction. Skipping.`,
          );
          return;
        }
      }

      // Respect "send between" preference
      if (!skipping && recur.between) {
        if (
          SLStatic.compareTimes(Date.now(), "<", recur.between.start) ||
          SLStatic.compareTimes(Date.now(), ">", recur.between.end)
        ) {
          // Skip message this time, but don't explicitly reschedule it.
          SLStatic.debug(
            `Message ${msgHdr.id} ${originalMsgId} outside of ` +
              `sendable time range. Skipping.`,
            recur.between,
          );
          return;
        }
      }

      // Respect "only on days of week" preference
      if (!skipping && recur.days) {
        const today = new Date().getDay();
        if (!recur.days.includes(today)) {
          // Reschedule for next valid time.
          const start_time = recur.between && recur.between.start;
          const end_time = recur.between && recur.between.end;
          let nextRecurAt = SLStatic.adjustDateForRestrictions(
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
          SLStatic.info(
            `Message ${msgHdr.id} not scheduled to send on ` +
              `${this_wkday.format(new Date())}. Rescheduling ` +
              `for ${nextRecurAt}`,
          );

          let newMsgContent = await messenger.messages.getRaw(msgHdr.id);

          newMsgContent = SLStatic.replaceHeader(
            newMsgContent,
            "X-Send-Later-At",
            SLStatic.parseableDateTimeFormat(nextRecurAt),
            false,
          );

          let success = await SLStatic.tb115(
            async () => {
              let file = SLStatic.getFileFromRaw(newMsgContent);
              return await SLStatic.messageImport(file, msgHdr.folder, {
                new: false,
                read: preferences.markDraftsRead,
              });
            },
            async () => {
              return messenger.SL3U.saveMessage(
                newMsgContent,
                msgHdr.folder,
                preferences.markDraftsRead,
              );
            },
          );

          if (success) {
            SLStatic.debug(
              `Rescheduled message ${originalMsgId}. Deleting original.`,
            );
            await SendLater.deleteMessage(msgHdr);
            return;
          } else {
            SLStatic.error("Unable to schedule next recurrence.");
            return;
          }
        }
      }
    }

    if (!skipping) {
      // Initiate send from draft message
      SLStatic.info(`Sending message ${originalMsgId}.`);

      let localAccount = (await messenger.accounts.list(false)).find(
        (account) => account.type == "none",
      );
      let localFolders = await messenger.folders.getSubFolders(localAccount);
      let outboxFolder = localFolders.find((f) => f.type == "outbox");
      if (!outboxFolder) {
        SLStatic.error("Could not find outbox folder to deliver message");
        return false;
      }
      let content = SLStatic.prepNewMessageHeaders(
        await messenger.messages.getRaw(msgHdr.id),
      );
      let success = await SLStatic.tb115(
        async () => {
          let file = SLStatic.getFileFromRaw(content);
          return await SLStatic.messageImport(file, outboxFolder, {
            new: false,
            read: true,
          });
        },
        async () => {
          return await messenger.SL3U.saveMessage(content, outboxFolder, true);
        },
      );

      if (success) {
        if (preferences.sendUnsentMsgs) {
          setTimeout(messenger.SL3U.queueSendUnsentMessages, 1000);
        }
        await locker.lock(msgHdr, fullMsg, true);
        SLStatic.debug(`Locked message <${msgLockId}> from re-sending.`);
        if (preferences.throttleDelay) {
          SLStatic.debug(
            `Throttling send rate: ${preferences.throttleDelay / 1000}s`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, preferences.throttleDelay),
          );
        }
      } else {
        SLStatic.error(
          `Something went wrong while sending message ${originalMsgId}`,
        );
        return;
      }
      SLStatic.telemetrySend({
        event: "delivery",
        successful: success,
      });
    }

    let nextRecur;
    if (recur.type !== "none") {
      nextRecur = await SLStatic.nextRecurDate(
        nextSend,
        msgRecurSpec,
        new Date(),
        args,
      );
    }

    if (nextRecur) {
      try {
        let nextRecurAt = nextRecur.sendAt;
        let nextRecurSpec = nextRecur.nextspec;
        let nextRecurArgs = nextRecur.nextargs;
        while (nextRecurAt < new Date()) {
          nextRecurAt = new Date(nextRecurAt.getTime() + 60000);
        }
        SLStatic.info(
          `Scheduling next recurrence of message ${originalMsgId}`,
          {
            nextRecurAt,
            nextRecurSpec,
            nextRecurArgs,
          },
        );

        let newMsgContent = await messenger.messages.getRaw(msgHdr.id);

        newMsgContent = SLStatic.replaceHeader(
          newMsgContent,
          "Date",
          SLStatic.parseableDateTimeFormat(Date.now()),
          false /* replaceAll */,
          true /* addIfMissing */,
        );

        newMsgContent = SLStatic.replaceHeader(
          newMsgContent,
          "X-Send-Later-At",
          SLStatic.parseableDateTimeFormat(nextRecurAt),
          false,
        );

        if (typeof nextRecurSpec === "string") {
          newMsgContent = SLStatic.replaceHeader(
            newMsgContent,
            "X-Send-Later-Recur",
            nextRecurSpec,
            false,
            true,
          );
        }

        if (typeof nextRecurArgs === "object") {
          newMsgContent = SLStatic.replaceHeader(
            newMsgContent,
            "X-Send-Later-Args",
            SLStatic.unparseArgs(nextRecurArgs),
            false,
            true,
          );
        }

        // newMsgContent = SLStatic.appendHeader(
        //   newMsgContent,
        //   "References",
        //   originalMsgId
        // );

        // const idkey = (fullMsg.headers["x-identity-key"]||[])[0];
        // const newMessageId = await messenger.SL3U.generateMsgId(idkey);
        // newMsgContent = SLStatic.replaceHeader(
        //   newMsgContent,
        //   "Message-ID",
        //   newMessageId,
        //   false
        // );

        let success = await SLStatic.tb115(
          async () => {
            let file = SLStatic.getFileFromRaw(newMsgContent);
            return await SLStatic.messageImport(file, msgHdr.folder, {
              new: false,
              read: preferences.markDraftsRead,
            });
          },
          async () => {
            return messenger.SL3U.saveMessage(
              newMsgContent,
              msgHdr.folder,
              preferences.markDraftsRead,
            );
          },
        );

        SLStatic.telemetrySend({ event: "scheduleNext", successful: success });
        if (success) {
          SLStatic.info(
            `Scheduled next occurrence of message ` +
              `<${originalMsgId}>. Deleting original.`,
          );
        } else {
          throw new Error("Unable to schedule next recurrence.");
        }
      } catch (ex) {
        await locker.lock(msgHdr, fullMsg, "rescheduling");
        SLStatic.error("Error scheduling next recurrence", ex);
        let title = SLStatic.i18n.getMessage("RescheduleErrorTitle");
        let text = SLStatic.i18n.getMessage("RescheduleErrorText", [
          msgSubject,
        ]);
        SLTools.alert(title, text);
      }
      await SendLater.deleteMessage(msgHdr);
      return true;
    } else if (!skipping) {
      SLStatic.info(
        `No recurrences for message <${originalMsgId}>. Deleting original.`,
      );
      await SendLater.deleteMessage(msgHdr);
      return;
    }
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

    let prefDefaults = await SLStatic.prefDefaults();

    // Pick up any new properties from defaults
    for (let prefName of Object.getOwnPropertyNames(prefDefaults)) {
      if (preferences[prefName] === undefined) {
        const prefValue = prefDefaults[prefName][1];
        SLStatic.info(`Added new preference ${prefName}: ${prefValue}`);
        preferences[prefName] = prefValue;
      }
    }

    if (preferences.instanceUUID) {
      SLStatic.info(`This instance's UUID: ${preferences.instanceUUID}`);
    } else {
      let instance_uuid = SLStatic.generateUUID();
      SLStatic.info(`Generated new UUID: ${instance_uuid}`);
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
        SLStatic.error(
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
    if (waitFor) {
      await waitFor;
    }
    let extName = messenger.i18n.getMessage("extensionName");
    if (nActive == undefined)
      nActive = await SLTools.countActiveScheduledMessages();
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
      if (nActive == undefined)
        nActive = await SLTools.countActiveScheduledMessages();
      enabled = nActive > 0;
    }
    if (!enabled) {
      await messenger.quitter.removeQuitRequestedObserver();
      await messenger.quitter.removeQuitGrantedObserver();
      return;
    }
    let appName = messenger.i18n.getMessage("extensionName");
    let title =
      messenger.i18n.getMessage("scheduledMessagesWarningTitle") +
      " - " +
      appName;
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

    await SLStatic.tb115(false, async () => {
      // Initialize drafts folder column
      await messenger.columnHandler.cachePrefs(preferences);
      await messenger.columnHandler
        .addCustomColumn({
          name: messenger.i18n.getMessage("sendlater3header.label"),
          tooltip: "",
        })
        .catch((ex) => {
          SLStatic.error("columnHandler.addCustomColumn", ex);
        });
      messenger.mailTabs.onDisplayedFolderChanged.addListener(
        SendLater.displayedFolderChangedListener,
      );
      messenger.tabs.onUpdated.addListener(SendLater.tabUpdatedListener);
      // We won't get events for tabs that are already loaded.
      SendLater.configureAllTabs();
    });

    messenger.messages.onNewMailReceived.addListener(
      SendLater.onNewMailReceivedListener,
    );

    // Set custom DB headers preference, if not already set.
    await messenger.SL3U.setCustomDBHeaders([
      "x-send-later-at",
      "x-send-later-recur",
      "x-send-later-args",
      "x-send-later-cancel-on-reply",
      "x-send-later-uuid",
      "content-type",
    ]).catch((ex) => {
      SLStatic.error("SL3U.setCustomDBHeaders", ex);
    });

    // Clear the current message settings cache
    await messenger.storage.local.set({ scheduleCache: {} });

    try {
      await messenger.SL3U.setLogConsoleLevel(preferences.logConsoleLevel);

      let nActive = await SLTools.countActiveScheduledMessages();
      await SendLater.updateStatusIndicator(nActive);
      await SendLater.setQuitNotificationsEnabled(true, preferences, nActive);

      await messenger.browserAction.setLabel({
        label: preferences.showStatus
          ? messenger.i18n.getMessage("sendlater3header.label")
          : "",
      });
    } catch (ex) {
      SLStatic.error(ex);
    }

    // Attach to all existing msgcompose windows
    messenger.SL3U.hijackComposeWindowKeyBindings().catch((ex) => {
      SLStatic.error("SL3U.hijackComposeWindowKeyBindings", ex);
    });

    await SLStatic.tb115(false, () => {
      messenger.SL3U.forceToolbarVisible().catch((ex) => {
        SLStatic.error("SL3U.forceToolbarVisible", ex);
      });
    });

    // This listener should be added *after* all of the storage-related
    // initialization is complete. It ensures that subsequent changes to storage
    // take effect immediately.
    messenger.storage.onChanged.addListener(SendLater.storageChangedListener);

    this.scheduleMenuId = await messenger.menus.create({
      contexts: ["message_list"],
      title: messenger.i18n.getMessage("menuScheduleMsg"),
    });
    this.skipMenuId = await messenger.menus.create({
      contexts: ["message_list"],
      title: messenger.i18n.getMessage("menuSkipMsg"),
    });
    this.menuVisible = true;
    messenger.menus.onClicked.addListener(async (info, tab) => {
      SendLater.menuClickHandler(info, tab);
    });
    messenger.menus.onShown.addListener(async (info, tab) => {
      SendLater.checkMenu(info, tab);
    });

    if (preferences.releaseNotesShow) {
      SLStatic.debug("Checking if release notes should be displayed");
      let slVersionString = messenger.runtime.getManifest().version;
      let slVersion = slVersionString.split(".").map((n) => {
        return parseInt(n);
      });
      let oldVersion = preferences.releaseNotesVersion;
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
        SLStatic.debug("Displaying release notes");
        await SendLater.onRuntimeMessageListenerasync(
          { action: "showReleaseNotes" },
          {},
        );
        preferences.releaseNotesVersion = slVersionString;
        await messenger.storage.local.set({
          preferences,
        });
      } else {
        SLStatic.debug("Release notes display not needed");
      }
    } else {
      SLStatic.debug("Release notes display not wanted");
    }

    if (!preferences.telemetryAsked) {
      await messenger.windows.create({
        url: "ui/telemetry.html",
        type: "popup",
        allowScriptsToClose: true,
      });
    }
  },

  async menuClickHandler(info, tab) {
    SLStatic.trace("SendLater.scheduleSelectedMessages", info, tab);
    let messageIds = info.selectedMessages.messages.map((msg) => msg.id);
    if (!messageIds.length) {
      return;
    }
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
          messageCheckerFull: true,
          batchMode: true,
        },
        null,
        messageIds,
      );
    } else {
      SLStatic.error(`Unrecognized menu item ID ${info.menuItemId}`);
    }
  },

  async checkMenu(info, tab) {
    SLStatic.trace("SendLater.checkScheduleMenu", info, tab);
    let visible = info.displayedFolder.type == "drafts";
    if (SendLater.menuVisible != visible) {
      SLStatic.debug(`Making menu items ${visible ? "" : "in"}visible`);
      for (let menuId of [this.scheduleMenuId, this.skipMenuId]) {
        await messenger.menus.update(menuId, { visible: visible });
      }
      await messenger.menus.refresh();
      SendLater.menuVisible = visible;
    }
  },

  async storageChangedListener(changes, areaName) {
    SLStatic.debug("storageChangedListener");
    if (areaName === "local" && changes.preferences) {
      SLStatic.debug("Propagating changes from local storage");
      const preferences = changes.preferences.newValue;
      if (preferences.checkTimePref) {
        rescheduleDeferred("mainLoop", preferences.checkTimePref * 60000);
      }
      SendLater.prefCache = preferences;
      SLStatic.logConsoleLevel = preferences.logConsoleLevel.toLowerCase();

      await messenger.SL3U.setLogConsoleLevel(SLStatic.logConsoleLevel);
      await SendLater.setQuitNotificationsEnabled(true, preferences);
      await messenger.browserAction.setLabel({
        label: preferences.showStatus
          ? messenger.i18n.getMessage("sendlater3header.label")
          : "",
      });

      await SLStatic.tb115(false, async () => {
        messenger.columnHandler.cachePrefs(preferences);
        // Note: It's possible to immediately obey a preference change if the
        // user has decided to disable the send later column, but when the
        // column is being enabled there isn't a simple way to tell whether
        // we're in a drafts folder, so the user may need to navigate away and
        // back to the folder before their preferences can fully take effect.
        if (!preferences.showColumn) {
          const columnName = messenger.i18n.getMessage(
            "sendlater3header.label",
          );
          messenger.columnHandler.setColumnVisible(columnName, false);
        }
      });
    }
  },

  // The functions in this block are currently only used in tb102, although they
  // may in some form start being used again later when TB once again supports
  // add-ons adding custom columns. In the meantime I'm marking them with tb115(
  // to make them easy to find later when I'm looking for code to remove when
  // we're no longer supporting tb102.
  // tb115(false, ...
  async headerRowUpdateListener(hdr) {
    const preferences = await SLTools.getPrefs();
    let msgParts = await messenger.messages.getFull(hdr.id);
    let hdrs = {
      "content-type": msgParts.contentType,
    };
    for (let hdrName in msgParts.headers) {
      hdrs[hdrName] = msgParts.headers[hdrName][0];
    }
    const { cellText } = SLStatic.customHdrToScheduleInfo(
      hdrs,
      preferences.instanceUUID,
    );
    const visible = preferences.showHeader === true && cellText !== "";
    return { text: cellText, visible };
  },

  async configureAllTabs() {
    SLStatic.debug("SLTABS: configureAllTabs");
    messenger.tabs.query({ mailTab: true, active: true }).then((tabs) => {
      for (let tab of tabs) {
        SLStatic.debug(
          "SLTABS: Calling tabUpdatedListener from configureAllTabs",
        );
        SendLater.tabUpdatedListener(tab.id, {}, tab);
      }
    });
  },

  async tabUpdatedListener(tabId, changeInfo, tab) {
    SLStatic.debug(
      `SLTABS: tabUpdatedListener tab.status=${tab.status} tab.mailTab=${tab.mailTab}`,
    );
    if (tab.status != "complete" || !tab.mailTab) return;
    let tabProperties = await messenger.mailTabs.get(tabId);
    SLStatic.debug(
      `SLTABS: tabProperties.displayedFolder=${tabProperties.displayedFolder}`,
    );
    if (!tabProperties.displayedFolder) return;
    await SendLater.displayedFolderChangedListener(
      tab,
      tabProperties.displayedFolder,
    );
  },

  async displayedFolderChangedListener(tab, folder) {
    SLStatic.debug("SLTABS: displayedFolderChangedListener");
    const preferences = await SLTools.getPrefs();
    let visible =
      preferences.showColumn === true &&
      (await SLTools.isDraftsFolder(folder));
    let columnName = messenger.i18n.getMessage("sendlater3header.label");
    await messenger.columnHandler.setColumnVisible(
      columnName,
      visible,
      tab.windowId,
    );
  },
  // ...) // tb115() end

  // When user opens a new messagecompose window, we need to do several things
  // to ensure that it behaves as they expect. namely, we need to override the
  // window's send and sendlater menu items, we need to ensure the toolbar is
  // visible, and we need to check whether they're editing a previously
  // scheduled draft.
  async onWindowCreatedListener(window) {
    if (window.type != "messageCompose") {
      SLStatic.debug("Not a messageCompose window");
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
    SLStatic.info("Opened new window", window);

    await SLStatic.tb115(false, () => {
      // Ensure that the composeAction button is visible,
      // otherwise the popup action will silently fail.
      messenger.SL3U.forceToolbarVisible(window.id).catch((ex) => {
        SLStatic.error("SL3U.forceToolbarVisible", ex);
      });
    });

    // Bind listeners to overlay components like File>Send,
    // Send Later, and keycodes like Ctrl+enter, etc.
    messenger.SL3U.hijackComposeWindowKeyBindings(window.id).catch((ex) => {
      SLStatic.error("SL3U.hijackComposeWindowKeyBindings", ex);
    });

    let tab = window.tabs[0];
    let cd = await messenger.compose.getComposeDetails(tab.id);
    SLStatic.debug("Opened window with composeDetails", cd);

    // Check if we're editing an existing draft message
    if (cd.type != "draft") {
      SLStatic.debug("Not editing an existing draft");
      return;
    }

    let originalMsg = await messenger.SL3U.findAssociatedDraft(window.id);
    if (originalMsg) {
      let originalMsgPart = await messenger.messages.getFull(originalMsg.id);
      SLTools.scheduledMsgCache.delete(originalMsg.id);
      SLTools.unscheduledMsgCache.add(originalMsg.id);

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

        // Courtesy of https://bugzilla.mozilla.org/show_bug.cgi?id=263114, if
        // the draft we're editing started in a subfolder than TB doesn't
        // delete it automatically. *sigh*
        if (!messages.map((m) => m.id).includes(originalMsg.id)) {
          SendLater.deleteMessage(originalMsg);
        }

        // Pick the message stored in the same folder as the original draft was
        // stored in.
        // let newMsg = messages.find(m => m.folder == originalMsg.folder);
        // The saved message has a different message id then the original one.
        // The new message is not used.
        // console.debug({originalMsg, newMsg});

        await SendLater.updateStatusIndicator();

        // Set popup scheduler defaults based on original message
        scheduleCache[window.id] = SLStatic.parseHeadersForPopupUICache(
          originalMsgPart.headers,
        );
        SLStatic.debug(
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
    SLStatic.info("Opening popup");
    // The onClicked event on the compose action button doesn't fire if a
    // pop-up is configured, so we have to set and open the popup here and
    // then immediately unset the popup so that we can catch the key binding
    // if the user clicks again with a modifier.
    messenger.composeAction.setPopup({ popup: "ui/popup.html" });
    try {
      if (!(await messenger.composeAction.openPopup())) {
        // openPopup doesn't return a status in TB102, so we just have to assume
        // that it opened successfully. *sigh*
        await SLStatic.tb115(async () => {
          SLStatic.info(
            "composeAction pop-up failed to open, trying standalone",
          );
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
            SLStatic.error("standalone scheduling pop-up failed to open");
          }
        });
      }
    } finally {
      messenger.composeAction.setPopup({ popup: null });
    }
  },

  // Custom events that are attached to user actions within
  // composition windows. These events occur when the user activates
  // the built-in send or send later using either key combinations
  // (e.g. ctrl+shift+enter), or click the file menu buttons.
  async onUserCommandKeyListener(keyid) {
    SLStatic.info(`Received keycode ${keyid}`);
    switch (keyid) {
      case "key_altShiftEnter": {
        if (SendLater.prefCache.altBinding) {
          await SendLater.openPopup();
        } else {
          SLStatic.info(
            "Ignoring Alt+Shift+Enter on account of user preferences",
          );
        }
        break;
      }
      case "key_sendLater": {
        // User pressed ctrl+shift+enter
        SLStatic.debug("Received Ctrl+Shift+Enter.");
        if (SendLater.prefCache.altBinding) {
          SLStatic.info(
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
        if (SendLater.prefCache.sendDoesSL) {
          await SendLater.openPopup();
        } else if (SendLater.prefCache.sendDoesDelay) {
          // Schedule with delay.
          const sendDelay = SendLater.prefCache.sendDelay;
          SLStatic.info(
            `Scheduling Send Later ${sendDelay} minutes from now.`,
          );
          let curTab = await SLTools.getActiveComposeTab();
          if (curTab) {
            await SendLater.scheduleSendLater(curTab.id, { delay: sendDelay });
          }
        } else {
          let curTab = await SLTools.getActiveComposeTab();
          if (curTab) {
            await messenger.compose.sendMessage(curTab.id, {
              mode: "sendNow",
            });
          }
        }
        break;
      }
      default: {
        SLStatic.error(`Unrecognized keycode ${keyid}`);
      }
    }
  },

  // Allow other extensions to access local preferences
  onMessageExternalListener(message, sender, sendResponse) {
    switch (message.action) {
      case "getUUID": {
        // Return Promise for the instanceUUID.
        return SLTools.getPrefs()
          .then((preferences) => preferences.instanceUUID)
          .catch((ex) => SLStatic.error(ex));
      }
      case "getPreferences": {
        // Return Promise for the allowed preferences.
        let prefKeysPromise = SLStatic.userPrefKeys(true);
        let prefsPromise = SLTools.getPrefs();
        return Promise.all([prefKeysPromise, prefsPromise])
          .then(([prefKeys, prefs]) => {
            prefs = Object.entries(prefs);
            prefs = prefs.filter(([key, value]) => prefKeys.includes(key));
            prefs = Object.fromEntries(prefs);
            return prefs;
          })
          .catch((ex) => SLStatic.error(ex));
      }
      case "setPreferences": {
        // Return Promise for updating the allowed preferences.
        let prefKeysPromise = SLStatic.userPrefKeys(false);
        let prefsPromise = SLTools.getPrefs();
        return Promise.all([prefKeysPromise, prefsPromise])
          .then(async ([prefKeys, old_prefs]) => {
            let new_prefs = message.preferences;
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
          })
          .catch((ex) => SLStatic.error(ex));
      }
      case "parseDate": {
        SLStatic.trace("onMessageExternalListener.parseDate");
        // Return Promise for the Date. Since this is a sync operation, the
        // Promise is already fulfilled. But it still has to be a Promise, or
        // sendResponse() has to be used instead. Promise syntax is preferred.
        try {
          const date = SLStatic.convertDate(message["value"]);
          if (date) {
            const dateStr = SLStatic.parseableDateTimeFormat(date.getTime());
            return Promise.resolve(dateStr);
          }
        } catch (ex) {
          SLStatic.debug("Unable to parse date/time", ex);
        }
        break;
      }
      default: {
        SLStatic.warn(`Unrecognized operation <${message.action}>.`);
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
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showSkipAlert = false;
          await messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled occurrence skip.`);
          return false;
        }
      }
    }
    // Is this a recurring message?
    let recurHeader = (options.messageFull.headers["x-send-later-recur"] ||
      [])[0];
    let recur = SLStatic.parseRecurSpec(recurHeader);
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
      SLStatic.error(
        `Message ${options.messageId} (${options.messageHeader.subject}) ` +
          `has recur header but no at header?`,
      );
      return false;
    }
    let argsHeader = (options.messageFull.headers["x-send-later-args"] ||
      [])[0];
    let args = argsHeader ? SLStatic.parseArgs(msgRecurArgs) : null;
    let sendAt = new Date(sendAtHeader);
    let now = new Date();
    if (now < sendAt) {
      now = sendAt;
    }
    let nextRecur = await SLStatic.nextRecurDate(
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
    if (tabId || !fromMenuCommand) {
      SLStatic.error("Unsupported doSkipNextOccurrence call from window");
      return false;
    }
    options.skipping = true;
    return await SendLater.possiblySendMessage(options.messageHeader, options);
  },

  async handleMessageCommand(command, options, tabId, messageIds) {
    options.first = true;
    if (messageIds) {
      let total = messageIds.length;
      let successful = 0;
      for (let messageId of messageIds) {
        let message = await messenger.messages.get(messageId);
        let identityId = await findBestIdentity(message);
        options.messageId = messageId;
        options.messageHeader = message;
        if (options.messageChecker) {
          if (options.messageCheckerFull) {
            options.messageFull = await messenger.messages.getFull(messageId);
          }
          if (!(await options.messageChecker(options))) {
            break;
          }
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
          await SendLater.deleteMessage(message);
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
      SLTools.scheduledMsgCache.clear();
      SLTools.unscheduledMsgCache.clear();
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

  // Various extension components communicate with
  // the background script via these runtime messages.
  // e.g. the options page and the scheduler dialog.
  async onRuntimeMessageListenerasync(message, sender) {
    if (sender.tab) {
      // If this tab was associated with a popup, then process
      // its callback and return early. If it was not associated
      // with a popup, then the handlePopupCallback method will
      // return false.
      if (SLTools.handlePopupCallback(sender.tab.id, message)) {
        return;
      }
    }

    const response = {};
    switch (message.action) {
      case "alert": {
        SLTools.alert(message.title, message.text);
        break;
      }
      case "doSendNow": {
        SLStatic.debug("User requested send immediately.");
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
        SLStatic.debug("User requested system send later.");
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
        SLStatic.debug("User requested send later.");
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
          const recur = SLStatic.parseRecurSpec(recurSpec);
          recur.cancelOnReply = ["true", "yes"].includes(msgCancelOnReply);
          recur.args = msgArgs;
          response.scheduleTxt = SLStatic.formatScheduleForUI(
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
            if (SLTools.unscheduledMsgCache.has(draftHdr.id)) {
              SLStatic.debug(
                "Ignoring unscheduled message",
                draftHdr.id,
                draftHdr,
              );
              return null;
            }
            return await messenger.messages
              .getFull(draftHdr.id)
              .then((draftMsg) => {
                function getHeader(name) {
                  return (draftMsg.headers[name] || [])[0];
                }
                if (getHeader("x-send-later-at")) {
                  SLTools.scheduledMsgCache.add(draftHdr.id);
                  return {
                    sendAt: getHeader("x-send-later-at"),
                    recur: getHeader("x-send-later-recur"),
                    args: getHeader("x-send-later-args"),
                    cancel: getHeader("x-send-later-cancel-on-reply"),
                    subject: draftHdr.subject,
                    recipients: draftHdr.recipients,
                  };
                } else {
                  SLTools.unscheduledMsgCache.add(draftHdr.id);
                  SLTools.scheduledMsgCache.delete(draftHdr.id);
                  return null;
                }
              });
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
        messenger.windows.openDefaultBrowser(
          "https://extended-thunder.github.io/send-later/",
        );
        break;
      }
      case "showReleaseNotes": {
        let locale = SLStatic.i18n.getUILanguage();
        let url = SLStatic.translationURL(
          "https://extended-thunder.github.io/send-later/release-notes",
        );
        messenger.tabs.create({ url });
        break;
      }
      case "contactAuthor": {
        messenger.windows.openDefaultBrowser(
          "https://github.com/Extended-Thunder/send-later/discussions/278",
        );
        break;
      }
      case "donateLink": {
        messenger.windows.openDefaultBrowser(
          "https://extended-thunder.github.io/send-later/#support-send-later",
        );
        break;
      }
      default: {
        SLStatic.warn(`Unrecognized operation <${message.action}>.`);
      }
    }
    SLStatic.debug(`${message.action} action:`, response);
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
      SLStatic.debug(
        `Skipping onNewMailReceived for folder type ${folder.type}`,
      );
      return;
    }
    SLStatic.debug("Received messages in folder", folder, ":", messagelist);

    for (let rcvdHdr of messagelist.messages) {
      let rcvdMsg = await messenger.messages.getFull(rcvdHdr.id);
      SLStatic.debug("Got message", rcvdHdr, rcvdMsg);
      let inReplyTo = (rcvdMsg.headers["in-reply-to"] || [])[0];
      if (inReplyTo) {
        await SLTools.forAllDrafts(async (draftHdr) => {
          if (!SLTools.unscheduledMsgCache.has(draftHdr.id)) {
            SLStatic.debug(
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
                SLStatic.info(
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
    if (!hdr) {
      // No, this shouldn't happen, but it does. It looks like this happens
      // if Thunderbird is in the process of displaying a message when the
      // user switches to a different folder.
      return;
    }
    // TODO currently only display the Send Later header on messages in the
    // 3pane window. It would be nice to also display it when a draft is
    // opened in a separate tab or window.
    let headerName = messenger.i18n.getMessage("sendlater3header.label");
    await messenger.messageDisplayAction.disable(tab.id);
    if (await SLTools.isDraftsFolder(hdr.folder)) {
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
      const { cellText } = SLStatic.customHdrToScheduleInfo(
        hdrs,
        instanceUUID,
      );
      if (preferences.showHeader === true && cellText !== "") {
        await messenger.headerView
          .addCustomHdrRow(tab.id, headerName, cellText)
          .catch((ex) => {
            SLStatic.error("headerView.addCustomHdrRow", ex);
          });
      } else {
        await messenger.headerView.removeCustomHdrRow(tab.id, headerName);
      }

      let msg = await messenger.messages.getFull(hdr.id);
      if (msg.headers["x-send-later-uuid"] == instanceUUID) {
        await messenger.messageDisplayAction.enable(tab.id);
      }
    } else {
      await messenger.headerView.removeCustomHdrRow(tab.id, headerName);
    }
  },

  // Global key shortcuts (defined in manifest) are handled here.
  async onCommandListener(cmd) {
    const cmdId = /send-later-shortcut-([123])/.exec(cmd)[1];

    if (["1", "2", "3"].includes(cmdId)) {
      const preferences = await SLTools.getPrefs();
      const funcName = preferences[`quickOptions${cmdId}funcselect`];
      const funcArgs = preferences[`quickOptions${cmdId}Args`];
      SLStatic.info(`Executing shortcut ${cmdId}: ${funcName}(${funcArgs})`);
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
      SLStatic.info(
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
    SLStatic.warn("Disabling Send Later.");
    await SLStatic.nofail(clearDeferred, "mainLoop");
    await SLStatic.nofail(SendLater.setQuitNotificationsEnabled, false);
    await SLStatic.nofail(messenger.browserAction.disable);
    await SLStatic.nofail(messenger.browserAction.setTitle, {
      title:
        `${messenger.i18n.getMessage("extensionName")} ` +
        `[${messenger.i18n.getMessage("DisabledMessage")}]`,
    });
    await SLStatic.nofail(messenger.browserAction.setBadgeText, {
      text: null,
    });
    await SLStatic.nofail(messenger.composeAction.disable);
    await SLStatic.nofail(messenger.messageDisplayAction.disable);
    await SLStatic.nofail(messenger.messageDisplayAction.setPopup, {
      popup: null,
    });
    await SLStatic.nofail(
      messenger.alarms.onAlarm.removeListener,
      alarmsListener,
    );
    await SLStatic.nofail(
      messenger.windows.onCreated.removeListener,
      SendLater.onWindowCreatedListener,
    );
    await SLStatic.nofail(
      messenger.SL3U.onKeyCode.removeListener,
      SendLater.onUserCommandKeyListener,
    );
    await SLStatic.nofail(
      messenger.runtime.onMessageExternal.removeListener,
      SendLater.onMessageExternalListener,
    );
    await SLStatic.nofail(
      messenger.runtime.onMessage.removeListener,
      SendLater.onRuntimeMessageListenerasync,
    );
    await SLStatic.nofail(
      messenger.messages.onNewMailReceived.removeListener,
      SendLater.onNewMailReceivedListener,
    );
    await SLStatic.nofail(
      messenger.messageDisplay.onMessageDisplayed.removeListener,
      SendLater.onMessageDisplayedListener,
    );
    await SLStatic.nofail(
      messenger.commands.onCommand.removeListener,
      SendLater.onCommandListener,
    );
    await SLStatic.nofail(
      messenger.composeAction.onClicked.removeListener,
      SendLater.clickComposeListener,
    );
    await SLStatic.nofail(
      messenger.mailTabs.onDisplayedFolderChanged.removeListener,
      SendLater.displayedFolderChangedListener,
    );
    await SLStatic.nofail(
      messenger.storage.onChanged.removeListener,
      SendLater.storageChangedListener,
    );
    SLStatic.warn("Disabled.");
  },
}; // End SendLater object

async function mainLoop() {
  SLStatic.debug("Entering main loop.");

  try {
    clearDeferred("mainLoop");
  } catch (ex) {
    SLStatic.error(ex);
  }

  try {
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

      let doSequential = preferences.throttleDelay > 0;

      try {
        if (preferences.sendDrafts) {
          let locker = await new Locker();
          await SLTools.forAllDrafts(
            (message) => SendLater.possiblySendMessage(message, {}, locker),
            doSequential,
            undefined,
            preferences,
          );
        }
        let nActive = await SLTools.countActiveScheduledMessages();
        // noawait (indeterminatee, see above)
        SendLater.updateStatusIndicator(
          nActive,
          Promise.all([enablePromise, titlePromise]),
        );
        await SendLater.setQuitNotificationsEnabled(
          true,
          preferences,
          nActive,
        );

        setDeferred("mainLoop", 60000 * interval, mainLoop);
        SLStatic.debug(
          `Next main loop iteration in ${60 * interval} seconds.`,
        );
      } catch (err) {
        SLStatic.error(err);
        let nActive = await SLTools.countActiveScheduledMessages();
        await SendLater.updateStatusIndicator(nActive);
        await SendLater.setQuitNotificationsEnabled(
          true,
          preferences,
          nActive,
        );

        setDeferred("mainLoop", 60000, mainLoop);
        SLStatic.debug(`Next main loop iteration in 1 minute.`);
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
      SLStatic.debug(`Next main loop iteration in 1 minute.`);
    }
  } catch (ex) {
    SLStatic.error(ex);

    setDeferred("mainLoop", 60000, mainLoop);
    SLStatic.debug(`Next main loop iteration in 1 minute.`);
  }
}

let deferredObjects = {};

function alarmsListener(alarm, checking) {
  SLStatic.debug(`alarmsListener: alarm=${alarm.name}, checking=${checking}`);
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
    SLStatic.debug(`alarms.Listener: triggered ${alarm.name}`);
    deferredObjects[alarm.name].triggered = true;
    func();
  } else {
    SLStatic.debug(`alarmsListener: ${alarm.name} already triggered`);
  }
}

function setDeferred(name, timeout, func) {
  SLStatic.debug(`setDeferred(${name}, ${timeout})`);
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
        SLStatic.debug(`setDeferred timeout callback for ${name}`);
        response.triggered = true;
        func();
      } else {
        SLStatic.debug(`setDeferred timeout ${name} already triggered`);
      }
    }, timeout);
  }
  messenger.alarms.create(name, { delayInMinutes: timeout / 1000 / 60 });
  deferredObjects[name] = response;
  SLStatic.debug(`setDeferred(${name}) success`);
}

async function rescheduleDeferred(name, timeout) {
  // If the specified alarm is currently scheduled, recalculate when it should
  // be scheduled for based on the specified new timeout and reschedule as
  // needed.
  let deferred = deferredObjects[name];
  if (!deferred) {
    SLStatic.debug(`rescheduleDeferred: unrecognized time ${name}`);
    return;
  }
  if (deferred.triggered) {
    SLStatic.debug(`rescheduleDeferred: ${name} already triggered`);
    return;
  }
  if (timeout == deferred.timeout) {
    SLStatic.debug(`rescheduleDeferred: ${name} no change`);
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
  SLStatic.debug(
    `rescheduleDeferred moved ${name} to ${new Date(now.getTime() + msLeft)}`,
  );
}

async function clearDeferred(name) {
  SLStatic.debug(`clearDeferred(${name})`);
  let deferredObj = deferredObjects[name];
  if (!deferredObj) {
    SLStatic.debug("clearDeferred: no timer to clear");
    return;
  }
  deferredObj.triggered = true;
  clearTimeout(deferredObj.timeoutId);
  await messenger.alarms.clear(deferredObj.name);
}

async function findBestIdentity(message) {
  // First try to find the author of the message in the account associated
  // with the folder it's in. If that fails, save the default identity for
  // that account and try to find the author in the identities of all other
  // accounts. If that fails, return the default identity of the account
  // associated with the folder.
  let author = message.author;
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
    console.error("Error initializing Send Later", err);
    SendLater.disable();
  });
