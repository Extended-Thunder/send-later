// To receive feedback from user interactions in notification popups,
// we need to track which popups we are waiting on, and resolve promises
// when they communicate back to the background script.
var _popupCallbacks = new Map();

// https://javascript.plainenglish.io/how-to-add-a-timeout-limit-to-asynchronous-javascript-functions-3676d89c186d
// I would have been able to write this on my own, but it was easier to copy it
// from someone else. ;-)
/**
 * Call an async function with a maximum time limit (in milliseconds) for the timeout
 * @param {Promise<any>} asyncPromise An asynchronous promise to resolve
 * @param {number} timeLimit Time limit to attempt function in milliseconds
 * @returns {Promise<any> | undefined} Resolved promise for async function call, or an error if time limit reached
 */
const asyncTimeout = async (asyncPromise, timeLimit) => {
  let timeoutHandle;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error("Async call timeout limit reached")),
      timeLimit,
    );
  });

  return Promise.race([asyncPromise, timeoutPromise]).then((result) => {
    clearTimeout(timeoutHandle);
    return result;
  });
};

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

  async isOnBetaChannel() {
    let extensionInfo = await messenger.management.getSelf();
    let updateUrl = extensionInfo?.updateUrl;
    return updateUrl?.includes("beta-channel");
  },

  async userGuideLink(tail) {
    tail = tail ?? "";
    let link = "https://extended-thunder.github.io/send-later";
    if (await this.isOnBetaChannel()) {
      link += "/next";
    }
    if (!tail.startsWith("/")) {
      link += "/";
    }
    link += tail;
    return link;
  },

  // Debugging info printed to log during intialization.
  async startupLogVersionInfo() {
    const extensionName = messenger.i18n.getMessage("extensionName");
    const slVersion = messenger.runtime.getManifest().version;
    const browserInfo = await messenger.runtime.getBrowserInfo();
    const platformInfo = await messenger.runtime.getPlatformInfo();
    let UILocale = "unknown";
    let DateLocale = "unknown";
    try {
      UILocale = browser.i18n.getUILanguage();
    } catch (ex) {}
    try {
      DateLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch (ex) {}
    SLStatic.info(
      `${extensionName} version ${slVersion} on ` +
        `${browserInfo.name} ${browserInfo.version} ` +
        `(${browserInfo.buildID}) ` +
        `[${platformInfo.os} ${platformInfo.arch}] ` +
        `UI locale ${UILocale}, Date Locale ${DateLocale}`,
    );
    data = {
      event: "startup",
      version: slVersion,
      browserName: browserInfo.name,
      browserVersion: browserInfo.version,
      browserBuild: browserInfo.buildID,
      platformOS: platformInfo.os,
      platformArch: platformInfo.arch,
    };
    if (await this.isOnBetaChannel()) {
      data["beta"] = true;
    }
    SLStatic.telemetrySend(data);
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

  // Necessary because of https://bugzilla.mozilla.org/show_bug.cgi?id=1852407
  async isDraftsFolder(folder) {
    return (
      folder.type == "drafts" ||
      (await messenger.folders.getParentFolders(folder)).some(
        (f) => f.type == "drafts",
      )
    );
  },

  // Get all draft folders. Returns an array of Folder objects.
  async getDraftFolders(acct) {
    async function getDraftFoldersHelper(folder) {
      let drafts = [];
      if (folder.type == "drafts") {
        drafts.push(folder);
      }
      // Even if the parent folder isn't a drafts folder we still need to
      // recurse through subfolders because the user might have his drafts
      // folder several layers deep in the hierarchy (e.g., that's the default
      // in Gmail!).
      for (let subFolder of folder.subFolders) {
        // Bug: subfolders of drafts folders aren't marked as drafts folders
        // themselves even though they should be. See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1852407
        if (folder.type == "drafts") {
          subFolder.type = "drafts";
        }
        drafts = drafts.concat(await getDraftFoldersHelper(subFolder));
      }
      return drafts;
    }

    let folders = [];
    for (let folder of acct.folders) {
      folders = folders.concat(await getDraftFoldersHelper(folder));
    }
    SLStatic.debug(`Found Draft folder(s) for account ${acct.name}`, folders);
    return folders;
  },

  async expandRecipients(tabId) {
    let details = {};
    for (let type of ["to", "cc", "bcc"]) {
      details[type] = await messenger.SL3U.expandRecipients(tabId, type);
    }
    await messenger.compose.setComposeDetails(tabId, details);
  },

  async getTargetSubfolder(preferences, msg) {
    if (!preferences.storeInSubfolder) return;
    let subfolderName = preferences.subfolderName;
    if (!subfolderName) return;
    let folder = msg.folder;
    let found;
    let subfolder;
    for (subfolder of await messenger.folders.getSubFolders(folder)) {
      if (subfolder.name == subfolderName) {
        found = true;
        break;
      }
    }
    if (!found) {
      SLStatic.info(
        `Creating subfolder ${subfolderName} of folder ${folder.name} in ` +
          `account ${folder.accountId}`,
      );
      subfolder = await messenger.folders.create(folder, subfolderName);
    }
    return subfolder;
  },

  // Do something with each message in all draft folders. callback
  // should be an async function that takes a single MessageHeader
  // argument. If `sequential` is true, then the function will
  // `await` the result of each callback before moving on to the
  // next message.
  // `timeout` specifies how long in milliseconds we should wait for the
  // callback to finish for each message. If it's unset or 0, then it defaults
  // to 5000 if if sequential is true or 60000 otherwise.
  // If preferences isn't specified then this function will fetch preferences;
  // otherwise it'll use what's passed in. So if the caller has fetched them
  // already it should pass them in to avoid an extra storage call.
  async forAllDrafts(callback, sequential, timeout, preferences) {
    if (!preferences) {
      preferences = await SLTools.getPrefs();
    }
    let ignoredAccounts = preferences.ignoredAccounts || [];
    if (!timeout) {
      timeout = sequential ? 5000 : 60000;
    }
    let results = [];
    let accounts = await messenger.accounts.list(true);
    for (let acct of accounts) {
      if (ignoredAccounts.includes(acct.id)) {
        continue;
      }
      let draftFolders = await SLTools.getDraftFolders(acct);
      for (let folder of draftFolders) {
        let page = await messenger.messages.list(folder);
        while (true) {
          if (sequential) {
            for (let message of page.messages) {
              results.push(
                await asyncTimeout(callback(message), timeout).catch((ex) => {
                  SLStatic.error("Error processing message", message, ex);
                }),
              );
            }
          } else {
            let pageResults = page.messages.map((message) =>
              asyncTimeout(callback(message), timeout).catch((ex) => {
                SLStatic.error("Error processing message", message, ex);
              }),
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
      undefined,
      preferences,
    );
    return isScheduled.filter((x) => x).length;
  },
};

messenger.tabs.onRemoved.addListener((tabId) => {
  SLTools.handlePopupCallback(tabId, { ok: false, check: null });
});
