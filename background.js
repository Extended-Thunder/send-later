// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
    prefCache: {},

    // The user should be alerted about messages which are
    // beyond their late grace period once per session.
    warnedAboutLateMessageBlocked: new Set(),

    // Track the status of Send Later's main loop. This helps
    // resolve sub-minute accuracy for very short scheduled times
    // (e.g. "Send in 38 seconds" ...). Only affects UI
    // elements in which a relative time is displayed.
    previousLoop: new Date(Math.floor(Date.now()/60000)*60000),
    loopMinutes: 1,

    // Holds a reference to the main loop interval timeout
    // (created via setTimeout(...) in mainLoop())
    loopTimeout: null,

    // Cause current compose window to send immediately
    // (after some pre-send checks)
    async doSendNow(tabId) {
      let preferences = await SLTools.getPrefs();
      if (preferences.showSendNowAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("SendNowConfirmMessage"),
          messenger.i18n.getMessage("ConfirmAgain"),
          true
        ).catch((err) => {
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showSendNowAlert = false;
          messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled send now.`);
          return;
        }
      }
      messenger.compose.sendMessage(tabId, {mode: "sendNow"});
    },

    // Use built-in send later function (after some pre-send checks)
    async doPlaceInOutbox(tabId) {
      let preferences = await SLTools.getPrefs();
      if (preferences.showOutboxAlert) {
        const result = await SLTools.confirmCheck(
          messenger.i18n.getMessage("AreYouSure"),
          messenger.i18n.getMessage("OutboxConfirmMessage"),
          messenger.i18n.getMessage("ConfirmAgain"),
          true
        ).catch((err) => {
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showOutboxAlert = false;
          messenger.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled send later.`);
          return;
        }
      }
      messenger.compose.sendMessage(tabId, {mode: "sendLater"});
    },

    // Sends composed message according to user function (specified
    // by name), and arguments (specified as an "unparsed" string).
    async quickSendWithUfunc(funcName, funcArgs, tabId) {
      tabId = tabId || (await SLTools.getActiveComposeTab());

      if (tabId) {
        let { ufuncs } = await messenger.storage.local.get({ ufuncs: {} });
        let funcBody = ufuncs[funcName].body;
        let schedule = SLStatic.parseUfuncToSchedule(funcName, funcBody, null, funcArgs);
        let options = { sendAt: schedule.sendAt,
                        recurSpec: SLStatic.unparseRecurSpec(schedule.recur),
                        args: schedule.recur.args,
                        cancelOnReply: false };
        SendLater.scheduleSendLater(tabId, options);
      }
    },

    // Go through the process of handling pre-send checks, assigning custom
    // header fields, and saving the message to Drafts.
    async scheduleSendLater(tabId, options) {
      let now = new Date();
      SLStatic.debug(`Pre-send check initiated at ${now}`);
      let check = await messenger.SL3U.GenericPreSendCheck();
      if (!check) {
        SLStatic.warn(`Canceled via pre-send checks (check initiated at ${now})`);
        return;
      }

      const preferences = await SLTools.getPrefs();

      SLStatic.info(`Scheduling send later: ${tabId} with options`, options);

      // Expand mailing lists into individual recipients
      await SLTools.expandRecipients(tabId);

      let customHeaders = [
        {name: "X-Send-Later-Uuid", value: preferences.instanceUUID}
      ];

      // Determine time at which this message should be sent
      if (options.sendAt !== undefined) {
        const sendAt = new Date(options.sendAt);
        customHeaders.push(
          {name: "X-Send-Later-At", value: SLStatic.parseableDateTimeFormat(sendAt)}
        );
      } else if (options.delay !== undefined) {
        const sendAt = new Date(Date.now() + options.delay*60000);
        customHeaders.push(
          {name: "X-Send-Later-At", value: SLStatic.parseableDateTimeFormat(sendAt)}
        );
      } else {
        SLStatic.error("scheduleSendLater requires scheduling information");
        return;
      }

      if (options.recurSpec) {
        customHeaders.push(
          {name: "X-Send-Later-Recur", value: options.recurSpec}
        );
        if (options.cancelOnReply) {
          customHeaders.push(
            {name: "X-Send-Later-Cancel-On-Reply", value: "yes"}
          );
        }
      }

      if (options.args) {
        customHeaders.push(
          {name: "X-Send-Later-Args", value: options.args}
        );
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
      let saveProperties = await messenger.compose.saveMessage(
        tabId, { mode: "draft" }
      );
      if (saveProperties.messages.length != 1) {
        // Depending on FCC header, the saveMessage method may
        // save more than one copy of the message.
        // TODO: Look into whether this could be a problem for
        // SendLater (possibility for duplicates?)
        SLStatic.error(
          `Saved ${saveProperties.messages.length} messages.`
        )
      }

      // Close the composition tab
      await messenger.tabs.remove(tabId);

      // Optionally mark the saved message as "read"
      if (preferences.markDraftsRead) {
        for (let msg of saveProperties.messages) {
          messenger.messages.update(msg.id, { read: true })
        }
      }

      // If message was a reply or forward, update the original message
      // to show that it has been replied to or forwarded.
      if (composeDetails.relatedMessageId) {
        if (composeDetails.type == "reply") {
          console.debug("This is a reply message. Setting original 'replied'");
          messenger.SL3U.setDispositionState(
            composeDetails.relatedMessageId, "replied"
          );
        } else if (composeDetails.type == "forward") {
          console.debug("This is a fwd message. Setting original 'forwarded'");
          messenger.SL3U.setDispositionState(
            composeDetails.relatedMessageId, "forwarded"
          );
        }
      }

      SendLater.updateStatusIndicator();
    },

    // Given a MessageHeader object, identify whether the message is
    // scheduled, and due to be sent. If so, make sure it qualifies for
    // sending (not encrypted, not sent previously, not past the late
    // message limit), and then send it. If it was a recurring message,
    // handle rescheduling its next recurrence, otherwise just delete
    // the draft copy.
    // TODO: Break this up into more manageable parts. This function is
    // ridiculously long.
    async possiblySendMessage(msgHdr) {
      // Determines whether or not a particular draft message is due to be sent
      SLStatic.debug(`Checking message ${msgHdr.id}.`);
      const fullMsg = await messenger.messages.getFull(msgHdr.id);

      if (!fullMsg.headers.hasOwnProperty("x-send-later-at")) {
        return;
      }

      const originalMsgId = msgHdr.headerMessageId;
      const contentType = fullMsg.contentType;
      const msgSendAt = (fullMsg.headers["x-send-later-at"]||[])[0];
      const msgUUID = (fullMsg.headers["x-send-later-uuid"]||[])[0];
      const msgRecurSpec = (fullMsg.headers["x-send-later-recur"]||[])[0];
      const msgRecurArgs = (fullMsg.headers["x-send-later-args"]||[])[0];
      const msgLockId = `${originalMsgId}/${msgHdr.date}`;

      const nextSend = new Date(msgSendAt);

      if ((/encrypted/i).test(contentType)) {
        SLStatic.debug(`Message ${originalMsgId} is encrypted, and will not be processed by Send Later.`);
        return;
      }

      let { preferences, lock } = await messenger.storage.local.get({
        preferences: {}, lock: {}
      });

      if (!preferences.sendWhileOffline && !window.navigator.onLine) {
        SLStatic.debug(`Send Later is configured to disable sending while offline. Skipping.`);
        return;
      }

      if (!msgUUID) {
        SLStatic.debug(`Message <${originalMsgId}> has no uuid header.`);
        return;
      }

      if (msgUUID !== preferences.instanceUUID) {
        SLStatic.debug(`Message <${originalMsgId}> is scheduled by a different Thunderbird isntance.`);
        return;
      }

      if (lock[msgLockId]) {
        const msgSubject = msgHdr.subject;
        if (preferences.optOutResendWarning === true) {
          SLStatic.debug(`Encountered previously sent message "${msgSubject}" ${msgLockId}.`);
        } else {
          SLStatic.error(`Attempted to resend message "${msgSubject}" ${msgLockId}.`);
          const result = await SLTools.alertCheck(
            null,
            messenger.i18n.getMessage("CorruptFolderError", [msgHdr.folder.path]) + "\n\n" +
              messenger.i18n.getMessage("CorruptFolderErrorDetails", [msgSubject, originalMsgId]),
            null,
            true
          );
          preferences.optOutResendWarning = (result.check === false);
          await messenger.storage.local.set({ preferences });
        }
        return;
      }

      if (!(Date.now() >= nextSend.getTime())) {
        SLStatic.debug(`Message ${msgHdr.id} not due for send until ${SLStatic.humanDateTimeFormat(nextSend)}`);
        return;
      }

      const recur = SLStatic.parseRecurSpec(msgRecurSpec);
      const args = msgRecurArgs ? SLStatic.parseArgs(msgRecurArgs) : null;

      // Respect late message blocker
      if (preferences.blockLateMessages) {
        const lateness = (Date.now() - nextSend.getTime()) / 60000;
        if (lateness > preferences.lateGracePeriod) {
          SLStatic.warn(`Grace period exceeded for message ${msgHdr.id}`);
          if (!SendLater.warnedAboutLateMessageBlocked.has(originalMsgId)) {
            const msgSubject = msgHdr.subject;
            const warningMsg = messenger.i18n.getMessage(
              "BlockedLateMessage",
              [msgSubject, msgHdr.folder.path, preferences.lateGracePeriod]
            );
            const warningTitle = messenger.i18n.getMessage("ScheduledMessagesWarningTitle");
            SendLater.warnedAboutLateMessageBlocked.add(originalMsgId);
            SLTools.alert(warningTitle, warningMsg)
          }
          return;
        }
      }

      if (preferences.enforceTimeRestrictions) {
        // Respect "until" preference
        if (recur.until) {
          if (SLStatic.compareTimes(Date.now(), '>', recur.until)) {
            SLStatic.debug(
              `Message ${msgHdr.id} ${originalMsgId} past "until" restriction. Skipping.`
            );
            return;
          }
        }

        // Respect "send between" preference
        if (recur.between) {
          if (SLStatic.compareTimes(Date.now(), '<', recur.between.start) ||
              SLStatic.compareTimes(Date.now(), '>', recur.between.end)) {
            // Skip message this time, but don't explicitly reschedule it.
            SLStatic.debug(
              `Message ${msgHdr.id} ${originalMsgId} outside of sendable time range. Skipping.`,
              recur.between
            );
            return;
          }
        }

        // Respect "only on days of week" preference
        if (recur.days) {
          const today = (new Date()).getDay();
          if (!recur.days.includes(today)) {
            // Reschedule for next valid time.
            const start_time = recur.between && recur.between.start;
            const end_time = recur.between && recur.between.end;
            let nextRecurAt = SLStatic.adjustDateForRestrictions(
              new Date(), start_time, end_time, recur.days, false
            );
            while (nextRecurAt < (new Date())) {
              nextRecurAt = new Date(nextRecurAt.getTime() + 60000);
            }

            const this_wkday = new Intl.DateTimeFormat('default', {weekday:'long'});
            SLStatic.info(`Message ${msgHdr.id} not scheduled to send on ` +
              `${this_wkday.format(new Date())}. Rescheduling for ${nextRecurAt}`);

            let newMsgContent = await messenger.messages.getRaw();

            newMsgContent = SLStatic.replaceHeader(
              newMsgContent,
              "X-Send-Later-At",
              SLStatic.parseableDateTimeFormat(nextRecurAt),
              false
            );

            const success = await messenger.SL3U.saveMessage(
              msgHdr.folder.accountId,
              msgHdr.folder.path,
              newMsgContent
            );

            if (success) {
              SLStatic.debug(`Rescheduled message ${originalMsgId}. Deleting original.`);
              messenger.messages.delete([msgHdr.id], true).then(() => {
                SLStatic.info("Deleted message", msgHdr.id);
              }).catch(SLStatic.error);;
              return;
            } else {
              SLStatic.error("Unable to schedule next recuurrence.");
              return;
            }
          }
        }
      }

      // Initiate send from draft message
      SLStatic.info(`Sending message ${originalMsgId}.`);

      const success = await messenger.SL3U.sendRaw(
        SLStatic.prepNewMessageHeaders(
          await messenger.messages.getRaw(msgHdr.id)
        ),
        preferences.sendUnsentMsgs
      ).catch((ex) => {
        SLStatic.error(`Error sending raw message from drafts`, ex);
        return null;
      });

      if (success) {
        lock[msgLockId] = true;
        messenger.storage.local.set({ lock }).then(() => {
          SLStatic.debug(`Locked message <${msgLockId}> from re-sending.`);
        });
        if (preferences.throttleDelay) {
          SLStatic.debug(`Throttling send rate: ${preferences.throttleDelay/1000}s`);
          await new Promise(resolve =>
            setTimeout(resolve, preferences.throttleDelay)
          );
        }
      } else {
        SLStatic.error(`Something went wrong while sending message ${originalMsgId}`);
        return;
      }

      let nextRecur;
      if (recur.type !== "none") {
        nextRecur = await SLStatic.nextRecurDate(
          nextSend,
          msgRecurSpec,
          new Date(),
          args
        );
      }

      if (nextRecur) {
        let nextRecurAt, nextRecurSpec, nextRecurArgs;
        if (nextRecur.getTime) {
          nextRecurAt = nextRecur;
        } else {
          nextRecurAt = nextRecur.sendAt;
          nextRecurSpec = nextRecur.nextspec;
          nextRecurArgs = nextRecur.nextargs;
        }
        while (nextRecurAt < (new Date())) {
          nextRecurAt = new Date(nextRecurAt.getTime() + 60000);
        }
        SLStatic.info(`Scheduling next recurrence of message ${originalMsgId}`,
          {nextRecurAt, nextRecurSpec, nextRecurArgs});

        let newMsgContent = await messenger.messages.getRaw(msgHdr.id);

        newMsgContent = SLStatic.replaceHeader(
          newMsgContent,
          "Date",
          SLStatic.parseableDateTimeFormat(Date.now()),
          false, /* replaceAll */
          true /* addIfMissing */
        );

        newMsgContent = SLStatic.replaceHeader(
          newMsgContent,
          "X-Send-Later-At",
          SLStatic.parseableDateTimeFormat(nextRecurAt),
          false
        );

        if (typeof nextRecurSpec === "string") {
          newMsgContent = SLStatic.replaceHeader(
            newMsgContent,
            "X-Send-Later-Recur",
            nextRecurSpec,
            false,
            true
          );
        }

        if (typeof nextRecurArgs === "object") {
          newMsgContent = SLStatic.replaceHeader(
            newMsgContent,
            "X-Send-Later-Args",
            SLStatic.unparseArgs(nextRecurArgs),
            false,
            true
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

        const success = await messenger.SL3U.saveMessage(
          msgHdr.folder.accountId,
          msgHdr.folder.path,
          newMsgContent
        );

        if (success) {
          SLStatic.info(`Scheduled next occurrence of message ` +
            `<${originalMsgId}>. Deleting original.`);
          messenger.messages.delete([msgHdr.id], true).then(() => {
            SLStatic.info("Deleted message", msgHdr.id);
          }).catch(SLStatic.error);;
          return;
        } else {
          SLStatic.error("Unable to schedule next recuurrence.");
        }
      } else {
        SLStatic.info(
          `No recurrences for message <${originalMsgId}>. Deleting original.`
        );
        messenger.messages.delete([msgHdr.id], true).then(() => {
          SLStatic.info("Deleted message", msgHdr.id);
        }).catch(SLStatic.error);
        return;
      }
    },

    async migratePreferences() {
      // Migrate legacy preferences to local storage.
      let { preferences, ufuncs } = await messenger.storage.local.get(
        { preferences: {}, ufuncs: {} }
      );
      const currentMigrationNumber = preferences.migratedLegacy|0;

      if (currentMigrationNumber === SLStatic.CURRENT_LEGACY_MIGRATION) {
        SLStatic.logConsoleLevel = (preferences.logConsoleLevel||"info").toLowerCase();
        return currentMigrationNumber;
      }

      // (Re-)load the built-in user functions
      ufuncs.ReadMeFirst = {
        help: messenger.i18n.getMessage("EditorReadMeHelp"),
        body: messenger.i18n.getMessage("EditorReadMeCode"),
      };
      ufuncs.BusinessHours = {
        help: messenger.i18n.getMessage("BusinessHoursHelp"),
        body: messenger.i18n.getMessage("_BusinessHoursCode"),
      };
      ufuncs.DaysInARow = {
        help: messenger.i18n.getMessage("DaysInARowHelp"),
        body: messenger.i18n.getMessage("DaysInARowCode"),
      };
      ufuncs.Delay = {
        help: messenger.i18n.getMessage("DelayFunctionHelp"),
        body: "next = new Date(Date.now() + args[0]*60000);",
      };

      const prefDefaults = await fetch(
        "/utils/defaultPrefs.json"
      ).then((ptxt) => ptxt.json());

      // Load legacy preferences
      if (currentMigrationNumber === 0) {
        // Merge any existing legacy preferences into the new storage system
        let prefKeys = [];
        let legacyValuePromises = [];

        // Load values from legacy storage, substitute defaults if not defined.
        for (let prefName of Object.getOwnPropertyNames(prefDefaults)) {
          prefKeys.push(prefName);
          let dtype = prefDefaults[prefName][0];
          let defVal = prefDefaults[prefName][1];
          let legacyKey = prefDefaults[prefName][2];
          let pp; // Promise that resolves to this preference value.
          const isquickopt = prefName.match(/quickOptions(\d)Label/);
          if (isquickopt) {
            const delayMins = (+prefDefaults[`quickOptions${isquickopt[1]}Args`][1])|0;
            const localizedDelayLabel =
              `${(new Sugar.Date(Date.now() + 60000 * delayMins)).relative()}`;
            pp = new Promise((resolve, reject) => {
              resolve(localizedDelayLabel)
            });
          } else if (legacyKey === null) {
            pp = new Promise((resolve, reject) => resolve(defVal));
          } else {
            pp = messenger.SL3U.getLegacyPref(
              legacyKey,
              dtype,
              defVal.toString()
            );
          }
          legacyValuePromises.push(pp);
        }
        // Combine keys and legacy/default values back into a single object.
        let legacyPrefs = await Promise.all(legacyValuePromises).then(
          (legacyVals) => {
            return legacyVals.reduce((r, f, i) => {
              r[prefKeys[i]] = f;
              return r;
            }, {});
          }
        );

        SLStatic.info("SendLater: migrating legacy/default preferences.");

        // Merge legacy preferences into undefined preference keys
        prefKeys.forEach((key) => {
          if (preferences[key] === undefined) {
            preferences[key] = legacyPrefs[key];
          }
        });
      }

      SLStatic.logConsoleLevel = (preferences.logConsoleLevel||"info").toLowerCase();
      SLStatic.customizeDateTime = (preferences.customizeDateTime === true);
      SLStatic.longDateTimeFormat = preferences.longDateTimeFormat;
      SLStatic.shortDateTimeFormat = preferences.shortDateTimeFormat;

      // Pick up any new properties from defaults
      for (let prefName of Object.getOwnPropertyNames(prefDefaults)) {
        if (preferences[prefName] === undefined) {
          const prefValue = prefDefaults[prefName][1];
          SLStatic.info(`Added new preference ${prefName}: ${prefValue}`);
          preferences[prefName] = prefValue;
        }
      }

      //if (currentMigrationNumber < 4)
      if (preferences.instanceUUID) {
        SLStatic.info(`This instance's UUID: ${preferences.instanceUUID}`);
      } else {
        let instance_uuid = await messenger.SL3U.getLegacyPref(
          "instance.uuid", "string", "");
        if (instance_uuid) {
          SLStatic.info(`Using migrated UUID: ${instance_uuid}`);
        } else {
          instance_uuid = SLStatic.generateUUID();
          SLStatic.info(`Generated new UUID: ${instance_uuid}`);
        }
        preferences.instanceUUID = instance_uuid;
        messenger.SL3U.setLegacyPref("instance.uuid", "string", instance_uuid);
      }

      if (currentMigrationNumber < SLStatic.CURRENT_LEGACY_MIGRATION) {
        preferences.migratedLegacy = SLStatic.CURRENT_LEGACY_MIGRATION;
      }

      if (preferences.migratedLegacy !== SLStatic.CURRENT_LEGACY_MIGRATION) {
        SLStatic.error("Something has gone wrong with migrating preferences. " +
                      "The migration number is currently set to an " +
                      "invalid value:", preferences.migratedLegacy);
      }

      await messenger.storage.local.set({ preferences, ufuncs });

      return currentMigrationNumber;
    },

    async updateStatusIndicator() {
      let extName = messenger.i18n.getMessage("extensionName");
      let nActive = await SLTools.countActiveScheduledMessages();
      if (nActive) {
        messenger.browserAction.setTitle({title: (
          `${extName} [${messenger.i18n.getMessage("PendingMessage", [nActive])}]`
        )});
        messenger.browserAction.setBadgeText({text: String(nActive)});
      } else {
        messenger.browserAction.setTitle({title: (
          `${extName} [${messenger.i18n.getMessage("IdleMessage")}]`
        )});
        messenger.browserAction.setBadgeText({text: null});
      }
    },

    async setQuitNotificationsEnabled(enabled) {
      SLStatic.debug(`Setting quit notifications: ${enabled ? "on" : "off"}`);
      if (enabled) {
        let nActive = await SLTools.countActiveScheduledMessages();
        if (nActive > 0) {
          let appName = messenger.i18n.getMessage("extensionName");
          let title = messenger.i18n.getMessage("scheduledMessagesWarningTitle") + " - " + appName;
          let requestWarning = messenger.i18n.getMessage("scheduledMessagesWarningQuitRequested", appName);
          let grantedWarning = messenger.i18n.getMessage("ScheduledMessagesWarningQuit", appName);
          messenger.quitter.setQuitRequestedAlert(title, requestWarning);
          messenger.quitter.setQuitGrantedAlert(title, grantedWarning);
          return;
        }
      }
      messenger.quitter.removeQuitRequestedObserver();
      messenger.quitter.removeQuitGrantedObserver();
    },

    async init() {
      SLTools.printVersionInfo();

      // Set custom DB headers preference, if not already set.
      await messenger.SL3U.setCustomDBHeaders([
        "x-send-later-at", "x-send-later-recur", "x-send-later-args",
        "x-send-later-cancel-on-reply", "x-send-later-uuid", "content-type"
      ]);

      // Before preferences are available, let's set logging
      // to the default level.
      SLStatic.logConsoleLevel = "info";

      // Clear the current message settings cache
      messenger.storage.local.set({ scheduleCache: {} });

      // Perform any pending preference migrations.
      await this.migratePreferences();

      SLTools.getPrefs().then((preferences) => {
        SendLater.prefCache = preferences;
        SLStatic.logConsoleLevel = preferences.logConsoleLevel.toLowerCase();
        SLStatic.customizeDateTime = (preferences.customizeDateTime === true);
        SLStatic.longDateTimeFormat = preferences.longDateTimeFormat;
        SLStatic.shortDateTimeFormat = preferences.shortDateTimeFormat;
        messenger.SL3U.setLogConsoleLevel(SLStatic.logConsoleLevel);

        for (let pref of [
          "customizeDateTime", "longDateTimeFormat", "shortDateTimeFormat", "instanceUUID"
        ]) {
          messenger.columnHandler.setPreference(pref, preferences[pref]);
        }

        SendLater.setQuitNotificationsEnabled(preferences.askQuit);

        messenger.browserAction.setLabel({label: (
          preferences.showStatus ? messenger.i18n.getMessage("sendlater3header.label") : ""
        )});
      }).catch(ex => SLStatic.error(ex));

      // Initialize drafts folder column
      await messenger.columnHandler.addCustomColumn({
        name: messenger.i18n.getMessage("sendlater3header.label"),
        tooltip: "",
      });

      // Initialize expanded header row
      await messenger.headerView.addCustomHdrRow({
        name: messenger.i18n.getMessage("sendlater3header.label"),
      });

      // Attach to all existing msgcompose windows
      messenger.SL3U.hijackComposeWindowKeyBindings().catch(ex => {
        SLStatic.error("SL3U.hijackComposeWindowKeyBindings",ex);
      });

      messenger.SL3U.forceToolbarVisible().catch(ex => {
        SLStatic.error("SL3U.forceToolbarVisible", ex);
      });

      messenger.mailTabs.onDisplayedFolderChanged.addListener(async (tab, folder) => {
        const preferences = await SLTools.getPrefs();
        let visible = (folder.type == "drafts") && (preferences.showColumn === true);
        let columnName = messenger.i18n.getMessage("sendlater3header.label");
        await messenger.columnHandler.setColumnVisible(columnName, visible, tab.windowId);
      });

      let rowLabel = messenger.i18n.getMessage("sendlater3header.label");
      messenger.headerView.onHeaderRowUpdate.addListener(async (hdr) => {
        const preferences = await SLTools.getPrefs();
        let msgParts = await messenger.messages.getFull(hdr.id);
        let hdrs = {
          "content-type": msgParts.contentType
        };
        for (let hdrName in msgParts.headers) {
          hdrs[hdrName] = msgParts.headers[hdrName][0];
        }
        const { cellText } = SLStatic.customHdrToScheduleInfo(
          hdrs, preferences.instanceUUID
        );
        const visible = (preferences.showHeader === true) && (cellText !== "");
        return { text: cellText, visible };
      }, rowLabel);

      // This listener should be added *after* all of the storage-related
      // setup is complete. It ensures that subsequent changes to storage
      // take effect immediately.
      messenger.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.preferences) {
          SLStatic.debug("Propagating changes from local storage");
          const preferences = changes.preferences.newValue;
          SendLater.prefCache = preferences;
          SLStatic.logConsoleLevel = preferences.logConsoleLevel.toLowerCase();

          for (let pref of ["customizeDateTime", "longDateTimeFormat", "shortDateTimeFormat", "instanceUUID"]) {
            if (changes.preferences.oldValue[pref] !== preferences[pref]) {
              SLStatic[pref] = preferences[pref];
              messenger.columnHandler.setPreference(pref, preferences[pref]);
              // messenger.columnHandler.invalidateAll();
            }
          }

          messenger.SL3U.setLogConsoleLevel(SLStatic.logConsoleLevel);

          SendLater.setQuitNotificationsEnabled(preferences.askQuit);

          messenger.browserAction.setLabel({label: (
            preferences.showStatus ? messenger.i18n.getMessage("sendlater3header.label") : ""
          )});

          // Note: It's possible to immediately obey a preference change if the
          // user has decided to disable the send later column, but when the column
          // is being enabled there isn't a simple way to tell whether we're in a
          // drafts folder, so the user may need to navigate away and back to the
          // folder before their preferences can fully take effect.
          if (!preferences.showColumn) {
            const columnName = messenger.i18n.getMessage("sendlater3header.label");
            messenger.columnHandler.setColumnVisible(columnName, false);
          }
        }
      });
    }
}; // End SendLater object

