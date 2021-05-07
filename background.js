// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
    prefCache: {},

    watchAndMarkRead: new Set(),

    // The user should be alerted about messages which are
    // beyond their late grace period once per session.
    warnedAboutLateMessageBlocked: new Set(),

    loopTimeout: null,

    popupCallbacks: new Map(),

    notificationPopup(type, title, message, checkLabel, checked) {
      title = title || browser.i18n.getMessage("extensionName");
      checkLabel = checkLabel || browser.i18n.getMessage("confirmAgain");

      let url = `ui/notification.html?`
              + `&type=${type}`
              + `&message=${encodeURIComponent(message)}`
              + `&checkLabel=${encodeURIComponent(checkLabel)}`
              + `&checked=${checked ? "true" : "false"}`;

      return new Promise(resolve => {
        messenger.windows.create({
          url: url,
          type: "popup",
          titlePreface: title,
          height: 250,
          width: 750
        }).then(window => {
          const tab = window.tabs[0];
          SendLater.popupCallbacks.set(tab.id, resolve);
        });
      });
    },

    alert(title, message) {
      return SendLater.notificationPopup("alert", title, message);
    },

    confirm(title, message) {
      return SendLater.notificationPopup("confirm", title, message);
    },

    alertCheck(title, message, checkLabel, checked) {
      return SendLater.notificationPopup("alertCheck", title, message, checkLabel, checked);
    },

    confirmCheck(title, message, checkLabel, checked) {
      return SendLater.notificationPopup("confirmCheck", title, message, checkLabel, checked);
    },

    async printVersionInfo() {
      const extensionName = browser.i18n.getMessage("extensionName");
      const thisVersion = browser.runtime.getManifest().version;
      const browserInfo = await browser.runtime.getBrowserInfo();
      const platformInfo = await browser.runtime.getPlatformInfo();
      console.info(`${extensionName} version ${thisVersion} on ` +
        `${browserInfo.name} ${browserInfo.version} (${browserInfo.buildID}) ` +
        `[${platformInfo.os} ${platformInfo.arch}]`);
    },

    async setQuitNotificationsEnabled(enabled, instanceUUID) {
      SLStatic.debug(`Setting quit notifications: ${enabled ? "on" : "off"}`);
      if (enabled) {
        let schedules = await this.getActiveSchedules(instanceUUID);
        if (schedules.length > 0) {
          let appName = browser.i18n.getMessage("extensionName");
          let title = browser.i18n.getMessage("scheduledMessagesWarningTitle") + " - " + appName;
          let requestWarning = browser.i18n.getMessage("scheduledMessagesWarningQuitRequested", appName);
          let grantedWarning = browser.i18n.getMessage("ScheduledMessagesWarningQuit", appName);
          messenger.quitter.setQuitRequestedAlert(title, requestWarning);
          messenger.quitter.setQuitGrantedAlert(title, grantedWarning);
          return;
        }
      }
      messenger.quitter.removeQuitRequestedObserver();
      messenger.quitter.removeQuitGrantedObserver();
    },

    customHdrToScheduleInfo(customHeaders, instanceUUID) {
      let cellText = "";
      let sortValue = (Math.pow(2,31)-5)|0;

      if (!customHeaders["content-type"]) {
        SLStatic.warn("Didn't receive complete headers.");
        return { cellText, sortValue };
      } else if (!customHeaders["x-send-later-at"]) {
        // Do nothing. Leave cell properties as default
        return { cellText, sortValue };
      }

      if (customHeaders["x-send-later-uuid"] !== instanceUUID) {
        cellText = browser.i18n.getMessage("incorrectUUID");
        sortValue = (Math.pow(2,31)-2)|0;
      } else if ((/encrypted/i).test(customHeaders["content-type"])) {
        cellText = browser.i18n.getMessage("EncryptionIncompatText");
        sortValue = (Math.pow(2,31)-1)|0;
      } else {
        const sendAt = new Date(customHeaders["x-send-later-at"]);
        const recurSpec = (customHeaders["x-send-later-recur"] || "none");
        let recur = SLStatic.parseRecurSpec(recurSpec);
        recur.cancelOnReply = ["true", "yes"].includes(
          customHeaders["x-send-later-cancel-on-reply"]
        );
        recur.args = customHeaders["x-send-later-args"];
        cellText = SLStatic.formatScheduleForUIColumn({ sendAt, recur });
        // Numbers will be truncated. Be sure this fits in 32 bits
        sortValue = (sendAt.getTime()/1000)|0;
      }
      return { cellText, sortValue };
    },

    async isEditing(msgId) {
      // Look through each of the compose windows, check for this message UUID.
      return await messenger.SL3U.editingMessage(msgId);
    },

    async getDraftFolders(acct) {
      async function getDraftFoldersHelper(folder) {
        // Recursive helper function to look through an account for draft folders
        const accountId = folder.accountId, path = folder.path;
        if (await messenger.SL3U.isDraftsFolder(accountId, path)) {
          return folder;
        } else {
          const drafts = [];
          for (let subFolder of folder.subFolders) {
            drafts.push(await getDraftFoldersHelper(subFolder));
          }
          return drafts;
        }
      }

      const draftSubFolders = [];
      for (let folder of acct.folders) {
        draftSubFolders.push(await getDraftFoldersHelper(folder));
      }
      const allDraftFolders = SLStatic.flatten(draftSubFolders);
      SLStatic.debug(`Found Draft folder(s) for account ${acct.name}`,allDraftFolders);
      return allDraftFolders;
    },

    async forAllDraftFolders(callback) {
      const that = this;
      try {
        let results = [];
        let accounts = await messenger.accounts.list();
        for (let acct of accounts) {
          let draftFolders = await SendLater.getDraftFolders(acct);
          for (let folder of draftFolders) {
            results.push(callback(folder));
          }
        }
        return await Promise.all(results);
      } catch (ex) {
        SLStatic.error(ex);
      }
    },

    async forAllDrafts(callback) {
      const that = this;
      try {
        let results = [];
        let accounts = await messenger.accounts.list();
        for (let acct of accounts) {
          let draftFolders = await SendLater.getDraftFolders(acct);
          for (let folder of draftFolders) {
            let page = await messenger.messages.list(folder);
            do {
              let pageResults = page.messages.map(
                message => callback.call(that, message)
              );
              results = results.concat(pageResults);
              if (page.id) {
                page = await messenger.messages.continueList(page.id);
              }
            } while (page.id);
          }
        }
        return await Promise.all(results);
      } catch (ex) {
        SLStatic.error(ex);
      }
    },

    async expandRecipients(tabId) {
      let details = {};
      for (let type of ["to", "cc", "bcc"]) {
        details[type] = await messenger.SL3U.expandRecipients(type);
      }
      await messenger.compose.setComposeDetails(tabId, details);
    },

    async doSendNow() {
      const { preferences } = await browser.storage.local.get({ preferences: {} });
      if (preferences.showSendNowAlert) {
        const result = await SendLater.confirmCheck(
          browser.i18n.getMessage("AreYouSure"),
          browser.i18n.getMessage("SendNowConfirmMessage"),
          browser.i18n.getMessage("ConfirmAgain"),
          true
        ).catch((err) => {
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showSendNowAlert = false;
          browser.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled send now.`);
          return;
        }
        messenger.SL3U.goDoCommand("cmd_sendNow").catch((ex) => {
          SLStatic.error("Error during cmd_sendNow operation", ex);
        });
      } else {
        messenger.SL3U.goDoCommand("cmd_sendWithCheck").catch((ex) => {
          SLStatic.error("Error during cmd_sendWithCheck operation", ex);
        });
      }
    },

    async doPlaceInOutbox() {
      const { preferences } = await browser.storage.local.get({ preferences: {} });
      if (preferences.showOutboxAlert) {
        const result = await SendLater.confirmCheck(
          browser.i18n.getMessage("AreYouSure"),
          browser.i18n.getMessage("OutboxConfirmMessage"),
          browser.i18n.getMessage("ConfirmAgain"),
          true
        ).catch((err) => {
          SLStatic.trace(err);
        });
        if (result.check === false) {
          preferences.showOutboxAlert = false;
          browser.storage.local.set({ preferences });
        }
        if (!result.ok) {
          SLStatic.debug(`User canceled send later.`);
          return;
        }
      }
      messenger.SL3U.goDoCommand("cmd_sendLater");
    },

    async scheduleSendLater(tabId, options) {
      let now = new Date();
      SLStatic.debug(`Pre-send check initiated at ${now}`);
      let check = await messenger.SL3U.GenericPreSendCheck();
      if (!check) {
        SLStatic.warn(`Canceled via pre-send checks (check initiated at ${now})`);
        return;
      }

      SLStatic.info(`Scheduling send later: ${tabId} with options`,options);
      const { preferences } = await browser.storage.local.get({ preferences: {} });
      const composeDetails = await messenger.compose.getComposeDetails(tabId);
      const newMessageId = await messenger.SL3U.generateMsgId(composeDetails.identityId);

      // We want to fully expand the recipients list
      await SendLater.expandRecipients(tabId);

      const customHeaders = {
        "x-send-later-uuid": preferences.instanceUUID,
        'message-id': newMessageId
      };

      // Determine time at which this message should be sent
      if (options.sendAt !== undefined) {
        const sendAt = new Date(options.sendAt);
        customHeaders["x-send-later-at"] = SLStatic.parseableDateTimeFormat(sendAt);
      } else if (options.delay !== undefined) {
        const sendAt = new Date(Date.now() + options.delay*60000);
        customHeaders["x-send-later-at"] = SLStatic.parseableDateTimeFormat(sendAt);
      } else {
        SLStatic.error("scheduleSendLater requires scheduling information");
        return;
      }

      if (options.recurSpec) {
        customHeaders['x-send-later-recur'] = options.recurSpec;
        if (options.cancelOnReply) {
          customHeaders['x-send-later-cancel-on-reply'] = "yes";
        }
      }

      if (options.args) {
        customHeaders['x-send-later-args'] = options.args;
      }

      for (let key of Object.keys(customHeaders)) {
        await messenger.SL3U.setHeader(key, customHeaders[key]);
      }
      SLStatic.debug('headers',customHeaders);

      if (preferences.markDraftsRead) {
        SendLater.watchAndMarkRead.add(newMessageId);
      }

      await messenger.SL3U.performPseudoSend().catch(SLStatic.error);

      setTimeout(() => {
        SendLater.updateStatusBarIndicator(false);
      }, 1000);
    },

    // Sends composed message according to user function (specified
    // by name), and arguments (specified as an "unparsed" string).
    async quickSendWithUfunc(funcName, funcArgs, tabId) {
      if (tabId === undefined) {
        // If no tabId is specified, then default to the currently
        // active tab.
        tabId = await messenger.windows.getAll({
          populate: true, windowTypes: ["messageCompose"]
        }).then((allWindows) => {
          const ccWins = allWindows.filter((cWindow) => (cWindow.focused === true));
          if (ccWins.length === 1) {
            const ccTabs = ccWins[0].tabs.filter(tab => (tab.active === true));
            if (ccTabs.length !== 1) // No tabs?
              throw new Error(`Unexpected situation: no tabs found in current window`);
            return ccTabs[0].id;
          } else if (ccWins.length === 0) { // No compose window is opened
            SLStatic.warn(`The currently active window is not a messageCompose window`);
          } else { // Whaaaat!?!?
            throw new Error(`Unexpected situation: multiple active windows found?`);
          }
        }).catch(ex => SLStatic.error(ex));
      }

      if (tabId !== undefined) {
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

    async possiblySendMessage(msgHdr, rawContent) {
      // Determines whether or not a particular draft message is due to be sent
      SLStatic.debug(`Checking message ${msgHdr.uri}.`);

      // const rawContent = await messenger.messages.getRaw(msgHdr.id).catch(err => {
      //   SLStatic.warn(`Unable to fetch message ${msgHdr.id}.`, err);
      // });
      if (!rawContent) {
        SLStatic.warn("possiblySendMessage failed. Unable to get raw message contents.", msgHdr);
        return;
      }

      const msgSendAt = SLStatic.getHeader(rawContent, 'x-send-later-at');
      const msgUUID = SLStatic.getHeader(rawContent, 'x-send-later-uuid');
      const msgRecurSpec = SLStatic.getHeader(rawContent, 'x-send-later-recur');
      const msgRecurArgs = SLStatic.getHeader(rawContent, 'x-send-later-args');
      const originalMsgId = SLStatic.getHeader(rawContent, 'message-id');
      const contentType = SLStatic.getHeader(rawContent, 'content-type');

      if (msgSendAt === undefined) {
        return;
      }
      const nextSend = new Date(msgSendAt);

      if ((/encrypted/i).test(contentType)) {
        SLStatic.debug(`Message ${originalMsgId} is encrypted, and will not be processed by Send Later.`);
        return;
      }

      const { preferences, lock } = await browser.storage.local.get({
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

      if (lock[originalMsgId]) {
        const msgSubject = SLStatic.getHeader(rawContent, 'subject');
        if (preferences.optOutResendWarning === true) {
          SLStatic.debug(`Encountered previously sent message "${msgSubject}" ${originalMsgId}.`);
        } else {
          SLStatic.error(`Attempted to resend message "${msgSubject}" ${originalMsgId}.`);
          const result = await SendLater.alertCheck(
            null,
            browser.i18n.getMessage("CorruptFolderError", [msgHdr.folder.path]) + "\n\n" +
              browser.i18n.getMessage("CorruptFolderErrorDetails", [msgSubject, originalMsgId]),
            null,
            true
          );
          preferences.optOutResendWarning = (result.check === false);
          await browser.storage.local.set({ preferences });
        }
        return;
      }

      if (!(Date.now() >= nextSend.getTime())) {
        SLStatic.debug(`Message ${msgHdr.id} not due for send until ${SLStatic.humanDateTimeFormat(nextSend)}`);
        return;
      }

      if (await this.isEditing(originalMsgId)) {
        SLStatic.debug(`Skipping message ${originalMsgId} while it is being edited`);
        return;
      }

      const recur = SLStatic.parseRecurSpec(msgRecurSpec);
      const args = msgRecurArgs ? SLStatic.parseArgs(msgRecurArgs) : null;

      // Respect late message blocker
      if (preferences.blockLateMessages) {
        const lateness = (Date.now() - nextSend.getTime()) / 60000;
        if (lateness > preferences.lateGracePeriod) {
          SLStatic.warn(`Grace period exceeded for message ${msgHdr.id}`);
          if (!this.warnedAboutLateMessageBlocked.has(originalMsgId)) {
            const msgSubject = SLStatic.getHeader(rawContent, "subject");
            const warningMsg = browser.i18n.getMessage(
              "BlockedLateMessage",
              [msgSubject, msgHdr.folder.path, preferences.lateGracePeriod]
            );
            const warningTitle = browser.i18n.getMessage("ScheduledMessagesWarningTitle");
            this.warnedAboutLateMessageBlocked.add(originalMsgId);
            SendLater.alert(warningTitle, warningMsg)
          }
          return;
        }
      }

      if (preferences.enforceTimeRestrictions) {
        // Respect "send between" preference
        if (recur.between) {
          if (SLStatic.compareTimes(Date.now(), '<', recur.between.start) ||
              SLStatic.compareTimes(Date.now(), '>', recur.between.end)) {
            // Skip message this time, but don't explicitly reschedule it.
            SLStatic.debug(
              `Message ${msgHdr.id} ${originalMsgId} outside of sendable time range. Skipping.`,
              recur.between);
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
            const nextRecurAt = SLStatic.adjustDateForRestrictions(
              new Date(), start_time, end_time, recur.days, false
            );

            const this_wkday = new Intl.DateTimeFormat('default', {weekday:'long'});
            SLStatic.info(`Message ${msgHdr.id} not scheduled to send on ` +
              `${this_wkday.format(new Date())}. Rescheduling for ${nextRecurAt}`);

            let newMsgContent = rawContent;

            newMsgContent = SLStatic.replaceHeader(
              newMsgContent,
              "X-Send-Later-At",
              SLStatic.parseableDateTimeFormat(nextRecurAt),
              false
            );

            const idkey = SLStatic.getHeader(rawContent, "X-Identity-Key");
            const newMessageId = await messenger.SL3U.generateMsgId(idkey);
            newMsgContent = SLStatic.replaceHeader(
              newMsgContent,
              "Message-ID",
              newMessageId,
              false
            );

            if (preferences.markDraftsRead) {
              this.watchAndMarkRead.add(newMessageId);
            }

            const success = await messenger.SL3U.saveMessage(
              msgHdr.folder.accountId,
              msgHdr.folder.path,
              newMsgContent
            );

            if (success) {
              SLStatic.debug(`Rescheduled message ${originalMsgId}. Deleting original.`);
              return "delete_original";
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
        SLStatic.prepNewMessageHeaders(rawContent),
        preferences.sendUnsentMsgs
      ).catch((ex) => {
        SLStatic.error(`Error sending raw message from drafts`, ex);
        return null;
      });

      if (success) {
        lock[originalMsgId] = true;
        browser.storage.local.set({ lock }).then(() => {
          SLStatic.debug(`Locked message <${originalMsgId}> from re-sending.`);
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
        SLStatic.info(`Scheduling next recurrence of message ${originalMsgId}`,
          {nextRecurAt, nextRecurSpec, nextRecurArgs});

        let newMsgContent = rawContent;

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

        newMsgContent = SLStatic.appendHeader(
          newMsgContent,
          "References",
          originalMsgId
        );

        const idkey = SLStatic.getHeader(rawContent, "X-Identity-Key");
        const newMessageId = await messenger.SL3U.generateMsgId(idkey);
        newMsgContent = SLStatic.replaceHeader(
          newMsgContent,
          "Message-ID",
          newMessageId,
          false
        );

        if (preferences.markDraftsRead) {
          this.watchAndMarkRead.add(newMessageId);
        }

        const success = await messenger.SL3U.saveMessage(
          msgHdr.folder.accountId,
          msgHdr.folder.path,
          newMsgContent
        );

        if (success) {
          SLStatic.info(`Scheduled next occurrence of message ` +
            `<${originalMsgId}>. Deleting original.`);
          // messenger.messages.delete([msgHdr.id], true);
          return "delete_original";
        } else {
          SLStatic.error("Unable to schedule next recuurrence.");
        }
      } else {
        SLStatic.info(`No recurrences for message ${originalMsgId} (${msgHdr.id}). Deleting original.`);
        //messenger.messages.delete([msgHdr.id], true);
        return "delete_original";
      }
    },

    async migratePreferences() {
      // Migrate legacy preferences to local storage.
      const { ufuncs, preferences } = await browser.storage.local.get({
          preferences: {},
          ufuncs: {},
        });
      const currentMigrationNumber = preferences.migratedLegacy|0;

      if (currentMigrationNumber === SLStatic.CURRENT_LEGACY_MIGRATION) {
        SLStatic.logConsoleLevel = (preferences.logConsoleLevel||"info").toLowerCase();
        return currentMigrationNumber;
      }

      // Load the default user functions.
      const isComplete = (v) => v && v.body && v.help;
      if (
        !isComplete(ufuncs.ReadMeFirst) ||
        !isComplete(ufuncs.BusinessHours) ||
        !isComplete(ufuncs.DaysInARow) ||
        !isComplete(ufuncs.Delay)
      ) {
        ufuncs.ReadMeFirst = {
          help: browser.i18n.getMessage("EditorReadMeHelp"),
          body: browser.i18n.getMessage("EditorReadMeCode"),
        };
        ufuncs.BusinessHours = {
          help: browser.i18n.getMessage("BusinessHoursHelp"),
          body: browser.i18n.getMessage("_BusinessHoursCode"),
        };
        ufuncs.DaysInARow = {
          help: browser.i18n.getMessage("DaysInARowHelp"),
          body: browser.i18n.getMessage("DaysInARowCode"),
        };
        ufuncs.Delay = {
          help: browser.i18n.getMessage("DelayFunctionHelp"),
          body: "next = new Date(Date.now() + args[0]*60000);",
        };
      }

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

      await browser.storage.local.set({ preferences, ufuncs });

      return currentMigrationNumber;
    },

    async getActiveSchedules(matchUUID) {
      const allSchedulePromises = await messenger.accounts.list().then(async accounts => {
        let folderSchedules = [];
        for (let acct of accounts) {
          let draftFolders = await SendLater.getDraftFolders(acct).catch(SLStatic.error);
          if (draftFolders && draftFolders.length > 0) {
            for (let draftFolder of draftFolders) {
              if (draftFolder) {
                try {
                  SLStatic.debug(`Checking for messages in folder ${draftFolder.path}`);
                  const accountId = draftFolder.accountId, path = draftFolder.path;
                  const thisFoldersSchedulePromise = messenger.SL3U.getAllScheduledMessages(
                    accountId, path, false, true
                  ).then(messages => {
                    let schedules = [];
                    for (let message of messages) {
                      const msgSendAt = message["x-send-later-at"];
                      const msgUUID = message["x-send-later-uuid"];

                      if (msgSendAt === undefined) {
                        //return null;
                      } else if (matchUUID && msgUUID != matchUUID) {
                        //return null;
                      } else {
                        const nextSend = new Date(msgSendAt).getTime();
                        schedules.push(nextSend);
                      }
                    }
                    return schedules;
                  });
                  folderSchedules.push(thisFoldersSchedulePromise);
                } catch (ex0) {
                  SLStatic.error(ex0);
                }
              }
            }
          } else {
            SLStatic.debug(`getActiveSchedules: Unable to find drafts folder for account`, acct);
          }
        }
        return SLStatic.flatten(folderSchedules);
      }).catch(SLStatic.error);

      const allSchedules = await Promise.all(allSchedulePromises);
      return SLStatic.flatten(allSchedules);
    },

    async doSanityCheck() {
      const { preferences } = await browser.storage.local.get({ preferences: {} });

      let message = "";

      try { // Compact Drafts folders and Outbox folder
        const compactedDrafts = await this.forAllDraftFolders(
          async folder => {
            const accountId = folder.accountId, path = folder.path;
            SLStatic.log(`Compacting folder <${path}> in account ${accountId}`);
            return messenger.SL3U.compactFolder(accountId, path);
          });
        const compactedOutbox = await messenger.SL3U.compactFolder("", "outbox");

        if (compactedDrafts.every(v => v === true)) {
          SLStatic.debug("Successfully compacted Drafts.");
        } else {
          let errMsg = browser.i18n.getMessage("CompactionFailureNoError", ["Drafts"]);
          message += "\n\n"+errMsg;
        }
        if (compactedOutbox) {
          SLStatic.debug("Successfully compacted Outbox.");
        } else {
          let errMsg = browser.i18n.getMessage("CompactionFailureNoError", ["Outbox"]);
          message += "\n\n"+errMsg;
        }
      } catch (e) {
        SLStatic.error("Compacting Outbox and/or Drafts folders failed with error",e);
        let errMsg = browser.i18n.getMessage("CompactionFailureWithError");
        message += `\n\n${errMsg}\n${e}`;
      }

      const activeSchedules = await this.getActiveSchedules(preferences.instanceUUID);
      const nActive = activeSchedules.length;
      if (nActive > 0) {
        const soonest = new Date(Math.min(...activeSchedules));
        const nextActiveText = SLStatic.humanDateTimeFormat(soonest) +
          ` (${(new Sugar.Date(soonest)).relative()})`;
        message += "\n\n" + browser.i18n.getMessage("SanityCheckDrafts", [nActive, nextActiveText]);
      }

      const nUnsentMessages = await messenger.SL3U.countUnsentMessages();
      if (nUnsentMessages > 0 && preferences.sendUnsentMsgs) {
        message += "\n\n" + browser.i18n.getMessage("SanityCheckOutbox", [nUnsentMessages]);
      }

      if (message !== "") {
        message += "\n\n" + browser.i18n.getMessage("SanityCheckCorruptFolderWarning");
        message += `\n\n` + browser.i18n.getMessage("SanityCheckConfirmOptionMessage");
        const result = await SendLater.confirm(null, message.trim());
        if (!result.ok) {
          SLStatic.info("Disabling Send Later per user selection.");
          preferences.checkTimePref = 0;
          // We dont need to do the whole migration again next time, but
          // we should run the sanity check once more until the user hits
          // 'okay' to close it. Hard code back to legacy migration 2, because
          // this sanity check was implemented in migration 3.
          preferences.migratedLegacy = 2;
          await browser.storage.local.set({ preferences });
          return false;
        }
      }
      return true;
    },

    async claimDrafts() {
      /*
       * Because the x-send-later-uuid header was omitted in beta
       * releases <= 8.0.15, there may be some scheduled drafts
       * which do not have an associated instance id.
       *
       * This function will scan all drafts for messages with an
       * x-send-later-at header but no x-send-later-uuid header.
       * It will create a new message with this instance's uuid,
       * and delete the existing draft.
       *
       * This should only happen once, and only for users who
       * have been following the beta releases.
       */
      let claimed = await this.forAllDrafts(async (msg) => {
        const rawContent = await messenger.messages.getRaw(msg.id).catch(err => {
          SLStatic.warn(`Unable to fetch message ${msg.id}.`, err);
        });
        if (!rawContent) {
          SLStatic.warn("claimDrafts.forAllDrafts failed. Unable to get raw message contents.",msg);
          return;
        }
        const sendAt = SLStatic.getHeader(rawContent, "x-send-later-at");
        const uuid = SLStatic.getHeader(rawContent, 'x-send-later-uuid');

        if (sendAt && !uuid) {
          const msgId = SLStatic.getHeader(rawContent, 'message-id');
          const subject = SLStatic.getHeader(rawContent, 'subject');

          SLStatic.info(`Adding UUID to message ${msgId} (${subject})`);

          const { preferences } =
            await browser.storage.local.get({ preferences: {} });

          const idkey = SLStatic.getHeader(rawContent, "X-Identity-Key");
          const newMessageId = await messenger.SL3U.generateMsgId(idkey);

          let newMsgContent = rawContent;
          newMsgContent = SLStatic.replaceHeader(
            newMsgContent, "Message-ID", newMessageId, false);
          newMsgContent = SLStatic.replaceHeader(
            newMsgContent, "X-Send-Later-Uuid", preferences.instanceUUID,
            false, true);
          newMsgContent = SLStatic.appendHeader(
            newMsgContent, "References", msgId);

          if (msg.read) {
            this.watchAndMarkRead.add(newMessageId);
          }

          const success = await messenger.SL3U.saveMessage(
            msg.folder.accountId,
            msg.folder.path,
            newMsgContent
          );

          if (success) {
            SLStatic.log(`Saved new message id: ${newMessageId}. ` +
              `Deleting original.`);
            messenger.messages.delete([msg.id], true);
            return newMessageId;
          } else {
            SLStatic.error("Unable to claim message");
          }
        }
      });
      claimed = claimed.filter(v => v !== null && v !== undefined);
      SLStatic.info(`Claimed ${claimed.length} scheduled messages.`);
    },

    async updateStatusBarIndicator(isActive) {
      const { preferences } = await browser.storage.local.get({ preferences: {} });

      messenger.statusBar.setVisible(preferences.showStatus);

      if (preferences.showStatus) {
        let statusMsg = '...';
        if (isActive) {
          statusMsg = browser.i18n.getMessage("CheckingMessage");
        } else {
          const activeSchedules = await this.getActiveSchedules(preferences.instanceUUID);
          const nActive = activeSchedules.length;
          messenger.SL3U.setSendLaterVars({
            messages_pending: nActive
          }).catch(SLStatic.error);
          if (nActive > 0) {
            statusMsg = browser.i18n.getMessage("PendingMessage", [nActive]);
          } else {
            statusMsg = browser.i18n.getMessage("IdleMessage");
          }
        }

        const extName = browser.i18n.getMessage("extensionName");
        messenger.statusBar.setStatusMessage(`${extName} [${statusMsg}]`);
      }
    },

    async extractCustomHeaders(hdr, wantedHdrs) {
      const rawContent = await messenger.messages.getRaw(hdr.id);
      let customHeaders = {};
      for (let key of wantedHdrs)
        customHeaders[key] = SLStatic.getHeader(rawContent, key);
      return customHeaders;
    },

    initCustomOverlays() {
      let promises = [];

      // Drafts folder column
      const columnName = messenger.i18n.getMessage("sendlater3header.label");
      let p_a = messenger.columnHandler.addCustomColumn({ name: columnName, tooltip: "" }).then(() => {
        messenger.columnHandler.onCustomColumnFill.addListener(async (hdr) => {
          const { preferences } = await browser.storage.local.get({ preferences: {} });
          const customHeaders = await SendLater.extractCustomHeaders(hdr, [
            "x-send-later-at", "x-send-later-recur", "x-send-later-args",
            "x-send-later-cancel-on-reply", "x-send-later-uuid", "content-type"
          ]);
          const { cellText, sortValue } =
            SendLater.customHdrToScheduleInfo(customHeaders, preferences.instanceUUID);
          return { cellText, sortValue };
        }, columnName);
      });
      promises.push(p_a);

      let p_b = messenger.mailTabs.onDisplayedFolderChanged.addListener(async (tab, folder) => {
        const { preferences } = await browser.storage.local.get({ preferences: {} });
        let visible = (preferences.showColumn === true);
        if (visible) {
          const accountId = folder.accountId, path = folder.path;
          const isDrafts = await messenger.SL3U.isDraftsFolder(accountId, path);
          visible = isDrafts;
        }
        await messenger.columnHandler.setColumnVisible(columnName, visible, false);
      });
      promises.push(p_b);

      // Header row
      const rowLabel = browser.i18n.getMessage("sendlater3header.label");
      let p_c = messenger.headerView.addCustomHdrRow({ name: rowLabel }).then(() => {
        messenger.headerView.onHeaderRowUpdate.addListener(async (hdr) => {
          const { preferences } = await browser.storage.local.get({ preferences: {} });
          const customHeaders = await SendLater.extractCustomHeaders(hdr, [
            "x-send-later-at", "x-send-later-recur", "x-send-later-args",
            "x-send-later-cancel-on-reply", "x-send-later-uuid", "content-type"
          ]);
          const { cellText } = SendLater.customHdrToScheduleInfo(customHeaders, preferences.instanceUUID);
          const visible = (preferences.showHeader === true) && (cellText !== "");
          return { text: cellText, visible };
        }, rowLabel);
      });
      promises.push(p_c);

      // Status bar menu
      let p_d = messenger.statusBar.addStatusMenu(
        browser.i18n.getMessage("extensionName"), // Default label
        false, // Initial visibility
        [ // Menu items:
          { id: 'show-preferences',
            label: browser.i18n.getMessage("prefwindow.title") },
          { id: 'user-guide-link',
            label: browser.i18n.getMessage("userGuideLabel") },
          { id: 'release-notes-link',
            label: browser.i18n.getMessage("releasenotes.value") },
          { id: 'contact-author-link',
            label: browser.i18n.getMessage("contactAuthorLabel") },
          { id: 'donate-link',
            label: browser.i18n.getMessage("donatelink.value") }
        ]
      ).then(() => {
        SendLater.updateStatusBarIndicator(false);
      });
      promises.push(p_d);

      // Status bar menu listener
      let p_e = messenger.statusBar.statusMenuCallback.addListener(id => {
        switch (id) {
          case "show-preferences":
            messenger.runtime.openOptionsPage();
            break;
          case "user-guide-link":
            messenger.windows.openDefaultBrowser("https://extended-thunder.github.io/send-later/");
            break;
          case "release-notes-link":
            messenger.windows.openDefaultBrowser("https://github.com/Extended-Thunder/send-later/releases");
            break;
          case "contact-author-link":
            messenger.windows.openDefaultBrowser("https://github.com/Extended-Thunder/send-later/discussions/278");
            break;
          case "donate-link":
            messenger.windows.openDefaultBrowser("https://extended-thunder.github.io/send-later/#support-send-later");
            break;
        };
      });
      promises.push(p_e);

      return Promise.all(promises);
    },

    async init() {
      await this.printVersionInfo();

      // Set custom DB headers preference, if not already set.
      await messenger.SL3U.setCustomDBHeaders([
        "x-send-later-at", "x-send-later-recur", "x-send-later-args",
        "x-send-later-cancel-on-reply", "x-send-later-uuid", "content-type"
      ]);

      // Before preferences are available, let's set logging
      // to the default level.
      SLStatic.logConsoleLevel = "info";

      // Clear the current message settings cache
      browser.storage.local.set({ scheduleCache: {} });

      // Perform any pending preference migrations.
      const previousMigration = await this.migratePreferences();
      if (previousMigration < 3) {
        // This really shouldn't be necessary, but we should check
        // whether the outbox and drafts folders might be corrupted.
        await this.doSanityCheck();
      }

      // Very early iterations of the webextension version
      // of send later did not set the x-send-later-uuid
      // header. This function will "claim" any messages that
      // were originally saved that way.
      if (previousMigration > 0 && previousMigration < 4) {
        await this.claimDrafts();
      }

      browser.storage.local.get({ preferences: {} }).then(
        ({ preferences }) => {
          SendLater.prefCache = preferences;
          SLStatic.logConsoleLevel = preferences.logConsoleLevel.toLowerCase();
          SLStatic.customizeDateTime = (preferences.customizeDateTime === true);
          SLStatic.longDateTimeFormat = preferences.longDateTimeFormat;
          SLStatic.shortDateTimeFormat = preferences.shortDateTimeFormat;
          messenger.SL3U.setSendLaterVars({
            logConsoleLevel: SLStatic.logConsoleLevel
          });

          SendLater.setQuitNotificationsEnabled(preferences.askQuit, preferences.instanceUUID);
        }).catch(ex => SLStatic.error(ex));

      // Initialize the draft folder column, expanded
      // header view, and status bar menu
      await this.initCustomOverlays();

      // This listener should be added *after* all of the storage-related
      // setup is complete. It makes sure that subsequent changes to storage
      // take effect immediately.
      browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.preferences) {
          SLStatic.debug("Propagating changes from local storage");
          const preferences = changes.preferences.newValue;
          SendLater.prefCache = preferences;
          SLStatic.logConsoleLevel = preferences.logConsoleLevel.toLowerCase();

          ["customizeDateTime", "longDateTimeFormat", "shortDateTimeFormat"].forEach(
            pref => {
              if (changes.preferences.oldValue[pref] !== preferences[pref]) {
                SLStatic[pref] = preferences[pref];
                messenger.columnHandler.invalidateAll();
              }
            });

          messenger.SL3U.setSendLaterVars({
            logConsoleLevel: SLStatic.logConsoleLevel
          });

          SendLater.setQuitNotificationsEnabled(preferences.askQuit, preferences.instanceUUID);

          messenger.statusBar.setVisible(preferences.showStatus);

          // Note: It's possible to immediately obey a preference change if the
          // user has decided to disable the send later column, but when the column
          // is being enabled there isn't a simple way to tell whether we're in a
          // drafts folder, so the user will have to navigate away and back to the
          // folder before their preferences can fully take effect.
          if (!preferences.showColumn) {
            const columnName = messenger.i18n.getMessage("sendlater3header.label");
            messenger.columnHandler.setColumnVisible(columnName, false, true);
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
  if (window.type === "messageCompose") {
    // Wait for window to fully load
    await messenger.windows.getCurrent();

    // Ensure that the composeAction button is visible,
    // otherwise the popup action will silently fail.
    await messenger.SL3U.forceToolbarVisible().catch(ex => {
      SLStatic.error("SL3U.forceToolbarVisible", ex);
    });

    // Bind listeners to overlay components like File>Send,
    // Send Later, and keycodes like Ctrl+enter, etc.
    await messenger.SL3U.hijackComposeWindowKeyBindings().catch(ex => {
      SLStatic.error("SL3U.hijackComposeWindowKeyBindings",ex);
    });

    // Now, check if this message was an existing scheduled draft.
    const originalMsg = await messenger.SL3U.findCurrentDraft();
    if (originalMsg) {
      const headers = await SendLater.extractCustomHeaders(originalMsg, [
        "x-send-later-at", "x-send-later-recur", "x-send-later-args",
        "x-send-later-cancel-on-reply", "message-id"
      ]);
      if (headers['x-send-later-at']) {
        let { preferences, scheduleCache } = await browser.storage.local.get(
          { preferences: {}, scheduleCache: {} }
        );

        // Re-save the msg (delete existing schedule headers)
        await messenger.SL3U.goDoCommand("cmd_saveAsDraft", window.id);

        // Alert the user about what just happened
        if (preferences.showEditAlert) {
          let draftSaveWarning = browser.i18n.getMessage("draftSaveWarning")
          SendLater.alertCheck(
            null, draftSaveWarning, null, true
          ).then(async (result) => {
            let { preferences } = await browser.storage.local.get({preferences: {}});
            preferences.showEditAlert = result.check;
            browser.storage.local.set({ preferences });
          });
        }

        // Set popup scheduler defaults based on original message
        scheduleCache[window.id] =
          SLStatic.parseHeadersForPopupUICache(headers);
        SLStatic.debug(`Schedule cache item added for window ${window.id}:`,
          scheduleCache[window.id]);
        browser.storage.local.set({ scheduleCache });

        // Once the draft save operation is definitely complete,
        // then invalidate that row with the columnHandler.
        setTimeout(() => {
          messenger.columnHandler.invalidateRowByMessageId(
            headers["message-id"]
          ).catch(SLStatic.error);
        }, 1000);
      } // else: This message is not queued by send later.
    } // else: Not editing a saved draft message.
  } // else: This isn't a msgcompose window.
});

// Also attach bindings to all existing msgcompose windows
(() => {
  messenger.SL3U.forceToolbarVisible(-1).catch(ex => {
    SLStatic.error("SL3U.forceToolbarVisible", ex);
  });
  messenger.SL3U.hijackComposeWindowKeyBindings(-1).catch(ex => {
    SLStatic.error("SL3U.hijackComposeWindowKeyBindings",ex);
  });
})();

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
          messenger.SL3U.goDoCommand("cmd_sendLater");
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

          messenger.windows.getAll({
            populate: true,
            windowTypes: ["messageCompose"]
          }).then((allWindows) => {
            // Current compose windows
            const ccWins = allWindows.filter((cWindow) => (cWindow.focused === true));
            if (ccWins.length === 1) {
              const ccTabs = ccWins[0].tabs.filter(tab => (tab.active === true));
              if (ccTabs.length !== 1) { // No tabs?
                throw new Error(`Unexpected situation: no tabs found in current window`);
              }
              const tabId = ccTabs[0].id;
              SendLater.scheduleSendLater(tabId, { delay: sendDelay });
            } else if (ccWins.length === 0) {
              // No compose window is opened
              SLStatic.warn(`The currently active window is not a messageCompose window`);
            } else {
              // Whaaaat!?!?
              throw new Error(`Unexpected situation: multiple active windows found?`);
            }
          });
        } else {
          // Just pass along to the builtin command
          let command = keyid;
          if (command === "key_send")
            command = "cmd_sendWithCheck";
          messenger.SL3U.goDoCommand(command).catch((ex) => {
            SLStatic.error("Error during builtin send operation",ex);
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
    if (message["action"] === "getPreferences") {
      browser.storage.local.get({"preferences":{}}).then(storage => {
        for (const prop in storage["preferences"]) {
          if (!SLStatic.prefInputIds.includes(prop)) {
            delete storage.preferences[prop];
          }
        }
        sendResponse(storage.preferences);
      });
      return true;
    }
    else if (message["action"] === "setPreferences") {
      new_prefs = message.preferences;
      browser.storage.local.get({"preferences":{}}).then(storage => {
        old_prefs = storage.preferences;
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
        browser.storage.local.set(storage).then((result) => {
          sendResponse(old_prefs)
        });
      });
      return true;
    }
    else if (message["action"] === "parseDate") {
      try {
        const date = SLStatic.convertDate(message["value"], true);
        if (date) {
          const dateStr = SLStatic.parseableDateTimeFormat(date.getTime());
          sendResponse(dateStr);
          return;
        }
      } catch (ex) {
        SLStatic.debug("Unable to parse date/time",ex);
      }
      sendResponse(null);
    }
  });

messenger.tabs.onRemoved.addListener(tabId => {
  if (SendLater.popupCallbacks.has(tabId)) {
    let callback = SendLater.popupCallbacks.get(tabId);
    callback({ ok: false, check: null });
    SendLater.popupCallbacks.delete(tabId);
  }
});

// Various extension components communicate with
// the background script via these runtime messages.
// e.g. the options page and the scheduler dialog.
messenger.runtime.onMessage.addListener(async (message, sender) => {

  let tabId = sender.tab.id;
  if (SendLater.popupCallbacks.has(tabId)) {
    let callback = SendLater.popupCallbacks.get(tabId);
    callback(message);
    SendLater.popupCallbacks.delete(tabId);
    return;
  }

  const response = {};
  switch (message.action) {
    case "alert": {
      SendLater.alert(message.title, message.text);
      break;
    }
    case "doSendNow": {
      SLStatic.debug("User requested send immediately.");
      SendLater.doSendNow();
      break;
    }
    case "doPlaceInOutbox": {
      SLStatic.debug("User requested system send later.");
      SendLater.doPlaceInOutbox();
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
      response.previousLoop = SLStatic.previousLoop.getTime();
      break;
    }
    case "getScheduleText": {
      try {
        const dispMsgHdr =
          await messenger.messageDisplay.getDisplayedMessage(message.tabId);
        const rawDispMsg =
          await messenger.messages.getRaw(dispMsgHdr.id).catch(err => {
            SLStatic.warn(`Unable to fetch message ${dispMsgHdr.id}.`, err);
          });

        if (!rawDispMsg) {
          SLStatic.warn("getScheduleText failed. Unable to get raw message contents.",dispMsgHdr);
          return;
        }

        const { preferences } = await browser.storage.local.get({ preferences: {} });

        const msgContentType = SLStatic.getHeader(rawDispMsg, "content-type");
        const msgSendAt = SLStatic.getHeader(rawDispMsg, "x-send-later-at");
        const msgUuid = SLStatic.getHeader(rawDispMsg, "x-send-later-uuid");
        const msgRecur = SLStatic.getHeader(rawDispMsg, "x-send-later-recur");
        const msgArgs = SLStatic.getHeader(rawDispMsg, "x-send-later-args");
        const msgCancelOnReply = SLStatic.getHeader(rawDispMsg, "x-send-later-cancel-on-reply");

        if (!msgSendAt) {
          response.err = "Message is not scheduled by Send Later.";
          break;
        } else if (msgUuid !== preferences.instanceUUID) {
          response.err = "Message is scheduled by a different Thunderbird instance";
          break;
        } else if (msgContentType && (/encrypted/i).test(msgContentType)) {
          response.err = browser.i18n.getMessage("EncryptionIncompatText");
          break;
        }

        const sendAt = new Date(msgSendAt);
        const recurSpec = (msgRecur || "none");
        const recur = SLStatic.parseRecurSpec(recurSpec);
        recur.cancelOnReply = ["true", "yes"].includes(msgCancelOnReply);
        recur.args = msgArgs;
        response.scheduleTxt = SLStatic.formatScheduleForUI({ sendAt, recur });
      } catch (ex) {
        response.err = ex.message;
      }

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
  // First, we want to skip onNewMailReceived events triggered locally during
  // regular send, move, and copy operations. We never touch archives folders anyway,
  // so we can immediately ignore this if it's an operation on an archives folder.
  if (["sent", "trash", "archives", "junk", "outbox"].includes(folder.type)) {
    SLStatic.debug(`Skipping onNewMailReceived for folder type ${folder.type}`);
    return;
  } else {
    SLStatic.debug(`Messages received in folder ${folder.path}`);
  }

  // We can't do this processing right away, because the message might not be
  // accessible via messenger.messages, so we'll schedule it for a few seconds from now.
  setTimeout(async () => {
    const myself = SLStatic.flatten(await messenger.accounts.list().then(accts =>
      accts.map(acct => acct.identities.map(identity => identity.email))));

    for (let hdr of messagelist.messages) {
      SLStatic.debug(`Received new message: ${hdr.subject}`);

      const rawRecvdMsg =
        await messenger.messages.getRaw(hdr.id).catch(err => {
          SLStatic.warn(`Unable to fetch message ${hdr.id}.`, err);
        });
      if (!rawRecvdMsg) {
        SLStatic.warn("onNewMailReceived.scanMessage failed. Unable to get raw message contents.",hdr);
        return;
      } else {
        // Saving a message is processed as an incoming message. If we wanted to save it
        // to drafts, we should do that now.
        const recvdMsgId = SLStatic.getHeader(rawRecvdMsg, "message-id");
        if (SendLater.watchAndMarkRead.has(recvdMsgId)) {
          SLStatic.debug(`Marking draft message read ${recvdMsgId}`);
          SendLater.watchAndMarkRead.delete(recvdMsgId);
          messenger.messages.update(hdr.id, { read: true });
          return;
        }

        // And even if we didn't want to mark it read, if it is from this account
        // then we don't want to treat it the same as an incoming message.
        for (let email of myself) {
          if (hdr.author.indexOf(email) > -1) {
            SLStatic.debug(`Skipping onNewMailReceived for own message`);
            return;
          }
        }

        const recvdMsgReplyToStr = SLStatic.getHeader(rawRecvdMsg, "in-reply-to");
        if (recvdMsgReplyToStr) {
          const recvdMsgReplyTo =[...recvdMsgReplyToStr.matchAll(/(<\S*>)/gim)].map(i=>i[1]);
          SLStatic.debug(`Message is a reply to`, recvdMsgReplyTo);

          // Loop over all draft messages, and check for overlap between this
          // incoming message's 'in-reply-to' header, and any of the draft's
          // 'references' headers.
          messenger.accounts.list().then(async accounts => {
            for (let acct of accounts) {
              let draftFolders = await SendLater.getDraftFolders(acct);
              if (draftFolders && draftFolders.length > 0) {
                for (let draftFolder of draftFolders) {
                  if (draftFolder) {
                    try {
                      SLStatic.debug(`Checking for messages in folder ${draftFolder.path}`);
                      const accountId = draftFolder.accountId, path = draftFolder.path;
                      messenger.SL3U.getAllScheduledMessages(accountId, path, false, true).then(messages => {
                        for (let message of messages) {
                          const draftId = message["message-id"];
                          const draftCancelOnReply = message["x-send-later-cancel-on-reply"];
                          const draftRefString = message["references"];

                          const cancelOnReply = (draftCancelOnReply &&
                            ["true", "yes"].includes(draftCancelOnReply));
                          if (cancelOnReply) {
                            const draftMsgRefs = [...draftRefString.matchAll(/(<\S*>)/gim)].map(i=>i[1]);
                            const isReferenced = draftMsgRefs.some(item => recvdMsgReplyTo.includes(item));
                            if (isReferenced) {
                              SLStatic.info(`Received response to message ${draftId}. Deleting scheduled draft.`);
                              messenger.SL3U.deleteDraftByUri(accountId, path, message.uri);
                            }
                          }
                        }
                      }).catch(SLStatic.error);
                    } catch (ex0) {
                      SLStatic.error(ex0);
                    }
                  }
                }
              } else {
                SLStatic.debug(`onNewMailReceived: Unable to find drafts folder for account`, acct);
              }
            }
          }).catch(SLStatic.error);
        }
      }
    }
  }, 5000);
});

// When a new message is displayed, check whether it is scheduled and
// choose whether to show the messageDisplayAction button.
messenger.messageDisplay.onMessageDisplayed.addListener(async (tab, hdr) => {
  await messenger.messageDisplayAction.disable(tab.id);
  const accountId = hdr.folder.accountId, path = hdr.folder.path;
  if (await messenger.SL3U.isDraftsFolder(accountId, path)) {
    let rawMessage = await messenger.messages.getRaw(hdr.id).catch(err => {
        SLStatic.warn(`Unable to fetch message ${hdr.id}.`, err);
      });
    const { preferences } = await browser.storage.local.get({ preferences: {} });
    const instanceUUID = preferences.instanceUUID;
    if (!rawMessage) {
      SLStatic.warn("onMessageDisplayed failed. Unable to get raw message contents.",hdr.id);
      return;
    } else {
      const msgSendAt = SLStatic.getHeader(rawMessage, "x-send-later-at");
      const msgUuid = SLStatic.getHeader(rawMessage, "x-send-later-uuid");
      if (msgSendAt) {
        if (msgUuid === instanceUUID) {
          SLStatic.debug("Displayed message has send later headers.");
          messenger.messageDisplayAction.enable(tab.id);
        } else {
          SLStatic.debug(`Displayed message is scheduled by a different ` +
              `Thunderbird instance: ${msgUuid}`);
        }
      }
    }
  } else {
    SLStatic.debug("This is not a Drafts folder, so Send Later will not scan it.");
  }
});

// Global key shortcuts (defined in manifest)
messenger.commands.onCommand.addListener(async (cmd) => {
  const cmdId = (/send-later-shortcut-([123])/.exec(cmd))[1];

  if (["1","2","3"].includes(cmdId)) {
    const { preferences } = await browser.storage.local.get({ preferences: {} });
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
    const { preferences } = await browser.storage.local.get({ preferences: {} });
    const funcName = preferences[`accel${mod}funcselect`];
    const funcArgs = preferences[`accel${mod}Args`];
    SLStatic.info(`Executing composeAction accelerator ${mod}: ${funcName}(${funcArgs})`);
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

  browser.storage.local.get({ preferences: {} }).then(({ preferences }) => {
    let interval = +preferences.checkTimePref || 0;
    if (preferences.checkTimePref_isMilliseconds)
      interval /= 60000;
    const throttleDelay = preferences.throttleDelay;

    if (preferences.sendDrafts && interval > 0) {
      SendLater.updateStatusBarIndicator(true);

      messenger.accounts.list().then(async (accounts) => {
        let folderProcessPromises = [/*
          Will be filled with promises (one for each drafts folder), each resolves
          to an array of promises (one per message in that folder), which in turn
          resolve when that message has been processed.
        */];
        for (let acct of accounts) {
          let draftFolders = await SendLater.getDraftFolders(acct).catch(SLStatic.error);
          if (draftFolders && draftFolders.length > 0) {
            for (let draftFolder of draftFolders) {
              if (draftFolder) {
                try {
                  SLStatic.debug(`Checking for messages in folder ${draftFolder.path}`);
                  const accountId = draftFolder.accountId, path = draftFolder.path;
                  let messageProcessPromises = messenger.SL3U.getAllScheduledMessages(
                    accountId, path, true, false
                  ).then(async (messages) => {
                    let sendPromises = [/*
                      Filled with promises (one per message in this folder), which resolve
                      as soon as each message is processed.
                    */];
                    for (let message of messages) {
                      message.folder = draftFolder;
                      let callback = SendLater.possiblySendMessage.bind(SendLater);
                      let possiblySendPromise = callback(message, message.raw).then((result) => {
                        if (result === "delete_original") {
                          return messenger.SL3U.deleteDraftByUri(accountId, path, message.uri).catch((ex) => {
                            SLStatic.error(`mainLoop.deleteDraftByUri error:`, ex);
                          });
                        } else {
                          return new Promise((resolve, reject) => resolve(message));
                        }
                      }).catch(SLStatic.error);
                      sendPromises.push(possiblySendPromise);
                      if (throttleDelay) {
                        await possiblySendPromise;
                      }
                    }
                    return sendPromises;
                  }).catch(err => SLStatic.trace(err));
                  folderProcessPromises.push(messageProcessPromises);
                  if (throttleDelay) {
                    await messageProcessPromises;
                  }
                } catch (ex0) { SLStatic.error(ex0); }
              }
            }
          } else {
            SLStatic.debug(`mainLoop: Unable to find drafts folder for account`, acct.name);
          }
        }
        if (!throttleDelay) {
          for (messageProcessPromises of await Promise.all(folderProcessPromises)) {
            // messageProcessPromises is an array of promises which will each
            // resolve as soon as that message has been processed. We don't
            // actually need to know about the result of these promises, just
            // be sure to wait for them to resolve before continuing.
            await Promise.all(messageProcessPromises);
          }
        }
        return true;
      }).then(() => {
        SLStatic.previousLoop = new Date();
        SendLater.updateStatusBarIndicator(false);

        SendLater.setQuitNotificationsEnabled(preferences.askQuit, preferences.instanceUUID);

        SLStatic.previousLoop = new Date();
        SLStatic.debug(`Next main loop iteration in ${interval} ` +
                       `minute${interval === 1 ? "" : "s"}.`);
        SendLater.loopTimeout = setTimeout(mainLoop, 60000*interval);
      }).catch((err) => {
        SLStatic.error(err);
        SendLater.updateStatusBarIndicator(false);

        SLStatic.previousLoop = new Date();
        SendLater.loopTimeout = setTimeout(mainLoop, 60000);
      });
    } else {
      SendLater.setQuitNotificationsEnabled(false);
      const extName = browser.i18n.getMessage("extensionName");
      const disabledMsg = browser.i18n.getMessage("DisabledMessage");
      messenger.statusBar.setStatusMessage(`${extName} [${disabledMsg}]`);
      SLStatic.previousLoop = new Date();
      SendLater.loopTimeout = setTimeout(mainLoop, 60000);
    }
  }).catch(ex => {
    SLStatic.error(ex);
    SendLater.loopTimeout = setTimeout(mainLoop, 60000);
  });
}

SendLater.init().then(mainLoop);
