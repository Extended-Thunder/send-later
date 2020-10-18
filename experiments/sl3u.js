// Get various parts of the WebExtension framework that we need.
const { utils: Cu, classes: Cc, interfaces: Ci } = Components;
const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { Utils } = ChromeUtils.import("resource://services-settings/Utils.jsm");
// const { AppConstants } = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");

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
      console.error("Error triggering send from unsent messages folder.", ex);
    }
  }
}

function CopyStringMessageToFolder(content, folder, listener) {
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
}

const keyCodeEventTracker = {
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

        async SaveAsDraft() {
          // Saves the current compose window message as a draft.
          // (Window remains open)
          const cw = Services.wm.getMostRecentWindow("msgcompose");
          cw.GenericSendMessage(Ci.nsIMsgCompDeliverMode.SaveAsDraft);
        },

        async SendNow() {
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

        async sendRaw(content, sendUnsentMsgs) {
          // Replace message-id header with newly generated id.
          content = "\n" + content;
          const idkey = (/\nX-Identity-Key:\s*(\S+)/i.exec(content))[1];
          const newMessageId = generateMsgId(idkey);
          content = content.replace(/(\nMessage-ID:.*)<.*>/i,
                                    "$1" + newMessageId);
          content = content.slice(1);
          if (content.indexOf(newMessageId) === -1) {
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
                if (sendUnsentMsgs) {
                  const mailWindow = Services.wm.getMostRecentWindow("mail:3pane");
                  mailWindow.setTimeout(queueSendUnsentMessages, 1000);
                } else {
                  console.debug(`Not triggering send operation per user prefs.`);
                }
              } else {
                console.error(status);
              }
            },
            SetMessageKey: function(key) {}
          }
          CopyStringMessageToFolder(content, fdrunsent, listener);

          return newMessageId;
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

        bindKeyCodes() {
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
                  keyCodeEventTracker.emit("key_altShiftEnter");
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
                  keyCodeEventTracker.emit("key_sendLater");
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
                  keyCodeEventTracker.emit("cmd_sendLater");
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
            keyCodeEventTracker.add(callback);
            return function() {
              keyCodeEventTracker.remove(callback);
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