// When user opens a new messagecompose window, we need to
// do several things to ensure that it behaves as they expect.
// namely, we need to override the window's send and sendlater
// menu items, we need to ensure the toolbar is visible, and
// we need to check whether they're editing a previously
// scheduled draft.
messenger.windows.onCreated.addListener(async (window) => {
  if (window.type != "messageCompose") {
    SLStatic.debug("Not a messageCompose window");
    return;
  }

  // Wait for window to fully load
  window = await messenger.windows.get(window.id, {populate: true});
  SLStatic.info("Opened new window", window);

  // Ensure that the composeAction button is visible,
  // otherwise the popup action will silently fail.
  messenger.SL3U.forceToolbarVisible(window.id).catch(ex => {
    SLStatic.error("SL3U.forceToolbarVisible", ex);
  });

  // Bind listeners to overlay components like File>Send,
  // Send Later, and keycodes like Ctrl+enter, etc.
  messenger.SL3U.hijackComposeWindowKeyBindings(window.id).catch(ex => {
    SLStatic.error("SL3U.hijackComposeWindowKeyBindings",ex);
  });

  let tab = window.tabs[0];
  let cd = await messenger.compose.getComposeDetails(tab.id);
  SLStatic.debug("Opened window with composeDetails", cd);

  // Check if we're editing an existing draft message
  if (cd.type != "draft") {
    SLStatic.debug("Not editing an existing draft");
    return;
  }

  let originalMsg = await messenger.SL3U.findAssociatedDraft(window.id).then(
    m => m ? messenger.messages.getFull(m.id) : null
  );
  SLStatic.debug("Original message", originalMsg);

  // Check if original message has x-send-later headers
  if (originalMsg && originalMsg.headers.hasOwnProperty("x-send-later-at")) {
    let { preferences, scheduleCache } = await messenger.storage.local.get(
      { preferences: {}, scheduleCache: {} }
    );

    // Re-save message (drops x-send-later headers by default
    // because they are not loaded when editing as draft).
    messenger.compose.saveMessage(tab.id, {mode: "draft"});

    // Set popup scheduler defaults based on original message
    scheduleCache[window.id] =
    SLStatic.parseHeadersForPopupUICache(originalMsg.headers);
    SLStatic.debug(
      `Schedule cache item added for window ${window.id}:`,
      scheduleCache[window.id]
    );
    messenger.storage.local.set({ scheduleCache });

    // Alert the user about what just happened
    if (preferences.showEditAlert) {
      let draftSaveWarning = messenger.i18n.getMessage("draftSaveWarning")
      SLTools.alertCheck(
        null, draftSaveWarning, null, true
      ).then(async (result) => {
        const preferences = await SLTools.getPrefs();
        preferences.showEditAlert = result.check;
        messenger.storage.local.set({ preferences });
      });
    }
  }
});

