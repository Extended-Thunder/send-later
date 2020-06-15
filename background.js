const SendLater = {
    // A global-ish scoped variable that allows listeners to return promises
    // that can be resolved in response to some later event.
    PromiseMap: new Map(),
    async scheduleSendLater(tabId, options) {
      console.log("Scheduling send later: "+tabid+" with options "+options);
      return;
    }
};

browser.compose.onBeforeSend.addListener((tab) => {
  console.log("SendLater: User requested message send. Awaiting scheduling choice.");
  browser.composeAction.openPopup();

  // The compose window UI will be locked until this promise resolves.
  return new Promise(resolve => {
    SendLater.PromiseMap.set(tab.id, resolve);
  });
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
        console.debug("SendLater: User cancelled send via Send Later plugin.");
        resolve({ cancel: true });
    }
});

// Responds to keyboard shortcut
browser.commands.onCommand.addListener(async (command) => {
  if (command === "doSendLater") {
    //let result = await browser.sendLaterComposing.tryToSave();
    //console.log(result);
  }
});

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

// Finally, setup the background service to periodically check for messages
// that are ready to be sent.
let interval = setInterval(async () => {
        // let accts = await browser.accounts.list();
        // console.log(accts);
        // for (var i=0; i<accts.length; i++)
        // {
        //     for (var j = 0; j < accts[i].folders.length; j++) {
        //         if (accts[i].folders[j].type == "drafts") {
        //             console.log(accts[i].folders[j]);
        //         }
        //     }
        // }
    }, 3000);
