// WARNING: If you are importing this script into an Experiment, then your
// Experiment MUST have a cachePrefs endpoint which takes an object and passes
// it into SLTools.cachePrefs(...), and the extension's background script must
// call the Experiment's cachePrefs on initialization and every time the
// preferences change.

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
    SLTools.info(
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
    SLTools.telemetrySend(data);
  },

  async ufuncCompatibilityWarning(always, funcName) {
    let doCheck =
      always ||
      (await browser.storage.local.get({ ufuncs: {} }).then(({ ufuncs }) => {
        let funcNames;
        if (!funcName) funcNames = Object.keys(ufuncs);
        else funcNames = [funcName];
        for (funcName of funcNames)
          if (!SLTools.builtInFuncs[funcName]) return true;
        return false;
      }));
    if (doCheck) {
      try {
        const func = Function.apply(null, ["return true;"]);
      } catch (ex) {
        // Warn about dynamic function incompatibility
        SLTools.alert(
          messenger.i18n.getMessage("dynamicCompatibilityTitle"),
          messenger.i18n.getMessage("dynamicCompatibilityMessage", [
            messenger.i18n.getMessage("extensionName"),
            await SLTools.userGuideLink("#dynamic-compatibility"),
          ]),
          true,
        );
      }
    }
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
  notificationPopup(type, title, message, checkLabel, checked, isFormatted) {
    title = title || messenger.i18n.getMessage("extensionName");
    checkLabel = checkLabel || messenger.i18n.getMessage("confirmAgain");

    let url =
      `/ui/notification.html?` +
      `&type=${type}` +
      `&message=${encodeURIComponent(message)}` +
      `&isFormatted=${isFormatted ? "true" : "false"}` +
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
  alert(title, message, isFormatted) {
    return this.notificationPopup(
      "alert",
      title,
      message,
      null,
      null,
      isFormatted,
    );
  },

  // Create a popup with 'YES' and 'NO' buttons. Returns a promise
  // that resolves to an object with boolean member variable 'ok',
  // indicating the user's response.
  confirm(title, message, isFormatted) {
    return this.notificationPopup(
      "confirm",
      title,
      message,
      null,
      null,
      isFormatted,
    );
  },

  // Create a popup with a message and an 'OK' button.
  // Returns a promise that resolves to an object with boolean member
  // 'checked', indicating the user's response.
  alertCheck(title, message, checkLabel, checked, isFormatted) {
    return this.notificationPopup(
      "alertCheck",
      title,
      message,
      checkLabel,
      checked,
      isFormatted,
    );
  },

  // Create a popup with a message, 'YES' and 'NO' buttons, and a checkbox.
  // Returns a promise that resolves to an object with boolean members
  // 'ok' and 'checked', indicating the user's response.
  confirmCheck(title, message, checkLabel, checked, isFormatted) {
    return this.notificationPopup(
      "confirmCheck",
      title,
      message,
      checkLabel,
      checked,
      isFormatted,
    );
  },

  // Once https://bugzilla.mozilla.org/show_bug.cgi?id=1852407 and
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1857631 are fixed we can
  // revisit whether we need an experiment for the following two functions or
  // whether we can build them in native WebExtension code.
  async isDraftsFolder(folder) {
    return await messenger.SL3U.isDraftsFolder(folder.accountId, folder.path);
  },

  // Get all draft folders. Returns an array of Folder objects.
  async getDraftFolders(acct) {
    async function getDraftFoldersHelper(folder) {
      let drafts = [];
      if (await messenger.SL3U.isDraftsFolder(folder.accountId, folder.path)) {
        drafts.push(folder);
      }
      // Even if the parent folder isn't a drafts folder we still need to
      // recurse through subfolders because the user might have his drafts
      // folder several layers deep in the hierarchy (e.g., that's the default
      // in Gmail!).
      for (let subFolder of folder.subFolders) {
        drafts = drafts.concat(await getDraftFoldersHelper(subFolder));
      }
      return drafts;
    }

    let folders = [];
    for (let folder of acct.folders) {
      folders = folders.concat(await getDraftFoldersHelper(folder));
    }
    SLTools.debug(`Found Draft folder(s) for account ${acct.name}`, folders);
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
    // If the message is already in an appropriately named subfolder then
    // don't go another level deep. Necessary starting in TB 115.2, because
    // they changed TB so drafts loaded from a particular subfolder get saved
    // back to that subfolder.
    if (folder.path.endsWith("/" + subfolderName)) return;
    let found;
    let subfolder;
    for (subfolder of await messenger.folders.getSubFolders(
      await SLTools.tb128(folder.id, folder),
    )) {
      if (subfolder.name == subfolderName) {
        found = true;
        break;
      }
    }
    if (!found) {
      SLTools.info(
        `Creating subfolder ${subfolderName} of folder ${folder.name} in ` +
          `account ${folder.accountId}`,
      );
      subfolder = await messenger.folders.create(folder, subfolderName);
    }
    return subfolder;
  },

  // Wait for the specified message to be visible in the folder.
  async waitForMessage(hdr, timeout) {
    let start = Date.now();
    if (!timeout) timeout = 5000;
    SLTools.debug("Starting to wait for", hdr);
    let found = false;
    while (Date.now() - start < timeout) {
      await messenger.SL3U.updateFolder(hdr.folder);
      let result = await SLTools.forAllDrafts((dHdr) => dHdr.id == hdr.id);
      if (result.some((v) => v)) {
        found = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    delta = Date.now() - start;
    if (found) {
      SLTools.debug(`Found message after ${delta}ms`);
    } else {
      SLTools.debug(`Failed to find message after ${delta}ms`);
    }
    SLTools.telemetrySend({
      event: "waitForMessage",
      found: found,
      elapsed: delta,
    });
    return found;
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
        if (preferences.autoUpdateDraftsFolders)
          await messenger.SL3U.updateFolder(folder);
        let page = await messenger.messages.list(
          await SLTools.tb128(folder.id, folder),
        );
        while (true) {
          if (sequential) {
            for (let message of page.messages) {
              results.push(
                await asyncTimeout(callback(message), timeout).catch((ex) => {
                  SLTools.error("Error processing message", message, ex);
                }),
              );
            }
          } else {
            let pageResults = page.messages.map((message) =>
              asyncTimeout(callback(message), timeout).catch((ex) => {
                SLTools.error("Error processing message", message, ex);
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
          SLTools.warn(
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

  async prepNewMessageHeaders(content) {
    let draftInfo = SLTools.getHeader(content, "x-mozilla-draft-info");
    if (draftInfo.includes("receipt=1")) {
      let fromHeader = SLTools.getHeader(content, "from");
      content = SLTools.replaceHeader(
        content,
        "Disposition-Notification-To",
        fromHeader,
        false,
        true,
      );
    }

    sanitize = await messenger.SL3U.getLegacyPref(
      "mail.sanitize_date_header",
      "bool",
      "false",
      true,
    );

    content = SLTools.replaceHeader(
      content,
      "Date",
      SLTools.parseableDateTimeFormat(null, sanitize),
      false,
    );
    content = SLTools.replaceHeader(
      content,
      "X-Send-Later-[a-zA-Z0-9-]*",
      null,
      true,
    );
    content = SLTools.replaceHeader(
      content,
      "X-Enigmail-Draft-Status",
      null,
      false,
    );
    content = SLTools.replaceHeader(content, "Openpgp", null, false);
    return content;
  },

  i18n: null,
  tempFolderName: "Send-Later-Temp",
  timeRegex: /^(2[0-3]|[01]?\d):?([0-5]\d)$/,
  _prefDefaults: null,
  // setPreferences isn't allowed to modify these
  readWriteFilterPrefs: ["instanceUUID", "releaseNotesVersion"],
  // getPreferences isn't allowed to return these
  readOnlyFilterPrefs: ["releaseNotesVersion"],
  thunderbirdVersion: null,
  // prettier-ignore
  shortcutKeys: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
    .concat("0123456789".split(""))
    .concat(["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11",
             "F12", "Comma", "Period", "Home", "End", "PageUp", "PageDown",
             "Space", "Insert", "Delete", "Up", "Down", "Left", "Right"]),
  builtInFuncs: {
    // This function isn't ever actually used, but the name needs to be here.
    ReadMeFirst: (specname, prev, args) => {
      return null;
    },
    BusinessHours: (specname, prev, args) => {
      // Copied from _locales/en/messages.json, except the first and last line
      let next, nextspec, nextargs;
      // Defaults
      var workDays = [1, 2, 3, 4, 5]; // Mon - Fri; Sun == 0, Sat == 6
      var workStart = [8, 30]; // Start of the work day as [H, M]
      var workEnd = [17, 30]; // End of the work day as [H, M]
      if (args && args[0]) workDays = args[0];
      if (args && args[1]) workStart = args[1];
      if (args && args[2]) workEnd = args[2];
      if (prev)
        // Not expected in normal usage, but used as the current time for testing.
        next = new Date(prev);
      else next = new Date();

      if (workDays.length == 0 || !workDays.every((d) => d >= 0 && d <= 6)) {
        return undefined;
      }

      // If we're past the end of the workday or not on a workday, move to the work
      // start time on the next day.
      while (
        next.getHours() > workEnd[0] ||
        (next.getHours() == workEnd[0] && next.getMinutes() > workEnd[1]) ||
        workDays.indexOf(next.getDay()) == -1
      ) {
        next.setDate(next.getDate() + 1);
        next.setHours(workStart[0]);
        next.setMinutes(workStart[1]);
      }
      // If we're before the beginning of the workday, move to its start time.
      if (
        next.getHours() < workStart[0] ||
        (next.getHours() == workStart[0] && next.getMinutes() < workStart[1])
      ) {
        next.setHours(workStart[0]);
        next.setMinutes(workStart[1]);
      }
      return [next, nextspec, nextargs];
    },
    DaysInARow: (specname, prev, args) => {
      // Copied from _locales/en/messages.json, except the first and last line
      let next, nextspec, nextargs;
      // Send the first message now, subsequent messages once per day.
      if (!prev) next = new Date();
      else {
        var now = new Date();
        next = new Date(prev); // Copy date argument so we don't modify it.
        do {
          next.setDate(next.getDate() + 1);
        } while (next < now);
        // ^^^ Don't try to send in the past, in case Thunderbird was asleep at
        // the scheduled send time.
      }
      if (!args)
        // Send messages three times by default.
        args = [3];
      nextargs = [args[0] - 1];
      // Recur if we haven't done enough sends yet.
      if (nextargs[0] > 0) nextspec = "function " + specname;
      return [next, nextspec, nextargs];
    },
    Delay: (specname, prev, args) => {
      let next, nextspec, nextargs;
      next = new Date(Date.now() + args[0] * 60000);
      return [next, nextspec, nextargs];
    },
  },

  async makeContentsVisible(attempts) {
    SLTools.trace("makeContentsVisible start");
    if (!attempts) attempts = 0;
    let body = document.getElementsByTagName("body")[0];
    let outerWidth = window.outerWidth;
    let outerHeight = window.outerHeight;
    let rect = body.getBoundingClientRect();
    let viewPortBottom =
      window.innerHeight || document.documentElement.clientHeight;
    let hidden = Math.floor(rect.bottom - viewPortBottom);
    if (hidden > 0) {
      if (hidden > outerHeight * 2) {
        SLTools.info(
          "makeContentsVisible not resizing popup, would have to >triple it",
        );
        SLTools.telemetrySend({
          event: "notResizingPopup",
          outerHeight: outerHeight,
          hidden: hidden,
        });
        return;
      }
      SLTools.debug(
        `makeContentsVisible resizing popup from ${outerHeight} to ${outerHeight + hidden}`,
      );
      let apiWindow = await messenger.windows.getCurrent();
      messenger.windows.update(apiWindow.id, {
        height: Math.floor(outerHeight + hidden),
      });
    }
    // Sometimes when this function is called the first time, the height of the
    // body it gets back is too small so the window doesn't get resized
    // properly, because Thunderbird hasn't finished rendering the updated
    // content. I have tried wrapping the body in nested requestAnimationFrame
    // calls as suggested at
    // https://macarthur.me/posts/when-dom-updates-appear-to-be-asynchronous/
    // but it didn't work. This works instead: try up to 10 times, 10ms apart,
    // to resize the window.
    if (attempts < 10)
      setTimeout(() => {
        SLTools.makeContentsVisible(attempts + 1);
      }, 10);
  },

  async tbIsVersion(wantVersion, yes, no) {
    if (typeof wantVersion == "number") {
      wantVersion = [wantVersion];
    }

    if (!SLTools.thunderbirdVersion) {
      let browserInfo = await messenger.runtime.getBrowserInfo();
      SLTools.thunderbirdVersion = browserInfo.version
        .split(".")
        .map(parseInt);
    }

    let tbVersion = [...SLTools.thunderbirdVersion];
    let satisfied = true;
    while (wantVersion.length) {
      let wantFirst = wantVersion.shift();
      let tbFirst = tbVersion.shift();
      if (wantFirst > tbFirst) {
        satisfied = false;
        break;
      }
      if (wantFirst < tbFirst) {
        break;
      }
    }

    if (satisfied) {
      if (yes) {
        if (typeof yes == "function") {
          return yes();
        } else {
          return yes;
        }
      }
    } else {
      if (no) {
        if (typeof no == "function") {
          return no();
        } else {
          return no;
        }
      }
    }
  },

  async tb128(yes, no) {
    return await SLTools.tbIsVersion(128, yes, no);
  },

  async tb137(yes, no) {
    return await SLTools.tbIsVersion(137, yes, no);
  },

  preferences: {},
  listeningForStorageChanges: false,
  logs: "",

  logThreshold(logLevel, messageLevel) {
    const levels = [
      "all",
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
      "none",
    ];
    return (
      levels.indexOf(logLevel.toLowerCase()) <=
      levels.indexOf(messageLevel.toLowerCase())
    );
  },

  async flushLogs() {
    const maxStorageLogSize = 10 * 1024 * 1024; // 10MB
    try {
      let newLogs = SLTools.logs;
      if (newLogs) {
        SLTools.logs = "";
        let { log } = await browser.storage.local.get(["log"]);
        log = log || "";
        log = newLogs + log;
        if (log.length > maxStorageLogSize) {
          let i = log.indexOf("\n", Math.floor(maxStorageLogSize / 2));

          while (log[i] != "\n") i++;
          log = log.substring(0, i + 1);
        }
        await browser.storage.local.set({ log });
      }
    } catch (ex) {
      throw ex;
    } finally {
      setTimeout(SLTools.flushLogs, 5000);
    }
  },

  doLog(messageLevel, ...args) {
    let logLevel = SLTools.preferences.logConsoleLevel || "all";
    if (SLTools.logThreshold(logLevel, messageLevel)) {
      console[messageLevel](...args);
    }
    logLevel = SLTools.preferences.logStorageLevel || "none";
    if (!SLTools.logThreshold(logLevel, messageLevel)) return;
    args = [...args];
    for (let i in args) {
      if (typeof args[i] == "object") {
        try {
          args[i] = JSON.stringify(args[i]);
        } catch (ex) {}
      }
    }
    message = "" + new Date().toISOString() + ": " + args.join(", ") + "\n";
    SLTools.logs = message + SLTools.logs;
  },

  error: (...args) => SLTools.doLog("error", ...args),
  warn: (...args) => SLTools.doLog("warn", ...args),
  info: (...args) => SLTools.doLog("info", ...args),
  log: (...args) => SLTools.doLog("all", ...args),
  debug: (...args) => SLTools.doLog("debug", ...args),
  trace: (...args) => SLTools.doLog("trace", ...args),

  // Run a function and report any errors to the console, but don't let the
  // error propagate to the caller.
  async nofail(func, ...args) {
    try {
      await func(...args);
    } catch (e) {
      SLTools.error(e);
    }
  },

  async prefDefaults() {
    if (!SLTools._prefDefaults) {
      SLTools._prefDefaults = await fetch("/utils/defaultPrefs.json").then(
        (ptxt) => ptxt.json(),
      );
    }
    return SLTools._prefDefaults;
  },

  async userPrefKeys(readOnly) {
    let prefDefaults = await SLTools.prefDefaults();
    let filterArray = readOnly
      ? SLTools.readOnlyFilterPrefs
      : SLTools.readWriteFilterPrefs;
    return Object.keys(prefDefaults).filter((k) => !filterArray.includes(k));
  },

  getLocale() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale;
    } catch (ex) {
      return SLTools.i18n.getUILanguage();
    }
  },

  cacheChanged(changes) {
    // You *must not* log anything in a storage changed listener until you've
    // confirmed that the stuff you care about has actually changed, or you will
    // cause an infinite logging loop when local storage logging is enabled,
    // because in that case logging causes storage to change!
    if (changes.preferences) {
      SLTools.cachePrefs(changes.preferences.newValue);
    }
  },

  async cachePrefs(preferences) {
    SLTools.debug("cachePrefs");
    if (!preferences) {
      if (!SLTools.listeningForStorageChanges) {
        browser.storage.local.onChanged.addListener(SLTools.cacheChanged);
        SLTools.listeningForStorageChanges = true;
      }
      let storage = await browser.storage.local.get(["preferences"]);
      if (storage.preferences) {
        preferences = storage.preferences;
      }
    }
    if (preferences) {
      SLTools.preferences = preferences;
    }
  },

  RFC5322: {
    // RFC2822 / RFC5322 formatter
    dayOfWeek: (d) =>
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()],

    day: (d) => d.getDate(),

    month: (d) =>
      [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][d.getMonth()],

    year: (d) => d.getFullYear().toFixed(0),

    date(d) {
      return `${this.day(d)} ${this.month(d)} ${this.year(d)}`;
    },

    time(d) {
      let H = d.getHours().toString().padStart(2, "0");
      let M = d.getMinutes().toString().padStart(2, "0");
      let S = d.getSeconds().toString().padStart(2, "0");
      return `${H}:${M}:${S}`;
    },

    tz(offset) {
      let sign = offset > 0 ? "-" : "+"; // yes, counterintuitive
      let absPad = (n) => Math.trunc(Math.abs(n)).toString().padStart(2, "0");
      return sign + absPad(offset / 60) + absPad(offset % 60);
    },

    format(d, sanitize) {
      let offset;
      if (sanitize) {
        d = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
        // Mimicking behavior in mailnews/mime/jsmime/jsmime.js in TB source.
        d.setSeconds(0);
        offset = 0;
      } else {
        offset = d.getTimezoneOffset() || 0;
      }
      let day = this.dayOfWeek(d);
      let date = this.date(d);
      let time = this.time(d);
      let tz = this.tz(offset);
      return `${day}, ${date} ${time} ${tz}`;
    },
  },

  flatten(arr) {
    // Flattens an N-dimensional array.
    return arr.reduce(
      (res, item) =>
        res.concat(Array.isArray(item) ? SLTools.flatten(item) : item),
      [],
    );
  },

  generateUUID() {
    // Thanks to stackexchange for this one
    //    https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    // Note: This will eventually be replaced with a standard uuid javascript
    // module as part of the ecmascript standard.
    const uuid = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16),
    );
    return `{${uuid}}`;
  },

  convertTime(t) {
    if (!t) {
      return null;
    } else if (typeof t === "string") {
      return SLTools.parseDateTime(null, t) || new Date(t);
    } else if (typeof t === "number") {
      if (t < 2401) {
        return SLTools.parseDateTime(null, `${t}`);
      } else {
        return new Date(t);
      }
    } else if (t.getTime) {
      return new Date(t.getTime());
    } else {
      throw new Error(`Send Later error: unable to parse time format ${t}`);
    }
  },

  convertDate(date) {
    SLTools.trace(`convertDate(${date})`);
    if (!date) {
      return null;
    } else if (date.raw) {
      date = date.raw;
    }

    if (typeof date === "string") {
      let relativeTo = new Date();
      const localeCode = SLTools.getLocale();
      let sugarDate;
      for (let locale of [localeCode, localeCode.split("-")[0], "en"]) {
        sugarDate = Sugar.Date.get(relativeTo, date, {
          locale: locale,
          future: true,
        });
        if (sugarDate.getTime()) {
          return new Date(sugarDate.getTime());
        }
        let internalValue = Date.parse(date);
        if (internalValue) {
          return new Date(internalValue);
        }
      }

      return null;
    } else if (typeof date === "number") {
      return new Date(date);
    } else if (date.getTime) {
      return new Date(date.getTime());
    }
    throw new Error(`Send Later error: unable to parse date format`, date);
  },

  estimateSendTime(scheduledDate, previousLoop, loopMinutes) {
    SLTools.trace(
      `estimateSendTime(${scheduledDate}, ${previousLoop}, ${loopMinutes})`,
    );
    // Probably redundant but might as well be careful.
    scheduledDate = SLTools.convertDate(scheduledDate);
    if (!(previousLoop && loopMinutes)) {
      SLTools.debug(
        "estimateSendTime: mainloop data not set, returning input",
      );
      return scheduledDate;
    }
    let now = new Date();
    if (scheduledDate < now) {
      SLTools.debug(
        "estimateSendTime: scheduled in past, starting with present",
      );
      scheduledDate = now;
    }

    let delta = scheduledDate.getTime() - previousLoop;
    let modulus = delta % (60000 * loopMinutes);
    let estimate = new Date(scheduledDate.getTime() + modulus);
    SLTools.debug(
      `estimateSendTime: delta=${delta}, modulus=${modulus}, ` +
        `estimate=${estimate}`,
    );
    return estimate;
  },

  // Round datetime up to the next nearest full minute
  ceilDateTime(dt) {
    SLTools.trace(`ceilDateTime(${dt})`);
    dt = SLTools.convertDate(dt);
    return new Date(Math.ceil(dt.getTime() / 60000) * 60000);
  },

  // Round datetime down to the next nearest full minute
  floorDateTime(dt) {
    SLTools.trace(`floorDateTime(${dt})`);
    dt = SLTools.convertDate(dt);
    return new Date(Math.floor(dt.getTime() / 60000) * 60000);
  },

  // Round datetime to the nearest full minute
  roundDateTime(dt) {
    SLTools.trace(`roundDateTime(${dt})`);
    dt = SLTools.convertDate(dt);
    return new Date(Math.round(dt.getTime() / 60000) * 60000);
  },

  parseableDateTimeFormat(date, sanitize) {
    SLTools.trace(`parseableDateTimeFormat(${date})`);
    date = SLTools.convertDate(date) || new Date();
    return SLTools.RFC5322.format(date, sanitize);
  },

  isoDateTimeFormat(date) {
    SLTools.trace(`isoDateTimeFormat(${date})`);
    date = SLTools.convertDate(date) || new Date();
    return date.toISOString();
  },

  defaultHumanDateTimeFormat(date) {
    const options = {
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return new Intl.DateTimeFormat([], options).format(date || new Date());
  },

  defaultShortHumanDateTimeFormat(date) {
    SLTools.trace(`defaultShortHumanDateTimeFormat(${date})`);
    date = SLTools.convertDate(date);
    const options = {
      hour: "numeric",
      minute: "numeric",
      month: "numeric",
      day: "numeric",
      year: "numeric",
    };
    return new Intl.DateTimeFormat([], options).format(date || new Date());
  },

  customHumanDateTimeFormat(date, fmt) {
    SLTools.trace(`customHumanDateTimeFormat(${date}, ${fmt})`);
    date = SLTools.convertDate(date);
    return Sugar.Date.format(date || new Date(), fmt);
  },

  humanDateTimeFormat(date) {
    if (
      this.preferences.customizeDateTime &&
      this.preferences.longDateTimeFormat !== ""
    ) {
      try {
        return this.customHumanDateTimeFormat(
          date,
          this.preferences.longDateTimeFormat,
        );
      } catch (ex) {
        this.warn(ex);
      }
    }
    return this.defaultHumanDateTimeFormat(date);
  },

  shortHumanDateTimeFormat(date) {
    if (
      this.preferences.customizeDateTime &&
      this.preferences.shortDateTimeFormat !== ""
    ) {
      try {
        return this.customHumanDateTimeFormat(
          date,
          this.preferences.shortDateTimeFormat,
        );
      } catch (ex) {
        this.warn(ex);
      }
    }
    return this.defaultShortHumanDateTimeFormat(date);
  },

  compare(a, comparison, b, tolerance) {
    if (!tolerance) {
      tolerance = 0;
    }
    switch (comparison) {
      case "<":
        return a - b < tolerance;
      case ">":
        return a - b > tolerance;
      case "<=":
        return a - b <= tolerance;
      case ">=":
        return a - b >= tolerance;
      case "==":
      case "===":
        return Math.abs(a - b) <= tolerance;
      case "!=":
      case "!==":
        return Math.abs(a - b) > tolerance;
      default:
        throw new Error("Unknown comparison: " + comparison);
        break;
    }
  },

  compareDates(a, comparison, b) {
    SLTools.trace(`compareDates(${a}, ${comparison}, ${b}`);
    a = SLTools.convertDate(a);
    b = SLTools.convertDate(b);
    const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return SLTools.compare(A.getTime(), comparison, B.getTime());
  },

  compareTimes(a, comparison, b, ignoreSec, tolerance) {
    a = SLTools.convertTime(a);
    b = SLTools.convertTime(b);
    const A = new Date(
      2000,
      0,
      01,
      a.getHours(),
      a.getMinutes(),
      ignoreSec ? 0 : a.getSeconds(),
    );
    const B = new Date(
      2000,
      0,
      01,
      b.getHours(),
      b.getMinutes(),
      ignoreSec ? 0 : b.getSeconds(),
    );
    return SLTools.compare(A.getTime(), comparison, B.getTime(), tolerance);
  },

  compareDateTimes(a, comparison, b, ignoreSec, tolerance) {
    SLTools.trace(
      `compareDateTimes(${a}, ${comparison}, ${b}, ${ignoreSec}, ${tolerance})`,
    );
    const A = SLTools.convertDate(a);
    const B = SLTools.convertDate(b);
    A.setMilliseconds(0);
    B.setMilliseconds(0);
    if (ignoreSec) {
      A.setSeconds(0);
      B.setSeconds(0);
    }
    return SLTools.compare(A.getTime(), comparison, B.getTime(), tolerance);
  },

  getWkdayName(input, style) {
    style = style || "long";
    let date;
    if (input.getTime) {
      date = input;
    } else {
      date = new Date(2000, 0, 2 + +input); // 2000/01/02 Happens to be a Sunday
    }
    return new Intl.DateTimeFormat([], { weekday: style }).format(date);
  },

  parseDateTime(dstr, tstr) {
    // Inputs: dstr (formatted YYYY/MM/DD), tstr (formatted HH:MM)
    const dpts = dstr ? dstr.split(/\D/) : [0, 1, 0];
    const tpts = SLTools.timeRegex.test(tstr)
      ? SLTools.timeRegex.exec(tstr)
      : [null, 0, 0];
    return new Date(+dpts[0], --dpts[1], +dpts[2], +tpts[1], +tpts[2]);
  },

  formatTime(datetime, zeropad, human) {
    if (typeof datetime === "number") {
      datetime = new Date(datetime);
    } else if (typeof datetime === "string") {
      datetime = SLTools.parseDateTime(null, datetime);
    }

    if (datetime.getTime) {
      const hours = ("" + datetime.getHours()).padStart(zeropad ? 2 : 1, "0");
      const minutes = ("" + datetime.getMinutes()).padStart(2, "0");
      if (human) {
        return `${hours}:${minutes}`;
      } else {
        return `${hours}${minutes}`;
      }
    } else {
      SLTools.debug(`Unable to parse datetime`, datetime);
      return null;
    }
  },

  formatRelative(dateTime, relativeTo) {
    if (!relativeTo) {
      relativeTo = new Date(Date.now() - 10);
    }
    const dt = (dateTime.getTime() - relativeTo.getTime()) / 1000;
    const DT = Math.abs(dt);
    const L = Sugar.Date.getLocale("en");
    const l = Sugar.Date.getLocale();

    const prettyRound = (n) => {
      if (n % 1 <= 0.3 || n % 1 > 0.7) {
        return Math.round(n).toFixed(0);
      } else {
        return n.toFixed(1);
      }
    };

    let num, u;
    if (DT < 60) {
      num = `${Math.floor(DT)}`;
      u = L.unitMap.seconds;
    } else if (DT < 60 * 2) {
      num = `${Math.round((DT / 60) * 10) / 10}`;
      u = L.unitMap.minutes;
    } else if (DT < 60 * 10) {
      num =
        (DT / 60) % 1 > 0.9
          ? `${Math.ceil(DT / 60)}`
          : `${Math.floor(DT / 60)}`;
      u = L.unitMap.minutes;
    } else if (DT < 60 * 55) {
      num = `${Math.floor(DT / 60)}`;
      u = L.unitMap.minutes;
    } else if (DT < 60 * 60 * 23.7) {
      num = prettyRound(DT / (60 * 60));
      u = L.unitMap.hours;
    } else if (DT <= 60 * 60 * 24 * 364.3) {
      num = prettyRound(DT / (60 * 60 * 24));
      u = L.unitMap.days;
    } else {
      num = prettyRound(DT / (60 * 60 * 24 * 365));
      u = L.unitMap.years;
    }

    const singular = !l.plural || num === "1";
    const unit = singular ? l.units[u] : l.units[8 + u];
    const sign = l[dt > -1 ? "fromNow" : "ago"];
    const format = l[dt > -1 ? "future" : "past"];
    return format.replace(/\{(.*?)\}/g, function (full, match) {
      switch (match) {
        case "num":
          return num;
        case "unit":
          return unit;
        case "sign":
          return sign;
      }
    });
  },

  evaluateUfunc(name, body, prev, args) {
    let FUNC = SLTools.builtInFuncs[name];
    if (FUNC) {
      SLTools.telemetrySend({ event: "evaluateUfunc", func: name });
    } else {
      SLTools.telemetrySend({ event: "evaluateUfunc", func: "<private>" });
      SLTools.ufuncCompatibilityWarning(true);
      const funcStr = `
        let next, nextspec, nextargs;
        ${body};
        return([next, nextspec, nextargs]);`;
      try {
        FUNC = Function.apply(null, ["specname", "prev", "args", funcStr]);
      } catch (ex) {
        SLTools.debug(`User function ${name} construction failed`, ex);
        return { error: ex.message };
      }
    }
    let response;
    try {
      response = FUNC(name, prev, args);
    } catch (ex) {
      SLTools.debug(
        `User function ${name} (prev: ${prev}, args: ${args}) ` +
          `returned error.`,
        ex,
      );
      return { error: ex.message };
    }

    if (response === undefined) {
      let error = `Send Later: Recurrence function '${name}' did not return a value`;
      SLTools.warn(error);
      return { error };
    }

    let recvdType;
    if (typeof response === "number") {
      recvdType = "number";
    } else if (response.getTime) {
      recvdType = "date";
    } else if (response.splice) {
      recvdType = "array";
    } else {
      let error = `Recurrence function "${name}" did not return number, Date, or array`;
      SLTools.warn(error);
      return { error };
    }

    const prevOrNow = prev ? new Date(prev).getTime() : Date.now();

    switch (recvdType) {
      case "number":
        if (response < 0) {
          return { sendAt: null };
        } else {
          return {
            sendAt: new Date(prevOrNow + response * 60 * 1000),
          };
        }
      case "date":
        return { sendAt: response };
      case "array":
        if (response.length < 2) {
          let error = `Array returned by recurrence function "${name}" is too short`;
          SLTools.warn(error);
          return { error };
        }
        let sendAt;
        if (typeof response[0] === "number") {
          if (response[0] < 0) {
            return { sendAt: null };
          } else {
            sendAt = new Date(prevOrNow + response[0] * 60 * 1000);
          }
        } else if (response[0].getTime) {
          sendAt = response[0];
        } else {
          let error =
            `Send Later: Array ${response} returned by recurrence ` +
            `function ${name}" did not start with a number or Date`;
          SLTools.warn(error);
          return { error };
        }
        return {
          sendAt,
          nextspec: response[1],
          nextargs: response[2],
          error: undefined,
        };
    }
  },

  formatRecurForUI(recur) {
    if (!recur || recur.type === "none") {
      return "";
    }
    let recurText = "";
    let typeCap = recur.type.charAt(0).toUpperCase() + recur.type.slice(1);
    if (recur.type === "function") {
      // Almost certainly doesn't work for all languages. Need a new translation
      // for "recur according to function $1"
      recurText = this.i18n
        .getMessage("sendwithfunction", [recur.function])
        .replace(/^\S*/, this.i18n.getMessage("recurLabel"));
      if (recur.args) {
        let funcArgsLabel = this.i18n.getMessage(
          "sendlater.prompt.functionargs.label",
        );
        recurText += `\n${funcArgsLabel}: [${recur.args}]`;
      }
    } else if (recur.type === "monthly") {
      recurText = this.i18n.getMessage("recurLabel") + " ";

      let monthlyRecurParts = [];

      if (!recur.multiplier) {
        monthlyRecurParts.push(this.i18n.getMessage(`recur${typeCap}Label`));
      }

      if (recur.monthly_day) {
        const ordDay = this.i18n.getMessage("ord" + recur.monthly_day.week);
        const dayName = SLTools.getWkdayName(recur.monthly_day.day, "long");
        monthlyRecurParts.push(
          `${this.i18n.getMessage("everymonthly", [ordDay, dayName])}`,
        );
      }

      if (recur.multiplier) {
        monthlyRecurParts.push(
          this.i18n.getMessage("every_" + recur.type, recur.multiplier),
        );
      }

      recurText += monthlyRecurParts.join(", ");
    } else {
      recurText = this.i18n.getMessage("recurLabel") + " ";

      const multiplier = recur.multiplier || 1;
      if (multiplier === 1) {
        recurText += this.i18n.getMessage(`recur${typeCap}Label`);
      } else {
        recurText += this.i18n.getMessage("every_" + recur.type, multiplier);
      }
    }

    if (recur.between) {
      const start = SLTools.formatTime(recur.between.start, false, true);
      const end = SLTools.formatTime(recur.between.end, false, true);
      recurText += " " + this.i18n.getMessage("betw_times", [start, end]);
    }

    if (recur.days) {
      const days = recur.days.map((v) => SLTools.getWkdayName(v));
      let onDays;
      if (/^en/i.test(SLTools.getLocale())) {
        if (days.length === 1) {
          onDays = days;
        } else if (days.length === 2) {
          onDays = days.join(" and ");
        } else {
          const ndays = days.length;
          days[ndays - 1] = `and ${days[ndays - 1]}`;
          onDays = days.join(", ");
        }
      } else {
        onDays = days.join(", ");
      }
      recurText += `\n${this.i18n.getMessage("sendOnlyOnLabel")} ${onDays}`;
    }

    if (recur.until) {
      let formattedUntil = this.shortHumanDateTimeFormat(recur.until);
      recurText +=
        "\n" + this.i18n.getMessage("until_datetime", formattedUntil);
    }

    if (recur.cancelOnReply) {
      recurText += "\n" + this.i18n.getMessage("cancel_on_reply");
    }

    return recurText.trim();
  },

  formatScheduleForUIColumn(schedule) {
    if (/encrypted/i.test(schedule.contentType)) {
      return (
        "Warning: Message is encrypted and will not be processed by " +
        "Send Later"
      );
    }

    let sendAt = schedule.sendAt;
    let recur = schedule.recur;

    let scheduleText;
    if (recur !== undefined && !sendAt && recur.type === "function") {
      scheduleText = this.i18n.getMessage("sendwithfunction", [
        recur.function,
      ]);
    } else {
      scheduleText = SLTools.shortHumanDateTimeFormat(sendAt);
    }

    const rTxt = SLTools.formatRecurForUI(recur).replace(/\n/gm, ". ");
    if (rTxt) {
      scheduleText += ` (${rTxt})`;
    }

    return scheduleText;
  },

  formatScheduleForUI(schedule, previousLoop, loopMinutes) {
    let scheduleText;
    if (!schedule.sendAt && schedule.recur.type === "function") {
      scheduleText = this.i18n.getMessage("sendwithfunction", [
        schedule.recur.function,
      ]);
    } else {
      let sendAt = SLTools.estimateSendTime(
        schedule.sendAt,
        previousLoop || new Date(Math.floor(Date.now() / 60000) * 60000),
        loopMinutes || 1,
      );

      scheduleText = this.i18n.getMessage("sendAtLabel");
      scheduleText += " " + SLTools.humanDateTimeFormat(sendAt);
      const fromNow = (sendAt.getTime() - Date.now()) / 1000;
      if (fromNow < 0 && fromNow > -90) {
        scheduleText += ` (${new Sugar.Date(Date.now() + 100).relative()})`;
      } else {
        try {
          scheduleText += ` (${SLTools.formatRelative(sendAt)})`;
        } catch (ex) {
          SLTools.warn(ex);
        }
      }
    }

    scheduleText += "\n" + SLTools.formatRecurForUI(schedule.recur);

    return scheduleText.trim();
  },

  // Get header's value from raw MIME message content.
  // e.g. "subject: foo bar    baz" returns "foo bar    baz"
  getHeader(content, header) {
    const regex = new RegExp(
      `^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,
      "im",
    );
    let hdrContent = content.split(/\r\n\r\n/m)[0] + "\r\n";
    if (regex.test(hdrContent)) {
      let hdrLine = hdrContent.match(regex)[0];
      // Strip off the header key (everything before the first colon)
      hdrLine = hdrLine.replace(/[^:]*:/m, "");
      // We can assume all CRLF sequences are followed by whitespace,
      // since they matched the regex above. This complies with RFC822:
      // https://datatracker.ietf.org/doc/html/rfc822#section-3.1.1
      hdrLine = hdrLine.replace(/\r\n/gm, "");
      return hdrLine.trim();
    } else {
      return undefined;
    }
  },

  // Replaces the header content with a new value.
  //    replaceAll: operate on all instances of the header (can be regex)
  //    addIfMissing: If the header does not exist
  replaceHeader(content, header, value, replaceAll, addIfMissing) {
    const regexStr = `^${header}:.*(?:\r\n|\n)([ \t].*(?:\r\n|\n))*`;
    const replacement = value ? `${header}: ${value}\r\n` : "";
    const regex = new RegExp(regexStr, replaceAll ? "img" : "im");
    const hdrContent = content.split(/\r\n\r\n/m)[0] + "\r\n";
    const msgContent = content
      .split(/\r\n\r\n/m)
      .slice(1)
      .join("\r\n\r\n");
    if (addIfMissing && !regex.test(hdrContent)) {
      return `${hdrContent.trim()}\r\n${header}: ${value}\r\n\r\n${msgContent}`;
    } else {
      const newHdrs = hdrContent.replace(regex, replacement);
      return `${newHdrs.trim()}\r\n\r\n${msgContent}`;
    }
  },

  parseArgs(argstring) {
    return JSON.parse(`[${argstring || ""}]`);
  },

  unparseArgs(args) {
    // Convert a list into its string representation, WITHOUT the square
    // braces around the entire list.
    let arglist = JSON.stringify(args || [], null, " ");
    arglist = arglist.replace(/\r?\n\s*/g, " "); // Remove newlines
    arglist = arglist.replace(/\[\s*/g, "[").replace(/\s*\]/g, "]"); // Cleanup
    arglist = arglist.replace(/^\[|\]$/g, ""); // Strip outer brackets
    return arglist;
  },

  /* Format:
     First field is none/minutely/daily/weekly/monthly/yearly/function

     If first field is monthly, then it is followed by either one or
     two numbers. If one, then it's a single number for the day of
     the month; otherwise, it's the day of the week followed by its
     place within the month, e.g., "1 3" means the third Monday of
     each month.

     If the first field is yearly, then the second and third fields
     are the month (0-11) and date numbers for the yearly occurrence.

     After all of the above except function, "/ #" indicates a skip
     value, e.g., "/ 2" means every 2, "/ 3" means every 3, etc. For
     example, "daily / 3" means every 3 days, while "monthly 2 2 /
     2" means every other month on the second Tuesday of the month.

     If the first field is function, then the second field is the
     name of a global function which will be called with one
     argument, the previous scheduled send time (as a Date
     object), and an array of arguments returned by the previous
     invocation. It has three legal return values:

     -1 - stop recurring, i.e., don't schedule any later instances
     of this message

     integer 0 or greater - schedule this message the specified
     number of minutes into the future, then stop recurring

     array [integer 0 or greater, recur-spec, ...] - schedule this
     message the specified number of minutes into the future,
     with the specified recurrence specification for instances
     after this one, and pass the remaining items in the array into the
     next invocation of the function as an arguments array

     If the word "finished" appears in the spec anywhere after the function
     name, then it indicates that the specified function should _not_ be
     called again; rather, we're finished scheduling future sends of this
     message, but the function is being preserved in the recurrence
     specification so that it'll be set properly in the dialog if the user
     edits the scheduled message.

     Sending can be restricted with any combination of the following:

     - "between HH:MM HH:MM" to indicate a time of day restriction
     - "on # ..." to indicate day of week restrictions
     - "until [date-time]" to indicate when the recurrence terminates
  */

  // recur (object) -> recurSpec (string)
  unparseRecurSpec(recur) {
    let spec = recur.type;

    if (spec === "none") return spec;

    if (recur.type === "monthly") {
      spec += " ";
      if (recur.monthly_day) {
        spec += recur.monthly_day.day + " " + recur.monthly_day.week;
      } else {
        spec += recur.monthly;
      }
    } else if (recur.type === "yearly") {
      spec += " " + recur.yearly.month + " " + recur.yearly.date;
    } else if (recur.type === "function") {
      spec += " " + recur.function;
      if (recur.finished) {
        spec += " finished";
      }
    }

    if (recur.multiplier) {
      spec += " / " + recur.multiplier;
    }

    if (recur.between) {
      const start = SLTools.formatTime(recur.between.start, false, false);
      const end = SLTools.formatTime(recur.between.end, false, false);
      spec += ` between ${start} ${end}`;
    }

    if (recur.days) {
      spec += " on " + recur.days.join(" ");
    }

    if (recur.until) {
      spec += ` until ${SLTools.isoDateTimeFormat(recur.until)}`;
    }

    return spec;
  },

  // recurSpec (string) -> recur (object)
  parseRecurSpec(recurSpec) {
    if (!recurSpec) {
      return { type: "none" };
    }

    const params = recurSpec.split(/\s+/);
    const recur = {};
    recur.type = params.shift();
    if (
      ![
        "none",
        "minutely",
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "function",
      ].includes(recur.type)
    ) {
      throw new Error("Invalid recurrence type in " + recurSpec);
    }
    switch (recur.type) {
      case "none":
        /* pass */
        break;
      case "monthly":
        if (!/^\d+$/.test(params[0])) {
          throw new Error("Invalid first monthly argument in " + recurSpec);
        }
        if (/^[1-9]\d*$/.test(params[1])) {
          recur.monthly_day = {
            day: parseInt(params.shift()),
            week: parseInt(params.shift()),
          };
          if (recur.monthly_day.day < 0 || recur.monthly_day.day > 6) {
            throw new Error("Invalid monthly day argument in " + recurSpec);
          }
          if (recur.monthly_day.week < 1 || recur.monthly_day.week > 5) {
            throw new Error("Invalid monthly week argument in " + recurSpec);
          }
        } else {
          recur.monthly = parseInt(params.shift());
          if (recur.monthly > 31)
            throw new Error("Invalid monthly date argument in " + recurSpec);
        }
        break;
      case "yearly":
        if (!/^\d+$/.test(params[0])) {
          throw "Invalid first yearly argument in " + recurSpec;
        }
        if (!/^[1-9]\d*$/.test(params[1])) {
          throw "Invalid second yearly argument in " + recurSpec;
        }
        recur.yearly = {
          month: parseInt(params.shift()),
          date: parseInt(params.shift()),
        };

        // Check that this month/date combination is possible at all.
        // Use a leap year for this test.
        const test = new Date(2000, recur.yearly.month, recur.yearly.date);
        if (
          test.getMonth() !== recur.yearly.month ||
          test.getDate() !== recur.yearly.date
        ) {
          throw new Error("Invalid yearly date in " + recurSpec);
        }
        break;
      case "function":
        recur.function = params.shift();
        recur.finished = params[0] === "finished";

        if (!recur.function) {
          throw new Error("Invalid function recurrence spec");
        }
        break;
      default:
        break;
    }

    if (recur.type !== "function") {
      const slashIndex = params.indexOf("/");
      if (slashIndex > -1) {
        const multiplier = params[slashIndex + 1];
        if (!/^[1-9]\d*$/.test(multiplier)) {
          throw new Error("Invalid multiplier argument in " + recurSpec);
        }
        recur.multiplier = parseInt(multiplier);
        params.splice(slashIndex, 2);
      }
    }

    const btwnIdx = params.indexOf("between");
    if (btwnIdx > -1) {
      const startTimeStr = params[btwnIdx + 1];
      const endTimeStr = params[btwnIdx + 2];

      if (!SLTools.timeRegex.test(startTimeStr)) {
        throw new Error("Invalid between start in " + recurSpec);
      } else if (!SLTools.timeRegex.test(endTimeStr)) {
        throw new Error("Invalid between end in " + recurSpec);
      }

      recur.between = {
        start: SLTools.formatTime(startTimeStr, false, false),
        end: SLTools.formatTime(endTimeStr, false, false),
      };
      params.splice(btwnIdx, 3);
    }
    const onIndex = params.indexOf("on");
    if (onIndex > -1) {
      recur.days = [];
      params.splice(onIndex, 1);
      while (/^\d$/.test(params[onIndex])) {
        const day = params.splice(onIndex, 1)[0];
        if (day > 6) {
          throw new Error("Bad restriction day in " + recurSpec);
        }
        recur.days.push(parseInt(day));
      }
      if (!recur.days.length) {
        throw new Error("Day restriction with no days in spec " + recurSpec);
      }
    }
    let untilIndex = params.indexOf("until");
    if (untilIndex > -1) {
      let untilDTstring = params[untilIndex + 1];
      recur.until = new Date(untilDTstring);
      params.splice(untilIndex, 2);
    }
    if (params.length) {
      throw new Error("Extra arguments in " + recurSpec);
    }
    return recur;
  },

  async nextRecurFunction(prev, recurSpec, recur, args) {
    if (!recur.function) {
      throw new Error(
        `Invalid recurrence specification '${recurSpec}': ` +
          "No function defined",
      );
    }

    const funcName = recur.function.replace(/^ufunc:/, "");
    const { ufuncs } = await browser.storage.local.get({ ufuncs: {} });

    prev = new Date(prev);

    if (ufuncs[funcName] === undefined) {
      throw new Error(
        `Invalid recurrence specification '${recurSpec}': ` +
          `${funcName} is not defined.`,
      );
    }

    let nextRecur = SLTools.evaluateUfunc(
      funcName,
      ufuncs[funcName].body,
      prev,
      args,
    );

    if (!nextRecur) {
      return null;
    }

    if (!nextRecur.nextspec && (recur.between || recur.days)) {
      nextRecur.nextspec = "none";
    }

    if (nextRecur.nextspec) {
      // Merge restrictions from old spec into this one.
      const functionSpec = SLTools.parseRecurSpec(nextRecur.nextspec);
      if (recur.between) {
        functionSpec.between = recur.between;
      }
      if (recur.days) {
        functionSpec.days = recur.days;
      }
      if (recur.until) {
        functionSpec.until = recur.until;
      }
      nextRecur.nextspec = SLTools.unparseRecurSpec(functionSpec);
    }

    return nextRecur;
  },

  async nextRecurDate(next, recurSpec, now, args) {
    // Make sure we don't modify our input!
    next = new Date(next.getTime());
    const recur = SLTools.parseRecurSpec(recurSpec);

    if (recur.type === "none") {
      return null;
    }

    if (recur.type === "function") {
      if (recur.finished) {
        return null;
      }
      const nextRecur = await SLTools.nextRecurFunction(
        next,
        recurSpec,
        recur,
        args,
      );
      if (nextRecur && nextRecur.sendAt && (recur.between || recur.days)) {
        nextRecur.sendAt = SLTools.adjustDateForRestrictions(
          nextRecur.sendAt,
          recur.between && recur.between.start,
          recur.between && recur.between.end,
          recur.days,
        );
      }
      if (recur.until && recur.until.getTime() < nextRecur.sendAt.getTime()) {
        SLTools.debug(
          `Recurrence ending because of "until" restriction: ` +
            `${recur.until} < ${nextRecur.sendAt}`,
        );
        return null;
      }
      return nextRecur;
    }

    if (!now) now = new Date();

    let redo = false;

    if (!recur.multiplier) {
      recur.multiplier = 1;
    }

    while (next <= now || recur.multiplier > 0 || redo) {
      redo = false;
      switch (recur.type) {
        case "minutely":
          next.setMinutes(next.getMinutes() + 1);
          break;
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "monthly":
          // Two different algorithms are in play here, depending on
          // whether we're supposed to schedule on a day of the month or
          // a weekday of a week of the month.
          //
          // If the former, then either the current day of the month is
          // the same as the one we want, in which case we just move to
          // the next month, or it's not, in which case the "correct"
          // month didn't have that day (i.e., it's 29, 30, or 31 on a
          // month without that many days), so we ended up rolling
          // over. In that case, we set the day of the month of the
          // _current_ month, because we're already in the right month.
          //
          // If the latter, then first check if we're at the correct
          // weekday and week of the month. If so, then go to the first
          // day of the next month. After that, move forward to the
          // correct week of the month and weekday.  If that pushes us
          // past the end of the month, that means the month in question
          // doesn't have, e.g., a "5th Tuesday", so we need to set the
          // redo flag indicating that we need to go through the loop
          // again because we didn't successfully find a date.

          if (recur.monthly) {
            if (next.getDate() === +recur.monthly) {
              next.setMonth(next.getMonth() + 1);
            } else {
              next.setDate(recur.monthly);
            }
          } else {
            if (
              next.getDay() === +recur.monthly_day.day &&
              Math.ceil(next.getDate() / 7) === +recur.monthly_day.week
            ) {
              next.setDate(1);
              next.setMonth(next.getMonth() + 1);
            } else {
            }
            next.setDate((recur.monthly_day.week - 1) * 7 + 1);
            while (next.getDay() !== +recur.monthly_day.day) {
              next.setDate(next.getDate() + 1);
            }
            if (Math.ceil(next.getDate() / 7) !== +recur.monthly_day.week) {
              redo = true;
            }
          }
          break;
        case "yearly":
          next.setFullYear(next.getFullYear() + 1);
          next.setMonth(recur.yearly.month);
          next.setDate(recur.yearly.date);
          break;
        default:
          throw new Error(
            "Send Later error: unrecognized recurrence type: " + recur.type,
          );
          break;
      }

      recur.multiplier--;
    }

    if (recur.between || recur.days) {
      next = SLTools.adjustDateForRestrictions(
        next,
        recur.between && recur.between.start,
        recur.between && recur.between.end,
        recur.days,
      );
    }

    if (recur.until && recur.until.getTime() < next.getTime()) {
      SLTools.debug(
        `Recurrence ending because of "until" restriction: ` +
          `${recur.until} < ${next}`,
      );
      return null;
    }

    return { sendAt: next };
  },

  // sendAt is a Date object for the scheduled send time we need to adjust.
  // start_time and end_time are numbers like HHMM, e.g., 10:00am is
  // 1000, 5:35pm is 1735, or null if there is no time restriction.
  // days is an array of numbers, with 0 being Sunday and 6 being Saturday,
  // or null if there is no day restriction. soonest_valid indicates
  // whether we should skip to the same time within the next valid day, or
  // to the soonest time that satisfies all the conditions.
  // Algorithm:
  // 1) If there is a time restriction and the scheduled time is before it,
  //    change it to the beginning of the time restriction.
  // 2) If there is a time restriction and the scheduled time is after it,
  //    change it to the beginning of the time restriction the next day.
  // 3) If there is a day restriction and the scheduled day isn't in it,
  //    change the day to the smallest day in the restriction that is larger
  //    than the scheduled day, or if there is none, then the smallest day in
  //    the restriction overall.
  // 4) If this is a one-off schedule and the assigned day is not valid, then we
  //    want to go to the beginning of the allowed time range on the next valid
  //    day.
  adjustDateForRestrictions(
    sendAt,
    start_time,
    end_time,
    days,
    soonest_valid,
  ) {
    // Copy argument variable to avoid modifying the original
    // (Is this really necessary?)
    sendAt = new Date(sendAt.getTime());
    start_time = SLTools.convertTime(start_time);
    end_time = SLTools.convertTime(end_time);

    if (
      start_time &&
      SLTools.compareTimes(sendAt, "<", start_time, true, 1000)
    ) {
      // 1) If there is a time restriction and the scheduled time is before it,
      // reschedule to the beginning of the time restriction.
      sendAt.setHours(start_time.getHours());
      sendAt.setMinutes(start_time.getMinutes());
    } else if (
      end_time &&
      SLTools.compareTimes(sendAt, ">", end_time, true, 1000)
    ) {
      // 2) If there is a time restriction and the scheduled time is after it,
      // reschedule to the beginning of the time restriction the next day.
      sendAt.setDate(sendAt.getDate() + 1); // works on end of month, too.
      sendAt.setHours(start_time.getHours());
      sendAt.setMinutes(start_time.getMinutes());
    }
    // 3) If there is a day restriction and the scheduled day isn't in it, then
    // increment the scheduled date by 1 day at a time until it reaches the
    // next unrestricted day.
    while (days && !days.includes(sendAt.getDay())) {
      sendAt.setDate(sendAt.getDate() + 1);
      if (soonest_valid && start_time) {
        // 4) Go to soonest valid time, rather than just skipping days.
        sendAt.setHours(start_time.getHours());
        sendAt.setMinutes(start_time.getMinutes());
      }
    }
    return sendAt;
  },

  parseHeadersForPopupUICache(headers) {
    SLTools.trace(`parseHeadersForPopupUICache(${headers})`);
    // input elements:
    //   - send-datetime (string)
    //   - recur (radio: once, minutely, daily, ...)
    //   - recur-multiplier (number)
    //   - recur-monthly-byweek (checkbox)
    //   - recur-function-args (text)
    //   - recur-cancelonreply (checkbox)
    //   - sendbetween (checkbox)
    //   - sendbetween-start (time)
    //   - sendbetween-end (time)
    //   - senduntil (checkbox)
    //   - senduntil-date (date)
    //   - senduntil-time (time)
    //   - sendon (checkbox)
    //   - sendon-{saturday|sunday|...} (checkboxes)
    // select elements:
    //   - recurFuncSelect
    //   - recur-monthly-byweek-week
    //   - recur-monthly-byweek-day

    for (let hdrName in headers) {
      if (hdrName.toLowerCase().startsWith("x-send-later")) {
        let hdrVal = headers[hdrName];
        headers[hdrName.toLowerCase()] = Array.isArray(hdrVal)
          ? hdrVal[0]
          : hdrVal;
      }
    }
    let sendAt = new Date(headers["x-send-later-at"]);
    let recurSpec = headers["x-send-later-recur"] || "none";
    let recur = SLTools.parseRecurSpec(recurSpec);
    recur.cancelOnReply = ["true", "yes"].includes(
      headers["x-send-later-cancel-on-reply"],
    );
    recur.args = headers["x-send-later-args"];

    let dom = {
      "send-datetime": SLTools.shortHumanDateTimeFormat(sendAt),
    };

    for (let recurType of [
      "once",
      "minutely",
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "function",
    ]) {
      dom[recurType] = recur.type === recurType;
    }

    if (recur.type === "none") {
      dom["once"] = true;
      return dom;
    }

    dom["recur-cancelonreply"] = recur.cancelOnReply;
    if (recur.multiplier) dom["recur-multiplier"] = recur.multiplier;

    dom["recur-function-args"] = recur.args || "";
    if (recur.type === "function" && recur.finished) {
      dom["recur"] = "none";
    } else if (recur.function) {
      dom["recurFuncSelect"] = recur.function;
    }

    if (recur.type === "monthly") {
      if (recur.monthly_day) {
        dom["recur-monthly-byweek"] = true;
        dom["recur-monthly-byweek-day"] = recur.monthly_day.day;
        dom["recur-monthly-byweek-week"] = recur.monthly_day.week;
      } else {
        dom["recur-monthly-byweek"] = false;
      }
    }

    if (recur.between) {
      dom["sendbetween"] = true;
      let start = SLTools.parseDateTime(null, recur.between.start);
      let end = SLTools.parseDateTime(null, recur.between.end);
      dom["sendbetween-start"] = SLTools.formatTime(start, true, true);
      dom["sendbetween-end"] = SLTools.formatTime(end, true, true);
    } else {
      dom["sendbetween"] = false;
    }

    if (recur.days) {
      dom["sendon"] = true;
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      for (let i = 0; i < 7; i++) {
        dom[`sendon-${dayNames[i]}`] = recur.days.includes(i);
      }
    } else {
      dom["sendon"] = false;
    }

    if (recur.until) {
      dom["senduntil"] = true;
      let isoSendUntil = SLTools.convertDate(recur.until).toISOString();
      dom["senduntil-date"] = isoSendUntil.substr(0, 10); // YYYY-mm-dd
      dom["senduntil-time"] = isoSendUntil.substr(11, 5); // HH:MM
    } else {
      dom["senduntil"] = false;
    }

    return dom;
  },

  translationURL(url) {
    let locale = SLTools.i18n.getUILanguage();
    if (locale.toLowerCase().startsWith("en")) {
      return url;
    } else {
      let [all, before, host, after, anchor] =
        /(.*\/\/)([^/]+)(.*?)(#.*)?$/.exec(url);
      anchor = anchor || "";
      host =
        host.replaceAll("-", "--").replaceAll(".", "-") + ".translate.goog";
      return `${before}${host}${after}?_x_tr_sl=en&_x_tr_tl=${locale}${anchor}`;
    }
  },

  telemetryNonce() {
    // Putting a nonce in the telemetry URL prevents identical telemetry
    // requests from getting intercepted by the cache. Making the nonce only
    // change once per minute leverages the cache to protect against the
    // possibility of a bug causing a client to submit the same request many
    // times in short order. This limits the use of telemetry for events that
    // occur frequently whose frequency we care a lot about, but I'm OK with
    // losing that big of signal for the sake of not accidentally DDoS'ing the
    // telemetry server by introducing a bug in the add-on.
    return new Sugar.Date().format("%Y%m%d%H%M").raw;
  },

  telemetrySend(values) {
    SLTools.debug("telemetrySend", values);
    if (!this.preferences.telemetryEnabled) {
      return;
    }
    if (this.preferences.telemetryUUIDEnabled) {
      let uuid = this.preferences.telemetryUUID;
      if (!uuid) {
        uuid = this.generateUUID().slice(1, -1);
        this.preferences.telemetryUUID = uuid;
        // We just let this promise complete in the background because it's not
        // incredibly important if the UUID isn't saved successfully, better
        // luck next time!
        messenger.storage.local.set({ preferences: this.preferences });
      }
      values.uuid = uuid;
    }
    values.locale = this.getLocale();
    values.nonce = this.telemetryNonce();
    if (!this.preferences.telemetryURL) {
      return;
    }
    let query = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      query.append(key, value);
    });
    let url = `${this.preferences.telemetryURL}?${query.toString()}`;
    try {
      let req = new XMLHttpRequest();
      req.addEventListener("load", (event) => {
        SLTools.debug("telemetrySend successful");
      });
      req.addEventListener("error", (event) => {
        SLTools.debug("telemetrySend failed", event);
      });

      req.open("GET", url);
      req.send();
      // We don't care about the response. Off it goes into the ether! Hopefully
      // it arrives, but we're not going to wait around to find out!
    } catch (ex) {
      SLTools.error("telemetrySend failure", ex);
    }
  },
};

/*
  We need to mock certain functions depending on the execution context. We made
  it to this point either through the extension itself, or through an
  experiment context, or via a Node-based unit test.
*/

// First, we need access to the i18n localization strings. This is trivial if
// we are inside of the extension context, but from outside of that context we
// need to access the extension, or create a mock translation service.
if (SLTools.i18n === null) {
  if (typeof browser !== "undefined" && browser.i18n) {
    // We're in the extension context.
    SLTools.i18n = browser.i18n;
  } else if (typeof require === "undefined") {
    // We're in an overlay context.
    try {
      let EP;
      if (typeof ExtensionParent !== "undefined") {
        EP = ExtensionParent;
      } else if (
        typeof window !== "undefined" &&
        typeof window.ExtensionParent !== "undefined"
      ) {
        EP = window.ExtensionParent;
      } else {
        var { ExtensionParent } = ChromeUtils.importESModule(
          "resource://gre/modules/ExtensionParent.sys.mjs",
        );
        EP = ExtensionParent;
      }
      const ext = EP.GlobalManager.getExtension("sendlater3@kamens.us");

      SLTools.i18n = {
        getUILanguage() {
          return ext.localeData.selectedLocale;
        },
        getMessage(messageName, substitutions = [], options = {}) {
          try {
            messageName = messageName.toLowerCase();

            let messages, str;

            const selectedLocale = ext.localeData.selectedLocale;
            if (ext.localeData.messages.has(selectedLocale)) {
              messages = ext.localeData.messages.get(selectedLocale);
              if (messages.has(messageName)) {
                str = messages.get(messageName);
              }
            }

            if (str === undefined) {
              SLTools.warn(
                `Unable to find message ${messageName} in ` +
                  `locale ${selectedLocale}`,
              );
              for (let locale of ext.localeData.availableLocales) {
                if (ext.localeData.messages.has(locale)) {
                  messages = ext.localeData.messages.get(locale);
                  if (messages.has(messageName)) {
                    str = messages.get(messageName);
                    break;
                  }
                }
              }
            }

            if (str === undefined) {
              str = messageName;
            }

            if (!str.includes("$")) {
              return str;
            }

            if (!Array.isArray(substitutions)) {
              substitutions = [substitutions];
            }

            let replacer = (matched, index, dollarSigns) => {
              if (index) {
                // This is not quite Chrome-compatible. Chrome consumes any
                // number of digits following the $, but only accepts 9
                // substitutions. We accept any number of substitutions.
                index = parseInt(index, 10) - 1;
                return index in substitutions ? substitutions[index] : "";
              }
              // For any series of contiguous `$`s, the first is dropped, and
              // the rest remain in the output string.
              return dollarSigns;
            };
            return str.replace(/\$(?:([1-9]\d*)|(\$+))/g, replacer);
          } catch (e) {
            SLTools.warn("Unable to get localized message.", e);
          }
          return "";
        },
      };
    } catch (e) {
      SLTools.warn("Unable to load i18n from extension.", e);
    }
  } else {
    // We're in a node process (unit test).
    SLTools.i18n = {
      getUILanguage() {
        return "en-US";
      },
      getMessage(key, args) {
        if (typeof args !== "object") {
          args = [args];
        }
        try {
          let msg;
          if (
            typeof window !== "undefined" &&
            typeof window.localeMessages === "object"
          ) {
            // browser environment
            msg = localeMessages[key].message;
          } else {
            // node.js environment
            msg = global.localeMessages[key].message;
          }
          return msg.replace(/\$\d/g, (i) => args[--i[1]]);
        } catch (e) {
          console.warn(e);
          return key;
        }
      },
    };
  }
}

/*
  Unit and functional tests require other mocked browser objects. Since we don't
  need to worry about polluting the global namespace in a unit test, we'll just
  create a mock global browser object here.
*/
if (typeof browser === "undefined" && typeof require !== "undefined") {
  var browserMocking = true;
  SLTools.mockStorage = {};
  var Sugar = require("./sugar-custom.js");

  console.info("Defining mock browser object for Node unit tests.");
  var browser = {
    storage: {
      local: {
        async get(key) {
          if (typeof key === "string") {
            const keyobj = {};
            keyobj[key] = {};
            key = keyobj;
          }
          const ret = {};
          Object.keys(key).forEach((key) => {
            if (SLTools.mockStorage[key]) {
              ret[key] = SLTools.mockStorage[key];
            } else {
              ret[key] = {};
            }
          });

          return ret;
        },
        async set(item) {
          console.log("mock storage", SLTools.mockStorage);
          Object.assign(SLTools.mockStorage, item);
          console.log("mock storage", SLTools.mockStorage);
        },
      },
    },
    runtime: {
      sendMessage(...args) {
        console.debug("Sent message to background script", args);
      },
    },
    SL3U: {
      async getLegacyPref(name, dtype, def) {
        return null;
      },
      async setHeader(tabId, name, value) {
        return null;
      },
    },
  };

  if (typeof window === "undefined") {
    // Make this file node.js-aware for browserless unit testing
    const fs = require("fs"),
      path = require("path"),
      filePath = path.join(__dirname, "..", "_locales", "en", "messages.json");
    const contents = fs.readFileSync(filePath, { encoding: "utf-8" });
    global.localeMessages = JSON.parse(contents);
    global.SLStatic = SLStatic;
    global.browser = browser;
  } else {
    // We're in a non-addon browser environment (functional tests)
    fetch("/_locales/en/messages.json")
      .then((response) => response.json())
      .then((locale) => {
        window.localeMessages = locale;
      });
  }

  SLTools.mockStorage.ufuncs = {
    ReadMeFirst: {
      help: `Any text you put here will be displayed as a tooltip when you \
hover over the name of the function in the menu. You can use this to document \
what the function does and what arguments it accepts.`,
      body: `\
// Send the first message now, subsequent messages once per day.
if (! prev)
  next = new Date();
else {
  var now = new Date();
  next = new Date(prev); // Copy date argument so we don't modify it.
  do {
    next.setDate(next.getDate() + 1);
  } while (next < now);
  // ^^^ Don't try to send in the past, in case Thunderbird was asleep at
  // the scheduled send time.
}
if (! args) // Send messages three times by default.
  args = [3];
nextargs = [args[0] - 1];
// Recur if we haven't done enough sends yet.
if (nextargs[0] > 0)
  nextspec = \"function \" + specname;";
`,
    },
    BusinessHours: {
      help: `Send the message now if it is during business hours, or at the \
beginning of the next work day. You can change the definition of work days \
(default: Mon - Fri) by passing in an array of work-day numbers as the first \
argument, where 0 is Sunday and 6 is Saturday. You can change the work start \
or end time (default: 8:30 - 17:30) by passing in an array of [H, M] as the \
second or third argument. Specify “null” for earlier arguments you don't \
change. For example, “null, [9, 0], [17, 0]” changes the work hours without \
changing the work days.`,
      body: `\
// Defaults
var workDays = [1, 2, 3, 4, 5]; // Mon - Fri; Sun == 0, Sat == 6
var workStart = [8, 30]; // Start of the work day as [H, M]
var workEnd = [17, 30]; // End of the work day as [H, M]
if (args && args[0])
  workDays = args[0];
if (args && args[1])
  workStart = args[1];
if (args && args[2])
  workEnd = args[2];
if (prev)
  // Not expected in normal usage, but used as the current time for testing.
  next = new Date(prev);
else
  next = new Date();

if (workDays.length == 0 || !workDays.every(d => (d >= 0) && (d <= 6)))
  return undefined;

// If we're past the end of the workday or not on a workday, move to the work
// start time on the next day.
while ((next.getHours() > workEnd[0]) ||
       (next.getHours() == workEnd[0] && next.getMinutes() > workEnd[1]) ||
       (workDays.indexOf(next.getDay()) == -1)) {
  next.setDate(next.getDate() + 1);
  next.setHours(workStart[0]);
  next.setMinutes(workStart[1]);
}
// If we're before the beginning of the workday, move to its start time.
if ((next.getHours() < workStart[0]) ||
    (next.getHours() == workStart[0] && next.getMinutes() < workStart[1])) {
  next.setHours(workStart[0]);
  next.setMinutes(workStart[1]);
}
`,
    },
    DaysInARow: {
      help: `Send the message now, and subsequently once per day at the same \
time, until it has been sent three times. Specify a number as an argument to \
change the total number of sends.`,
      body: `\
// Send the first message now, subsequent messages once per day.
if (! prev)
  next = new Date();
else {
  var now = new Date();
  next = new Date(prev); // Copy date argument so we don't modify it.
  do {
    next.setDate(next.getDate() + 1);
  } while (next < now);
  // ^^^ Don't try to send in the past, in case Thunderbird was asleep at
  // the scheduled send time.
}
if (! args) // Send messages three times by default.
  args = [3];
nextargs = [args[0] - 1];
// Recur if we haven't done enough sends yet.
if (nextargs[0] > 0)
  nextspec = \"function \" + specname;
`,
    },
    Delay: {
      help: `Simply delay message by some number of minutes. First argument \
is taken as the delay time.`,
      body: "next = new Date(Date.now() + args[0]*60000);",
    },
  };
}

if (browser) {
  SLTools.cachePrefs();
}

SLTools.flushLogs();

try {
  const locale = SLTools.getLocale();
  try {
    Sugar.Date.setLocale(locale);
  } catch (ex) {
    SLTools.warn(`Error setting Sugar locale to ${locale}: ${ex}`, ex);
    let fallback = locale.split("-")[0];
    try {
      Sugar.Date.setLocale(fallback);
    } catch (ex) {
      SLTools.warn(
        `[SendLater]: Error setting Sugar locale to ${fallback}: ${ex}`,
        ex,
      );
    }
  }
} catch (ex) {
  SLTools.warn(`[SendLater]: Unable to set date Sugar.js locale: ${ex}`, ex);
}

messenger.tabs.onRemoved.addListener((tabId) => {
  SLTools.handlePopupCallback(tabId, { ok: false, check: null });
});
messenger.runtime.onMessage.addListener((message, sender) => {
  if (sender.tab) SLTools.handlePopupCallback(sender.tab.id, message);
});