// Custom events that are attached to user actions within
// composition windows. These events occur when the user activates
// the built-in send or send later using either key combinations
// (e.g. ctrl+shift+enter), or click the file menu buttons.
messenger.SL3U.onKeyCode.addListener(keyid => {
  SLStatic.info(`Received keycode ${keyid}`);
  switch (keyid) {
    case "key_altShiftEnter": {
      if (SendLater.prefCache.altBinding) {
        SLStatic.info("Opening popup");
        messenger.composeAction.openPopup();
      } else {
        SLStatic.info("Ignoring Alt+Shift+Enter on account of user preferences");
      }
      break;
    }
    case "key_sendLater":
      { // User pressed ctrl+shift+enter
        SLStatic.debug("Received Ctrl+Shift+Enter.");
        if (SendLater.prefCache.altBinding) {
          SLStatic.info("Passing Ctrl+Shift+Enter along to builtin send later " +
                        "because user bound alt+shift+enter instead.");
          SLTools.getActiveComposeTab().then(curTab => {
            if (curTab)
              messenger.compose.sendMessage(curTab.id, {mode: "sendLater"});
          });
        } else {
          SLStatic.info("Opening popup");
          messenger.composeAction.openPopup();
        }
        break;
      }
    case "cmd_sendLater":
      { // User clicked the "Send Later" menu item, which should always
        // open the Send Later popup.
        messenger.composeAction.openPopup();
        break;
      }
    case "cmd_sendNow":
    case "cmd_sendButton":
    case "key_send":
      {
        if (SendLater.prefCache.sendDoesSL) {
          SLStatic.debug("Opening scheduler dialog.");
          messenger.composeAction.openPopup();
        } else if (SendLater.prefCache.sendDoesDelay) {
          //Schedule with delay
          const sendDelay = SendLater.prefCache.sendDelay;
          SLStatic.info(`Scheduling Send Later ${sendDelay} minutes from now.`);
          SLTools.getActiveComposeTab().then(curTab => {
            if (curTab)
              SendLater.scheduleSendLater(curTab.id, {delay: sendDelay});
          });
        } else {
          SLTools.getActiveComposeTab().then(curTab => {
            if (curTab)
              messenger.compose.sendMessage(curTab.id, {mode: "sendNow"});
          });
        }
        break;
      }
    default: {
      SLStatic.error(`Unrecognized keycode ${keyid}`);
    }
  }
});

