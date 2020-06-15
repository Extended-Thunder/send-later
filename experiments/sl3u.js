// Get various parts of the WebExtension framework that we need.
const { utils: Cu, classes: Cc, interfaces: Ci } = Components;
const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
const { Utils } = ChromeUtils.import("resource://services-settings/Utils.jsm");
const EventManager = ExtensionCommon.EventManager;

//const {MailUtils} = ChromeUtils.import("resource:///modules/MailUtils.jsm");
//const {AddonManager} = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

// Load helper functions from legacy jsm modules
//const extension = ExtensionParent.GlobalManager.getExtension("jph@extended-thunder.org");
//const sl3uf = ChromeUtils.import(extension.rootURI.resolve("modules/ufuncs.jsm"));
//const sl3log = ChromeUtils.import(extension.rootURI.resolve("modules/logging.jsm"));
////const sl3uf = ChromeUtils.import(extension.getURL("modules/ufuncs.jsm"));
////const sl3log = ChromeUtils.import(extension.getURL("modules/logging.jsm"));

// Some "global"-ish variables.
const SLGlobal = {
    _PromptBundle: null,
    copyService: null,
    promptService: null,
    fileNumber: 0,
    sendingUnsentMessages: false,
    lastMessagesPending: 0,
    quitConfirmed: false,
    // Kludgey way to handle user preferences. It doesn't appear to
    // be (easily) possible to access storage.local directly, so
    // instead we'll keep our own copy of those variables over here.
    prefs: null
}

const prefEventTracker = {
    /*
      Communicating between an experiment and the background script is not straight-
      forward. In particular, I haven't found any obvious way for code in an
      experiment to interact with data in storage.local. Therefore, right now this
      experiment API is set up to maintain its own independent copy of the user
      preferences.

      This object provides some signaling methods for the background script
      to keep its preferences in sync with the experiment API.
    */
    listeners: new Set(),

    addPrefEventListener(listener) {
        this.listeners.add(listener);
    },

    removePrefEventListener(listener) {
        this.listeners.delete(listener);
    },

    fireSetPrefEvent(prefs) {
        for (let listener of this.listeners) {
            listener(prefs);
        }
    },
};

