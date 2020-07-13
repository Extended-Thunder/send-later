// Get various parts of the WebExtension framework that we need.
const { utils: Cu, classes: Cc, interfaces: Ci } = Components;
const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { Utils } = ChromeUtils.import("resource://services-settings/Utils.jsm");

// Load helper functions from legacy jsm modules
//const { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
//const extension = ExtensionParent.GlobalManager.getExtension("jph@extended-thunder.org");
//const sl3uf = ChromeUtils.import(extension.rootURI.resolve("modules/ufuncs.jsm"));
////const sl3uf = ChromeUtils.import(extension.getURL("modules/ufuncs.jsm"));

var SL3U = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
        context.callOnClose(this);

        return {
            SL3U: {
                  async alert(title, text) {
                    const win = Services.wm.getMostRecentWindow();
                    return Services.prompt.alert(win, title, text);
                  },

                  isOffline: function() {
                    return Utils.isOffline;
                  },

                  async getLegacyPref(name, dtype, defVal) {
                    // Prefix for legacy preferences.
                    const prefName = `extensions.sendlater3.${name}`;

                    switch (dtype) {
                      case "bool": {
                        try {
                          return Services.prefs.getBoolPref(prefName);
                        } catch {
                          return (defVal === "true");
                        }
                      }
                      case "int": {
                        try {
                          return Services.prefs.getIntPref(prefName);
                        } catch {
                          return (Number(defVal)|0);
                        }
                      }
                      case "char": {
                        try {
                          return Services.prefs.getCharPref(prefName);
                        } catch {
                          return defVal;
                        }
                      }
                      case "string": {
                        try {
                          return Services.prefs.getStringPref(prefName);
                        } catch {
                          return defVal;
                        }
                      }
                      default: {
                        throw new Error("Unexpected pref type");
                      }
                    }
                  },

                  async SaveAsDraft() {
                    // Saves the current compose window message as a draft.
                    // (Window remains open)
                    const cw = Services.wm.getMostRecentWindow("msgcompose");
                    cw.GenericSendMessage(Ci.nsIMsgCompDeliverMode.SaveAsDraft);
                  },

                  async SendNow(batch) {
                    // Sends the message from the current composition window
                    const cw = Services.wm.getMostRecentWindow("msgcompose");
                    const sendMode_Now = Ci.nsIMsgCompDeliverMode.Now;
                    if (batch) {
                      // Skips usual checking and user interaction steps.
                      cw.CompleteGenericSendMessage(sendMode_Now);
                    } else {
                      cw.GenericSendMessage(sendMode_Now);
                    }
                  },

                  async setHeader(name, value) {
                    const cw = Services.wm.getMostRecentWindow("msgcompose");
                    cw.gMsgCompose.compFields.setHeader(name,value);
                  },

                  async editingMessage(msgId) {
                    for (let cw of Services.wm.getEnumerator("msgcompose")) {
                      // for (let header of cw.gMsgCompose.compFields.headerNames) {
                      //   console.log(header);
                      // }
                      const thisID = cw.gMsgCompose.compFields.getHeader("message-id");
                      if (thisID === msgId) {
                        return true;
                      }
                    }
                    return false;
                  },

                  async addMsgSendLaterListener() {
                      const msgSendLater = Cc.getService(Ci.nsIMsgSendLater);
                      msgSendLater.addListener(this.sendUnsentMessagesListener);
                  },

                  async removeMsgSendLaterListener() {
                      const msgSendLater = Cc.getService(Ci.nsIMsgSendLater);
                      msgSendLater.removeListener(this.sendUnsentMessagesListener);
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
    Be sure to unload any .jsm modules that we loaded above, and invalidate
    the cache to ensure the most recent version is always loaded on startup.
    */
    close() {
        console.log("[SendLater]: Goodbye world.");

        // // Clean up any existing windows that have the menu item.
        // for (let window of Services.wm.getEnumerator("mail:3pane")) {
        //   // Clean up any changes to the window
        // }
        // // Stop listening for new windows.
        // ExtensionSupport.unregisterWindowListener("composeListener");
        // ExtensionSupport.unregisterWindowListener("messengerListener");

        //// I don't remember which of these is correct:
        // Cu.unload(extension.getURL("modules/ufuncs.jsm"));
        // console.log(extension.getURL("modules/ufuncs.jsm"));
        //
        // Cu.unload(extension.rootURI.resolve("modules/ufuncs.jsm"));
        // console.log(extension.rootURI.resolve("modules/ufuncs.jsm"));

        Services.obs.notifyObservers(null, "startupcache-invalidate", null);
    }
};
