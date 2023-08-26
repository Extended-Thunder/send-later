// To receive feedback from user interactions in notification popups,
// we need to track which popups we are waiting on, and resolve promises
// when they communicate back to the background script.
var _popupCallbacks = new Map();

var SLTools = {
  // Set of message ID's which are scheduled
  scheduledMsgCache: new Set(),
  // Set of message ID's which are not scheduled
  unscheduledMsgCache: new Set(),

  // Convenience function for getting preferences.
  async getPrefs() {
    let { preferences } = await messenger.storage.local.get({
      preferences: {},
    });
    return preferences;
  },

  // Debugging info printed to log during intialization.
  async printVersionInfo() {
    const extensionName = messenger.i18n.getMessage("extensionName");
    const slVersion = messenger.runtime.getManifest().version;
    const browserInfo = await messenger.runtime.getBrowserInfo();
    const platformInfo = await messenger.runtime.getPlatformInfo();
    console.info(
      `${extensionName} version ${slVersion} on ` +
        `${browserInfo.name} ${browserInfo.version} ` +
        `(${browserInfo.buildID}) ` +
        `[${platformInfo.os} ${platformInfo.arch}]`,
    );
  },

  handlePopupCallback(tabId, message) {
    if (_popupCallbacks.has(tabId)) {
      let callback = _popupCallbacks.get(tabId);
      callback(message);
      _popupCallbacks.delete(tabId);
      return true;
    } else {
      // Tab not associated with a popup window
      return false;
    }
  },

  // Helper function to create simple HTML-based popup messages.
  notificationPopup(type, title, message, checkLabel, checked) {
    title = title || messenger.i18n.getMessage("extensionName");
    checkLabel = checkLabel || messenger.i18n.getMessage("confirmAgain");

    let url =
      `ui/notification.html?` +
      `&type=${type}` +
      `&message=${encodeURIComponent(message)}` +
      `&checkLabel=${encodeURIComponent(checkLabel)}` +
      `&checked=${checked ? "true" : "false"}`;

    return new Promise((resolve) => {
      messenger.windows
        .create({
          url: url,
          type: "popup",
          titlePreface: title + " - ",
          height: 250,
          width: 750,
        })
        .then((window) => {
          const tab = window.tabs[0];
          _popupCallbacks.set(tab.id, resolve);
        });
    });
  },

  // Create a popup with just an 'OK' button.
  alert(title, message) {
    return this.notificationPopup("alert", title, message);
  },

  // Create a popup with 'YES' and 'NO' buttons. Returns a promise
  // that resolves to an object with boolean member variable 'ok',
  // indicating the user's response.
  confirm(title, message) {
    return this.notificationPopup("confirm", title, message);
  },

  // Create a popup with a message and an 'OK' button.
  // Returns a promise that resolves to an object with boolean member
  // 'checked', indicating the user's response.
  alertCheck(title, message, checkLabel, checked) {
    return this.notificationPopup(
      "alertCheck",
      title,
      message,
      checkLabel,
      checked,
    );
  },

  // Create a popup with a message, 'YES' and 'NO' buttons, and a checkbox.
  // Returns a promise that resolves to an object with boolean members
  // 'ok' and 'checked', indicating the user's response.
  confirmCheck(title, message, checkLabel, checked) {
    return this.notificationPopup(
      "confirmCheck",
      title,
      message,
      checkLabel,
      checked,
    );
  },

  // Get all draft folders. Returns an array of Folder objects.
  getDraftFolders(acct) {
    function getDraftFoldersHelper(folder) {
      // Recursive helper function to look through an account for draft folders
      if (folder.type == "drafts") {
        return folder;
      } else {
        const drafts = [];
        for (let subFolder of folder.subFolders) {
          drafts.push(getDraftFoldersHelper(subFolder));
        }
        return drafts;
      }
    }

    const draftSubFolders = [];
    for (let folder of acct.folders) {
      draftSubFolders.push(getDraftFoldersHelper(folder));
    }
    const allDraftFolders = SLStatic.flatten(draftSubFolders);
    SLStatic.debug(
      `Found Draft folder(s) for account ${acct.name}`,
      allDraftFolders,
    );
    return allDraftFolders;
  },

  async expandRecipients(tabId) {
    let details = {};
    for (let type of ["to", "cc", "bcc"]) {
      details[type] = await messenger.SL3U.expandRecipients(tabId, type);
    }
    await messenger.compose.setComposeDetails(tabId, details);
  },

  // Do something with each message in all draft folders. callback
  // should be an async function that takes a single MessageHeader
  // argument. If `sequential` is true, then the function will
  // `await` the result of each callback before moving on to the
  // next message.
  async forAllDrafts(callback, sequential) {
    let results = [];
    let accounts = await messenger.accounts.list(true);
    for (let acct of accounts) {
      let draftFolders = SLTools.getDraftFolders(acct);
      for (let folder of draftFolders) {
        let page = await messenger.messages.list(folder);
        while (true) {
          if (sequential) {
            for (let message of page.messages) {
              results.push(await callback(message).catch(SLStatic.error));
            }
          } else {
            let pageResults = page.messages.map((message) =>
              callback(message).catch(SLStatic.error),
            );
            results = results.concat(pageResults);
          }
          if (!page.id) {
            break;
          }
          page = await messenger.messages.continueList(page.id);
        }
      }
    }
    if (sequential) {
      return results;
    } else {
      return await Promise.all(results);
    }
  },

  // Get the active tab (only if it is in a messageCompose window)
  async getActiveComposeTab() {
    return await messenger.windows
      .getAll({
        populate: true,
        windowTypes: ["messageCompose"],
      })
      .then((allWindows) => {
        // Current compose windows
        const ccWins = allWindows.filter(
          (cWindow) => cWindow.focused === true,
        );
        if (ccWins.length === 1) {
          const ccTabs = ccWins[0].tabs.filter((tab) => tab.active === true);
          if (ccTabs.length !== 1) {
            // No tabs?
            throw new Error(
              `Unexpected situation: no tabs found in current window`,
            );
          }
          return ccTabs[0];
        } else if (ccWins.length === 0) {
          // No compose window is opened
          SLStatic.warn(
            `The currently active window is not a messageCompose window`,
          );
          return undefined;
        } else {
          // Whaaaat!?!?
          throw new Error(
            `Unexpected situation: multiple active windows found?`,
          );
        }
      });
  },

  // Count draft messages containing the correct `x-send-later-uuid` header.
  async countActiveScheduledMessages() {
    const preferences = await SLTools.getPrefs();
    let isScheduled = await SLTools.forAllDrafts(
      async (msgHdr) => {
        if (SLTools.scheduledMsgCache.has(msgHdr.id)) {
          return true;
        } else if (SLTools.unscheduledMsgCache.has(msgHdr.id)) {
          return false;
        } else {
          let fullMsg = await messenger.messages.getFull(msgHdr.id);
          let uuid = (fullMsg.headers["x-send-later-uuid"] || [])[0];
          if (uuid == preferences.instanceUUID) {
            SLTools.scheduledMsgCache.add(msgHdr.id);
            return true;
          } else {
            SLTools.unscheduledMsgCache.add(msgHdr.id);
            return false;
          }
        }
      },
      true, // Running sequentially seems to give slightly better performance.
    );
    return isScheduled.filter((x) => x).length;
  },
};

messenger.tabs.onRemoved.addListener((tabId) => {
  SLTools.handlePopupCallback(tabId, { ok: false, check: null });
});