// Allow other extensions to access local preferences
messenger.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    switch (message.action) {
      case "getUUID": {
        SLTools.getPrefs().then((preferences) => {
            sendResponse(preferences.instanceUUID);
        }).catch(ex => SLStatic.error(ex));
        return true;
      }
      case "getPreferences": {
        SLTools.getPrefs().then((preferences) => {
          for (const prop in preferences) {
            if (!SLStatic.prefInputIds.includes(prop)) {
              delete preferences[prop];
            }
          }
          sendResponse(preferences);
        });
        return true;
      }
      case "setPreferences": {
        new_prefs = message.preferences;
        SLTools.getPrefs().then((preferences) => {
          old_prefs = preferences;
          for (const prop in new_prefs) {
            if (!SLStatic.prefInputIds.includes(prop)) {
              throw `Property ${prop} is not a valid Send Later preference.`;
            }
            if (prop in old_prefs && typeof(old_prefs[prop]) != "undefined" &&
                typeof(new_prefs[prop]) != "undefined" &&
                typeof(old_prefs[prop]) != typeof(new_prefs[prop])) {
              throw `Type of ${prop} is invalid: new ` +
                `${typeof(new_prefs[prop])} vs. current ` +
                `${typeof(old_prefs[prop])}.`;
            }
            old_prefs[prop] = new_prefs[prop];
          }
          messenger.storage.local.set({preferences}).then((result) => {
            sendResponse(old_prefs)
          });
        });
        return true;
      }
      case "parseDate": {
        try {
          const date = SLStatic.convertDate(message["value"]);
          if (date) {
            const dateStr = SLStatic.parseableDateTimeFormat(date.getTime());
            sendResponse(dateStr);
            return;
          }
        } catch (ex) {
          SLStatic.debug("Unable to parse date/time",ex);
        }
        sendResponse(null);
        return;
      }
      default: {
        SLStatic.warn(`Unrecognized operation <${message.action}>.`);
      }
    }
    sendResponse(null);
  });

