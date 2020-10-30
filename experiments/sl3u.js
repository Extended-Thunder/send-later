// Get various parts of the WebExtension framework that we need.
const { utils: Cu, classes: Cc, interfaces: Ci } = Components;
const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { Utils } = ChromeUtils.import("resource://services-settings/Utils.jsm");
// const { AppConstants } = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
const { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

const SendLaterVars = {
  fileNumber: 0,
  copyService: null,
  sendingUnsentMessages: false,
  needToSendUnsentMessages: false,
  wantToCompactOutbox: false
}

const SendLaterFunctions = {
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
          console.info("Successfully deleted queued " + this.file.path);
        } catch (ex) {
          console.warn("Failed to delete " + this.file.path);
        }
      }
    };
    timer.initWithCallback(callback, 100, Ci.nsITimer.TYPE_REPEATING_SLACK);
  },

  generateMsgId(idkey) {
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
      console.debug("Deferring sendUnsentMessages while offline");
    } else if (SendLaterVars.sendingUnsentMessages) {
        console.debug("Deferring sendUnsentMessages");
        SendLaterVars.needToSendUnsentMessages = true;
    } else {
      try {
        const msgSendLater = Cc[
            "@mozilla.org/messengercompose/sendlater;1"
          ].getService(Ci.nsIMsgSendLater);
        msgSendLater.sendUnsentMessages(null);
      } catch (ex) {
        console.error("Error triggering send from unsent messages folder.", ex);
      }
    }
  },

  copyStringMessageToFolder(content, folder, listener) {
    const dirService =
      Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    const tempDir = dirService.get("TmpD", Ci.nsIFile);
    const sfile0 = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    sfile0.initWithPath(tempDir.path);
    sfile0.appendRelativePath("tempMsg" + (SendLaterVars.fileNumber++) + ".eml");
    const filePath = sfile0.path;
    console.info("Saving message to " + filePath);
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
    if (!SendLaterVars.copyService) {
      SendLaterVars.copyService = Cc[
          "@mozilla.org/messenger/messagecopyservice;1"
        ].getService(Ci.nsIMsgCopyService);
    }
    let msgWindow = Cc["@mozilla.org/messenger/msgwindow;1"].createInstance();
    msgWindow = msgWindow.QueryInterface(Ci.nsIMsgWindow);
    SendLaterVars.copyService.CopyFileMessage(sfile1, folder, null, false, 0, "",
                                              listener, msgWindow);
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

const SendLaterBackgrounding = function() {
  var sl3log = {
    Entering(functionName) {
      console.debug("Entering function:",functionName);
    },
    Leaving(functionName) {
      console.debug("Leaving function:",functionName);
    }
  };

  var msgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
      .createInstance();
  msgWindow = msgWindow.QueryInterface(Components.interfaces.nsIMsgWindow);

  // If you add a message to the Outbox and call nsIMsgSendLater when it's
  // already in the middle of sending unsent messages, then it's possible
  // that the message you just added won't get sent. Therefore, when we add a
  // new message to the Outbox, we need to be aware of whether we're already
  // in the middle of sending unsent messages, and if so, then trigger
  // another send after it's finished.
  var sendUnsentMessagesListener = {
      onStartSending: function(aTotalMessageCount) {
          sl3log.Entering("Sendlater3Backgrounding.sendUnsentMessagesListener.onStartSending");
          SendLaterVars.wantToCompactOutbox =
              SendLaterFunctions.getUnsentMessagesFolder().getTotalMessages(false) > 0;
          SendLaterVars.sendingUnsentMessages = true;
          SendLaterVars.needToSendUnsentMessages = false;
          sl3log.Leaving("Sendlater3Backgrounding.sendUnsentMessagesListener.onStartSending");
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
          sl3log.Entering("Sendlater3Backgrounding.sendUnsentMessagesListener.onStopSending");
          SendLaterVars.sendingUnsentMessages = false;
          if (SendLaterVars.needToSendUnsentMessages) {
              if (Utils.isOffline) {
                  console.warn("Deferring sendUnsentMessages while offline");
              } else {
                  try {
                      var msgSendLater = Components
                          .classes["@mozilla.org/messengercompose/sendlater;1"]
                          .getService(Components.interfaces.nsIMsgSendLater);
                      msgSendLater.sendUnsentMessages(null);
                  } catch (ex) {
                      console.warn(ex);
                  }
              }
          } else if (SendLaterVars.wantToCompactOutbox &&
            SendLaterFunctions.getUnsentMessagesFolder().getTotalMessages(false) == 0) {
              try {
                  let fdrunsent = SendLaterFunctions.getUnsentMessagesFolder();
                  fdrunsent.compact(null, msgWindow);
                  SendLaterVars.wantToCompactOutbox = false;
                  console.debug("Compacted Outbox");
              } catch (ex) {
                console.warn("Compacting Outbox failed: " + ex);
              }
          }
          sl3log.Leaving("Sendlater3Backgrounding.sendUnsentMessagesListener.onStopSending");
      }
  }

  function addMsgSendLaterListener() {
      sl3log.Entering("Sendlater3Backgrounding.addMsgSendLaterListener");
      var msgSendLater = Components
          .classes["@mozilla.org/messengercompose/sendlater;1"]
          .getService(Components.interfaces.nsIMsgSendLater);
      msgSendLater.addListener(sendUnsentMessagesListener);
      sl3log.Leaving("Sendlater3Backgrounding.addMsgSendLaterListener");
  }

  function removeMsgSendLaterListener() {
      sl3log.Entering("Sendlater3Backgrounding.removeMsgSendLaterListener");
      var msgSendLater = Components
          .classes["@mozilla.org/messengercompose/sendlater;1"]
          .getService(Components.interfaces.nsIMsgSendLater);
      msgSendLater.removeListener(sendUnsentMessagesListener);
      sl3log.Leaving("Sendlater3Backgrounding.removeMsgSendLaterListener");
  }

  const window = Services.wm.getMostRecentWindow(null); // "mail:3pane"
  window.addEventListener("unload", removeMsgSendLaterListener, false);

  addMsgSendLaterListener();
};


var SL3U = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    let { extension } = context;
    context.callOnClose(this);

    return {
      SL3U: {
        async alert(title, text) {
          const window = Services.wm.getMostRecentWindow(null);
          return Services.prompt.alert(window, (title || ""), (text || ""));
        },

        async isOffline() {
          return Utils.isOffline;
        },

        async call(name, body, prev, argstring) {
          try {
            body = `let next, nextspec, nextargs; ${body}; ` +
                    "return([next, nextspec, nextargs]);";
            prev = (prev > 0) ? new Date(prev) : null;
            const args = JSON.parse(`[${argstring||""}]`);

            const FUNC = Function.apply(null, ["specname", "prev", "args", body]);
            return FUNC(name, prev, args);
          } catch (ex) {
            return [null, null, null, ex.message];
          }
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

        async expandRecipients(field) {
          const cw = Services.wm.getMostRecentWindow("msgcompose");
          let msgCompFields = cw.GetComposeDetails();
          cw.expandRecipients();
          return msgCompFields[field];
        },

        // Mostly borrowed from MsgComposeCommands.js
        async preSendCheck() {
          const cw = Services.wm.getMostRecentWindow("msgcompose");

          let msgCompFields = cw.GetComposeDetails();
          let subject = msgCompFields.subject;
          // Calling getComposeDetails collapses mailing lists. Expand them again.
          cw.expandRecipients();
          // Check if e-mail addresses are complete, in case user turned off
          // autocomplete to local domain.
          if (!cw.CheckValidEmailAddress(msgCompFields)) {
            return false;
          }

          const SetMsgBodyFrameFocus = function() {
            // window.content.focus() fails to blur the currently focused element
            cw.document.commandDispatcher.advanceFocusIntoSubtree(
              cw.document.getElementById("appcontent")
            );
          }

          // i18n globals
          let _gComposeBundle;
          const getComposeBundle = function() {
            // That one has to be lazy. Getting a reference to an element with a XBL
            // binding attached will cause the XBL constructors to fire if they haven't
            // already. If we get a reference to the compose bundle at script load-time,
            // this will cause the XBL constructor that's responsible for the personas to
            // fire up, thus executing the personas code while the DOM is not fully built.
            // Since this <script> comes before the <statusbar>, the Personas code will
            // fail.
            if (!_gComposeBundle) {
              _gComposeBundle = cw.document.getElementById("bundle_composeMsgs");
            }
            return _gComposeBundle;
          }

          // Do we need to check the spelling?
          if (Services.prefs.getBoolPref("mail.SpellCheckBeforeSend")) {
            // We disable spellcheck for the following -subject line, attachment
            // pane, identity and addressing widget therefore we need to explicitly
            // focus on the mail body when we have to do a spellcheck.
            SetMsgBodyFrameFocus();
            cw.cancelSendMessage = false;
            cw.openDialog(
              "chrome://messenger/content/messengercompose/EdSpellCheck.xhtml",
              "_blank",
              "dialog,close,titlebar,modal,resizable",
              true,
              true,
              false
            );

            if (cw.cancelSendMessage) {
              return false;
            }

            // Strip trailing spaces and long consecutive WSP sequences from the
            // subject line to prevent getting only WSP chars on a folded line.
            let fixedSubject = subject.replace(/\s{74,}/g, "    ").trimRight();
            if (fixedSubject != subject) {
              subject = fixedSubject;
              msgCompFields.subject = fixedSubject;
              cw.document.getElementById("msgSubject").value = fixedSubject;
            }
          }

          // Remind the person if there isn't a subject
          if (subject === "") {
            if (
              Services.prompt.confirmEx(
                cw,
                getComposeBundle().getString("subjectEmptyTitle"),
                getComposeBundle().getString("subjectEmptyMessage"),
                Services.prompt.BUTTON_TITLE_IS_STRING *
                  Services.prompt.BUTTON_POS_0 +
                  Services.prompt.BUTTON_TITLE_IS_STRING *
                    Services.prompt.BUTTON_POS_1,
                getComposeBundle().getString("sendWithEmptySubjectButton"),
                getComposeBundle().getString("cancelSendingButton"),
                null,
                null,
                { value: 0 }
              ) === 1
            ) {
              cw.document.getElementById("msgSubject").focus();
              return false;
            }
          }

          // Before sending the message, check what to do with HTML message,
          // eventually abort.
          let convert = cw.DetermineConvertibility();
          let action = cw.DetermineHTMLAction(convert);

          if (action == Ci.nsIMsgCompSendFormat.AskUser) {
            let recommAction =
              convert == Ci.nsIMsgCompConvertible.No
                ? Ci.nsIMsgCompSendFormat.AskUser
                : Ci.nsIMsgCompSendFormat.PlainText;
            let result2 = {
              action: recommAction,
              convertible: convert,
              abort: false,
            };
            window.openDialog(
              "chrome://messenger/content/messengercompose/askSendFormat.xhtml",
              "askSendFormatDialog",
              "chrome,modal,titlebar,centerscreen",
              result2
            );
            if (result2.abort) {
              return false;
            }
            action = result2.action;
          }

          // We will remember the users "send format" decision in the address
          // collector code (see nsAbAddressCollector::CollectAddress())
          // by using msgCompFields.forcePlainText and msgCompFields.useMultipartAlternative
          // to determine the nsIAbPreferMailFormat (unknown, plaintext, or html).
          // If the user sends both, we remember html.
          switch (action) {
            case Ci.nsIMsgCompSendFormat.PlainText:
              msgCompFields.forcePlainText = true;
              msgCompFields.useMultipartAlternative = false;
              break;
            case Ci.nsIMsgCompSendFormat.HTML:
              msgCompFields.forcePlainText = false;
              msgCompFields.useMultipartAlternative = false;
              break;
            case Ci.nsIMsgCompSendFormat.Both:
              msgCompFields.forcePlainText = false;
              msgCompFields.useMultipartAlternative = true;
              break;
            default:
              throw new Error(
                "Invalid nsIMsgCompSendFormat action; action=" + action
              );
          }

          return true;
        },

        async saveAsDraft(idkey) {
          // Saves the current compose window message as a draft.
          // (Window remains open)
          const cw = Services.wm.getMostRecentWindow("msgcompose");

          const newMessageId = SendLaterFunctions.generateMsgId(idkey);
          cw.gMsgCompose.compFields.setHeader("message-id",newMessageId);
          const verifyId = cw.gMsgCompose.compFields.getHeader("message-id");

          if (verifyId === newMessageId) {
            cw.GenericSendMessage(Ci.nsIMsgCompDeliverMode.SaveAsDraft);
          } else {
            console.error(`Message ID not set correctly, ${verifyId} != ${newMessageId}`);
          }
        },

        async sendNow() {
          // Sends the message from the current composition window
          const cw = Services.wm.getMostRecentWindow("msgcompose");
          cw.SendMessageWithCheck();
        },

        async builtInSendLater() {
          // Sends the message from the current composition window
          // using thunderbird's default send later mechanism.
          const cw = Services.wm.getMostRecentWindow("msgcompose");
          cw.SendMessageLater();
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

        async generateMsgId(content) {
          const idkey = ((/\nX-Identity-Key:\s*(\S+)/i).exec('\n'+content))[1];
          return SendLaterFunctions.generateMsgId(idkey);
        },

        async sendRaw(content, sendUnsentMsgs) {
          // Dump message content as new message in the outbox folder
          function CopyUnsentListener(triggerOutbox) {
            this._sendUnsentMsgs = triggerOutbox
          }
          CopyUnsentListener.prototype = {
            QueryInterface: function(iid) {
              console.debug("[SendLater]: Entering CopyUnsentListener.QueryInterface");
              if (iid.equals(Ci.nsIMsgCopyServiceListener) ||
                  iid.equals(Ci.nsISupports)) {
                console.debug("[SendLater]: Returingn copyServiceListener.QueryInterface",
                  this);
                return this;
              }
              console.error("CopyUnsentListener.QueryInterface",
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
                  console.debug(`Failed to delete ${copying.path}.` +
                                `Trying again with waitAndDelete.`);
                  SendLaterFunctions.waitAndDelete(copying);
                }
              }
              if (Components.isSuccessCode(status)) {
                console.debug("Successfully copied message to outbox.");
                if (this._sendUnsentMsgs) {
                  console.debug("Triggering send unsent messages.")
                  const mailWindow = Services.wm.getMostRecentWindow("mail:3pane");
                  mailWindow.setTimeout(SendLaterFunctions.queueSendUnsentMessages, 1000);
                } else {
                  console.debug(`Not triggering send operation per user prefs.`);
                }
              } else {
                console.error(status);
              }
            },
            SetMessageKey: function(key) {}
          }
          const fdrunsent = SendLaterFunctions.getUnsentMessagesFolder();
          const listener = new CopyUnsentListener(sendUnsentMsgs);
          SendLaterFunctions.copyStringMessageToFolder(content, fdrunsent, listener);

          return true;
        },

        // Saves raw message content in specified folder.
        async saveMessage(accountId, path, content) {
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
                  SendLaterFunctions.waitAndDelete(copying);
                }
              }
              if (Components.isSuccessCode(status)) {
                console.debug("Saved updated message");
              } else {
                console.error(status);
              }
            },
            SetMessageKey: function(key) {}
          }

          const uri = SendLaterFunctions.folderPathToURI(accountId, path);
          const folder = MailServices.folderLookup.getFolderForURL(uri);
          SendLaterFunctions.copyStringMessageToFolder(content, folder, listener);

          return true;
        },

        async addMsgSendLaterListener() {
            const msgSendLater = Cc.getService(Ci.nsIMsgSendLater);
            msgSendLater.addListener(this.sendUnsentMessagesListener);
        },

        async removeMsgSendLaterListener() {
            const msgSendLater = Cc.getService(Ci.nsIMsgSendLater);
            msgSendLater.removeListener(this.sendUnsentMessagesListener);
        },

        /*
         * Notify observer with local storage key-value object. The object is
         * obtained from our local storage via browser.storage.local.get() in
         * background.js, as |browser| is not available (maybe) here.
         * The observer will notfiy us when ready to accept the data, on
         * startup. Otherwise send the data.
         *
         * @param {Object} storageLocalData - The key-value object.
         * @param {Boolean} startup         - If true, wait for notification
         *                                    from chrome code before sending
         *                                    data; otherwise do it now.
         * @implements {nsIObserver}
         */
        notifyStorageLocal(storageLocalData, startup) {
          let getStorageLocalMap = () => {
            let storageLocalMap = new Map();
            Object.entries(storageLocalData).forEach(([key, value]) =>
              storageLocalMap.set(key, value)
            );
            return JSON.stringify([...storageLocalMap]);
          };

          let observerTopic = `extension:${extension.id}:ready`;
          let notificationTopic = `extension:${extension.id}:storage-local`;
          let dataStr = getStorageLocalMap();
          let Observer = {
            observe(subject, topic, data) {
              if (topic == observerTopic) {
                // console.debug("notifyStorageLocal.Observer: " + topic);
                Services.obs.removeObserver(Observer, observerTopic);
                Services.obs.notifyObservers(null, notificationTopic, dataStr);
              }
            },
          };
          // console.debug("notifyStorageLocal: START - " + notificationTopic);
          if (startup) {
            Services.obs.addObserver(Observer, observerTopic);
          } else {
            Services.obs.notifyObservers(null, notificationTopic, dataStr);
          }
        },

        injectScript(filename, windowType) {
          let window = Services.wm.getMostRecentWindow(windowType);
          if (window) {
            (async ()=>{
              let context = window.document.defaultView;
              try {
                let scriptURI = extension.rootURI.resolve(filename);
                let script = await ChromeUtils.compileScript(scriptURI);
                script.executeInGlobal(context);
              } catch (ex) {
                console.error("[SendLater]: Unable to inject script.",ex);
              }
            })();
          }
        },

        async startObservers() {
          // Setup various observers.
          SendLaterBackgrounding();
        },

        async bindKeyCodes() {
          // Add an overlay to messenger compose windows to listen for key commands
          ExtensionSupport.registerWindowListener("composeListener", {
            chromeURLs: [
              "chrome://messenger/content/messengercompose/messengercompose.xhtml",
              "chrome://messenger/content/messengercompose/messengercompose.xul"
            ],
            onLoadWindow(window) {
              console.debug("Binding to send later events like a barnicle.");

              const tasksKeys = window.document.getElementById("tasksKeys");
              if (tasksKeys) {
                const keyElement = window.document.createXULElement("key");
                keyElement.id = "key-alt-shift-enter";
                keyElement.setAttribute("keycode", "VK_RETURN");
                keyElement.setAttribute("modifiers", "alt, shift");
                keyElement.setAttribute("oncommand", "//");
                keyElement.addEventListener("command", event => {
                  event.preventDefault();
                  SendLaterFunctions.keyCodeEventTracker.emit("key_altShiftEnter");
                });
                tasksKeys.appendChild(keyElement);
                //console.debug("New alt+shift+enter key element",keyElement);
              } else {
                console.error("Unable to add keycode listener for Alt+Shift+Enter");
              }

              // Highjack keycode presses for the actual Send Later button.
              const sendLaterKey = window.document.getElementById("key_sendLater");
              if (sendLaterKey) {
                const keyClone = sendLaterKey.cloneNode(true);
                keyClone.setAttribute("oncommand", "//");
                keyClone.setAttribute("observes", "");
                keyClone.addEventListener('command', event => {
                  event.preventDefault();
                  SendLaterFunctions.keyCodeEventTracker.emit("key_sendLater");
                });
                sendLaterKey.parentNode.replaceChild(keyClone, sendLaterKey);
                //console.debug("Cloned key element",keyClone);
              } else {
                console.error("Could not find key_sendLater element. " +
                            "Cannot bind to sendlater keypress events.");
              }

              // And events from the send later File menu item
              const sendLaterCmd = window.document.getElementById("cmd_sendLater");
              if (sendLaterCmd) {
                const cmdClone = sendLaterCmd.cloneNode(true);
                cmdClone.setAttribute("oncommand", "//");
                cmdClone.addEventListener('command', event => {
                  event.preventDefault();
                  SendLaterFunctions.keyCodeEventTracker.emit("cmd_sendLater");
                });
                sendLaterCmd.parentNode.replaceChild(cmdClone, sendLaterCmd);
                //console.debug("Cloned menu command element",cmdClone);
              } else {
                console.error("Could not find cmd_sendLater element. " +
                              "Cannot bind to sendlater menu events.");
              }
            }
          });
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
    console.log("[SendLater]: Beginning close function");

    for (let cw of Services.wm.getEnumerator("msgcompose")) {
      const keyElement = cw.document.getElementById("key-alt-shift-enter");
      if (keyElement) {
        keyElement.remove();
      }
    }

    // Stop listening for new message compose windows.
    ExtensionSupport.unregisterWindowListener("composeListener");

    // Invalidate the cache to ensure we start clean if extension is reloaded.
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);

    console.log("[SendLater]: Extension removed. Goodbye world.");
  }
};
