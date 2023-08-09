// Get various parts of the WebExtension framework that we need.
var Utils = ChromeUtils.import(
  "resource://services-settings/Utils.jsm"
).Utils;
var MailServices = globalThis.MailServices || ChromeUtils.import(
  "resource:///modules/MailServices.jsm"
).MailServices;
var NetUtil = globalThis.NetUtil || ChromeUtils.import(
  "resource://gre/modules/NetUtil.jsm"
).NetUtil;

const SendLaterVars = {
  fileNumber: 0,
  sendingUnsentMessages: false,
  needToSendUnsentMessages: false,
  wantToCompactOutbox: false,
  logConsoleLevel: "info",
  context: null
}

const SendLaterFunctions = {
  logger(msg, level, stream) {
    const levels = ["all","trace","debug","info","warn","error","fatal"];
    if (levels.indexOf(level) >=
        levels.indexOf(SendLaterVars.logConsoleLevel)) {
      const output = stream || console.log;
      output(`${level.toUpperCase()} [SL3U]:`, ...msg);
    }
  },
  error(...msg)  { this.logger(msg, "error", console.error) },
  warn(...msg)   { this.logger(msg, "warn",  console.warn) },
  info(...msg)   { this.logger(msg, "info",  console.info) },
  log(...msg)    { this.logger(msg, "info",  console.log) },
  debug(...msg)  { this.logger(msg, "debug", console.debug) },
  trace(...msg)  { this.logger(msg, "trace", console.trace) },

  getMessage(context, messageName, substitutions) {
    // from static.js
    try {
      messageName = messageName.toLowerCase();

      let messages, str;

      const ext = context.extension;
      const selectedLocale = ext.localeData.selectedLocale;
      if (ext.localeData.messages.has(selectedLocale)) {
        messages = ext.localeData.messages.get(selectedLocale);
        if (messages.has(messageName)) {
          str = messages.get(messageName);
        }
      }

      if (str === undefined) {
        SendLaterFunctions.warn(
          `Unable to find message ${messageName} in locale ${selectedLocale}`);
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
          // This is not quite Chrome-compatible. Chrome consumes any number
          // of digits following the $, but only accepts 9 substitutions. We
          // accept any number of substitutions.
          index = parseInt(index, 10) - 1;
          return index in substitutions ? substitutions[index] : "";
        }
        // For any series of contiguous `$`s, the first is dropped, and
        // the rest remain in the output string.
        return dollarSigns;
      };
      return str.replace(/\$(?:([1-9]\d*)|(\$+))/g, replacer);
    } catch (e) {
      console.warn("Unable to get localized message.",e);
    }
    return "";
  },

  waitAndDelete(file_arg) {
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
          SendLaterFunctions.debug("Successfully deleted queued " +
                                   this.file.path);
        } catch (ex) {
          SendLaterFunctions.warn("Failed to delete " + this.file.path);
        }
      }
    };
    timer.initWithCallback(callback, 100, Ci.nsITimer.TYPE_REPEATING_SLACK);
  },

  /** From ext-mail.js
   * Convert a human-friendly path to a folder URI. This function does not assume that the
   * folder referenced exists.
   * @return {String}
   */
  folderPathToURI(accountId, path) {
    let server = MailServices.accounts.getAccount(accountId).incomingServer;
    let rootURI = server.rootFolder.URI;
    if (path == "/") {
      return rootURI;
    }
    // The .URI property of an IMAP folder doesn't have %-encoded characters.
    // If encoded here, the folder lookup service won't find the folder.
    if (server.type == "imap") {
      return rootURI + path;
    }
    return (
      rootURI +
        path
        .split("/")
        .map(p =>
          encodeURIComponent(p).replace(
            /[!'()*]/g,
            c => "%" + c.charCodeAt(0).toString(16)
          )
        )
        .join("/")
    );
  },

  getUnsentMessagesFolder() {
    // Find the local outbox folder
    const msgSendLater = Cc[
      "@mozilla.org/messengercompose/sendlater;1"
    ].getService(Ci.nsIMsgSendLater);
    return msgSendLater.getUnsentMessagesFolder(null);
  },

  queueSendUnsentMessages() {
    if (Utils.isOffline) {
      SendLaterFunctions.debug("SendLaterFunctions.queueSendUnsentMessages " +
                               "Deferring sendUnsentMessages while offline");
    } else if (SendLaterVars.sendingUnsentMessages) {
      SendLaterFunctions.debug("SendLaterFunctions.queueSendUnsentMessages " +
                               "Deferring sendUnsentMessages");
      SendLaterVars.needToSendUnsentMessages = true;
    } else {
      try {
        // From mailWindowOverlay.js
        let msgSendLater = Cc[
          "@mozilla.org/messengercompose/sendlater;1"
        ].getService(Ci.nsIMsgSendLater);
        for (let identity of MailServices.accounts.allIdentities) {
          let msgFolder = msgSendLater.getUnsentMessagesFolder(identity);
          if (msgFolder) {
            let numMessages = msgFolder.getTotalMessages(
              false /* include subfolders */
            );
            if (numMessages > 0) {
              msgSendLater.sendUnsentMessages(identity);
              // Right now, all identities point to the same unsent messages
              // folder, so to avoid sending multiple copies of the unsent
              // messages, we only call messenger.SendUnsentMessages() once.
              // See bug #89150 for details.
              break;
            }
          }
        }
      } catch (ex) {
        SendLaterFunctions.error(
          "SendLaterFunctions.queueSendUnsentMessages",
          "Error triggering send from unsent messages folder.", ex);
      }
    }
  },

  copyStringMessageToFolder(content, folder, listener, markRead) {
    const dirService = Cc["@mozilla.org/file/directory_service;1"]
          .getService(Ci.nsIProperties);
    const tempDir = dirService.get("TmpD", Ci.nsIFile);
    const sfile0 = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    sfile0.initWithPath(tempDir.path);
    sfile0.appendRelativePath(
      "tempMsg" + (SendLaterVars.fileNumber++) + ".eml");
    const filePath = sfile0.path;
    SendLaterFunctions.debug("SendLaterFunctions.copyStringMessageToFolder",
                             "Saving message to " + filePath);
    if (sfile0.exists()) {
      sfile0.remove(true);
    }
    sfile0.create(sfile0.NORMAL_FILE_TYPE, 0o600);
    const stream = Cc[
      '@mozilla.org/network/file-output-stream;1'
    ].createInstance(Ci.nsIFileOutputStream);
    stream.init(sfile0, 2, 0x200, false);
    stream.write(content, content.length);
    stream.close();
    // Separate stream required for reading, since
    // nsIFileOutputStream is write-only on Windows
    const sfile1 = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    sfile1.initWithPath(filePath);
    listener.localFile = sfile1;
    let msgWindow = Cc["@mozilla.org/messenger/msgwindow;1"].createInstance();
    msgWindow = msgWindow.QueryInterface(Ci.nsIMsgWindow);

    let flags = 0;
    try {
      flags |= markRead ? Ci.nsMsgMessageFlags.Read : 0;
    } catch (ex) {
      SendLaterFunctions.error(ex);
    }

    // TB91 changed CopyFileMessage -> copyFileMessage
    let copyFileMessage = MailServices.copy.copyFileMessage
        || MailServices.copy.CopyFileMessage;
    copyFileMessage(
      sfile1, folder, null, false, flags, "", listener, msgWindow);
  },

  // If you add a message to the Outbox and call nsIMsgSendLater when it's
  // already in the middle of sending unsent messages, then it's possible
  // that the message you just added won't get sent. Therefore, when we add a
  // new message to the Outbox, we need to be aware of whether we're already
  // in the middle of sending unsent messages, and if so, then trigger
  // another send after it's finished.
  sendUnsentMessagesListener: {
    _copyProcess: { status: null },
    QueryInterface: ChromeUtils.generateQI(["nsIMsgSendLaterListener"]),
    onStartSending: function(aTotalMessageCount) {
      SendLaterFunctions.debug(
        "Entering function: " +
          "SendLaterFunctions.sendUnsentMessagesListener.onStartSending");
      SendLaterVars.wantToCompactOutbox =
        SendLaterFunctions.getUnsentMessagesFolder().
        getTotalMessages(false) > 0;
      SendLaterVars.sendingUnsentMessages = true;
      SendLaterVars.needToSendUnsentMessages = false;
      SendLaterFunctions.debug(
        "Leaving function: " +
          "SendLaterFunctions.sendUnsentMessagesListener.onStartSending");
    },
    onMessageStartSending: function(aCurrentMessage, aTotalMessageCount,
                                    aMessageHeader, aIdentity) {},
    onProgress: function(aCurrentMessage, aTotalMessage) {},
    onMessageSendError: function(aCurrentMessage, aMessageHeader, aSstatus,
                                 aMsg) {},
    onMessageSendProgress: function(aCurrentMessage, aTotalMessageCount,
                                    aMessageSendPercent,
                                    aMessageCopyPercent) {},
    onStatus: function(aMsg) {},
    onStopSending: function(aStatus, aMsg, aTotalTried, aSuccessful) {
      SendLaterFunctions.debug(
        "Entering function: " +
          "SendLaterFunctions.sendUnsentMessagesListener.onStopSending");
      SendLaterVars.sendingUnsentMessages = false;
      if (SendLaterVars.needToSendUnsentMessages) {
        if (Utils.isOffline) {
          SendLaterFunctions.warn("Deferring sendUnsentMessages while offline");
        } else {
          try {
            const msgSendLater = Components.classes[
              "@mozilla.org/messengercompose/sendlater;1"
            ].getService(Components.interfaces.nsIMsgSendLater);
            msgSendLater.sendUnsentMessages(null);
          } catch (ex) {
            SendLaterFunctions.warn(
              "SendLaterFunctions.sendUnsentMessagesListener.OnStopSending",
              ex
            );
          }
        }
      } else if (SendLaterVars.wantToCompactOutbox &&
                 SendLaterFunctions.getUnsentMessagesFolder().
                 getTotalMessages(false) == 0) {
        try {
          let msgWindow = Cc["@mozilla.org/messenger/msgwindow;1"]
              .createInstance();
          msgWindow = msgWindow.QueryInterface(Ci.nsIMsgWindow);
          let fdrunsent = SendLaterFunctions.getUnsentMessagesFolder();
          fdrunsent.compact(null, msgWindow);
          SendLaterVars.wantToCompactOutbox = false;
          SendLaterFunctions.debug("Compacted Outbox");
        } catch (ex) {
          SendLaterFunctions.warn(
            "SendLaterFunctions.sendUnsentMessagesListener.OnStopSending",
            "Compacting Outbox failed: ",
            ex
          );
        }
      }
      SendLaterFunctions.debug(
        "Leaving function: " +
          "SendLaterFunctions.sendUnsentMessagesListener.onStopSending");
    }
  },

  keyCodeEventTracker: {
    listeners: new Set(),

    add(listener) {
      this.listeners.add(listener);
    },

    remove(listener) {
      this.listeners.delete(listener);
    },

    emit(keyid) {
      for (let listener of this.listeners) {
        listener(keyid);
      }
    }
  }
};