messenger.tabs.onRemoved.addListener(tabId => {
  SLTools.handlePopupCallback(tabId, { ok: false, check: null });
});

// Various extension components communicate with
// the background script via these runtime messages.
// e.g. the options page and the scheduler dialog.
messenger.runtime.onMessage.addListener(async (message, sender) => {

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
      SendLater.doSendNow(message.tabId);
      break;
    }
    case "doPlaceInOutbox": {
      SLStatic.debug("User requested system send later.");
      SendLater.doPlaceInOutbox(message.tabId);
      break;
    }
    case "doSendLater": {
      SLStatic.debug("User requested send later.");
      const options = { sendAt: message.sendAt,
                        recurSpec: message.recurSpec,
                        args: message.args,
                        cancelOnReply: message.cancelOnReply };
      SendLater.scheduleSendLater(message.tabId, options);
      break;
    }
    case "getMainLoopStatus": {
      response.previousLoop = SendLater.previousLoop.getTime();
      response.loopMinutes = SendLater.loopMinutes;
      break;
    }
    case "getScheduleText": {
      try {
        const dispMsgHdr =
          await messenger.messageDisplay.getDisplayedMessage(message.tabId);
        const fullMsg = await messenger.messages.getFull(dispMsgHdr.id);

        const preferences = await SLTools.getPrefs();

        const msgContentType = fullMsg.contentType;
        const msgSendAt = (fullMsg.headers["x-send-later-at"]||[])[0];
        const msgUuid = (fullMsg.headers["x-send-later-uuid"]||[])[0];
        const msgRecur = (fullMsg.headers["x-send-later-recur"]||[])[0];
        const msgArgs = (fullMsg.headers["x-send-later-args"]||[])[0];
        const msgCancelOnReply = (fullMsg.headers["x-send-later-cancel-on-reply"]||[])[0];

        if (!msgSendAt) {
          response.err = "Message is not scheduled by Send Later.";
          break;
        } else if (msgUuid !== preferences.instanceUUID) {
          response.err = messenger.i18n.getMessage("incorrectUUID");
          break;
        } else if (msgContentType && (/encrypted/i).test(msgContentType)) {
          response.err = messenger.i18n.getMessage("EncryptionIncompatText");
          break;
        }

        const sendAt = new Date(msgSendAt);
        const recurSpec = (msgRecur || "none");
        const recur = SLStatic.parseRecurSpec(recurSpec);
        recur.cancelOnReply = ["true", "yes"].includes(msgCancelOnReply);
        recur.args = msgArgs;
        response.scheduleTxt = SLStatic.formatScheduleForUI(
          { sendAt, recur }, SendLater.previousLoop, SendLater.loopMinutes
        );
      } catch (ex) {
        response.err = ex.message;
      }

      break;
    }
    case "getAllSchedules": {
      response.schedules = await SLTools.forAllDrafts(
        async (draftHdr) => {
          return await messenger.messages.getFull(draftHdr.id).then(
            async (draftMsg) => {
              function getHeader(name) {
                return (draftMsg.headers[name]||[])[0];
              }
              if (getHeader("x-send-later-at")) {
                return {
                  sendAt: getHeader("x-send-later-at"),
                  recur: getHeader("x-send-later-recur"),
                  args: getHeader("x-send-later-args"),
                  cancel: getHeader("x-send-later-cancel-on-reply"),
                  subject: draftHdr.subject,
                  recipients: draftHdr.recipients,
                }
              } else {
                return null;
              }
            }
          );
        },
        false // non-sequential
      ).then((r) => r.filter(x => x != null));
      break;
    }
    case "showPreferences": {
      messenger.runtime.openOptionsPage();
      break;
    }
    case "showUserGuide": {
      messenger.windows.openDefaultBrowser('https://extended-thunder.github.io/send-later/');
      break;
    }
    case "showReleaseNotes": {
      messenger.windows.openDefaultBrowser("https://github.com/Extended-Thunder/send-later/releases");
      break;
    }
    case "contactAuthor": {
      messenger.windows.openDefaultBrowser("https://github.com/Extended-Thunder/send-later/discussions/278");
      break;
    }
    case "donateLink": {
      messenger.windows.openDefaultBrowser("https://extended-thunder.github.io/send-later/#support-send-later");
      break;
    }
    default: {
      SLStatic.warn(`Unrecognized operation <${message.action}>.`);
    }
  }
  return response;
});

