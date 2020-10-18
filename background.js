// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
    prefCache: {},

    composeState: {},

    async setReplywatch(newMessageId, originalMessageId) {
      // Outgoing messages get unique message IDs. We need to keep track that
      // responses to `newMessageId` are really replies to `originalMessageId`
      browser.storage.local.get({ watchForReply: {} }).then(
        ({ watchForReply }) => {
          watchForReply[newMessageId] = originalMessageId;
          browser.storage.local.set({ watchForReply });
        }
      );
    },

    async removeReplyWatch(msgId) {
      browser.storage.local.get({ watchForReply: {} }).then(
        ({ watchForReply }) => {
          if (watchForReply[msgId]) {
            delete watchForReply[msgId];
            browser.storage.local.set({ watchForReply });
          }
        }
      );
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
        SLStatic.error(ex);
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

    async expandRecipients(tabId) {
      let details = {};
      for (let type of ["to", "cc", "bcc"]) {
        details[type] = await browser.SL3U.expandRecipients(type);
      }
      await browser.compose.setComposeDetails(tabId, details);
    },

    async scheduleSendLater(tabId, options) {
      SLStatic.info(`Scheduling send later: ${tabId} with options`,options);
      const customHeaders = {};

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
          customHeaders['x-send-later-cancel-on-reply'] = "true";
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
      if (await browser.SL3U.isOffline()) {
        return;
      }
      // Determines whether or not a particular draft message is due to be sent
      const msg = await browser.messages.getFull(id);

      const msgSendAt = msg.headers['x-send-later-at'] ? msg.headers['x-send-later-at'][0] : undefined;
      const msgRecurSpec = msg.headers['x-send-later-recur'] ? msg.headers['x-send-later-recur'][0] : undefined;
      const msgRecurArgs = msg.headers['x-send-later-args'] ? msg.headers['x-send-later-args'][0] : undefined;
      const msgRecurCancelOnReply =
        (msg.headers['x-send-later-cancel-on-reply'] &&
          (msg.headers['x-send-later-cancel-on-reply'][0] === "true"
        || msg.headers['x-send-later-cancel-on-reply'][0] === "yes"));
      const msgId = msg.headers['message-id'] ? msg.headers['message-id'][0] : undefined;

      if (msgSendAt === undefined) {
        return;
      }

      const { preferences } = await browser.storage.local.get({"preferences":{}});
      const { lock } = await browser.storage.local.get({"lock":{}});

      const nextSend = new Date(lock[msgId] ? lock[msgId].nextRecur : msgSendAt);

      if (!(Date.now() >= nextSend.getTime())) {
        SLStatic.debug(`Message ${id} not due for send until ${SLStatic.humanDateTimeFormat(nextSend)}`);
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
      SLStatic.info(`Sending message ${msgId}.`);
      const rawContent = await browser.messages.getRaw(id);

      const newMessageId = await browser.SL3U.sendRaw(
        SLStatic.prepNewMessageHeaders(rawContent),
        preferences.sendUnsentMsgs).catch(ex=>{
          SLStatic.error(`Error sending raw message from drafts`,ex);
          return null;
        });

      if (!newMessageId) {
        SLStatic.error(`Something went wrong while sending message ${msgId}`);
        return;
      }

      if (msgRecurCancelOnReply) {
        SendLater.setReplywatch(newMessageId, msgId);
      }


      let nextRecur;
      if (recur.type !== "none") {
        nextRecur = await SLStatic.NextRecurDate(nextSend, msgRecurSpec,
                                                  new Date(), args);
      }

      // TODO: Update the draft message with a new x-send-at header. This
      // method does not work if send later is installed on two browsers with an
      // IMAP account. (Although that situation is not well supported anyway)
      if (nextRecur) {
        SLStatic.info(`Scheduling next recurrence of message ${msgId} ` +
          `at ${nextRecur.toLocaleString()}, with recurSpec "${msgRecurSpec}"`);
        lock[msgId] = {
          lastSent: SLStatic.parseableDateTimeFormat(new Date()),
          nextRecur: SLStatic.parseableDateTimeFormat(nextRecur)
        };
        browser.storage.local.set({ lock });
      } else {
        SLStatic.info(`No recurrences for message ${msgId}. Deleting draft.`);
        browser.messages.delete([id], true);
      }
    },

    init: async function() {
      browser.storage.local.get({preferences: {}, ufuncs:{}}).then(storage => {
        SendLater.prefCache = storage.preferences;
        SLStatic.ufuncs = storage.ufuncs;
      });

      SLStatic.debug("Registering window listeners");
      browser.SL3U.bindKeyCodes();

      await browser.storage.local.get({preferences: {}}).then(storage => {
        storage.preferences['sendLaterColumnLabel'] = browser.i18n.getMessage("extensionName");
        storage.preferences['sendLaterColumnTooltip'] = browser.i18n.getMessage("extensionDescription");
        browser.SL3U.notifyStorageLocal(storage.preferences, true);
      });
      browser.SL3U.injectScript("utils/moment.min.js","mail:3pane");
      browser.SL3U.injectScript("utils/static.js","mail:3pane");
      browser.SL3U.injectScript("experiments/DraftsColumn.js","mail:3pane");

      // Start background loop to check for scheduled messages.
      setTimeout(SendLater.mainLoop, 0);
    },

    mainLoop: function() {
      SLStatic.debug("Entering main loop.");

      SendLater.forAllDrafts(
        async msg => SendLater.possiblySendMessage(msg.id).catch(SLStatic.error)
      ).catch(SLStatic.error);

      browser.storage.local.get({ "preferences": {} }).then(storage => {
        if (storage.preferences.markDraftsRead) {
          SendLater.markDraftsRead()
        }

        // TODO: Should use a persistent reference to the this timeout that can be
        // scrapped and restarted upon changes in the delay preference.
        const interval = +storage.preferences.checkTimePref || 1;
        SLStatic.debug(`Next main loop iteration in ${interval} minutes.`);
        setTimeout(SendLater.mainLoop, 60000*interval);
      });
    }

};

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
        browser.tabs.query({ active:true, currentWindow:true }).then(tabs => {
          const tabId = tabs[0].id;
          SendLater.composeState[tabId] = "sending";
          browser.SL3U.builtInSendLater().then(()=>{
            setTimeout(() => delete SendLater.composeState[tabId], 1000);
          });
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
        browser.SL3U.alert("Thunderbird is offline.",
                           "Cannot send message at this time.");
      } else {
        SendLater.composeState[message.tabId] = "sending";
        browser.SL3U.SendNow().then(()=>{
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
    case "reloadPrefCache": {
      await browser.storage.local.get({preferences: {}}).then(storage => {
        SendLater.prefCache = storage.preferences;

        storage.preferences['sendLaterColumnLabel'] = browser.i18n.getMessage("extensionName");
        storage.preferences['sendLaterColumnTooltip'] = browser.i18n.getMessage("extensionDescription");
        browser.SL3U.notifyStorageLocal(storage.preferences, false);
      });
      break;
    }
    case "reloadUfuncs":
      browser.storage.local.get({ ufuncs: {} }).then(storage => {
        SLStatic.ufuncs = storage.ufuncs;
      });
      break;
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

      const [next, nextspec, nextargs, error] =
        await browser.SL3U.call(name, body, time, argStr).catch(ex => {
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
        const dispMsg = await browser.messageDisplay.
          getDisplayedMessage(message.tabId).then(
            async hdr => await browser.messages.getFull(hdr.id));

        const headerSendAt = new Date(dispMsg.headers['x-send-later-at'][0]);
        const msgId = (dispMsg.headers['message-id'] || [])[0];

        if (headerSendAt === undefined) {
          response.err = "Message is not scheduled by Send Later.";
          break;
        } else if (msgId === undefined) {
          response.err = "Message somehow has no message-id header";
          break;
        }

        const msgLock = await browser.storage.local.get({ lock: {} }).then(
          ({ lock }) => (lock[msgId] || {}));
        const sendAt = new Date(msgLock.nextRecur || headerSendAt);

        const recurSpec = (dispMsg.headers['x-send-later-recur'] || ["none"])[0];
        const recur = SLStatic.ParseRecurSpec(recurSpec);
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

browser.messages.onNewMailReceived.addListener(async (folder, messagelist) => {
  // Message ID of sent messages do not correspond with the message id of
  // original draft versions. The local storage `watchForReply` object maps
  // between the message IDs that we have sent and the message Id of the
  // original draft messages.

  // First, we want to skip onNewMailReceived events triggered locally during
  // regular send operations.
  if (folder.type === "archives") {
    SLStatic.debug(`Skipping onNewMailReceived for outgoing message(s)`,messagelist);
    return;
  }
  const myself = SLStatic.flatten(await browser.accounts.list().then(accts =>
    accts.map(acct => acct.identities.map(identity => identity.email))));

  messagelist.messages.forEach(async hdr => {
    for (let email of myself) {
      if (hdr.author.indexOf(email) > -1) {
        SLStatic.debug(`Skipping onNewMailReceived for outgoing message "${hdr.subject}"`);
        return;
      }
    }
    SLStatic.debug("Received message",hdr);
    // We can't do this processing right away, because the message will not be
    // accessible via browser.messages
    setTimeout(() => (async () => {
      const fullRecvdMsg = await browser.messages.getFull(hdr.id).catch(
        ex => SLStatic.error(`Cannot fetch full message ${hdr.id}`,ex));
      if (fullRecvdMsg === undefined) {
        SLStatic.debug(`getFull returned undefined message in onNewMailReceived listener`);
      } else {
        SLStatic.debug(`Full message`,fullRecvdMsg);
        (fullRecvdMsg.headers['references'] || []).forEach(async refMsgId => {
          SLStatic.debug(`Message in reference to ${refMsgId}`);
          // incoming message references `refMsgId`. Let's check if we
          // need to cancel a recurring message because of that.
          const { watchForReply } = await browser.storage.local.get({ watchForReply: {} });
          if (watchForReply[refMsgId]) {
            const isReplyTo = watchForReply[refMsgId];

            SLStatic.info(`Received reply to message ${isReplyTo}.`);

            // Look through drafts for message with original message id.
            SendLater.forAllDrafts(async draftMsg => {
              const fullDraftMsg = await browser.messages.getFull(draftMsg.id);
              if (fullDraftMsg.headers['message-id'][0] === isReplyTo) {
                SLStatic.info(`Deleting draft ${draftMsg.id} of message ${isReplyTo}`);
                browser.messages.delete([draftMsg.id], true);
              }
            });

            // There may be multiple outgoing messages that are attached to
            // the same draft message. Let's clear those out of the watch list.
            let count = 0;
            for (let key of Object.keys(watchForReply)) {
              if (watchForReply[key] === isReplyTo) {
                SendLater.removeReplyWatch(key);
                count++;
              }
            }
            SLStatic.debug(`Stopped listeneing for replies to ${count} outgoing messages`);
          }
        });
      }
    })().catch(ex => SLStatic.error('Error processing message',ex)), 1000);
  });
});

browser.windows.onCreated.addListener(async (window) => {
  await browser.storage.local.get({preferences: {}}).then(storage => {
    storage.preferences['sendLaterColumnLabel'] = browser.i18n.getMessage("extensionName");
    storage.preferences['sendLaterColumnTooltip'] = browser.i18n.getMessage("extensionDescription");
    browser.SL3U.notifyStorageLocal(storage.preferences, true);
  });
  browser.SL3U.injectScript("utils/moment.min.js","mail:3pane");
  browser.SL3U.injectScript("utils/static.js","mail:3pane");
  browser.SL3U.injectScript("experiments/DraftsColumn.js","mail:3pane");
});

browser.messageDisplay.onMessageDisplayed.addListener(async (tab, hdr) => {
  browser.messageDisplayAction.disable(tab.id);
  if (hdr.folder.type === "drafts") {
    const enableDisplayAction = () => {
      browser.messages.getFull(hdr.id).then(fullMessage => {
        if (fullMessage.headers['x-send-later-at']) {
          SLStatic.debug("Displayed message has send later headers.");
          browser.messageDisplayAction.enable(tab.id);
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