var SL3U = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
        context.callOnClose(this);

        return {
            SL3U: {
                  // Event fired any time preferences are set *by the experiment*
                  onSetPref: new EventManager({
                      context,
                      name: "SL3U.onSetPref",
                      register: fire => {
                          const callback = (prefs) => fire.async(prefs);
                          prefEventTracker.addPrefEventListener(callback);
                          return () => {
                              prefEventTracker.removePrefEventListener(callback);
                          };
                      },
                  }).api(),

                  async alert(window, title, text) {
                      return Services.prompt.alert(window, title, text);
                  },

                  async isOnline() {
                      return !Utils.isOffline;
                  },

                  async appName() {
                      return Services.appinfo.name;
                  },

                  // When user preferences are changed by the webExtension bits,
                  // background.js sends updated user prefs to the experiment via
                  // this method.
                  async updatePrefs(prefs_str) {
                      SLGlobal.prefs = JSON.parse(prefs_str);
                  },

                  // Used internally within the experiment scope to access user
                  // preferences.
                  async getPref(key) {
                      if (!SLGlobal.prefs) {
                          throw {
                              name: "Unitialized storage.",
                              message: "Send Later extension requires access to browser.storage"
                          }
                      }
                      return SLGlobal.prefs[key];
                  },

                  // Helper. Used internally by the experiment to set preferences.
                  async setPref(key, value) {
                      prefEventTracker.fireSetPrefEvent(JSON.stringify({
                          key,
                          value
                      }));
                  },

                  async getLegacyPref(name, dtype, def) {
                    // Prefix for legacy preferences.
                    const EXTENSION_BASE_PREF_NAME = "extensions.sendlater3.";

                    console.debug("Getting legacy preference <"+name+"> of type: '"+dtype+"'");

                    try {
                      switch (dtype) {
                        case "bool": {
                          let legacyVal = Services.prefs.getBoolPref(`${EXTENSION_BASE_PREF_NAME}${name}`);
                          console.debug("Legacy pref ["+name+"] = "+legacyVal);
                          if (legacyVal === undefined) {
                              return (def === "true");
                          } else {
                              return legacyVal;
                          }
                        }
                        case "int": {
                          let legacyVal = Services.prefs.getIntPref(`${EXTENSION_BASE_PREF_NAME}${name}`);
                          console.debug("Legacy pref ["+name+"] = "+legacyVal);
                          if (legacyVal === undefined) {
                              return (Number(def)|0);
                          } else {
                              return legacyVal;
                          }
                        }
                        case "char": {
                          let legacyVal = Services.prefs.getCharPref(`${EXTENSION_BASE_PREF_NAME}${name}`);
                          console.debug("Legacy pref ["+name+"] = "+legacyVal);
                          if (legacyVal === undefined) {
                              return def;
                          } else {
                              return legacyVal;
                          }
                        }
                        case "string": {
                          let legacyVal = Services.prefs.getStringPref(`${EXTENSION_BASE_PREF_NAME}${name}`);
                          console.debug("Legacy pref ["+name+"] = "+legacyVal);
                          if (legacyVal === undefined) {
                              return def;
                          } else {
                              return legacyVal;
                          }
                        }
                      }
                    } catch (ex) {
                      return undefined;
                    }
                    throw new Error("Unexpected pref type");
                  },

                  async checkTimeout() {
                      const timeout = this.getPref("checkTimePref");
                      const millis = this.getPref("checkTimePref_isMilliseconds");
                      return await Promise.all([timeout, millis]).then(
                          ([timeout, millis]) => {return ((millis) ? timeout : timeout * 60000); }
                      );
                  },

                  // TODO: According to an old comment, the MailMerge add-on uses
                  // this function for some reason. Remember to check with that
                  // author about how it was used, because that is almost certainly
                  // broken at this point.
                  async getInstanceUuid() {
                      var instance_uuid = await this.getPref("instanceUUID");
                      if (!instance_uuid || instance_uuid === "") {
                          instance_uuid = Cc["@mozilla.org/uuid-generator;1"]
                              .getService(Ci.nsIUUIDGenerator)
                              .generateUUID().toString();
                          this.setPref("instanceUUID", instance_uuid);
                      }
                      return instance_uuid;
                  },

                  async PromptBundleGet(name) {
                      return SLGlobal._PromptBundle.GetStringFromName(name);
                  },

                  async PromptBundleGetFormatted(name, params) {
                      return SLGlobal._PromptBundle.formatStringFromName(name, params, params.length);
                  },

                  // Takes a date object and format options. If either one is null,
                  // then it substitutes defaults.
                  async DateTimeFormat(thisdate, options) {
                      const defaults = {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric',
                          second: 'numeric',
                          timeZoneName: 'short',
                          hour12: false
                      };
                      const dtfmt = new Intl.DateTimeFormat('default', (options || defaults));

                      return dtfmt.format(thisdate || (new Date()));
                  },

                  async queueSendUnsentMessages() {
                      if (!this.isOnline()) {
                          console.warn("Deferring sendUnsentMessages while offline");
                      } else if (SLGlobal.sendingUnsentMessages) {
                          console.debug("Deferring sendUnsentMessages");
                      } else {
                          try {
                              const msgSendLater = Cc["@mozilla.org/messengercompose/sendlater;1"]
                                  .getService(Ci.nsIMsgSendLater);
                              msgSendLater.sendUnsentMessages(null);
                          } catch (ex) {
                              console.warn(ex);
                          }
                      }
                  },

                  "sendUnsentMessagesListener": {
                      onStartSending: function(aTotalMessageCount) {
                          // TODO
                      },
                      onMessageStartSending: function(aCurrentMessage, aTotalMessageCount, aMessageHeader, aIdentity) {},
                      onProgress: function(aCurrentMessage, aTotalMessage) {},
                      onMessageSendError: function(aCurrentMessage, aMessageHeader, aSstatus, aMsg) {},
                      onMessageSendProgress: function(aCurrentMessage, aTotalMessageCount, aMessageSendPercent, aMessageCopyPercent) {},
                      onStatus: function(aMsg) {},
                      onStopSending: function(aStatus, aMsg, aTotalTried, aSuccessful) {
                          // TODO
                      }
                  },

                  async addMsgSendLaterListener() {
                      const msgSendLater = Cc.getService(Ci.nsIMsgSendLater);
                      msgSendLater.addListener(this.sendUnsentMessagesListener);
                  },

                  async removeMsgSendLaterListener() {
                      const msgSendLater = Cc.getService(Ci.nsIMsgSendLater);
                      msgSendLater.removeListener(this.sendUnsentMessagesListener);
                  },

                  async getUnsentMessagesFolder() {
                      const msgSendLater = Cc["@mozilla.org/messengercompose/sendlater;1"]
                          .getService(Ci.nsIMsgSendLater);
                      return msgSendLater.getUnsentMessagesFolder(null);
                  },

                  async setCustomDBHeaders() {
                      const wantedHeaders = new Object();
                      ["x-send-later-at", "x-send-later-uuid", "x-send-later-recur",
                          "x-send-later-cancel-on-reply", "x-send-later-args", "precedence",
                          "auto-submitted"
                      ].forEach(function(h) {
                          wantedHeaders[h] = 1;
                      });
                      const installedHeaders = new Object();
                      let customHeadersString = Services.prefs
                          .getCharPref('mailnews.customDBHeaders');
                      customHeadersString.split(/\s+/).forEach(function(h) {
                          delete wantedHeaders[h.toLowerCase()];
                      });
                      let changed = false;
                      for (let h in wantedHeaders) {
                          changed = true;
                          if (customHeadersString) {
                              customHeadersString += " " + h;
                          } else {
                              customHeadersString = h;
                          }
                      }
                      if (changed) {
                          Services.prefs.setCharPref('mailnews.customDBHeaders',
                                                      customHeadersString);
                      }
                  },

                  async promptConfirmCheck(title, text, checkMsg, state) {
                      if (!SLGlobal.promptService) {
                        SLGlobal.promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                            .getService(Ci.nsIPromptService);
                      }
                      const checkState = { value: state };
                      const result = prompts.confirmCheck(null,title,text,checkMsg,checkState);
                      return { ok: result, check: checkState.value };
                  },

                  async promptAlertCheck() {
                      if (!SLGlobal.promptService) {
                        SLGlobal.promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                            .getService(Ci.nsIPromptService);
                      }
                      const checkState = { value: state };
                      prompts.confirmCheck(null,title,text,checkMsg,checkState);
                      return { check: checkState.value };
                  },

                  async initUtil() {
                      SLGlobal._PromptBundle = Services.strings
                          .createBundle("chrome://sendlater3/locale/prompt.properties");

                      const scheduledMessagesWarningTitle =
                          this.PromptBundleGet("ScheduledMessagesWarningTitle");
                      const scheduledMessagesWarningQuitRequest =
                          this.PromptBundleGetFormatted("ScheduledMessagesWarningQuitRequested",
                                                        [this.appName()]);
                      const scheduledMessagesWarningQuit =
                          this.PromptBundleGetFormatted("ScheduledMessagesWarningQuit",
                                                        [this.appName()]);
                      const confirmAgain = this.PromptBundleGet("ConfirmAgain");
                      const prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                          .getService(Ci.nsIPromptService);

                      const observerService = Cc["@mozilla.org/observer-service;1"]
                          .getService(Ci.nsIObserverService);
                      observerService.addObserver({
                          observe: async function(subject, topic, data) {
                              if ((!SLGlobal.lastMessagesPending)
                                  || (! await this.getPref("ask_Quit"))) {
                                  return;
                              }
                              let res = await this.promptConfirmCheck(
                                scheduledMessagesWarningTitle,
                                scheduledMessagesWarningQuitRequest, confirmAgain, true);
                              if (!res.ok) {
                                  subject.QueryInterface(Ci.nsISupportsPRBool);
                                  subject.data = true;
                                  return;
                              } else if (!res.check) {
                                  this.setPref("ask_Quit", false);
                              }
                              SLGlobal.quitConfirmed = true;
                          }
                      }, "quit-application-requested", false);
                      observerService.addObserver({
                          observe: async function(subject, topic, data) {
                              if ((SLGlobal.quitConfirmed) || (!SLGlobal.lastMessagesPending)
                                      || (!await this.getPref("ask_Quit")))
                                  { return; }
                              let res = await this.promptAlertCheck(
                                scheduledMessagesWarningTitle, scheduledMessagesWarningQuit,
                                confirmAgain, true);
                              if (!res.check) {
                                this.setPref("ask_Quit", false);
                              }
                          }
                      }, "quit-application-granted", false);
                  },

                  async copyStringMessageToFolder(content, folder, listener) {
                      const dirService = Cc["@mozilla.org/file/directory_service;1"]
                          .getService(Ci.nsIProperties);
                      const tempDir = dirService.get("TmpD", Ci.nsIFile);
                      let sfile;
                      try { // nsILocalFile is deprecated.
                          sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
                      } catch (ex) {
                          sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                      }
                      sfile.initWithPath(tempDir.path);
                      const uuid = await this.getInstanceUuid();
                      sfile.appendRelativePath(`tempMsg${uuid}${SLGlobal.fileNumber++}.eml`);
                      const filePath = sfile.path;
                      if (sfile.exists()) {
                          sfile.remove(true);
                      }
                      sfile.create(sfile.NORMAL_FILE_TYPE, 0o600);
                      const stream = Cc['@mozilla.org/network/file-output-stream;1']
                          .createInstance(Ci.nsIFileOutputStream);
                      stream.init(sfile, 2, 0x200, false);
                      stream.write(content, content.length);
                      stream.close();
                      // Separate stream required for reading, since
                      // nsIFileOutputStream is write-only on Windows (and for
                      // that matter should probably be write-only on Linux as
                      // well, since it's an *output* stream, but it doesn't
                      // actually behave that way).
                      try { // nsILocalFile is deprecated.
                          sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
                      } catch (ex) {
                          sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                      }
                      sfile.initWithPath(filePath);
                      listener.localFile = sfile;
                      if (!SLGlobal.copyService) {
                          SLGlobal.copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                              .getService(Ci.nsIMsgCopyService);
                      }
                      SLGlobal.copyService.CopyFileMessage(sfile, folder, null,
                          false, 0, "", listener, msgWindow);
                  },

                  async WaitAndDelete(file_arg) {
                      const timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
                      const callback = {
                          file: file_arg,
                          // creating a circular reference on purpose so objects won't be
                          // deleted until we eliminate the circular reference.
                          timer_ref: timer,
                          notify: function(timer) {
                              try {
                                  this.file.remove(true);
                                  this.timer_ref = undefined;
                                  timer.cancel();
                                  //sl3log.info(`Successfully deleted queued ${this.file.path}`);
                              } catch (ex) {
                                  //sl3log.warn(`Failed to delete ${this.file.path}`);
                              }
                          }
                      };
                      timer.initWithCallback(callback, 100, Ci.nsITimer.TYPE_REPEATING_SLACK);
                  },

                  async applyMessengerOverlay() {
                    ExtensionSupport.registerWindowListener("messengerListener", {
                        chromeURLs: [
                          "chrome://messenger/content/messenger.xul"
                        ],
                        onLoadWindow(window) {
                          // backgrounding.xul ; headerView.xul
                        },
                      });
                  },

                  async applyComposeOverlay() {
                    ExtensionSupport.registerWindowListener("composeListener", {
                      chromeURLs: [
                        "chrome://messenger/content/messengercompose/messengercompose.xul"
                      ],
                      onLoadWindow(window) {
                        // composing.xul ; composeToolbar.xul

                        // Add a menu item to the File menu of any main window.
                        let fileQuitItem = window.document.getElementById("menu_FileQuitItem");
                        if (fileQuitItem) {
                          let fileRestartItem = window.document.createXULElement("menuitem");
                          fileRestartItem.id = "menu_FileRestartItem";
                          fileRestartItem.setAttribute("label", "Restart");
                          fileRestartItem.setAttribute("accesskey", "R");
                          fileRestartItem.addEventListener("command", () => Services.startup.quit(
                            Services.startup.eForceQuit | Services.startup.eRestart
                          ));
                          fileQuitItem.parentNode.insertBefore(fileRestartItem, fileQuitItem);
                        }
                      }
                    });
                  },

                  async init() {
                      this.applyMessengerOverlay();
                      this.applyComposeOverlay();
                  }
            },
        };
    }

    /*
    Because we load several legacy modules, we need to be sure to unload them
    before the extension stops. If we don't do this, the exact same modules
    will stay cached, and cannot change during upgrades.
    */
    close() {
        console.log("Goodbye world.");

        // // Clean up any existing windows that have the menu item.
        // for (let window of Services.wm.getEnumerator("mail:3pane")) {
        //   // Clean up any changes to the window
        // }
        // // Stop listening for new windows.
        // ExtensionSupport.unregisterWindowListener("composeListener");
        // ExtensionSupport.unregisterWindowListener("messengerListener");
        //
        // Cu.unload(extension.getURL("modules/ufuncs.jsm"));
        // Cu.unload(extension.getURL("modules/logging.jsm"));
        // console.log(extension.getURL("modules/ufuncs.jsm"));
        // console.log(extension.getURL("modules/logging.jsm"));

        // Cu.unload(extension.rootURI.resolve("modules/ufuncs.jsm"));
        // Cu.unload(extension.rootURI.resolve("modules/logging.jsm"));
        // console.log(extension.rootURI.resolve("modules/ufuncs.jsm"));
        // console.log(extension.rootURI.resolve("modules/logging.jsm"));
    }
};
