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

const SendLaterVars = {
  fileNumber: 0,
  copyService: null
}

function WaitAndDelete(file_arg) {
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
        console.info("Successfully deleted queued " + this.file.path);
      } catch (ex) {
        console.warn("Failed to delete " + this.file.path);
      }
    }
  };
  timer.initWithCallback(callback, 100, Ci.nsITimer.TYPE_REPEATING_SLACK);
}

function generateMsgId(idkey) {
  const accounts = Cc["@mozilla.org/messenger/account-manager;1"]
    .getService(Ci.nsIMsgAccountManager);
  const identity = accounts.getIdentity(idkey);
  if (identity) {
    const compUtils = Cc["@mozilla.org/messengercompose/computils;1"]
      .createInstance(Ci.nsIMsgCompUtils);
    const newMessageId = compUtils.msgGenerateMessageId(identity);
    if (newMessageId) {
      return newMessageId;
    } else {
      throw (`compUtils.msgGenerateMessageId(${identity}) failed`);
    }
  } else {
    throw (`MSGID: accounts.getIdentity(${idkey}) failed`);
  }
  return null;
}

function getUnsentMessagesFolder() {
  // Find the local outbox folder
  const msgSendLater = Cc[
      "@mozilla.org/messengercompose/sendlater;1"
    ].getService(Ci.nsIMsgSendLater);
  return msgSendLater.getUnsentMessagesFolder(null);
}

function queueSendUnsentMessages() {
  if (Utils.isOffline) {
    console.debug("Deferring sendUnsentMessages while offline");
  } else {
    try {
      const msgSendLater = Cc[
          "@mozilla.org/messengercompose/sendlater;1"
        ].getService(Ci.nsIMsgSendLater);
      msgSendLater.sendUnsentMessages(null);
    } catch (ex) {
      console.error(ex);
    }
  }
}

function CopyStringMessageToFolder(content, folder, listener) {
  const dirService =
    Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
  const tempDir = dirService.get("TmpD", Ci.nsIFile);
  let sfile;
  try {
    // nsILocalFile is deprecated.
    sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  } catch (ex) {
    sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  }
  sfile.initWithPath(tempDir.path);
  sfile.appendRelativePath("tempMsg" + (SendLaterVars.fileNumber++) + ".eml");
  const filePath = sfile.path;
  console.info("Saving message to " + filePath);
  if (sfile.exists()) {
    sfile.remove(true);
  }
  sfile.create(sfile.NORMAL_FILE_TYPE, 0o600);
  const stream = Cc[
      '@mozilla.org/network/file-output-stream;1'
    ].createInstance(Ci.nsIFileOutputStream);
  stream.init(sfile, 2, 0x200, false);
  stream.write(content, content.length);
  stream.close();
  // Separate stream required for reading, since
  // nsIFileOutputStream is write-only on Windows (and for
  // that matter should probably be write-only on Linux as
  // well, since it's an *output* stream, but it doesn't
  // actually behave that way).
  try {
    // nsILocalFile is deprecated.
    sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  } catch (ex) {
    sfile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  }
  sfile.initWithPath(filePath);
  listener.localFile = sfile;
  if (!SendLaterVars.copyService) {
    SendLaterVars.copyService = Cc[
        "@mozilla.org/messenger/messagecopyservice;1"
      ].getService(Ci.nsIMsgCopyService);
  }
  let msgWindow = Cc["@mozilla.org/messenger/msgwindow;1"].createInstance();
  msgWindow = msgWindow.QueryInterface(Ci.nsIMsgWindow);
  SendLaterVars.copyService.CopyFileMessage(sfile, folder, null, false, 0, "",
                                            listener, msgWindow);
}

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

                  async sendRaw(content) {
                    // Replace message-id header with newly generated id.
                    const idkey = (/\nX-Identity-Key:\s*(\S+)/i.exec(content))[1];
                    const newMessageId = generateMsgId(idkey);
                    content = "\n" + content;
                    content = content.replace(/(\nMessage-ID:.*)<.*>/i,
                                              "$1" + newMessageId);
                    content = content.slice(1);
                    if (content.indexOf(newMessageId) === -1) {
                      console.error({content, newMessageId});
                      throw "Message ID substitution failed.";
                    }

                    // Dump message content as new message in the outbox folder
                    const fdrunsent = getUnsentMessagesFolder();
                    const listener = {
                      QueryInterface: function(iid) {
                        if (iid.equals(Ci.nsIMsgCopyServiceListener) ||
                            iid.equals(Ci.nsISupports)) {
                          return this;
                        }
                        throw Components.results.NS_NOINTERFACE;
                      },
                      OnProgress: function(progress, progressMax) {},
                      OnStartCopy: function() {},
                      OnStopCopy: function(status) {
                        const copying = this.localFile;
                        if (copying.exists()) {
                          try {
                            copying.remove(true);
                          } catch (ex) {
                            console.debug(`Failed to delete ${copying.path}.`);
                            WaitAndDelete(copying);
                          }
                        }
                        if (Components.isSuccessCode(status)) {
                          queueSendUnsentMessages();
                        } else {
                          console.error(status);
                        }
                      },
                      SetMessageKey: function(key) {}
                    }
                    CopyStringMessageToFolder(content, fdrunsent, listener);
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