// Listen for incoming messages, and check if they are in reponse to a scheduled
// message with a 'cancel-on-reply' header.
messenger.messages.onNewMailReceived.addListener((folder, messagelist) => {
  if (["sent", "trash", "templates", "archives", "junk", "outbox"].includes(folder.type)) {
    SLStatic.debug(`Skipping onNewMailReceived for folder type ${folder.type}`);
    return;
  }
  SLStatic.debug("Received messags in folder", folder, ":", messagelist);

  for (let rcvdHdr of messagelist.messages) {
    messenger.messages.getFull(rcvdHdr.id).then((rcvdMsg) => {
      SLStatic.debug("Got message", rcvdHdr, rcvdMsg);
      let inReplyTo = (rcvdMsg.headers["in-reply-to"]||[])[0];
      if (inReplyTo) {
        SLTools.forAllDrafts(async (draftHdr) => {
          SLStatic.debug(
            "Comparing", rcvdHdr, "to", draftHdr,
            inReplyTo, "?=", `<${draftHdr.headerMessageId}>`
          );
          if (inReplyTo == `<${draftHdr.headerMessageId}>`) {
            let cancelOnReply = await messenger.messages.getFull(draftHdr.id).then(
              draftMsg => (draftMsg.headers["x-send-later-cancel-on-reply"]||[])[0]
            );
            if (["true", "yes"].includes(cancelOnReply)) {
              SLStatic.info(
                `Received response to message ${inReplyTo}.`,
                `Deleting scheduled draft ${draftHdr.id}`
              );
              messenger.messages.delete([draftHdr.id]).then(() => {
                SLStatic.info("Deleted message", draftHdr.id);
              }).catch(SLStatic.error);
            }
          }
        });
      }
    });
  }
});

