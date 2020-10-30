// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
    prefCache: {},

    composeState: {},

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
      await browser.SL3U.saveAsDraft(composeDetails.identityId);

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
      const message = await browser.messages.getFull(id);

      const header = (msg, hdr) => (msg.headers[hdr] ? msg.headers[hdr][0] : undefined);

      const msgSendAt = header(message, 'x-send-later-at');
      const msgRecurSpec = header(message, 'x-send-later-recur');
      const msgRecurArgs = header(message, 'x-send-later-args');
      const originalMsgId = header(message, 'message-id');
      const contentType = header(message, 'content-type');

      if (msgSendAt === undefined) {
        return;
      }
      const nextSend = new Date(msgSendAt);

      if ((/encrypted/i).test(contentType)) {
        SLStatic.warn(`Message ${originalMsgId} is encrypted, and will not be processed by Send Later.`);
        return;
      }

      const { preferences } = await browser.storage.local.get({"preferences":{}});

      if (!(Date.now() >= nextSend.getTime())) {
        SLStatic.debug(`Message ${id} not due for send until ${SLStatic.humanDateTimeFormat(nextSend)}`);
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
      SLStatic.info(`Sending message ${originalMsgId}.`);
      const rawContent = await browser.messages.getRaw(id);

      const success = await browser.SL3U.sendRaw(
        SLStatic.prepNewMessageHeaders(rawContent),
        preferences.sendUnsentMsgs).catch(ex=>{
          SLStatic.error(`Error sending raw message from drafts`,ex);
          return null;
        });

      if (!success) {
        SLStatic.error(`Something went wrong while sending message ${originalMsgId}`);
        return;
      }

      let nextRecur;
      if (recur.type !== "none") {
        nextRecur = await SLStatic.nextRecurDate(nextSend, msgRecurSpec,
                                                  new Date(), args);
      }

      if (nextRecur) {
        SLStatic.info(`Scheduling next recurrence of message ${originalMsgId} ` +
          `at ${nextRecur.toLocaleString()}, with recurSpec "${msgRecurSpec}"`);

        const msgHdr = await browser.messages.get(id);
        const folder = msgHdr.folder;

        let newMsgContent = rawContent;

        const nextRecurStr = SLStatic.parseableDateTimeFormat(nextRecur);
        newMsgContent = SLStatic.replaceHeader(newMsgContent, "X-Send-Later-At", nextRecurStr);

        const newMessageId = await browser.SL3U.generateMsgId(rawContent);
        newMsgContent = SLStatic.replaceHeader(newMsgContent, 'Message-ID', newMessageId);

        newMsgContent = SLStatic.appendHeader(newMsgContent, "References", originalMsgId);

        browser.SL3U.saveMessage(folder.accountId, folder.path, newMsgContent).then(success => {
          if (success) {
            if (preferences.markDraftsRead) {
              setTimeout(SendLater.markDraftsRead, 5000);
            }
            SLStatic.info(`Scheduled next occurrence of message <${originalMsgId}>. Deleting original.`);
            browser.messages.delete([id], true);
          } else {
            SLStatic.error("Unable to schedule next recuurrence.");
          }
        }).catch(ex => {
          SLStatic.error(`Error replacing Draft message for next occurrence`,ex);
        });
      } else {
        SLStatic.info(`No recurrences for message ${originalMsgId}. Deleting draft.`);
        browser.messages.delete([id], true);
      }
    },

    injectScripts: async function() {
      const { preferences } = await browser.storage.local.get({"preferences":{}});
      await browser.SL3U.notifyStorageLocal(preferences, true);
      await browser.SL3U.injectScript("utils/moment.min.js","mail:3pane");
      await browser.SL3U.injectScript("utils/static.js","mail:3pane");
      await browser.SL3U.injectScript("experiments/headerView.js","mail:3pane");
    },

    init: async function() {
      browser.storage.local.get({preferences: {}, ufuncs:{}}).then(storage => {
        SendLater.prefCache = storage.preferences;
        SLStatic.ufuncs = storage.ufuncs;
      });

      SLStatic.debug("Registering window listeners");
      await browser.SL3U.initializeSendLater();
      await browser.SL3U.startObservers();
      await browser.SL3U.bindKeyCodes();
      await SendLater.injectScripts();

      // Start background loop to check for scheduled messages.
      setTimeout(SendLater.mainLoop, 0);
    },

    mainLoop: function() {
      SLStatic.debug("Entering main loop.");

      browser.storage.local.get({ "preferences": {} }).then(storage => {
        let interval = (+storage.preferences.checkTimePref) || 0;

        if (storage.preferences.sendDrafts && interval > 0) {
          SendLater.forAllDrafts(
            async msg => SendLater.possiblySendMessage(msg.id).catch(SLStatic.error)
          ).catch(SLStatic.error);
        }

        if (storage.preferences.markDraftsRead) {
          SendLater.markDraftsRead();
        }

        // TODO: Should use a persistent reference to the this timeout that can be
        // scrapped and restarted upon changes in the delay preference.
        interval = Math.max(1,interval);
        SLStatic.debug(`Next main loop iteration in ${interval} minute${interval > 1 ? "s" : ""}.`);
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
    case "reloadPrefCache": {
      await browser.storage.local.get({preferences: {}}).then(storage => {
        SendLater.prefCache = storage.preferences;
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
  // regular send, move, and copy operations.
  if (folder.type === "archives") {
    SLStatic.debug(`Skipping onNewMailReceived for outgoing message(s)`,messagelist);
    return;
  }
  const myself = SLStatic.flatten(await browser.accounts.list().then(accts =>
    accts.map(acct => acct.identities.map(identity => identity.email))));

  messagelist.messages.forEach(msgHdr => {
    for (let email of myself) {
      if (msgHdr.author.indexOf(email) > -1) {
        SLStatic.debug(`Skipping onNewMailReceived for message "${msgHdr.subject}"`);
        return;
      }
    }
    SLStatic.debug("Received message",msgHdr);
    // We can't do this processing right away, because the message will not be
    // accessible via browser.messages, so we'll schedule it via setTimeout.
    const scanIncomingMessage = async (hdr) => {
      const fullRecvdMsg = await browser.messages.getFull(hdr.id).catch(
        ex => SLStatic.error(`Cannot fetch full message ${hdr.id}`,ex));
      if (fullRecvdMsg === undefined) {
        SLStatic.debug(`getFull returned undefined message in onNewMailReceived listener`);
      } else {
        SLStatic.debug(`Full message`,fullRecvdMsg);
        // const recvdMsgRefs = (fullRecvdMsg.headers['references'] || []);
        const isReplyToStr = (fullRecvdMsg.headers['in-reply-to']||[""])[0];
        const isReplyTo = [...isReplyToStr.matchAll(/(<\S*>)/gim)].map(i=>i[1]);
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
          });
        }
      }
    };
    setTimeout((() => { scanIncomingMessage(msgHdr) }), 5000);
  });
});

browser.windows.onCreated.addListener(async (window) => {
  SendLater.injectScripts();
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
