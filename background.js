// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
    prefCache: {},

    watchAndMarkRead: new Set(),

    // The user should be alerted about messages which are
    // beyond their late grace period once per session.
    warnedAboutLateMessageBlocked: new Set(),

    loopTimeout: null,

    notify(title, text) {
      SLStatic.warn(`Alert: ${title}- ${text}`);
      browser.notifications.create(null, {
        "type": "basic",
        "title": title,
        "message": text
      });
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

    async preSendCheck() {
      return await browser.SL3U.preSendCheck();
    },

    async isEditing(msgId) {
      // Look through each of the compose windows, check for this message UUID.
      return await browser.SL3U.editingMessage(msgId);
    },

    async forAllDraftFolders(callback) {
      const that = this;
      try {
        let results = [];
        let accounts = await browser.accounts.list();
        for (let acct of accounts) {
          let draftFolders = await getDraftFolders(acct);
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
        let accounts = await browser.accounts.list();
        for (let acct of accounts) {
          let draftFolders = await getDraftFolders(acct);
          for (let folder of draftFolders) {
            let page = await browser.messages.list(folder);
            do {
              let pageResults = page.messages.map(
                message => callback.call(that, message)
              );
              results = results.concat(pageResults);
              if (page.id) {
                page = await browser.messages.continueList(page.id);
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
        details[type] = await browser.SL3U.expandRecipients(type);
      }
      await browser.compose.setComposeDetails(tabId, details);
    },

    async scheduleSendLater(tabId, options) {
      SLStatic.info(`Scheduling send later: ${tabId} with options`,options);
      const { preferences } = await browser.storage.local.get({ preferences: {} });

      const customHeaders = {
        "x-send-later-uuid": preferences.instanceUUID
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

      const inserted = Object.keys(customHeaders).map(name =>
        browser.SL3U.setHeader(name, (""+customHeaders[name]))
      );
      await this.expandRecipients(tabId);
      await Promise.all(inserted);
      SLStatic.debug('headers',customHeaders);

      const composeDetails = await browser.compose.getComposeDetails(tabId);
      const newMessageId = await browser.SL3U.generateMsgId(composeDetails.identityId);

      if (preferences.markDraftsRead) {
        this.watchAndMarkRead.add(newMessageId);
      }

      const success = await browser.SL3U.saveAsDraft(newMessageId);
      if (!success) {
        SLStatic.error("Something went wrong while scheduling this message.");
      }

      setTimeout(() => {
        this.setStatusBarIndicator.call(this, false);
      }, 1000);
    },

    async possiblySendMessage(msgHdr, rawContent) {
      // Determines whether or not a particular draft message is due to be sent
      SLStatic.debug(`Checking message ${msgHdr.uri}.`);

      // const rawContent = await browser.messages.getRaw(msgHdr.id).catch(err => {
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
        SLStatic.warn(`Message ${originalMsgId} is encrypted, and will not be processed by Send Later.`);
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
          const result = await browser.SL3U.alertCheck(
            "",
            browser.i18n.getMessage("CorruptFolderError", [msgHdr.folder.path]) + "\n\n" +
              browser.i18n.getMessage("CorruptFolderErrorDetails", [msgSubject, originalMsgId]),
            browser.i18n.getMessage("ConfirmAgain"),
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
            browser.SL3U.alert(warningTitle, warningMsg)
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
            const newMessageId = await browser.SL3U.generateMsgId(idkey);
            newMsgContent = SLStatic.replaceHeader(
              newMsgContent,
              "Message-ID",
              newMessageId,
              false
            );

            if (preferences.markDraftsRead) {
              this.watchAndMarkRead.add(newMessageId);
            }

            const success = await browser.SL3U.saveMessage(
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

      const success = await browser.SL3U.sendRaw(
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
        const newMessageId = await browser.SL3U.generateMsgId(idkey);
        newMsgContent = SLStatic.replaceHeader(
          newMsgContent,
          "Message-ID",
          newMessageId,
          false
        );

        if (preferences.markDraftsRead) {
          this.watchAndMarkRead.add(newMessageId);
        }

        const success = await browser.SL3U.saveMessage(
          msgHdr.folder.accountId,
          msgHdr.folder.path,
          newMsgContent
        );

        if (success) {
          SLStatic.info(`Scheduled next occurrence of message ` +
            `<${originalMsgId}>. Deleting original.`);
          // browser.messages.delete([msgHdr.id], true);
          return "delete_original";
        } else {
          SLStatic.error("Unable to schedule next recuurrence.");
        }
      } else {
        SLStatic.info(`No recurrences for message ${originalMsgId} (${msgHdr.id}). Deleting original.`);
        //browser.messages.delete([msgHdr.id], true);
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
            pp = browser.SL3U.getLegacyPref(
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

      // Pick up any new properties from defaults
      for (let prefName of Object.getOwnPropertyNames(prefDefaults)) {
        if (preferences[prefName] === undefined) {
          const prefValue = prefDefaults[prefName][1];
          SLStatic.debug(`Added new preference ${prefName}: ${prefValue}`);
          preferences[prefName] = prefValue;
        }
      }

      //if (currentMigrationNumber < 4)
      if (preferences.instanceUUID) {
        SLStatic.info(`This instance's UUID: ${preferences.instanceUUID}`);
      } else {
        let instance_uuid = await browser.SL3U.getLegacyPref(
          "instance.uuid", "string", "");
        if (instance_uuid) {
          SLStatic.info(`Using migrated UUID: ${instance_uuid}`);
        } else {
          instance_uuid = SLStatic.generateUUID();
          SLStatic.info(`Generated new UUID: ${instance_uuid}`);
        }
        preferences.instanceUUID = instance_uuid;
        browser.SL3U.setLegacyPref("instance.uuid", "string", instance_uuid);
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
      const allSchedulePromises = await browser.accounts.list().then(async accounts => {
        let folderSchedules = [];
        for (let acct of accounts) {
          let draftFolders = await getDraftFolders(acct);
          if (draftFolders && draftFolders.length > 0) {
            for (let draftFolder of draftFolders) {
              if (draftFolder) {
                try {
                  SLStatic.debug(`Checking for messages in folder ${draftFolder.path}`);
                  const accountId = draftFolder.accountId, path = draftFolder.path;
                  const thisFoldersSchedulePromise = browser.SL3U.getAllScheduledMessages(
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
            return browser.SL3U.compactFolder(accountId, path);
          });
        const compactedOutbox = await browser.SL3U.compactFolder("", "outbox");

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

      const nUnsentMessages = await browser.SL3U.countUnsentMessages();
      if (nUnsentMessages > 0 && preferences.sendUnsentMsgs) {
        message += "\n\n" + browser.i18n.getMessage("SanityCheckOutbox", [nUnsentMessages]);
      }

      if (message !== "") {
        const title = browser.i18n.getMessage("extensionName");
        message += "\n\n" + browser.i18n.getMessage("SanityCheckCorruptFolderWarning");
        message += `\n\n` + browser.i18n.getMessage("SanityCheckConfirmOptionMessage");
        const okay = await browser.SL3U.confirm(title, message.trim());
        if (!okay) {
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
        const rawContent = await browser.messages.getRaw(msg.id).catch(err => {
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
          const newMessageId = await browser.SL3U.generateMsgId(idkey);

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

          const success = await browser.SL3U.saveMessage(
            msg.folder.accountId,
            msg.folder.path,
            newMsgContent
          );

          if (success) {
            SLStatic.log(`Saved new message id: ${newMessageId}. ` +
              `Deleting original.`);
            browser.messages.delete([msg.id], true);
            return newMessageId;
          } else {
            SLStatic.error("Unable to claim message");
          }
        }
      });
      claimed = claimed.filter(v => v !== null && v !== undefined);
      SLStatic.info(`Claimed ${claimed.length} scheduled messages.`);
    },

    async setStatusBarIndicator(isActive) {
      let statusMsg;
      if (isActive) {
        statusMsg = browser.i18n.getMessage("CheckingMessage");
      } else {
        const { preferences } = await browser.storage.local.get({ preferences: {} });
        const activeSchedules = await this.getActiveSchedules(preferences.instanceUUID);
        const nActive = activeSchedules.length;
        browser.SL3U.setSendLaterVar("messages_pending", nActive);
        if (nActive > 0) {
          statusMsg = browser.i18n.getMessage("PendingMessage", [nActive]);
        } else {
          statusMsg = browser.i18n.getMessage("IdleMessage");
        }
      }

      const extName = browser.i18n.getMessage("extensionName");
      return await browser.SL3U.showStatus(`${extName} [${statusMsg}]`);
    },

    async init() {
      await this.printVersionInfo();

      // Set custom DB headers preference, if not already set.
      await browser.SL3U.setCustomDBHeaders();

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

      if (previousMigration > 0 && previousMigration < 4) {
        await this.claimDrafts();
      }

      const { preferences } =
        await browser.storage.local.get({ preferences: {} });
      this.prefCache = preferences;

      // This listener should be added *after* all of the storage-related
      // setup is complete. It makes sure that subsequent changes to storage
      // are propagated to their respective
      browser.storage.onChanged.addListener(async (changes, areaName) => {
        if (areaName === "local") {
          SLStatic.debug("Propagating changes from local storage");
          const { preferences } =
            await browser.storage.local.get({ preferences: {} });
          this.prefCache = preferences;
          SLStatic.logConsoleLevel = preferences.logConsoleLevel.toLowerCase();
          const prefString = JSON.stringify(preferences);
          await browser.SL3U.notifyStorageLocal(prefString, false);
        }
      });

      await browser.SL3U.injectScripts([
        "utils/sugar-custom.js",
        "utils/static.js",
        "experiments/headerView.js",
        "experiments/statusBar.js"
      ]);


      setTimeout(() => {
        const prefString = JSON.stringify(preferences);
        browser.SL3U.notifyStorageLocal(prefString, true);
      }, 1000);

      SLStatic.debug("Registering window listeners");
      await browser.SL3U.startObservers();
      await browser.SL3U.bindKeyCodes();

      await this.setStatusBarIndicator(false);
    }
}; // SendLater

browser.SL3U.onKeyCode.addListener(keyid => {
  SLStatic.info(`Received keycode ${keyid}`);
  switch (keyid) {
    case "key_altShiftEnter": {
      if (SendLater.prefCache.altBinding) {
        browser.composeAction.openPopup();
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
          browser.SL3U.builtInSendLater().catch((ex) => {
            SLStatic.error("Error during builtin send later",ex);
          });
        } else {
          SLStatic.info("Opening popup");
          browser.composeAction.openPopup();
        }
        break;
      }
    case "cmd_sendLater":
      { // User clicked the "Send Later" menu item, which should always
        // open the Send Later popup.
        browser.composeAction.openPopup();
        break;
      }
    case "cmd_sendNow":
    case "cmd_sendButton":
    case "key_send":
      {
        if (SendLater.prefCache.sendDoesSL) {
          SLStatic.debug("Opening scheduler dialog.");
          browser.composeAction.openPopup();
        } else if (SendLater.prefCache.sendDoesDelay) {
          //Schedule with delay
          const sendDelay = SendLater.prefCache.sendDelay;
          SLStatic.info(`Scheduling Send Later ${sendDelay} minutes from now.`);

          browser.windows.getAll({
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

              SendLater.preSendCheck.call(SendLater).then(dosend => {
                if (dosend) {
                  SendLater.scheduleSendLater.call(SendLater, tabId, { delay: sendDelay });
                } else {
                  SLStatic.info("User cancelled send via pre-send check.");
                }
              });
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
          browser.SL3U.goDoCommand(command).catch((ex) => {
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

browser.runtime.onMessageExternal.addListener(
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

browser.runtime.onMessage.addListener(async (message) => {
  const response = {};
  switch (message.action) {
    case "alert": {
      SendLater.notify(message.title, message.text);
      break;
    }
    case "doSendNow": {
      SLStatic.debug("User requested send immediately.");
      const { preferences } = await browser.storage.local.get({ preferences: {} });
      if (preferences.showSendNowAlert) {
        const result = await browser.SL3U.confirmCheck(
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
          SLStatic.debug(`User cancelled send now.`);
          break;
        }
        browser.SL3U.goDoCommand("cmd_sendNow").catch((ex) => {
          SLStatic.error("Error during cmd_sendNow operation", ex);
        });
      } else {
        browser.SL3U.goDoCommand("cmd_sendWithCheck").catch((ex) => {
          SLStatic.error("Error during cmd_sendWithCheck operation", ex);
        });
      }
      break;
    }
    case "doPlaceInOutbox": {
      SLStatic.debug("User requested system send later.");
      const { preferences } = await browser.storage.local.get({ preferences: {} });
      if (preferences.showOutboxAlert) {
        const result = await browser.SL3U.confirmCheck(
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
          SLStatic.debug(`User cancelled send later.`);
          break;
        }
      }
      browser.SL3U.builtInSendLater().catch((ex) => {
        SLStatic.error("Error during builtin send later operation",ex);
      });
      break;
    }
    case "doSendLater": {
      SLStatic.debug("User requested send later.");
      SendLater.preSendCheck.call(SendLater).then(dosend => {
        if (dosend) {
          const options = { sendAt: message.sendAt,
                            recurSpec: message.recurSpec,
                            args: message.args,
                            cancelOnReply: message.cancelOnReply };
          SendLater.scheduleSendLater.call(SendLater, message.tabId, options);
        } else {
          SLStatic.info("User cancelled send via presendcheck.");
        }
      });
      break;
    }
    case "getMainLoopStatus": {
      response.previousLoop = SLStatic.previousLoop.getTime();
      break;
    }
    case "getScheduleText": {
      try {
        const dispMsgHdr =
          await browser.messageDisplay.getDisplayedMessage(message.tabId);
        const rawDispMsg =
          await browser.messages.getRaw(dispMsgHdr.id).catch(err => {
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
browser.messages.onNewMailReceived.addListener((folder, messagelist) => {
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
  // accessible via browser.messages, so we'll schedule it for a few seconds from now.
  setTimeout(async () => {
    const myself = SLStatic.flatten(await browser.accounts.list().then(accts =>
      accts.map(acct => acct.identities.map(identity => identity.email))));

    for (let hdr of messagelist.messages) {
      SLStatic.debug(`Received new message: ${hdr.subject}`);

      const rawRecvdMsg =
        await browser.messages.getRaw(hdr.id).catch(err => {
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
          browser.messages.update(hdr.id, { read: true });
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
          browser.accounts.list().then(async accounts => {
            for (let acct of accounts) {
              let draftFolders = await getDraftFolders(acct);
              if (draftFolders && draftFolders.length > 0) {
                for (let draftFolder of draftFolders) {
                  if (draftFolder) {
                    try {
                      SLStatic.debug(`Checking for messages in folder ${draftFolder.path}`);
                      const accountId = draftFolder.accountId, path = draftFolder.path;
                      browser.SL3U.getAllScheduledMessages(accountId, path, false, true).then(messages => {
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
                              browser.SL3U.deleteDraftByUri(accountId, path, message.uri);
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

browser.messageDisplay.onMessageDisplayed.addListener(async (tab, hdr) => {
  await browser.messageDisplayAction.disable(tab.id);
  const accountId = hdr.folder.accountId, path = hdr.folder.path;
  if (await browser.SL3U.isDraftsFolder(accountId, path)) {
    let rawMessage = await browser.messages.getRaw(hdr.id).catch(err => {
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
          browser.messageDisplayAction.enable(tab.id);
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

browser.commands.onCommand.addListener((cmd) => {
  const cmdId = (/send-later-shortcut-([123])/.exec(cmd))[1];

  if (["1","2","3"].includes(cmdId)) {
    browser.windows.getAll({
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

        browser.storage.local.get({
          preferences: {},
          ufuncs: {}
        }).then(({ preferences, ufuncs }) => {
          function evaluateUfunc(funcName, prev, argStr) {
            let args = null;
            if (argStr) {
              try {
                argStr = SLStatic.unparseArgs(SLStatic.parseArgs(argStr));
                args = SLStatic.parseArgs(argStr);
              } catch (ex) {
                SLStatic.warn(ex);
                return { err: (browser.i18n.getMessage("InvalidArgsTitle") + ": " +
                                browser.i18n.getMessage("InvalidArgsBody")) };
              }
            }

            const { sendAt, nextspec, nextargs, error } =
              SLStatic.evaluateUfunc(funcName, funcBody, prev, args);
            SLStatic.debug("User function returned:",
                            {sendAt, nextspec, nextargs, error});

            if (error) {
              throw new Error(error);
            } else {
              let recur = SLStatic.parseRecurSpec(nextspec || "none") || { type: "none" };
              if (recur.type !== "none") {
                recur.args = nextargs || "";
              }
              const schedule = { sendAt, recur };
              SLStatic.debug("commands.onCommand received ufunc response: ",schedule);
              return schedule;
            }
          }

          const funcName = preferences[`quickOptions${cmdId}funcselect`];
          const funcArgs = preferences[`quickOptions${cmdId}Args`];
          SLStatic.info(`Executing shortcut ${cmdId}: ${funcName}(${funcArgs})`);
          const funcBody = ufuncs[funcName].body;

          const schedule = evaluateUfunc(funcName, null, funcArgs);

          SendLater.preSendCheck.call(SendLater).then(dosend => {
            if (dosend) {
              const options = { sendAt: schedule.sendAt,
                                recurSpec: SLStatic.unparseRecurSpec(schedule.recur),
                                args: schedule.recur.args,
                                cancelOnReply: schedule.recur.cancelOnReply };
              SendLater.scheduleSendLater.call(SendLater, tabId, options);
            } else {
              SLStatic.info("User cancelled send via presendcheck.");
            }
          });
        });
      } else if (ccWins.length === 0) {
        // No compose window is opened
        SLStatic.warn(`The currently active window is not a messageCompose window`);
      } else {
        // Whaaaat!?!?
        throw new Error(`Unexpected situation: multiple active windows found?`);
      }
    }).catch(SLStatic.error);
  }
});

// browser.runtime.onUpdateAvailable.addListener((details) => {
//   const extensionName = browser.i18n.getMessage("extensionName");
//   const thisVersion = browser.runtime.getManifest().version;
//   const nextVersion = details.version||"";
//
//   browser.notifications.create(null, {
//     "type": "basic",
//     "title": `${extensionName} ${thisVersion}`,
//     "message": `${extensionName} ${nextVersion} is available and ` +
//                `will be upgraded next time you restart Thunderbird.`
//   });
// });

async function getDraftFoldersHelper(folder) {
  // Recursive helper function to look through an account for draft folders
  const accountId = folder.accountId, path = folder.path;
  if (await browser.SL3U.isDraftsFolder(accountId, path)) {
    return folder;
  } else {
    const drafts = [];
    for (let subFolder of folder.subFolders) {
      drafts.push(await getDraftFoldersHelper(subFolder));
    }
    return drafts;
  }
}

async function getDraftFolders(acct) {
  const draftSubFolders = [];
  for (let folder of acct.folders) {
    draftSubFolders.push(await getDraftFoldersHelper(folder));
  }
  const allDraftFolders = SLStatic.flatten(draftSubFolders);
  SLStatic.debug(`Found Draft folder(s) for account ${acct.name}`,allDraftFolders);
  return allDraftFolders;
}

function mainLoop() {
  SLStatic.debug("Entering main loop.");
  if (SendLater.loopTimeout) {
    clearTimeout(SendLater.loopTimeout);
  }

  // This variable gets set to "true" when a user is warned about
  // leaving TB open, but it may not get set back to false if
  // some other quit-requested-observer aborts the quit. So just
  // just in case, we'll periodically set it back to "false".
  browser.SL3U.setSendLaterVar("quit_confirmed", false);

  browser.storage.local.get({ preferences: {} }).then((storage) => {
    let interval = +storage.preferences.checkTimePref || 0;
    if (storage.preferences.checkTimePref_isMilliseconds)
      interval /= 60000;
    const throttleDelay = storage.preferences.throttleDelay;

    if (storage.preferences.sendDrafts && interval > 0) {
      SendLater.setStatusBarIndicator.call(SendLater, true);

      browser.accounts.list().then(async (accounts) => {
        let folderProcessPromises = [/*
          Will be filled with promises (one for each drafts folder), each resolves
          to an array of promises (one per message in that folder), which in turn
          resolve when that message has been processed.
        */];
        for (let acct of accounts) {
          let draftFolders = await getDraftFolders(acct);
          if (draftFolders && draftFolders.length > 0) {
            for (let draftFolder of draftFolders) {
              if (draftFolder) {
                try {
                  SLStatic.debug(`Checking for messages in folder ${draftFolder.path}`);
                  const accountId = draftFolder.accountId, path = draftFolder.path;
                  let messageProcessPromises = browser.SL3U.getAllScheduledMessages(
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
                          return browser.SL3U.deleteDraftByUri(accountId, path, message.uri).catch((ex) => {
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
        SendLater.setStatusBarIndicator.call(SendLater, false);

        SLStatic.previousLoop = new Date();
        SLStatic.debug(`Next main loop iteration in ${interval} ` +
                       `minute${interval === 1 ? "" : "s"}.`);
        SendLater.loopTimeout = setTimeout(mainLoop.bind(SendLater), 60000*interval);
      }).catch((err) => {
        SLStatic.error(err);
        SendLater.setStatusBarIndicator.call(SendLater, false);

        SLStatic.previousLoop = new Date();
        SendLater.loopTimeout = setTimeout(mainLoop.bind(SendLater), 60000);
      });
    } else {
      const extName = browser.i18n.getMessage("extensionName");
      const disabledMsg = browser.i18n.getMessage("DisabledMessage");
      browser.SL3U.showStatus(`${extName} [${disabledMsg}]`);
      SLStatic.previousLoop = new Date();
      SendLater.loopTimeout = setTimeout(mainLoop.bind(SendLater), 60000);
    }
  }).catch(ex => {
    SLStatic.error(ex);
    SendLater.loopTimeout = setTimeout(mainLoop.bind(SendLater), 60000);
  });
}

SendLater.init().then(
  mainLoop.bind(SendLater)
).catch(SLStatic.error);