// When a new message is displayed, check whether it is scheduled and
// choose whether to show the messageDisplayAction button.
messenger.messageDisplay.onMessageDisplayed.addListener(async (tab, hdr) => {
  await messenger.messageDisplayAction.disable(tab.id);
  if (hdr.folder.type == "drafts") {
    const preferences = await SLTools.getPrefs();
    const instanceUUID = preferences.instanceUUID;
    let msg = await messenger.messages.getFull(hdr.id);
    if (msg.headers["x-send-later-uuid"] == instanceUUID) {
      messenger.messageDisplayAction.enable(tab.id);
    }
  } else {
    SLStatic.debug("This is not a Drafts folder, so Send Later will not scan it.");
  }
});

// Global key shortcuts (defined in manifest)
messenger.commands.onCommand.addListener(async (cmd) => {
  const cmdId = (/send-later-shortcut-([123])/.exec(cmd))[1];

  if (["1","2","3"].includes(cmdId)) {
    const preferences = await SLTools.getPrefs();
    const funcName = preferences[`quickOptions${cmdId}funcselect`];
    const funcArgs = preferences[`quickOptions${cmdId}Args`];
    SLStatic.info(`Executing shortcut ${cmdId}: ${funcName}(${funcArgs})`);
    SendLater.quickSendWithUfunc(funcName, funcArgs);
  }
});

