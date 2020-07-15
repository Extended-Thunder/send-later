// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
    // Track unresolved promises that can be resolved by some future event.
    _PromiseMap: new Map(),

    prefCache: {},

    composeState: {},

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
        for (subFolder of folder.subFolders) {
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

    async forAllDrafts(callback) {
      try {
        browser.accounts.list().then(accounts => {
          accounts.forEach(acct => {
              SendLater.getDraftFolders(acct).then(draftFolders => {
                draftFolders.forEach(async drafts => {
                  let page = await browser.messages.list(drafts);
                  do {
                    page.messages.forEach(callback);
                    if (page.id) {
                      page = await browser.messages.continueList(page.id);
                    }
                  } while (page.id);
                });
              });
          });
        });
      } catch (ex) {
        console.error(ex);
      }
    },

    async markDraftsRead() {
      SendLater.forAllDrafts(async msg => {
        const fullMsg = await browser.messages.getFull(msg.id);
        if (fullMsg.headers['x-send-later-at']) {
          const msgHdr = await browser.messages.get(msg.id);
          if (!msgHdr.read) {
            SLStatic.debug(`Marking message ${msg.id} read.`);
            browser.messages.update(msg.id, { read: true });
          }
        }
      });
    },

    async scheduleSendLater(tabId, options) {
      SLStatic.info(`Scheduling send later: ${tabId} with options`,options);
      const customHeaders = {};

      // Determine time at which this message should be sent
      if (options.sendAt !== undefined) {
        const sendAt = new Date(options.sendAt);
        customHeaders["x-send-later-at"] = SLStatic.dateTimeFormat(sendAt);
      } else if (options.delay !== undefined) {
        const sendAt = new Date(Date.now() + options.delay*60000);
        customHeaders["x-send-later-at"] = SLStatic.dateTimeFormat(sendAt);
      } else {
        SLStatic.error("scheduleSendLater requires scheduling information");
        return;
      }

      if (options.recurSpec) {
        customHeaders['x-send-later-recur'] = options.recurSpec;
      }

      if (options.args) {
        customHeaders['x-send-later-args'] = options.args;
      }

      if (options.cancelOnReply) {
        customHeaders['x-send-later-cancel-on-reply'] = options.cancelOnReply;
      }

      const inserted = Object.keys(customHeaders).map(name =>
        browser.SL3U.setHeader(name, customHeaders[name])
      );
      await Promise.all(inserted);
      SLStatic.debug('headers',customHeaders);

      await browser.SL3U.SaveAsDraft();
      browser.storage.local.get({preferences:{}}).then(storage => {
        if (storage.preferences.markDraftsRead) {
          setTimeout(SendLater.markDraftsRead, 5000);
        } else {
          SLStatic.debug("Skipping mark all read.",storage.preferences);
        }
      });
      browser.tabs.remove(tabId);
    },

    async possiblySendMessage(id) {
      if (browser.SL3U.isOffline()) {
        return;
      }
      // Determines whether or not a particular draft message is due to be sent
      const msg = await browser.messages.getFull(id);

      const msgSendAt = msg.headers['x-send-later-at'] ? msg.headers['x-send-later-at'][0] : undefined;
      const msgRecurSpec = msg.headers['x-send-later-recur'] ? msg.headers['x-send-later-recur'][0] : undefined;
      const msgRecurArgs = msg.headers['x-send-later-args'] ? msg.headers['x-send-later-args'][0] : undefined;
      const msgRecurCancelOnReply = msg.headers['x-send-later-cancel-on-reply'] ? msg.headers['x-send-later-cancel-on-reply'][0] : undefined;
      const msgId = msg.headers['message-id'] ? msg.headers['message-id'][0] : undefined;

      if (msgSendAt === undefined) {
        return;
      }

      const { preferences } = await browser.storage.local.get({"preferences":{}});
      const { lock } = await browser.storage.local.get({"lock":{}});

      const nextSend = lock[msgId] ? lock[msgId].nextRecur : new Date(msgSendAt);

      if (Date.now() < nextSend.getTime()) {
        SLStatic.debug(`Message ${id} not due for send until ${nextSend.toLocaleString()}`);
        return;
      }

      if (await SendLater.isEditing(msgId)) {
        SLStatic.debug(`Skipping message ${msgId} while it is being edited`);
        return;
      }

      const recur = SLStatic.ParseRecurSpec(msgRecurSpec);
      const args = SLStatic.parseArgs(msgRecurArgs);

      if (preferences.enforceTimeRestrictions) {
        const now = Date.now();

        // Respect late message blocker
        if (preferences.blockLateMessages) {
          const lateness = (now - nextSend.getTime()) / 60000;
          if (lateness > preferences.lateGracePeriod) {
            SLStatic.info(`Grace period exceeded for message ${id}`);
            return;
          }
        }

        // Respect "send between" preference
        if (recur.between) {
          if ((now < recur.between.start) || (now > recur.between.end)) {
            SLStatic.debug(`Message ${id} outside of sendable time range.`);
            return;
          }
        }

        // Respect "only on days of week" preference
        if (recur.days) {
          const today = (new Date()).getDay();
          if (!recur.days.includes(today)) {
            const wkday = new Intl.DateTimeFormat('default', {weekday:'long'});
            SLStatic.debug(`Message ${id} not scheduled to send on ${wkday.format(new Date())}`);
          }
        }
      }

      // Initiate send from draft message
      SLStatic.debug(`Sending message ${msgId}.`);
      const rawContent = await browser.messages.getRaw(id);

      browser.SL3U.sendRaw(SLStatic.prepNewMessageHeaders(rawContent));

      let nextRecur;
      if (recur.type !== "none") {
        nextRecur = SLStatic.NextRecurDate(nextSend, msgRecurSpec, new Date(), args);
      }

      // TODO: Update the draft message with a new x-send-at header. This
      // method does not work if send later is installed on two browsers with an
      // IMAP account. (Although that situation is not well supported anyway)
      if (nextRecur) {
        SLStatic.debug(`Scheduling next recurrence of message ${msgId} ` +
          `at ${nextRecur.toLocaleString()}, with recurSpec "${msgRecurSpec}"`);
        lock[msgId] = { lastSent: new Date(), nextRecur };
        browser.storage.local.set({ lock });
      } else {
        SLStatic.debug(`No recurrences for message ${msgId}. Deleting draft.`);
        browser.messages.delete([id], true);
      }
    },

    mainLoop: function() {
      SLStatic.debug("Entering main loop.");

      SendLater.forAllDrafts(
        async msg => SendLater.possiblySendMessage(msg.id)
      ).catch(SLStatic.error);

      // TODO: Use a persistent reference to the this timeout that can be
      // scrapped and restarted upon changes in the delay preference.
      browser.storage.local.get({ "preferences": {} }).then(storage => {
        const interval = +storage.preferences['checkTimePref'];
        SLStatic.debug(`Next main loop iteration in ${interval} minutes.`);
        setTimeout(SendLater.mainLoop, 60000*interval);
      });
    }
};

browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log(tabId, removeInfo);
});

// Intercept sent messages. Decide whether to handle them or just pass them on.
browser.compose.onBeforeSend.addListener(tab => {
  if (SendLater.composeState[tab.id] === "sending") {
    return { cancel: false };
  }

  if (SendLater.prefCache.sendDoesSL) {
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

// Button clicks in the UI popup window send messages back to this function
// via the WebExtension messaging API.
browser.runtime.onMessage.addListener((message) => {
  const resolve = SendLater._PromiseMap.get(message.tabId);

  if (message.action === "doSendNow" ) {
    SLStatic.debug("User requested send immediately.");
    if (resolve !== undefined) {
      // If already blocking a send operation, just get out of the way.
      SendLater._PromiseMap.delete(message.tabId);
      resolve({ cancel: false });
    } else {
      // Otherwise, initiate a new send operation.
      if (browser.SL3U.isOffline()) {
        browser.SL3U.alert("Thunderbird is offline.",
                           "Cannot send message at this time.");
      } else {
        SendLater.composeState[message.tabId] = "sending";
        browser.SL3U.SendNow().then(()=>{
          delete SendLater.composeState[message.tabId];
        });
      }
    }
  } else if (message.action === "doSendLater") {
    SLStatic.debug("User requested send later.");
    const options = { sendAt: message.sendAt,
                      recurSpec: message.recurSpec,
                      args: message.args,
                      cancelOnReply: message.cancelOnReply };
    SendLater.scheduleSendLater(message.tabId, options);
    if (resolve !== undefined) {
      SendLater._PromiseMap.delete(message.tabId);
      resolve({ cancel: true });
    }
  } else if (message.action === "reloadPrefCache") {
    browser.storage.local.get({preferences: {}}).then(storage => {
      SendLater.prefCache = storage.preferences;
    });
  } else {
    SLStatic.warn(`Unrecognized operation <${message.action}>.`);
    if (resolve !== undefined) {
      SendLater._PromiseMap.delete(message.tabId);
      resolve({ cancel: true });
    }
  }
});

browser.storage.local.get({preferences: {}}).then(storage => {
  SendLater.prefCache = storage.preferences;
});

// Start background loop to check for scheduled messages.
setTimeout(SendLater.mainLoop, 0);
