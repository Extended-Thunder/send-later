// Pseudo-namespace encapsulation for global-ish variables.
const SendLater = {
    // Track unresolved promises that can be resolved by some future event.
    PromiseMap: new Map(),

    flatten: function(arr) {
      // Flattens an N-dimensional array.
      return arr.reduce((res, item) => {
        return res.concat(Array.isArray(item) ? SendLater.flatten(item) : item);
      }, []);
    },

    async logger(msg, level, stream) {
      const levels = ["all","trace","debug","info","warn","error","fatal"];
      const output = (stream !== undefined) ? stream : console.log;
      browser.storage.local.get({"preferences":{}}).then(storage => {
        const consoleLogLevel = storage.preferences.logConsoleLevel;
        if (levels.indexOf(level) >= levels.indexOf(consoleLogLevel)) {
          output(`${level.toUpperCase()} [SendLater]:`, ...msg);
        }
      });
    },

    async error(...msg)  { SendLater.logger(msg, "error", console.error) },
    async warn(...msg)   { SendLater.logger(msg, "warn",  console.warn) },
    async info(...msg)   { SendLater.logger(msg, "info",  console.info) },
    async log(...msg)    { SendLater.logger(msg, "info",  console.log) },
    async debug(...msg)  { SendLater.logger(msg, "debug", console.debug) },
    async trace(...msg)  { SendLater.logger(msg, "trace", console.trace) },

    async getIdentity(id) {
      const accts = await browser.accounts.list();

      for (const acct of accts) {
        for (const identity of acct.identities) {
          if (id.includes(identity.id)) {
            SendLater.debug(`Found identity matching <${id}>`, identity);
            return identity;
          }
        }
      }

      SendLater.warn(`Cannot find identity <${id}>`);
      return null;
    },

    waitAndSend: function() {
      // When bound to a compose window, this function will wait for
      // the window's status to be "complete", and then it will initiate
      // a batch send operation.
      if (this.status === "complete") {
        browser.SL3U.SendNow(true);
      } else {
        setTimeout(SendLater.waitAndSend.bind(this), 50);
      }
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
      return Promise.all(draftSubFolders).then(SendLater.flatten);
    },

    async beginEditAsNewMessage(id) {
      // Begin new message composition. Duplicate contents of existing message.
      // Returns new compose window.
      const original = await browser.messages.getFull(id);
      SendLater.debug("Composing message from original:",original);

      const idKey = original.headers['x-identity-key'];
      const identity = await SendLater.getIdentity(idKey[0]);
      if (!identity) {
        SendLater.warn("Cannot send message without a sender identity.");
        return;
      }

      function expandMimeParts(msgparts) {
        // Recursively traverses MIME tree to find message body.
        const ret = { attachments: [] };
        for (part of msgparts.parts) {
          if (part.name) {
            // The messagePart object for extensions does not actually include
            // the attachment content as of TB78. See workaround below.
            const att = { name: part.name, file: null };
            ret.attachments.push(att);
          } else if (part.body && part.contentType.startsWith('text/html')) {
            // HTML body part
            if (ret.htmlmsg) {
              SendLater.warn("HTML message body defined twice.");
            }
            // Clean up HTML message, because otherwise Thunderbird treats it as
            // if it were plaintext, adds a bunch of <br> tags, and wraps the
            // whole thing in an <html> element for some reason.
            ret.htmlmsg = part.body;
            ret.htmlmsg = ret.htmlmsg.replaceAll(/\n/g,'');
            ret.htmlmsg = ret.htmlmsg.replace(/.*<body>/i,'');
            ret.htmlmsg = ret.htmlmsg.replace(/<\/body>.*/i,'');
          } else if (part.body && part.contentType.startsWith('text/plain')) {
            // Plaintext body part
            if (ret.plainmsg) {
              SendLater.warn("Plain message body defined twice.");
            }
            ret.plainmsg = part.body;
          } else if (part.contentType.startsWith('multipart/mixed')) {
            // Another level of message parts.
            const subparts = expandMimeParts(part)
            Object.assign(ret, subparts);
          } else {
            SendLater.warn("Unsure how to handle message part:",part);
          }
        }
        return ret;
      }

      const mimeParts = expandMimeParts(original);

      const details = {
        identityId: identity.id,
        to: original.headers.to,
        subject: original.headers.subject[0],
        cc: original.headers.cc,
        bcc: original.headers.bcc,
        isPlainText: (mimeParts.htmlmsg === undefined)
      }

      if (details.isPlainText) {
        details.plainTextBody = mimeParts.plainmsg;
      } else {
        details.body = mimeParts.htmlmsg;
      }

      // Duplicate message details into a new compose window.
      const cw = await browser.compose.beginNew(details);

      // The MailExtension message API does not return message attachment body
      // as of TB78. This workaround starts a forwarded message, then duplicates
      // its attachments into a new compose window.
      const fw = await browser.compose.beginForward(id, "forwardInline");
      const attachments = await browser.compose.listAttachments(fw.id);
      const files = await Promise.all(attachments.map(att => att.getFile()));
      for (let idx=0; idx<files.length; idx++) {
        const name = attachments[idx].name;
        const file = files[idx];
        await browser.compose.addAttachment(cw.id, { name, file });
      }
      browser.tabs.remove(fw.id);

      return cw;
    },

    async possiblySendMessage(id) {
      // Determines whether or not a particular draft message is due to be sent
      const msg = await browser.messages.getFull(id);
      if (msg.headers['x-send-later-at'] !== undefined) {
        const nextSend = new Date(msg.headers['x-send-later-at']);
        const messageDueForSend = true; // TODO
        if (messageDueForSend) {
          // Duplicate draft message into new compose window, and initiate send
          const cw = await SendLater.beginEditAsNewMessage(id);
          setTimeout(SendLater.waitAndSend.bind(cw), 0);

          // TODO: Possibly delete draft and/or schedule next recurrence.
        } else {
          SendLater.debug(`Message ${id} not scheduled for send.`);
        }
      }
    },

    async scheduleSendLater(tabId, options) {
      SendLater.info(`Scheduling send later: ${tabId} with options`,options);
      // TODO: Add custom headers
      browser.SL3U.SaveAsDraft();
      browser.tabs.remove(tabId);
    },

    mainLoop: function() {
      try {
        browser.accounts.list().then(accounts => {
          accounts.forEach(acct => {
              // Looping over accounts. Most accounts should only have one Drafts
              // folder, but to be safe, we'll loop through each of them and check
              // for messages that are scheduled to be sent.
              SendLater.getDraftFolders(acct).then(draftFolders => {
                draftFolders.forEach(async drafts => {
                  let page = await browser.messages.list(drafts);
                  do {
                    page.messages.forEach(msg =>
                      SendLater.possiblySendMessage(msg.id)
                    );
                    if (page.id) {
                      page = await browser.messages.continueList(page.id);
                    }
                  } while (page.id);
                });
              });
          });
        });
      } catch (ex) {
        SendLater.trace(ex);
      }
      browser.storage.local.get("preferences").then(storage => {
        // Rather than using setInterval for this loop, we'll just start a new
        // timeout each time it runs to schedule it some delay in the future.
        // This automatically responds to user changes in 'delay', but has the
        // disadvantage that shortening `delay` will still take up to the
        // previous delay time before taking effect.
        // TODO: Use a persistent reference to the this timeout that can be
        // scrapped and restarted upon changes in the delay preference.
        const prefs = storage.preferences || {};
        const intervalTimeout = prefs['checkTimePref'];
        const millis = prefs["checkTimePref_isMilliseconds"];
        const delay = (millis) ? intervalTimeout : intervalTimeout * 60000;
        SendLater.debug(`Next main loop iteration in ${delay/1000} seconds.`);
        setTimeout(SendLater.mainLoop, delay);
      });
    }
};

