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
          output(level.toUpperCase()+" (SendLater):", ...msg);
        }
      });
    },

    async error(...msg)  { SendLater.logger(msg, "error", console.error) },
    async warn(...msg)   { SendLater.logger(msg, "warn",  console.warn) },
    async info(...msg)   { SendLater.logger(msg, "info",  console.info) },
    async log(...msg)    { SendLater.logger(msg, "info",  console.log) },
    async debug(...msg)  { SendLater.logger(msg, "debug", console.debug) },
    async trace(...msg)  { SendLater.logger(msg, "trace", console.trace) },

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

    async possiblySendMessage(id) {
      // TODO: This function should determine whether or not a particular
      // message is due to be sent, and then act on that choice. It receives
      // a message id as input, and doesn't need to return anything.
    },

    async scheduleSendLater(tabId, options) {
      SendLater.log("Scheduling send later: "+tabid+" with options ",options);
      return;
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
                    page.messages.forEach(async message => {
                      const msg = await browser.messages.getFull(message.id);
                      console.debug(msg.headers);
                      if (msg.headers["x-send-later"] !== undefined) {
                        SendLater.possiblySendMessage(message.id);
                      }
                    });
                    if (page.id) {
                      page = await browser.messages.continueList(page.id);
                    }
                  } while (page.id);
                });
              });
          });
        });
      } catch (ex) {
        SendLater.error(ex);
      }
      browser.storage.local.get("preferences").then(storage => {
        const prefs = storage.preferences || {};
        const intervalTimeout = prefs['checkTimePref'];
        const millis = prefs["checkTimePref_isMilliseconds"];
        const delay = (millis) ? intervalTimeout : intervalTimeout * 60000;
        setTimeout(SendLater.mainLoop, delay);
      });
    }
};

// Intercept sent messages. Decide whether to handle them or just pass them on.
browser.compose.onBeforeSend.addListener((tab) => {
  SendLater.log("SendLater: User requested send. Awaiting UI selections.");

  setTimeout(() => browser.storage.local.get("preferences").then(storage => {
    const prefs = storage.preferences || {};
    const resolver = (SendLater.PromiseMap.get(tab.id)) || (()=>{});

    if (prefs["sendDoesSL"]) {
      browser.composeAction.openPopup();
      // No need to resolve just yet. User will do that via UI listener.
    } else if (prefs["sendDoesDelay"]) { // TODO
      const sendDelay = prefs["sendDelay"];
      SendLater.scheduleSendLater(tab.id, { delay: sendDelay });
      resolver({ cancel: true });
    } else {
      resolver({ cancel: false });
    }
  }), 0);

  return new Promise(resolve => SendLater.PromiseMap.set(tab.id, resolve));
});

browser.runtime.onMessage.addListener((message) => {
    let resolve = (SendLater.PromiseMap.get(message.tabId)) || (()=>{});

    if (message.action === "doSendNow" ) {
        console.debug("SendLater: User requested send immediately.");
        resolve({ cancel: false });
    } else if (message.action === "doSendLater") {
        console.debug("SendLater: User requested send later.");
        const options = { sendTime: message.sendTime };
        SendLater.scheduleSendLater(message.tabId, options);
        resolve({ cancel: true });
    } else if (message.action === "cancel") {
        console.debug("SendLater: User cancelled send.");
        resolve({ cancel: true });
    } else {
        resolve({ cancel: true });
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
