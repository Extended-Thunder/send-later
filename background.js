// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
    prefCache: {},

    composeState: {},

    watchAndMarkRead: new Set(),

    async propagatePreferences(storage, initializing) {
      // This is now handled by a storage.onChanged listener,
      // so no need to call it manually. Leaving it here as
      // a stub for the time being.
      return true;
    },

    async isEditing(msgId) {
      // Look through each of the compose windows, check for this message UUID.
      return await browser.SL3U.editingMessage(msgId);
    },

    async findDraftsHelper(folder) {
      // Recursive helper function to look through an account for draft folders
      if (folder.type === "drafts") {
        return folder;
      } else {
        const drafts = [];
        for (let subFolder of folder.subFolders) {
          drafts.push(SendLater.findDraftsHelper(subFolder));
        }
        return Promise.all(drafts);
      }
    },

    async getDraftFolders(acct) {
      const draftSubFolders = [];
      acct.folders.forEach(folder => {
        draftSubFolders.push(SendLater.findDraftsHelper(folder));
      });
      return Promise.all(draftSubFolders).then(SLStatic.flatten);
    },

    async forAllDraftFolders(callback) {
      try {
        let results = [];
        let accounts = await browser.accounts.list();
        for (let acct of accounts) {
          let draftFolders = await SendLater.getDraftFolders(acct);
          for (let folder of draftFolders) {
            results.push(callback(folder));
          }
        }
        return Promise.all(results);
      } catch (ex) {
        SLStatic.error(ex);
      }
    },

    async forAllDrafts(callback, sequential) {
      try {
        let results = [];
        let accounts = await browser.accounts.list();
        for (let acct of accounts) {
          let draftFolders = await SendLater.getDraftFolders(acct);
          for (let drafts of draftFolders) {
            let page = await browser.messages.list(drafts);
            do {
              for (let message of page.messages) {
                if (sequential === true) {
                  const result = await callback(message);
                  results.push(result);
                } else {
                  const resultPromise = callback(message);
                  results.push(resultPromise);
                }
              }
              if (page.id) {
                page = await browser.messages.continueList(page.id);
              }
            } while (page.id);
          }
        }
        if (sequential === true) {
          return results;
        } else {
          return Promise.all(results);
        }
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
      await SendLater.expandRecipients(tabId);
      await Promise.all(inserted);
      SLStatic.debug('headers',customHeaders);

      const composeDetails = await browser.compose.getComposeDetails(tabId);
      const newMessageId = await browser.SL3U.generateMsgId(composeDetails.identityId);

      if (preferences.markDraftsRead) {
        SendLater.watchAndMarkRead.add(newMessageId);
      }

      await browser.SL3U.saveAsDraft(newMessageId);

      browser.tabs.remove(tabId);
    },

    async possiblySendMessage(msgHdr) {
      if (await browser.SL3U.isOffline()) {
        SLStatic.debug(`The option to send scheduled messages while ` +
          `thunderbird is offline has not yet been implemented. Skipping.`);
        return;
      }

      // Determines whether or not a particular draft message is due to be sent
      const rawContent = await browser.messages.getRaw(msgHdr.id);

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

      if (!msgUUID) {
        SLStatic.debug(`Message <${originalMsgId}> has no uuid header.`);
        return;
      }

      if (msgUUID !== preferences.instanceUUID) {
        SLStatic.debug(`Message <${originalMsgId}> is scheduled by a different Thunderbird isntance.`);
        return;
      }

      if (lock[originalMsgId]) {
        SLStatic.log(`Skipping message ${originalMsgId} -- resend!`);
        const err = browser.i18n.getMessage("MessageResendError", [msgHdr.folder.path]);
        browser.SL3U.alert("", err);
        preferences.checkTimePref = 0;
        await browser.storage.local.set({ preferences });
        return;
      }

      if (!(Date.now() >= nextSend.getTime())) {
        // SLStatic.debug(`Message ${msgHdr.id} not due for send until ${SLStatic.humanDateTimeFormat(nextSend)}`);
        return;
      }

      if (await SendLater.isEditing(originalMsgId)) {
        SLStatic.debug(`Skipping message ${originalMsgId} while it is being edited`);
        return;
      }

      const recur = SLStatic.parseRecurSpec(msgRecurSpec);
      const args = SLStatic.parseArgs(msgRecurArgs);

      if (preferences.enforceTimeRestrictions) {
        const now = Date.now();

        // Respect late message blocker
        if (preferences.blockLateMessages) {
          const lateness = (now - nextSend.getTime()) / 60000;
          if (lateness > preferences.lateGracePeriod) {
            SLStatic.info(`Grace period exceeded for message ${msgHdr.id}`);
            return;
          }
        }

        // Respect "send between" preference
        if (recur.between) {
          if ((now < recur.between.start) || (now > recur.between.end)) {
            SLStatic.debug(`Message ${msgHdr.id} outside of sendable time range.`);
            return;
          }
        }

        // Respect "only on days of week" preference
        if (recur.days) {
          const today = (new Date()).getDay();
          if (!recur.days.includes(today)) {
            const wkday = new Intl.DateTimeFormat('default', {weekday:'long'});
            SLStatic.debug(`Message ${msgHdr.id} not scheduled to send on ${wkday.format(new Date())}`);
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
          nextRecurAt = nextRecur[0];
          nextRecurSpec = nextRecur[1];
          nextRecurArgs = nextRecur[2];
        }
        SLStatic.info(`Scheduling next recurrence of message ${originalMsgId}`,
          {nextRecurAt, nextRecurSpec, nextRecurArgs});

        let newMsgContent = rawContent;

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
          SendLater.watchAndMarkRead.add(newMessageId);
        }

        const success = await browser.SL3U.saveMessage(
          msgHdr.folder.accountId,
          msgHdr.folder.path,
          newMsgContent
        );

        if (success) {
          SLStatic.info(`Scheduled next occurrence of message ` +
            `<${originalMsgId}>. Deleting original.`);
          browser.messages.delete([msgHdr.id], true);
        } else {
          SLStatic.error("Unable to schedule next recuurrence.");
        }
      } else {
        SLStatic.info(`No recurrences for message <${originalMsgId}>. Deleting original.`);
        browser.messages.delete([msgHdr.id], true);
      }
    },

    migratePreferences: async function () {
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

      // Load legacy preferences
      if (currentMigrationNumber === 0) {
        // Merge any existing legacy preferences into the new storage system
        let prefKeys = [];
        let legacyValuePromises = [];

        // Load values from legacy storage, substitute defaults if not defined.
        let prefDefaults = await fetch(
            "/utils/defaultPrefs.json"
          ).then((ptxt) => ptxt.json());
        for (let prefName of Object.getOwnPropertyNames(prefDefaults)) {
          prefKeys.push(prefName);
          let dtype = prefDefaults[prefName][0];
          let defVal = prefDefaults[prefName][1];
          let legacyKey = prefDefaults[prefName][2];
          let pp; // Promise that resolves to this preference value.
          const isquickopt = prefName.match(/quickOptions(\d)Label/);
          if (isquickopt) {
            const localizedDelayLabel = [
              moment(new Date(Date.now() + 60000 * 15)).fromNow(),
              moment(new Date(Date.now() + 60000 * 30)).fromNow(),
              moment(new Date(Date.now() + 60000 * 120)).fromNow(),
            ][+isquickopt[1] - 1];
            pp = new Promise((resolve, reject) =>
              resolve(localizedDelayLabel)
            );
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

      //if (currentMigrationNumber < 4)
      if (!preferences.instanceUUID) {
        let instance_uuid = await browser.SL3U.getLegacyPref(
          "instance.uuid", "string", "");
        if (instance_uuid) {
          SLStatic.info(`Using migrated UUID: ${instance_uuid}`);
        } else {
          SLStatic.info(`Generating new UUID: ${instance_uuid}`);
          instance_uuid = await browser.SL3U.generateUUID();
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

    getActiveSchedules: async function (matchUUID) {
      const { preferences } = await browser.storage.local.get({ preferences: {} });

      let allSchedules = await SendLater.forAllDrafts(async (msg) => {
        const rawMessage = await browser.messages.getRaw(msg.id);
        const msgSendAt = SLStatic.getHeader(rawMessage, "x-send-later-at");
        const msgUUID = SLStatic.getHeader(rawMessage, "x-send-later-uuid");
        if (msgSendAt === undefined) {
          return null;
        } else if (matchUUID && msgUUID !== preferences.instanceUUID) {
          return null;
        } else {
          const nextSend = new Date(msgSendAt).getTime();
          return nextSend;
        }
      }, true);
      return allSchedules.filter(v => v !== null);
    },

    doSanityCheck: async function() {
      const { preferences } = await browser.storage.local.get({ preferences: {} });

      let message = "";

      try { // Compact Drafts folders and Outbox folder
        const compactedDrafts = await SendLater.forAllDraftFolders(
          async folder => {
            const accountId = folder.accountId, path = folder.path;
            console.log(`Compacting folder <${path}> in account ${accountId}`);
            return browser.SL3U.compactFolder(accountId, path);
          });
        const compactedOutbox = await browser.SL3U.compactFolder("", "outbox");

        if (compactedDrafts.every(v => v === true)) {
          SLStatic.debug("Successfully compacted Drafts.");
        } else {
          message += `\n\nCompacting Drafts folders failed without error message.`;
        }
        if (compactedOutbox) {
          SLStatic.debug("Successfully compacted Outbox.");
        } else {
          message += `\n\nCompacting Outbox failed without error message.`;
        }
      } catch (e) {
        SLStatic.error("Compacting Outbox and/or Drafts folders failed with error",e);
        message += `\n\nCompacting Outbox and/or Drafts folders failed with error:\n${e}`;
      }

      const activeSchedules = await SendLater.getActiveSchedules(false);
      const nActive = activeSchedules.length;
      if (nActive > 0) {
        const soonest = new Date(Math.min(...activeSchedules));
        const nextActiveText = SLStatic.humanDateTimeFormat(soonest) +
          ` (${moment(soonest).fromNow()})`;
        message += `\n\nYou have ${nActive} message${nActive === 1 ? "" : "s"} ` +
          `scheduled to be delivered by Send Later.\nThe next one is ` +
          `scheduled for ${nextActiveText}.`;
      }

      const nUnsentMessages = await browser.SL3U.countUnsentMessages();
      if (nUnsentMessages > 0 && preferences.sendUnsentMsgs) {
        message += `\n\nYou have ${nUnsentMessages} ` +
          `unsent message${nUnsentMessages === 1 ? "" : "s"} which will be ` +
          `triggered to send next time a scheduled message becomes due.`;
      }

      if (message !== "") {
        const title = browser.i18n.getMessage("extensionName");
        message += "\n\nIf these numbers don't look right to you, you might have " +
          "a corrupted Outbox and/or Drafts folder(s). In that case it is " +
          "advised that you compact and rebuild those folders before activating " +
          "Send Later. See <https://blog.kamens.us/send-later/#corrupt-drafts-error> " +
          "for more details.";
        message += `\n\nSelect one of the options:\n`;
        message += `  "OK": Proceed as usual. You will not be prompted again.\n\n` +
          `  "Cancel": Send Later will be disabled via its own preferences.\n` +
          `                    To re-enable Send Later, go to its options page and set\n` +
          `                    the "${browser.i18n.getMessage("checkTimePrefLabel1")}" ` +
                              `preference to a non-zero value.\n` +
          `                    You will receive this prompt again next time you restart\n` +
          `                    Thunderbird`;
        const okay = await browser.SL3U.confirmAction(title, message.trim());
        console.log("isokay",okay);
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

    continueOnUpgrade: async function() {
      let { preferences } = await browser.storage.local.get({
        preferences: {}
      });
      let thisVersion = "0.0.0";
      try {
        thisVersion = await browser.SL3U.getVersion();
      } catch (e) {
        SLStatic.warn("Unable to read current Send Later version.", e);
      }
      const extensionName = browser.i18n.getMessage("extensionName");
      if (thisVersion === preferences.versionNumber) {
        console.info(`Starting ${extensionName} version ${thisVersion}.`);
        // Just a regular old restart. Not a version upgrade.
        return true;
      } else {
        SLStatic.info(`Version upgraded from ${preferences.versionNumber} to ${thisVersion}`);
        if (preferences.hideRestartNotification) {
          //TODO: This is not yet implemented.
          SLStatic.debug("User has chosen to hide notifications about restarts on upgrade.");
          return true;
        } else {
          preferences.versionNumber = thisVersion;
          await browser.storage.local.set({ preferences });

          let title = browser.i18n.getMessage("extensionName");
          let message = `A new version of ${title} has been installed.\n\n` +
            `To prevent unexpected behavior, it is recommended that you ` +
            `restart Thunderbird before using any of its functionality. ` +
            `This is especially important when a previous version was ` +
            `actively running prior to this upgrade.\n\n` +
            `Click "OK" to continue loading ${extensionName}, or "Cancel" to ` +
            `wait until the next Thunderbird restart.`;
          title += ` ${thisVersion}`;

          const okay = await browser.SL3U.confirmAction(title, message.trim());
          if (okay === true) {
            SLStatic.warn("Continuing without restart.");
            return true;
          } else if (okay === false) {
            SLStatic.info("Returning early, and waiting until next restart.");
            return false;
          }
        }
      }
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
      let claimed = await SendLater.forAllDrafts(async (msg) => {
        const rawContent = await browser.messages.getRaw(msg.id);
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
            SendLater.watchAndMarkRead.add(newMessageId);
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
      }, true);
      claimed = claimed.filter(v => v !== null && v !== undefined);
      SLStatic.info(`Claimed ${claimed.length} scheduled messages.`);
    },

    init: async function () {
      // Set custom DB headers preference, if not already set.
      await browser.SL3U.setCustomDBHeaders();

      // Check if version has just been upgraded, and possibly
      // prompt for restart if so.
      if (!(await SendLater.continueOnUpgrade())) {
        return;
      }

      // Perform any pending preference migrations.
      const previousMigration = await SendLater.migratePreferences();
      if (previousMigration < 3) {
        // This really shouldn't be necessary, but we should check
        // whether the outbox and drafts folders might be corrupted.
        await SendLater.doSanityCheck();
      }

      await SendLater.claimDrafts();

      const { preferences, ufuncs } = await browser.storage.local.get({
          preferences: {},
          ufuncs: {},
        });

      SendLater.prefCache = preferences;
      SLStatic.ufuncs = ufuncs;
      const prefString = JSON.stringify(preferences);
      await browser.SL3U.notifyStorageLocal(prefString, true);

      // This listener should be added *after* all of the storate-related
      // setup is complete. It makes sure that subsequent changes to storage
      // are propagated to their respective
      browser.storage.onChanged.addListener(async (changes, areaName) => {
        if (areaName === "local") {
          SLStatic.debug("Propagating changes from local storage");
          const { preferences, ufuncs } =
            await browser.storage.local.get({
              preferences: {},
              ufuncs: {}
            });
          SendLater.prefCache = preferences;
          SLStatic.ufuncs = ufuncs;
          const prefString = JSON.stringify(preferences);
          await browser.SL3U.notifyStorageLocal(prefString, false);
        }
      });

      await browser.SL3U.injectScript("utils/moment.min.js");
      await browser.SL3U.injectScript("utils/static.js");
      await browser.SL3U.injectScript("experiments/headerView.js");

      SLStatic.debug("Registering window listeners");
      await browser.SL3U.startObservers();
      await browser.SL3U.bindKeyCodes();

      // Start background loop to check for scheduled messages.
      setTimeout(SendLater.mainLoop, 0);
    },

    mainLoop: function() {
      SLStatic.debug("Entering main loop.");

      browser.storage.local.get({ preferences: {} }).then((storage) => {
        let interval = +storage.preferences.checkTimePref || 0;

        if (storage.preferences.sendDrafts && interval > 0) {
          SendLater.forAllDrafts(
            SendLater.possiblySendMessage,
            true
          ).catch(SLStatic.error);
        }

        // TODO: Should use a persistent reference to the this timeout that can be
        // scrapped and restarted upon changes in the delay preference.
        interval = Math.max(1, interval);
        SLStatic.debug(
          `Next main loop iteration in ${interval} ` +
          `minute${interval > 1 ? "s" : ""}.`
        );
        SLStatic.previousLoop = new Date();
        setTimeout(SendLater.mainLoop, 60000*interval);
      });
    }
}; // SendLater

browser.SL3U.onKeyCode.addListener(keyid => {
  console.info(`Received keycode ${keyid}`);
  switch (keyid) {
    case "key_altShiftEnter": {
      if (SendLater.prefCache.altBinding) {
        browser.composeAction.openPopup();
      } else {
        SLStatic.info("Ignoring Alt+Shift+Enter on account of user preferences");
      }
      break;
    }
    case "key_sendLater": {
      // User pressed ctrl+shift+enter
      SLStatic.debug("Received Ctrl+Shift+Enter.");
      if (SendLater.prefCache.altBinding) {
        SLStatic.info("Passing Ctrl+Shift+Enter along to builtin send later " +
                      "because user bound alt+shift+enter instead.");
        browser.tabs.query({ active:true, mailTab:false }).then(tabs => {
          let thistab = undefined;
          for (let tab of tabs) {
            if (!tab.mailTab) {
              thistab = tab;
              break;
            }
          }
          if (thistab === undefined) {
            SLStatic.error("Cannot find current compose window");
            return;
          } else {
            SendLater.composeState[thistab.id] = "sending";
            browser.SL3U.builtInSendLater().then(()=>{
              setTimeout(() => delete SendLater.composeState[thistab.id], 1000);
            });
          }
        }).catch(ex => SLStatic.error("Error starting builtin send later",ex));
      } else {
        SLStatic.info("Opening popup");
        browser.composeAction.openPopup();
      }
      break;
    }
    case "cmd_sendLater":
    {
      // User clicked the "Send Later" menu item, which should always be bound
      // to the send later plugin.
      browser.composeAction.openPopup();
      break;
    }
    default: {
      SLStatic.error(`Unrecognized keycode ${keyid}`);
    }
  }
});

// Intercept sent messages. Decide whether to handle them or just pass them on.
browser.compose.onBeforeSend.addListener(tab => {
  console.info(`Received onBeforeSend from tab`,tab);
  if (SendLater.composeState[tab.id] === "sending") {
    // Avoid blocking extension's own send events
    setTimeout(() => delete SendLater.composeState[tab.id], 1000);
    return { cancel: false };
  } else if (SendLater.prefCache.sendDoesSL) {
    SLStatic.info("Send does send later. Opening popup.")
    browser.composeAction.enable(tab.id);
    browser.composeAction.openPopup();
    return ({ cancel: true });
  } else if (SendLater.prefCache.sendDoesDelay) {
    const sendDelay = SendLater.prefCache.sendDelay;
    SLStatic.debug(`Scheduling SendLater ${sendDelay} minutes from now.`);
    SendLater.scheduleSendLater(tab.id, { delay: sendDelay });
    return ({ cancel: true });
  } else {
    SLStatic.debug(`Bypassing send later.`);
    return ({ cancel: false });
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
        browser.storage.local.set(storage);
      });
      return true;
    }
  });

browser.runtime.onMessage.addListener(async (message) => {
  const response = {};
  switch (message.action) {
    case "alert": {
      browser.SL3U.alert(message.title, message.text);
      break;
    }
    case "doSendNow": {
      SLStatic.debug("User requested send immediately.");

      if (await browser.SL3U.isOffline()) {
        // TODO -> Option to place in outbox.
        browser.SL3U.alert("Thunderbird is offline.",
                           "Cannot send message at this time.");
      } else {
        SendLater.composeState[message.tabId] = "sending";
        browser.SL3U.sendNow().then(()=>{
          setTimeout(() => delete SendLater.composeState[message.tabId], 1000);
        });
      }
      break;
    }
    case "doSendLater": {
      SLStatic.debug("User requested send later.");
      if (await browser.SL3U.preSendCheck()) {
        const options = { sendAt: message.sendAt,
                          recurSpec: message.recurSpec,
                          args: message.args,
                          cancelOnReply: message.cancelOnReply };
        SendLater.scheduleSendLater(message.tabId, options);
      } else {
        SLStatic.info("User cancelled send via presendcheck.");
      }
      break;
    }
    case "evaluateUfuncByContents":
    case "evaluateUfuncByName": {
      const { name, time, argStr } = message;
      SLStatic.debug(`Evaluating function ${name}`);

      let body;
      if (message.action === "evaluateUfuncByName") {
        const { ufuncs } = await browser.storage.local.get({ ufuncs: {} });
        const func = ufuncs[name];
        body = func.body;
      } else if (message.action === "evaluateUfuncByContents") {
        body = message.body;
      } else {
        // How did we get here?
        break;
      }

      const prev = (new Date(time)).getTime();
      const [next, nextspec, nextargs, error] =
        await browser.SL3U.call(name, body, prev, argStr).catch(ex => {
          SLStatic.error(`User function ${name} failed with exception`,ex);
          return [undefined, undefined, undefined, ex.message];
        });
      SLStatic.debug("User function returned:",
                      {next, nextspec, nextargs, error});
      if (error) {
        response.err = error;
      } else {
        response.next = SLStatic.parseableDateTimeFormat(next);
        response.nextspec = nextspec || "none";
        response.nextargs = nextargs || "";
      }
      break;
    }
    case "getScheduleText": {
      try {
        const dispMsgHdr =
          await browser.messageDisplay.getDisplayedMessage(message.tabId);
        const dispMsg = await browser.messages.getFull(dispMsgHdr.id);
        const { preferences } = await browser.storage.local.get({ preferences: {} });

        if (!dispMsg.headers['x-send-later-at']) {
          response.err = "Message is not scheduled by Send Later.";
          break;
        } else if (!dispMsg.headers['message-id']) {
          response.err = "Message somehow has no message-id header";
          break;
        } else if (dispMsg.headers['x-send-later-uuid'][0] !== preferences.instanceUUID) {
          response.err = "Message is scheduled by a different Thunderbird instance";
          break;
        }

        const headerSendAt = new Date(dispMsg.headers['x-send-later-at'][0]);

        let contentType = dispMsg.headers['content-type'];
        if (contentType) {
          if ((/encrypted/i).test(contentType[0])) {
            response.err = "Message is encrypted and will not be processed by Send Later.";
            break;
          }
        }

        const sendAt = new Date(headerSendAt);
        const recurSpec = (dispMsg.headers['x-send-later-recur'] || ["none"])[0];
        const recur = SLStatic.parseRecurSpec(recurSpec);
        recur.cancelOnReply =
          ((dispMsg.headers['x-send-later-cancel-on-reply']||[""])[0] === "true"
        || (dispMsg.headers['x-send-later-cancel-on-reply']||[""])[0] === "yes");
        recur.args = (dispMsg.headers['x-send-later-args']||[""])[0];
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
browser.messages.onNewMailReceived.addListener(async (folder, messagelist) => {
  // First, we want to skip onNewMailReceived events triggered locally during
  // regular send, move, and copy operations. We never touch archives folders anyway,
  // so we can immediately ignore this if it's an operation on an archives folder.
  if (folder.type === "archives") {
    SLStatic.debug(`Skipping onNewMailReceived for outgoing message(s)`,messagelist);
    return;
  }

  // We can't do this processing right away, because the message might not be
  // accessible via browser.messages, so we'll schedule it for a few seconds from now.
  setTimeout(async () => {
    const myself = SLStatic.flatten(await browser.accounts.list().then(accts =>
      accts.map(acct => acct.identities.map(identity => identity.email))));

    for (let hdr of messagelist.messages) {
      SLStatic.debug(`Received new message: ${hdr.subject}`);

      const fullRecvdMsg = await browser.messages.getFull(hdr.id).catch(
        ex => SLStatic.error(`Cannot fetch full message ${hdr.id}`,ex));
      if (fullRecvdMsg === undefined) {
        SLStatic.debug(`getFull returned undefined message in onNewMailReceived listener`);
      } else {
        // Saving a message is processed as an incoming message. If we wanted to save it
        // to drafts, we should do that now.
        const messageId = fullRecvdMsg.headers['message-id'][0];
        if (SendLater.watchAndMarkRead.has(messageId)) {
          SLStatic.debug(`Marking draft message read ${messageId}`);
          SendLater.watchAndMarkRead.delete(messageId);
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

        // const recvdMsgRefs = (fullRecvdMsg.headers['references'] || []);
        const isReplyToStr = (fullRecvdMsg.headers['in-reply-to']||[""])[0];
        const isReplyTo = [...isReplyToStr.matchAll(/(<\S*>)/gim)].map(i=>i[1]);
        SLStatic.debug(`Message is a reply to`,isReplyTo);
        if (isReplyTo) {
          SendLater.forAllDrafts(async draftMsg => {
            const fullDraftMsg = await browser.messages.getFull(draftMsg.id);
            const cancelOnReply = (fullDraftMsg.headers['x-send-later-cancel-on-reply'] &&
                        (fullDraftMsg.headers['x-send-later-cancel-on-reply'][0] === "true"
                      || fullDraftMsg.headers['x-send-later-cancel-on-reply'][0] === "yes"));
            if (cancelOnReply) {
              const draftMsgRefStr = (fullDraftMsg.headers['references'] || [""])[0];
              const draftMsgRefs = [...draftMsgRefStr.matchAll(/(<\S*>)/gim)].map(i=>i[1]);
              //const isReferenced = draftMsgRefs.some(item => recvdMsgRefs.includes(item));
              const isReferenced = draftMsgRefs.some(item => isReplyTo.includes(item));
              if (isReferenced) {
                const msgId = fullDraftMsg.headers['message-id'][0];
                SLStatic.info(`Received response to message ${msgId}. Deleting scheduled draft.`);
                SLStatic.debug(fullDraftMsg);
                browser.messages.delete([draftMsg.id], true);
              }
            }
          }, true);
        }
      }
    }
  }, 5000);
});

browser.messageDisplay.onMessageDisplayed.addListener(async (tab, hdr) => {
  browser.messageDisplayAction.disable(tab.id);
  if (hdr.folder.type === "drafts") {
    const { preferences } = await browser.storage.local.get({ preferences: {} });
    const enableDisplayAction = () => {
      browser.messages.getFull(hdr.id).then(fullMessage => {
        if (fullMessage.headers['x-send-later-at']) {
          const msgUUID = fullMessage.headers['x-send-later-uuid'][0];
          if (msgUUID === preferences.instanceUUID) {
            SLStatic.debug("Displayed message has send later headers.");
            browser.messageDisplayAction.enable(tab.id);
          } else {
            SLStatic.debug(`Displayed message is scheduled by a different ` +
              `Thunderbird instance: ${msgUUID}`);
          }
        } else {
          SLStatic.debug("This message does not have Send Later headers.");
        }
      }).catch(ex => SLStatic.error("Could not get full message contents",ex));
    };
    setTimeout(enableDisplayAction, 0);
  } else {
    SLStatic.debug("This is not a Drafts folder, so Send Later will not scan it.");
  }
});

SendLater.init();