// Compose action button (emulate accelerator keys)
messenger.composeAction.onClicked.addListener(async (tab, info) => {
  let mod = (info.modifiers.length === 1) ? info.modifiers[0] : undefined;
  if (mod === "Command") // MacOS compatibility
    mod = "Ctrl";

  if (["Ctrl", "Shift"].includes(mod)) {
    const preferences = await SLTools.getPrefs();
    const funcName = preferences[`accel${mod}funcselect`];
    const funcArgs = preferences[`accel${mod}Args`];
    SLStatic.info(`Executing accelerator Click+${mod}: ${funcName}(${funcArgs})`);
    SendLater.quickSendWithUfunc(funcName, funcArgs, tab.id);
  } else {
    messenger.composeAction.setPopup({"popup": "ui/popup.html"});
		messenger.composeAction.openPopup();
		messenger.composeAction.setPopup({"popup": null});
  }
});

function mainLoop() {
  SLStatic.debug("Entering main loop.");
  try {
    if (SendLater.loopTimeout) {
      clearTimeout(SendLater.loopTimeout);
    }
  } catch (ex) { SLStatic.error(ex); }

  SLTools.getPrefs().then((preferences) => {
    let interval = +preferences.checkTimePref || 0;
    if (preferences.checkTimePref_isMilliseconds)
      interval /= 60000;

    SendLater.loopMinutes = interval;

    if (preferences.sendDrafts && interval > 0) {
      // Possible refresh icon options (↻ \u8635); or (⟳ \u27F3)
      // or (⌛ \u231B) (e.g. badgeText = "\u27F3")
      let extName = messenger.i18n.getMessage("extensionName");
      let isActiveMessage = messenger.i18n.getMessage("CheckingMessage");
      messenger.browserAction.enable();
      messenger.browserAction.setTitle({title: `${extName} [${isActiveMessage}]`});

      let doSequential = preferences.throttleDelay > 0;
      SLTools.forAllDrafts(SendLater.possiblySendMessage, doSequential).then(() => {
        SendLater.updateStatusIndicator();
        SendLater.setQuitNotificationsEnabled(preferences.askQuit);

        SendLater.previousLoop = new Date();
        SendLater.loopTimeout = setTimeout(mainLoop, 60000*interval);
        SLStatic.debug(`Next main loop iteration in ${60*interval} seconds.`);
      }).catch((err) => {
        SLStatic.error(err);
        SendLater.updateStatusIndicator();

        SendLater.previousLoop = new Date();
        SendLater.loopTimeout = setTimeout(mainLoop, 60000);
        SLStatic.debug(`Next main loop iteration in 1 minute.`);
      });
    } else {
      SendLater.setQuitNotificationsEnabled(false);
      let extName = messenger.i18n.getMessage("extensionName");
      let disabledMsg = messenger.i18n.getMessage("DisabledMessage");
      messenger.browserAction.disable();
      messenger.browserAction.setTitle({title: `${extName} [${disabledMsg}]`});
      messenger.browserAction.setBadgeText({text: null});

      SendLater.previousLoop = new Date();
      SendLater.loopTimeout = setTimeout(mainLoop, 60000);
      SLStatic.debug(`Next main loop iteration in 1 minute.`);
    }
  }).catch(ex => {
    SLStatic.error(ex);

    SendLater.previousLoop = new Date();
    SendLater.loopTimeout = setTimeout(mainLoop, 60000);
    SLStatic.debug(`Next main loop iteration in 1 minute.`);
  });
}

SendLater.init().then(mainLoop);