// Intercept sent messages. Decide whether to handle them or just pass them on.
browser.compose.onBeforeSend.addListener((tab) => {
  SendLater.log("User requested send. Awaiting UI selections.");
  if (SendLater.PromiseMap.get(tab.id)) {
    return;
  }

  setTimeout(() => browser.storage.local.get("preferences").then(storage => {
    const prefs = storage.preferences || {};
    const resolver = (SendLater.PromiseMap.get(tab.id)) || (()=>{});

    if (prefs["sendDoesSL"]) {
      SendLater.debug("Intercepting send operation. Awaiting user input.");
      browser.composeAction.openPopup();
      // No need to resolve just yet. User will do that via UI listener.
    } else if (prefs["sendDoesDelay"]) {
      const sendDelay = prefs["sendDelay"];
      SendLater.debug(`Scheduling SendLater ${sendDelay} minutes from now.`);
      SendLater.scheduleSendLater(tab.id, { delay: sendDelay });
      resolver({ cancel: true });
    } else {
      // No need to intercept sending
      SendLater.debug("Resolving onBeforeSend intercept.");
      resolver({ cancel: false });
    }
  }), 0);

  return new Promise(resolve => SendLater.PromiseMap.set(tab.id, resolve));
});

// Button clicks in the UI popup window send messages back to this function
// via the WebExtension messaging API.
browser.runtime.onMessage.addListener((message) => {
    const resolve = SendLater.PromiseMap.get(message.tabId);

    if (message.action === "doSendNow" ) {
        SendLater.debug("User requested send immediately.");
        if (resolve !== undefined) {
          // If already blocking a send operation, just get out of the way.
          resolve({ cancel: false });
        } else {
          // Otherwise, initiate a new send operation.
          browser.SL3U.SendNow(false);
        }
    } else if (message.action === "doSendLater") {
        SendLater.debug("User requested send later.");
        const options = { sendTime: message.sendTime };
        SendLater.scheduleSendLater(message.tabId, options);
        if (resolve !== undefined) {
          resolve({ cancel: true });
        }
    } else if (message.action === "cancel") {
        SendLater.debug("User cancelled send.");
        if (resolve !== undefined) {
          resolve({ cancel: true });
        }
    } else {
      SendLater.warn(`Unrecognized operation <${message.action}>.`);
      if (resolve !== undefined) {
        resolve({ cancel: true });
      }
    }
});

// // Responds to keyboard shortcut
// browser.commands.onCommand.addListener(async (command) => {
//   if (command === "doSendLater") {
//     //let result = await browser.sendLaterComposing.tryToSave();
//     //SendLater.log(result);
//   }
// });
//
// /*
//  * Template for actions to perform during installation or updates.
//  */
// browser.runtime.onInstalled.addListener(async ({ reason, temporary }) => {
//   if (temporary) return; // skip during development
//   switch (reason) {
//     case "install":
//       {
//         //const url = browser.runtime.getURL("views/installed.html");
//         //await browser.tabs.create({ url });
//         // or: await browser.windows.create({ url, type: "popup", height: 600, width: 600, });
//       }
//       break;
//     case "update":
//       {
//         // Do something
//       }
//       break;
//   }
// });

// Initialize experiments.
//browser.SL3U.init();

// Start background loop to check for scheduled messages.
setTimeout(SendLater.mainLoop, 0);