var SL3U = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    let { extension } = context;
    SendLaterVars.context = context;
    context.callOnClose(this);

    // Watch the outbox to avoid messages getting stuck there
    const msgSendLater = Cc[
      "@mozilla.org/messengercompose/sendlater;1"
    ].getService(Ci.nsIMsgSendLater);
    msgSendLater.addListener(SendLaterFunctions.sendUnsentMessagesListener);

    return {
      SL3U: {

        async setLegacyPref(name, dtype, value) {
          const prefName = `extensions.sendlater3.${name}`;

          switch (dtype) {
          case "bool": {
            const prefValue = (value === "true");
            try {
              Services.prefs.setBoolPref(prefName, prefValue);
              return true;
            } catch (err) {
              SendLaterFunctions.error("SL3U.setLegacyPref.dtype="+dtype,err);
              return false;
            }
          }
          case "int": {
            const prefValue = (Number(value)|0);
            try {
              Services.prefs.setIntPref(prefName, prefValue);
              return true;
            } catch (err) {
              SendLaterFunctions.error("SL3U.setLegacyPref.dtype="+dtype,err);
              return false;
            }
          }
          case "char": {
            const prefValue = value;
            try {
              Services.prefs.setCharPref(prefName, prefValue);
              return true;
            } catch (err) {
              SendLaterFunctions.error("SL3U.setLegacyPref.dtype="+dtype,err);
              return false;
            }
          }
          case "string": {
            const prefValue = value;
            try {
              Services.prefs.setStringPref(prefName, prefValue);
              return true;
            } catch (err) {
              SendLaterFunctions.error("SL3U.setLegacyPref.dtype="+dtype,err);
              return false;
            }
          }
          default: {
            throw new Error("Unexpected pref type");
          }
          }
        },

        async getLegacyPref(name, dtype, defVal) {
          // Prefix for legacy preferences.
          const prefName = `extensions.sendlater3.${name}`;

          switch (dtype) {
          case "bool": {
            const prefDefault = (defVal === "true");
            try {
              return Services.prefs.getBoolPref(prefName, prefDefault);
            } catch {
              return prefDefault;
            }
          }
          case "int": {
            const prefDefault = (Number(defVal)|0);
            try {
              return Services.prefs.getIntPref(prefName, prefDefault);
            } catch {
              return prefDefault;
            }
          }
          case "char": {
            const prefDefault = defVal;
            try {
              return Services.prefs.getCharPref(prefName, prefDefault);
            } catch (err) {
              return prefDefault;
            }
          }
          case "string": {
            const prefDefault = defVal;
            try {
              return Services.prefs.getStringPref(prefName, prefDefault);
            } catch (err) {
              return prefDefault;
            }
          }
          default: {
            throw new Error("Unexpected pref type");
          }
          }
        },

        async expandRecipients(tabId, field) {
          function composeWindowIsReady(composeWindow) {
            return new Promise(resolve => {
              if (composeWindow.composeEditorReady) {
                resolve();
                return;
              }
              composeWindow.addEventListener("compose-editor-ready", resolve, {
                once: true,
              });
            });
          }

          let tab = context.extension.tabManager.get(tabId);
          let cw = tab.nativeTab;
          await composeWindowIsReady(cw);
          let msgCompFields = cw.GetComposeDetails();
          cw.expandRecipients();
          return msgCompFields[field];
        },

        /*
         * Pre-send checks are tricky. They happen in the compose window's
         * GenericSendMessage() function, but only when a message is actually
         * being sent (i.e. not when it's saving as a draft, which is what we
         * will ultimately be doing here). That function will evaluate all of
         * the relevant checks (spelling, attachments, etc) and emit a
         * 'beforesend' event to allow other extensions a chance to modify the
         * message or cancel sending.
         *
         * If all of those checks pass, then GenericSendMessage will pass along
         * to a function called CompleteGenericSendMessage, which actually does
         * the sending. GenericSendMessage does not return anything, so we have
         * no way of knowing what the result of its checks are. Instead, we
         * will temporarily redefine the 'CompleteGenericSendMessage' function,
         * and listen for the eventual callback.
         *
         * If the send was canceled during these checks, this promise will hang
         * around waiting. It can resolve in two ways:
         *
         *     1. The pre-send checks all pass, and the dummy
         *        CompleteGenericSendMessage function is executed (resolve to
         *        `true`).
         *
         *     2. The checks fail and this promise hangs around until
         *        GenericSendMessage is eventually called again. That can
         *        happen either by Send Later, or through some other channel
         *        like 'AutoSaveAsDraft' which means the window is no longer
         *        locked and we can assume the checks failed (pass through to
         *        original GenericSendMessage and resolve `false`).
         *
         * In either case, the promise will resolve and restore the window's
         * original .*GenericSendMessage functions. In case 2, this promise may
         * hang for quite some time, so don't `await` this function unless the
         * subsequent code is conditional on a `true` response anyway.
         */
        GenericPreSendCheck() {
          const cw = Services.wm.getMostRecentWindow("msgcompose");

          if (cw.ResolvePendingPreSendCheck) {
            // Resolve any hanging promises. This happens if the user canceled
            // sending via one of the pre-send checks, and is now running the
            // scheduler again. The GenericSendMessage function does not notify
            // CompleteGenericSendMessage about what happened.
            cw.ResolvePendingPreSendCheck(false);
          }

          if (!cw.OriginalCompleteGenericSendMessage) {
            // Stash references to the true '*GenericSendMessage' functions.
            // We will restore them soon.
            cw.OriginalCompleteGenericSendMessage =
              cw.CompleteGenericSendMessage;
            cw.OriginalGenericSendMessage = cw.GenericSendMessage;
          }

          return new Promise((resolve, reject) => {
            const DummyGenericSendMessage = (msgType) => {
              // This function could get called if the user cancels the
              // original send operation via one of the pre-send checks and
              // later goes to send the message directly (via 'send now' or
              // so). In that case we should restore the original window state,
              // pass the function call along to the real 'GenericSendMessage'
              // function, and resolve this dangling promise.
              SendLaterFunctions.log(
                "Received call to dummy GenericSendMessage", msgType);
              cw.CompleteGenericSendMessage =
                cw.OriginalCompleteGenericSendMessage;
              cw.GenericSendMessage = cw.OriginalGenericSendMessage;
              cw.ResolvePendingPreSendCheck = undefined;
              cw.GenericSendMessage(msgType);
              resolve(false);
            }
            const DummyCompleteGenericSendMessage = (detail) => {
              // If we made it here it's either because the pre-send checks
              // have all passed, and the original GenericSendMessage has
              // passed the ball back to us. We should restore the window and
              // resolve this promise as true.
              SendLaterFunctions.log(
                "Received call to dummy CompleteGenericSendMessage", detail);
              cw.CompleteGenericSendMessage =
                cw.OriginalCompleteGenericSendMessage;
              cw.GenericSendMessage = cw.OriginalGenericSendMessage;
              cw.ResolvePendingPreSendCheck = undefined;
              if (detail === Ci.nsIMsgCompDeliverMode.Later)
                resolve(true);
              else
                reject("Something strange happened while performing " +
                       "pre-send checks.");
            };

            const ResolvePendingPreSendCheck = (status) => {
              SendLaterFunctions.log(
                "Received call to ResolvePendingPreSendCheck", status);
              cw.CompleteGenericSendMessage =
                cw.OriginalCompleteGenericSendMessage;
              cw.GenericSendMessage = cw.OriginalGenericSendMessage;
              cw.ResolvePendingPreSendCheck = undefined;
              resolve(status);
            };

            cw.ResolvePendingPreSendCheck = ResolvePendingPreSendCheck;
            cw.CompleteGenericSendMessage = DummyCompleteGenericSendMessage;
            cw.GenericSendMessage = DummyGenericSendMessage;
            cw.OriginalGenericSendMessage(Ci.nsIMsgCompDeliverMode.Later);
          });
        },

        async setDispositionState(messageId, disposition) {
          let msgHdr = context.extension.messageManager.get(messageId)
          if (disposition == "replied") {
            msgHdr.folder.addMessageDispositionState(
              msgHdr, msgHdr.folder.nsMsgDispositionState_Replied
            );
          } else if (disposition == "forwarded") {
            msgHdr.folder.addMessageDispositionState(
              msgHdr, msgHdr.folder.nsMsgDispositionState_Forwarded
            );
          } else {
            throw new Error(`Unrecognized message disposition state: ` +
                            `"${disposition}"`);
          }
        },

        async sendRaw(content, sendUnsentMsgs) {
          // Dump message content as new message in the outbox folder
          function CopyUnsentListener(triggerOutbox) {
            this._sendUnsentMsgs = triggerOutbox
          }
          CopyUnsentListener.prototype = {
            QueryInterface: function(iid) {
              SendLaterFunctions.debug(
                "SL3U.sendRaw.CopyUnsentListener.QueryInterface: Entering");
              if (iid.equals(Ci.nsIMsgCopyServiceListener) ||
                  iid.equals(Ci.nsISupports)) {
                SendLaterFunctions.debug(
                  "SL3U.sendRaw.CopyUnsentListener.QueryInterface: Returning",
                  this
                );
                return this;
              }
              SendLaterFunctions.error(
                "SL3U.sendRaw.CopyUnsentListener.QueryInterface",
                Components.results.NS_NOINTERFACE);
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
                  SendLaterFunctions.debug(
                    `SL3U.sendRaw.CopyUnsentListener.OnStopCopy:`,
                    `Failed to delete ${copying.path}.` +
                      `Trying again with waitAndDelete.`);
                  SendLaterFunctions.waitAndDelete(copying);
                }
              }
              if (Components.isSuccessCode(status)) {
                SendLaterFunctions.debug(
                  "SL3U.sendRaw.CopyUnsentListener.OnStopCopy:",
                  "Successfully copied message to outbox.");
                if (this._sendUnsentMsgs) {
                  SendLaterFunctions.debug(
                    "SL3U.sendRaw.CopyUnsentListener.OnStopCopy:",
                    "Triggering send unsent messages.")
                  const mailWindow =
                        Services.wm.getMostRecentWindow("mail:3pane");
                  mailWindow.setTimeout(
                    SendLaterFunctions.queueSendUnsentMessages, 1000);
                } else {
                  SendLaterFunctions.debug(
                    "SL3U.sendRaw.CopyUnsentListener.OnStopCopy:",
                    "Not triggering send operation per user prefs.");
                }
              } else {
                SendLaterFunctions.error(
                  "SL3U.sendRaw.CopyUnsentListener.OnStopCopy",
                  status
                );

                const hexStatus = `0x${status.toString(16)}`;
                const CopyUnsentError =
                      SendLaterFunctions.getMessage(
                        context, "CopyUnsentError", [hexStatus]);
                Services.prompt.alert(null, null, CopyUnsentError);
              }
            },
            SetMessageKey: function(key) {}
          }
          const fdrunsent = SendLaterFunctions.getUnsentMessagesFolder();
          const listener = new CopyUnsentListener(sendUnsentMsgs);
          SendLaterFunctions.copyStringMessageToFolder(
            content, fdrunsent, listener, false);

          return true;
        },

        // Saves raw message content in specified folder.
        async saveMessage(accountId, path, content, markRead) {
          function CopyRecurListener(folder) {
            this._folder = folder;
          }

          CopyRecurListener.prototype = {
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
                  SendLaterFunctions.debug(
                    `SL3U.saveMessage: Failed to delete ${copying.path}.`);
                  SendLaterFunctions.waitAndDelete(copying);
                }
              }
              if (Components.isSuccessCode(status)) {
                SendLaterFunctions.debug(
                  "SL3U.saveMessage: Saved updated message");
              } else {
                SendLaterFunctions.error(
                  "SL3U.saveMessage:", `0x${status.toString(16)}`);
              }
            },
            SetMessageKey: function(key) {
              this._key = key;
            }
          }

          const uri = SendLaterFunctions.folderPathToURI(accountId, path);
          const folder = MailServices.folderLookup.getFolderForURL(uri);
          const listener = new CopyRecurListener(folder);
          SendLaterFunctions.copyStringMessageToFolder(
            content, folder, listener, markRead);

          return true;
        },

        async setHeader(tabId, name, value) {
          let tab = context.extension.tabManager.get(tabId);
          let window = tab.nativeTab;
          window.gMsgCompose.compFields.setHeader(name, value);
        },

        async setCustomDBHeaders(requestedHdrs) {
          // mailnews.customDBHeaders
          let originals = [];
          try {
            originals = Services.prefs.getCharPref(
              "mailnews.customDBHeaders", ""
            ).toLowerCase().split(/\s+/).filter(v=>(v!==""));
          } catch(e) {}

          const allDefined = requestedHdrs.every(
            hdr => originals.includes(hdr));
          if (!allDefined) {
            let chNames = originals.concat(requestedHdrs);
            let uniqueHdrs = chNames.filter((v, i, s) => (s.indexOf(v) === i));
            const customHdrString = uniqueHdrs.join(" ");
            SendLaterFunctions.info(
              `SL3U.setCustomDBHeaders`,
              `Setting mailnews.customDBHeaders Updated: ${customHdrString}`,
              `Previously: ${originals.join(" ")}`);
            Services.prefs.setCharPref("mailnews.customDBHeaders",
                                       customHdrString);
          }
        },

        async setLogConsoleLevel(level) {
          SendLaterVars.logConsoleLevel = level;
        },

        async forceToolbarVisible(windowId) {
          let windows;
          if (windowId) {
            let wm = context.extension.windowManager.get(windowId, context);
            windows = [wm.window];
          } else {
            windows = Services.wm.getEnumerator("msgcompose");
          }

          for (let window of windows) {
            let windowReadyPromise = new Promise((resolve) => {
              if (window.document.readyState == "complete") resolve();
              else window.addEventListener("load", resolve, { once: true });
            });
            await windowReadyPromise;

            if (!window.gMsgCompose)
              throw new Error(
                "Attempted forceToolbarVisible on non-compose window");

            const toolbarId = "composeToolbar2";
            const toolbar = window.document.getElementById(toolbarId);

            const widgetId = ExtensionCommon.makeWidgetId(extension.id);
            const toolbarButtonId = `${widgetId}-composeAction-toolbarbutton`;
            const windowURL = "chrome://messenger/content/messengercompose/" +
                  "messengercompose.xhtml";
            let currentSet = Services.xulStore.getValue(
              windowURL, toolbarId, "currentset");
            if (!currentSet) {
              SendLaterFunctions.error(
                "SL3U.bindKeyCodes.messengercompose.onLoadWindow",
                "Unable to find compose window toolbar area");
            } else if (currentSet.includes(toolbarButtonId)) {
              SendLaterFunctions.debug(
                "Toolbar includes Send Later compose action button.");
            } else {
              SendLaterFunctions.debug("Adding Send Later toolbar button");
              currentSet = currentSet.split(",");
              currentSet.push(toolbarButtonId);
              toolbar.currentSet = currentSet.join(",");
              toolbar.setAttribute("currentset",toolbar.currentSet);
              SendLaterFunctions.debug(
                "Current toolbar action buttons:", currentSet);
              Services.xulStore.setValue(
                windowURL, toolbarId, "currentset", currentSet.join(","));
              // Services.xulStore.persist(toolbar, "currentset");
            }

            Services.xulStore.setValue(
              windowURL, toolbarId, "collapsed", "false");
            toolbar.collapsed = false;
            toolbar.hidden = false;

            SendLaterFunctions.debug(
              "Compose window has send later button now.");
          }
        },

        // Find whether the current composition window is editing an existing
        // draft
        async findAssociatedDraft(windowId) {
          let window;
          if (windowId) {
            let wm = context.extension.windowManager.get(windowId, context);
            window = wm.window;
          } else {
            window = Services.wm.getMostRecentWindow("msgcompose");
          }

          if (!window.gMsgCompose)
            throw new Error("Attempted getDraftHeaders on non-compose window");

          const msgCompFields = window.gMsgCompose.compFields;
          if (msgCompFields && msgCompFields.draftId!="") {
            const messageURI = msgCompFields.draftId.replace(/\?.*/, "");
            const messenger = Cc["@mozilla.org/messenger;1"]
                  .getService(Ci.nsIMessenger);
            const msgHdr = messenger.msgHdrFromURI(messageURI);
            return context.extension.messageManager.convert(msgHdr);
          } else {
            SendLaterFunctions.debug("Window is not an existing draft.");
          }
        },

        async hijackComposeWindowKeyBindings(windowId) {
          let windows;
          if (windowId) {
            let wm = context.extension.windowManager.get(windowId, context);
            windows = [wm.window];
          } else {
            windows = Services.wm.getEnumerator("msgcompose");
          }

          for (let window of windows) {
            let windowReadyPromise = new Promise((resolve) => {
              if (window.document.readyState == "complete") resolve();
              else window.addEventListener("load", resolve, { once: true });
            });
            await windowReadyPromise;

            if (!window.gMsgCompose)
              throw new Error(
                "Attempted attachMsgComposeKeyBindings on non-compose window");

            // Add keycode listener for "Alt+Shift+Enter"
            const tasksKeys = window.document.getElementById("tasksKeys");
            if (tasksKeys) {
              const keyElement = window.document.createXULElement("key");
              keyElement.id = "key-alt-shift-enter";
              keyElement.setAttribute("keycode", "VK_RETURN");
              keyElement.setAttribute("modifiers", "alt, shift");
              keyElement.setAttribute("oncommand", "//");
              keyElement.addEventListener("command", event => {
                event.preventDefault();
                SendLaterFunctions.keyCodeEventTracker.emit(
                  "key_altShiftEnter");
              });
              tasksKeys.appendChild(keyElement);
            } else {
              SendLaterFunctions.error(
                "SL3U.bindKeyCodes.messengercompose.onLoadWindow",
                "Unable to add keycode listener for Alt+Shift+Enter");
            }

            window.sendLaterReplacedAttributes = {};

            [ "key_sendLater", "cmd_sendLater", "key_send",
              "cmd_sendWithCheck", "cmd_sendButton", "cmd_sendNow"
            ].forEach((itemId) => {
              const element = window.document.getElementById(itemId);
              if (element) {
                const listener = ((event) => {
                  event.preventDefault();
                  SendLaterFunctions.keyCodeEventTracker.emit(itemId);
                });
                window.sendLaterReplacedAttributes[itemId] = {
                  oncommand: element.getAttribute("oncommand"),
                  listener
                };
                element.setAttribute('oncommand', "//");
                element.addEventListener('command', listener);
              } else {
                SendLaterFunctions.error(
                  "SL3U.bindKeyCodes.messengercompose.onLoadWindow",
                  `Could not find ${itemId} element.`);
              }
            });
          }
        },

        // This eventmanager needs the 'inputHandling' property, or else
        // openPopup() will be disabled.
        onKeyCode: new ExtensionCommon.EventManager({
          context,
          name: "SL3U.onKeyCode",
          inputHandling: true,
          register: fire => {
            const callback = (evt => fire.async(evt));
            SendLaterFunctions.keyCodeEventTracker.add(callback);
            return function() {
              SendLaterFunctions.keyCodeEventTracker.remove(callback);
            };
          },
        }).api(),
      },
    };
  }

  /*
    Be sure to unload any .jsm modules that we loaded above, and invalidate
    the cache to ensure the most recent version is always loaded on startup.
  */
  close() {
    SendLaterFunctions.debug("SL3U.close","Beginning close function");

    // Restore key bindings for any currently active msgcompose windows
    for (let cw of Services.wm.getEnumerator("msgcompose")) {
      const keyElement = cw.document.getElementById("key-alt-shift-enter");
      if (keyElement)
        keyElement.remove();

      const attrs = cw.sendLaterReplacedAttributes;
      if (attrs) {
        for (let elementId of Object.getOwnPropertyNames(attrs)) {
          try {
            SendLaterFunctions.debug(
              `Restoring element attributes: ${elementId}`);
            const element = cw.document.getElementById(elementId);
            element.setAttribute("oncommand", attrs[elementId].oncommand);
            element.removeEventListener("command", attrs[elementId].listener);
          } catch (ex) {
            SendLaterFunctions.warn(ex);
          }
        }
      } else {
        SendLaterFunctions.debug(`No elements to restore`);
      }
    }

    // Resolve any pending pre-send check promises
    for (let cw of Services.wm.getEnumerator("msgcompose")) {
      if (cw.ResolvePendingPreSendCheck) {
        try {
          cw.ResolvePendingPreSendCheck(false);
        } catch (ex) {
          SendLaterFunctions.error(
            "Unable to resolve pre-send check promise", ex);
        }
      }
    }

    // Remove msgSendLater listener
    try {
      SendLaterFunctions.debug("Removing msgSendLaterlistener");
      const msgSendLater = Cc[
        "@mozilla.org/messengercompose/sendlater;1"
      ].getService(Ci.nsIMsgSendLater);
      msgSendLater.removeListener(
        SendLaterFunctions.sendUnsentMessagesListener);
    } catch (ex) {
      SendLaterFunctions.error("Unable to remove msgSendLater listener.")
    }

    // Invalidate the cache to ensure we start clean if extension is reloaded.
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);

    SendLaterFunctions.info("SL3U.close","Extension removed. Goodbye world.");
  }
};
