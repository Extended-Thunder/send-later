// Get various parts of the WebExtension framework that we need.
const { utils: Cu, classes: Cc, interfaces: Ci } = Components;
const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { Utils } = ChromeUtils.import("resource://services-settings/Utils.jsm");
// const { AppConstants } = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
const { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

const { NetUtil } = ChromeUtils.import("resource://gre/modules/NetUtil.jsm");

const SendLaterVars = {
  fileNumber: 0,
  copyService: null,
  sendingUnsentMessages: false,
  needToSendUnsentMessages: false,
  wantToCompactOutbox: false,
  scriptListeners: new Set(),
  logConsoleLevel: "info"
}

const SendLaterFunctions = {
  logger(msg, level, stream) {
    const levels = ["all","trace","debug","info","warn","error","fatal"];
    if (levels.indexOf(level) >= levels.indexOf(SendLaterVars.logConsoleLevel)) {
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
          SendLaterFunctions.debug("Successfully deleted queued " + this.file.path);
        } catch (ex) {
          SendLaterFunctions.warn("Failed to delete " + this.file.path);
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
      SendLaterFunctions.debug("SendLaterFunctions.queueSendUnsentMessages Deferring sendUnsentMessages while offline");
    } else if (SendLaterVars.sendingUnsentMessages) {
        SendLaterFunctions.debug("SendLaterFunctions.queueSendUnsentMessages Deferring sendUnsentMessages");
        SendLaterVars.needToSendUnsentMessages = true;
    } else {
      try {
        const msgSendLater = Cc[
            "@mozilla.org/messengercompose/sendlater;1"
          ].getService(Ci.nsIMsgSendLater);
        msgSendLater.sendUnsentMessages(null);
      } catch (ex) {
        SendLaterFunctions.error("SendLaterFunctions.queueSendUnsentMessages",
          "Error triggering send from unsent messages folder.", ex);
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
    SendLaterFunctions.debug("SendLaterFunctions.copyStringMessageToFolder","Saving message to " + filePath);
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

  rebuildDraftsFolders() {
    let accountManager = Components
      .classes["@mozilla.org/messenger/account-manager;1"]
      .getService(Ci.nsIMsgAccountManager);
    let fdrlocal = accountManager.localFoldersServer.rootFolder;
    var msgWindow = Cc[
      "@mozilla.org/messenger/msgwindow;1"
    ].createInstance();
    msgWindow = msgWindow.QueryInterface(Ci.nsIMsgWindow);
    let folderstocheck = new Object();
    let foldersdone = new Object();
    let CheckFolder = function(folder) {
      let uri = folder.URI;
      if (folderstocheck[uri] || foldersdone[uri]) {
          SendLaterFunctions.debug("rebuildDraftsFolder.CheckFolder: Already done - " + uri);
          return;
      }
      foldersdone[uri] = 1;
      SendLaterFunctions.debug("SendLaterFunctions.rebuildDraftsFolder.CheckFolder","Compacting folder",folder);
      //folder.compact(null, msgWindow);
      //const msgDb = folder.msgDatabase.QueryInterface(Ci.nsIMsgDatabase);
      const msgStore = folder.msgStore.QueryInterface(Ci.nsIMsgPluggableStore);
      function CustomListener() {};
      CustomListener.prototype = {
        QueryInterface: ChromeUtils.generateQI(["nsIUrlListener"]),
        OnStopRunningUrl(url, exitCode) {
          SendLaterFunctions.debug(
            "SendLaterFunctions.rebuildDraftsFolder.CustomListener.OnStopRunningUrl",
            url, exitCode);
          let nssErrorsService = Cc["@mozilla.org/nss_errors_service;1"].getService(
            Ci.nsINSSErrorsService
          );
          try {
            let errorClass = nssErrorsService.getErrorClass(exitCode);
            if (errorClass == Ci.nsINSSErrorsService.ERROR_CLASS_BAD_CERT) {
              let mailNewsUrl = url.QueryInterface(Ci.nsIMsgMailNewsUrl);
              let secInfo = mailNewsUrl.failedSecInfo;
              InformUserOfCertError(secInfo, url.asciiHostPort);
            }
          } catch (e) {
            SendLaterFunctions.warn(
              "SendLaterFunctions.rebuildDraftsFolder.CustomListener.OnStopRunningUrl",
              e
            );
          }
        },
        OnStartCopy() {},
        OnStopCopy(aExitCode) {
          SendLaterFunctions.debug(
            "SendLaterFunctions.rebuildDraftsFolder.CustomListener.OnStopCopy",
            aExitCode
          );
        },
        SetMessageKey(dstKey) {
          SendLaterFunctions.debug(
            "SendLaterFunctions.rebuildDraftsFolder.CustomListener.SetMessageKey",
            dstKey
          );
        }
      }
      const listener = (new CustomListener());
      try {
        /*
         * From comm/mailnews/base/public/nsIMsgPluggableStore.idl:
         * void rebuildIndex(in nsIMsgFolder aFolder, in nsIMsgDatabase aMsgDB,
         *                   in nsIMsgWindow aMsgWindow, in nsIUrlListener aListener);
         */
        msgStore.rebuildIndex(folder, folder.msgDatabase, msgWindow, listener);
      } catch (e) {
        SendLaterFunctions.error(
          "SendLaterFunctions.rebuildDraftsFolder.CheckFolder",
          e
        );
      }
    }
    let folder = fdrlocal.findSubFolder("Drafts");
    if (folder)
        CheckFolder(folder);
    else
      SendLaterFunctions.warn("rebuildDraftsFolder","FindSubFolder(fdrlocal, \"Drafts\") " +
            "returned nothing");

    let draft_folder_pref = 'mail.identity.default.draft_folder';
    let local_draft_pref = Services.prefs.getStringPref(draft_folder_pref);
    SendLaterFunctions.debug("mail.identity.default.draft_folder=" + local_draft_pref);
    if (local_draft_pref) {
      try {
        folder = MailServices.folderLookup.getFolderForURL(local_draft_pref);
        //folder = MailUtils.getExistingFolder(local_draft_pref);
        if (folder) {
          CheckFolder(folder);
        }
      } catch (e) {
        SendLaterFunctions.debug("default Drafts folder " + local_draft_pref +
                        " does not exist?");
      }
    }
    let allaccounts = accountManager.accounts;
    let acindex, numAccounts;
    numAccounts = allaccounts.length;
    SendLaterFunctions.debug("rebuildDraftsFolder", numAccounts, allaccounts);
    for (acindex = 0; acindex<numAccounts; acindex++) {
      let thisaccount = allaccounts[acindex].QueryInterface(Ci.nsIMsgAccount);
      if (thisaccount) {
        let numIdentities = thisaccount.identities.length;
        SendLaterFunctions.debug(
          thisaccount.incomingServer.type +
            " - Identities [" +
            numIdentities +
            "]"
        );
        switch (thisaccount.incomingServer.type) {
          case "pop3":
          case "imap":
          case "owl":
            let identityNum;
            for (identityNum = 0; identityNum < numIdentities; identityNum++) {
              try {
                SendLaterFunctions.debug("rebuildDraftsFolder",thisaccount.identities);
                let identity = thisaccount.identities[identityNum].QueryInterface(Ci.nsIMsgIdentity);
                let thisfolder = MailServices.folderLookup.getFolderForURL(identity.draftFolder);
                CheckFolder(thisfolder);
              } catch (e) {
                SendLaterFunctions.warn("rebuildDraftsFolder","Error getting identity:",e);
              }
            }
            break;
          default:
            SendLaterFunctions.debug("rebuildDraftsFolder: skipping this server type - " + thisaccount);
            break;
        }
      }
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

const SendLaterBackgrounding = function() {
  var sl3log = {
    Entering(functionName) {
      SendLaterFunctions.debug("Entering function:",functionName);
    },
    Leaving(functionName) {
      SendLaterFunctions.debug("Leaving function:",functionName);
    }
  };

  var msgWindow = Cc[
      "@mozilla.org/messenger/msgwindow;1"
    ].createInstance();
  msgWindow = msgWindow.QueryInterface(Components.interfaces.nsIMsgWindow);

  // If you add a message to the Outbox and call nsIMsgSendLater when it's
  // already in the middle of sending unsent messages, then it's possible
  // that the message you just added won't get sent. Therefore, when we add a
  // new message to the Outbox, we need to be aware of whether we're already
  // in the middle of sending unsent messages, and if so, then trigger
  // another send after it's finished.
  var sendUnsentMessagesListener = {
    _copyProcess: { status: null },
      QueryInterface: ChromeUtils.generateQI(["nsIMsgSendLaterListener"]),
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
            SendLaterFunctions.getUnsentMessagesFolder().getTotalMessages(false) == 0) {
              try {
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
          sl3log.Leaving("Sendlater3Backgrounding.sendUnsentMessagesListener.onStopSending");
      }
  }

  function addMsgSendLaterListener() {
      sl3log.Entering("Sendlater3Backgrounding.addMsgSendLaterListener");
      const msgSendLater = Cc[
          "@mozilla.org/messengercompose/sendlater;1"
        ].getService(Ci.nsIMsgSendLater);
      msgSendLater.addListener(sendUnsentMessagesListener);
      sl3log.Leaving("Sendlater3Backgrounding.addMsgSendLaterListener");
  }

  function removeMsgSendLaterListener() {
      sl3log.Entering("Sendlater3Backgrounding.removeMsgSendLaterListener");
      const msgSendLater = Cc[
          "@mozilla.org/messengercompose/sendlater;1"
        ].getService(Ci.nsIMsgSendLater);
      msgSendLater.removeListener(sendUnsentMessagesListener);
      sl3log.Leaving("Sendlater3Backgrounding.removeMsgSendLaterListener");
  }

  const AddonListener = {
    resetSession(addon, who) {
      if (addon.id != "sendlater3@kamens.us") {
        return;
      }
      SendLaterFunctions.debug("AddonListener.resetSession: who - " + who);
      try {
        AddonManager.removeAddonListener(this);
      } catch (ex) {
        SendLaterFunctions.warn(
          "AddonListener.resetSession: Unable to remove addon listener",
          ex
        );
      }
      removeMsgSendLaterListener();
    },
    onUninstalling(addon) {
      this.resetSession(addon, "onUninstalling");
    },
    onInstalling(addon) {
      this.resetSession(addon, "onInstalling");
    },
    onDisabling(addon) {
      this.resetSession(addon, "onDisabling");
    },
    // The listener is removed so these aren't run; they aren't needed as the
    // addon is installed by the addon system and runs our backgound.js loader.
    onEnabling(addon) {},
    onOperationCancelled(addon) {},
  };

  const window = Services.wm.getMostRecentWindow(null); // "mail:3pane"
  window.addEventListener("unload", removeMsgSendLaterListener, false);
  AddonManager.addAddonListener(AddonListener);

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

        async confirmCheck(title, message, checkMessage, state) {
          function doConfirmCheck(resolve, reject) {
            try {
              let checkbox = { value: state };
              let okToProceed = Services.prompt.confirmCheck(
                null, title, message, checkMessage, checkbox
              );
              resolve(okToProceed && checkbox.value);
            } catch (err) {
              reject(`An error occurred in SL3U.doConfirmCheck: ${err}`);
            }
          }
          return new Promise(doConfirmCheck.bind(this));
        },

        async showStatus(message) {
          for (let window of Services.wm.getEnumerator("mail:3pane")) {
            const { document } = window;
            const statusMenu = document.getElementById("sendlater3-panel");
            if (statusMenu) {
              statusMenu.setAttribute("label", message);
            } else {
              SendLaterFunctions.debug("Unable to find status-bar menu element");
            }
          }
        },

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
            function doConfirm(resolve, reject) {
              try {
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
                resolve(cw.cancelSendMessage);
              } catch (err) {
                reject(`An error occurred in SL3U.confirmAction: ${err}`);
              }
            }

            const cancelSendMessage = await (new Promise(doConfirm.bind(this)));

            if (cancelSendMessage) {
              return false;
            }
          }

          // Strip trailing spaces and long consecutive WSP sequences from the
          // subject line to prevent getting only WSP chars on a folded line.
          let fixedSubject = subject.replace(/\s{74,}/g, "    ").trimRight();
          if (fixedSubject != subject) {
            subject = fixedSubject;
            msgCompFields.subject = fixedSubject;
            cw.document.getElementById("msgSubject").value = fixedSubject;
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

          // Attachment Reminder: Alert the user if
          //  - the user requested "Remind me later" from either the notification bar or the menu
          //    (alert regardless of the number of files already attached: we can't guess for how many
          //    or which files users want the reminder, and guessing wrong will annoy them a lot), OR
          //  - the aggressive pref is set and the latest notification is still showing (implying
          //    that the message has no attachment(s) yet, message still contains some attachment
          //    keywords, and notification was not dismissed).
          if (
            cw.gManualAttachmentReminder ||
            (Services.prefs.getBoolPref(
              "mail.compose.attachment_reminder_aggressive"
            ) &&
              cw.gNotification.notificationbox.getNotificationWithValue(
                "attachmentReminder"
              ))
          ) {
            let flags =
              Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
              Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_IS_STRING;
            let hadForgotten = Services.prompt.confirmEx(
              cw,
              getComposeBundle().getString("attachmentReminderTitle"),
              getComposeBundle().getString("attachmentReminderMsg"),
              flags,
              getComposeBundle().getString("attachmentReminderFalseAlarm"),
              getComposeBundle().getString("attachmentReminderYesIForgot"),
              null,
              null,
              { value: 0 }
            );
            // Deactivate manual attachment reminder after showing the alert to avoid alert loop.
            // We also deactivate reminder when user ignores alert with [x] or [ESC].
            if (cw.gManualAttachmentReminder) {
              cw.toggleAttachmentReminder(false);
            }

            if (hadForgotten) {
              return false;
            }
          }

          // Check if the user tries to send a message to a newsgroup through a mail
          // account.
          let identityList = cw.document.getElementById("msgIdentity");
          let currentAccountKey = identityList.getAttribute("accountkey");
          let account = MailServices.accounts.getAccount(currentAccountKey);
          if (!account) {
            throw new Error(
              "currentAccountKey '" + currentAccountKey + "' has no matching account!"
            );
          }
          if (
            account.incomingServer.type != "nntp" &&
            msgCompFields.newsgroups != ""
          ) {
            const kDontAskAgainPref = "mail.compose.dontWarnMail2Newsgroup";
            // default to ask user if the pref is not set
            let dontAskAgain = Services.prefs.getBoolPref(kDontAskAgainPref);
            if (!dontAskAgain) {
              let checkbox = { value: false };
              let okToProceed = Services.prompt.confirmCheck(
                cw,
                getComposeBundle().getString("noNewsgroupSupportTitle"),
                getComposeBundle().getString("recipientDlogMessage"),
                getComposeBundle().getString("CheckMsg"),
                checkbox
              );
              if (!okToProceed) {
                return false;
              }
              if (checkbox.value) {
                Services.prefs.setBoolPref(kDontAskAgainPref, true);
              }
            }
            // remove newsgroups to prevent news_p to be set
            // in nsMsgComposeAndSend::DeliverMessage()
            msgCompFields.newsgroups = "";
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
            cw.openDialog(
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

        async saveAsDraft(newMessageId) {
          // Saves the current compose window message as a draft.
          // (Window remains open)
          const cw = Services.wm.getMostRecentWindow("msgcompose");

          cw.gMsgCompose.compFields.setHeader("message-id",newMessageId);
          const verifyId = cw.gMsgCompose.compFields.getHeader("message-id");

          if (verifyId === newMessageId) {
            // Save the message to drafts
            try {
              cw.GenericSendMessage(Ci.nsIMsgCompDeliverMode.SaveAsDraft);
            } catch (err) {
              SendLaterFunctions.error("SL3U.saveAsDraft","Unable to save message to drafts", err);
              return false;
            }

            // Set reply forward message flags
            try {
              const type = cw.gMsgCompose.type;
              const originalURI = cw.gMsgCompose.originalMsgURI;
              SendLaterFunctions.debug("Setting message reply/forward flags", type, originalURI);

              if ( originalURI ) {
                const messenger = Cc["@mozilla.org/messenger;1"].getService(Ci.nsIMessenger);
                var hdr = messenger.msgHdrFromURI(originalURI);
                switch (type) {
                  case Ci.nsIMsgCompType.Reply:
                  case Ci.nsIMsgCompType.ReplyAll:
                  case Ci.nsIMsgCompType.ReplyToSender:
                  case Ci.nsIMsgCompType.ReplyToGroup:
                  case Ci.nsIMsgCompType.ReplyToSenderAndGroup:
                  case Ci.nsIMsgCompType.ReplyWithTemplate:
                  case Ci.nsIMsgCompType.ReplyToList:
                    hdr.folder.addMessageDispositionState(
                      hdr, hdr.folder.nsMsgDispositionState_Replied);
                    break;
                  case Ci.nsIMsgCompType.ForwardAsAttachment:
                  case Ci.nsIMsgCompType.ForwardInline:
                    hdr.folder.addMessageDispositionState(
                      hdr, hdr.folder.nsMsgDispositionState_Forwarded);
                    break;
                }
              } else {
                SendLaterFunctions.debug("SL3U.saveAsDraft","Unable to set reply / forward flags " +
                             "for message. Cannot find original message URI");
              }
            } catch (err) {
              SendLaterFunctions.debug("SL3U.saveAsDraft","Failed to set flag for reply / forward", err);
            }
            return true;
          } else {
            SendLaterFunctions.error(
              "SL3U.saveAsDraft",
              `SendLater: Message ID not set correctly, ${verifyId} != ${newMessageId}`
            );
          }
          return false;
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
            const thisID = cw.gMsgCompose.compFields.getHeader("message-id");
            if (thisID === msgId) {
              return true;
            }
          }
          return false;
        },

        async generateMsgId(idkey) {
          // const idkey = ((/\nX-Identity-Key:\s*(\S+)/i).exec('\n'+content))[1];
          return SendLaterFunctions.generateMsgId(idkey);
        },

        async sendRaw(content, sendUnsentMsgs) {
          // Dump message content as new message in the outbox folder
          function CopyUnsentListener(triggerOutbox) {
            this._sendUnsentMsgs = triggerOutbox
          }
          CopyUnsentListener.prototype = {
            QueryInterface: function(iid) {
              SendLaterFunctions.debug("SL3U.sendRaw.CopyUnsentListener.QueryInterface: Entering");
              if (iid.equals(Ci.nsIMsgCopyServiceListener) ||
                  iid.equals(Ci.nsISupports)) {
                    SendLaterFunctions.debug(
                      "SL3U.sendRaw.CopyUnsentListener.QueryInterface: Returning",
                      this
                    );
                return this;
              }
              SendLaterFunctions.error("SL3U.sendRaw.CopyUnsentListener.QueryInterface",
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
                  const mailWindow = Services.wm.getMostRecentWindow("mail:3pane");
                  mailWindow.setTimeout(SendLaterFunctions.queueSendUnsentMessages, 1000);
                } else {
                  SendLaterFunctions.debug(
                    "SL3U.sendRaw.CopyUnsentListener.OnStopCopy:",
                    "Not triggering send operation per user prefs.");
                }
              } else {
                SendLaterFunctions.error(
                  "SL3U.sendRaw.CopyUnsentListener.OnStopCopy",
                  status);
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
                  SendLaterFunctions.debug(`SL3U.saveMessage: Failed to delete ${copying.path}.`);
                  SendLaterFunctions.waitAndDelete(copying);
                }
              }
              if (Components.isSuccessCode(status)) {
                SendLaterFunctions.debug("SL3U.saveMessage: Saved updated message");
              } else {
                SendLaterFunctions.error("SL3U.saveMessage:",status);
              }
            },
            SetMessageKey: function(key) {
              this._key = key;
            }
          }

          const uri = SendLaterFunctions.folderPathToURI(accountId, path);
          const folder = MailServices.folderLookup.getFolderForURL(uri);
          const listener = new CopyRecurListener(folder);
          SendLaterFunctions.copyStringMessageToFolder(content, folder, listener);

          return true;
        },

        async setCustomDBHeaders() {
          // mailnews.customDBHeaders
          let originals = [];
          try {
            originals = Services.prefs.getCharPref(
                "mailnews.customDBHeaders", ""
              ).toLowerCase().split(/\s+/).filter(v=>(v!==""));
          } catch(e) {}
          let wantedHeaders = ["x-send-later-at", "x-send-later-recur",
            "x-send-later-args", "x-send-later-cancel-on-reply", "x-send-later-uuid"];

          const allDefined = wantedHeaders.every(hdr => originals.includes(hdr));
          if (!allDefined) {
            let chNames = originals.concat(wantedHeaders);
            let uniqueHdrs = chNames.filter((v, i, s) => (s.indexOf(v) === i));
            const customHdrString = uniqueHdrs.join(" ");
            SendLaterFunctions.info(`SL3U.setCustomDBHeaders`,
              `Setting mailnews.customDBHeaders Updated: ${customHdrString}`,
              `Previously: ${originals.join(" ")}`);
            Services.prefs.setCharPref("mailnews.customDBHeaders",
                                        customHdrString);
            // TODO: Forcing rebuild of Drafts folders doesn't
            // work yet.
            // SendLaterFunctions.rebuildDraftsFolders();
          }
        },

        async confirmAction(title, message) {
          function doConfirm(resolve, reject) {
            try {
              const prompts = Cc[
                  "@mozilla.org/embedcomp/prompt-service;1"
                ].getService(Ci.nsIPromptService);
              const result = prompts.confirm(null, title, message);
              SendLaterFunctions.debug("SL3U.confirmAction",
                `User input ${result ? "OK" : "Cancel"}`);
              resolve(result);
            } catch (err) {
              reject(`An error occurred in SL3U.confirmAction: ${err}`);
            }
          }
          return new Promise(doConfirm.bind(this));
        },

        async countUnsentMessages() {
          return SendLaterFunctions.getUnsentMessagesFolder().getTotalMessages(false);
        },

        async deleteDraftByUri(accountId, path, draftUri) {
          const folderUri = SendLaterFunctions.folderPathToURI(accountId, path);
          const folder = MailServices.folderLookup.getFolderForURL(folderUri);
          if (draftUri.indexOf("#") === -1) {
            SendLaterFunctions.error("SL3U.deleteDraftByUri Unexpected message URI format");
            return;
          }
          const msgKey = draftUri.substr(draftUri.indexOf("#") + 1);
          if (!folder) {
            SendLaterFunctions.error("SL3U.deleteDraftByUri Cannot find folder");
            return;
          }
          try {
            SendLaterFunctions.debug(`Deleting message (${draftUri})`);
            if (folder.getFlag(Ci.nsMsgFolderFlags.Drafts)) {
              let msgs = Cc["@mozilla.org/array;1"].createInstance(
                Ci.nsIMutableArray
              );
              msgs.appendElement(folder.GetMessageHeader(msgKey));
              folder.deleteMessages(msgs, null, true, false, null, false);
            }
          } catch (ex) {
            // couldn't find header - perhaps an imap folder.
            SendLaterFunctions.debug(`SL3U.deleteDraftByUri couldn't find header - perhaps an imap folder.`,ex);
            let imapFolder = folder.QueryInterface(Ci.nsIMsgImapMailFolder);
            if (imapFolder) {
              imapFolder.storeImapFlags(
                Ci.nsMsgFolderFlags.Expunged,
                true,
                [msgKey],
                null
              );
            }
          }
        },

        async getAllScheduledMessages(accountId, path, onlyDueForSend, onlyHeaders) {
          const folderUri = SendLaterFunctions.folderPathToURI(accountId, path);
          const folder = MailServices.folderLookup.getFolderForURL(folderUri);

          SendLaterFunctions.debug(`Entering getAllScheduledMessages folder URI: ${folderUri}`);

          let allMessages = [];

          let N_MESSAGES = 0;
          if (folder) {
            let thisfolder = folder.QueryInterface(Ci.nsIMsgFolder);
            let messageenumerator;
            try {
              messageenumerator = thisfolder.messages;
            } catch (e) {
              let lmf;
              try {
                SendLaterFunctions.debug(`Unable to get message enumerator. ` +
                                         `Trying as LocalMailFolder (${folder.URI})`);
                lmf = thisfolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
              } catch (ex) {
                SendLaterFunctions.warn("Unable to get folder as nsIMsgLocalMailFolder");
              }

              if (// NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE
                  (e.result == 0x80550005 ||
                  // NS_MSG_ERROR_FOLDER_SUMMARY_MISSING
                    e.result == 0x80550006) && lmf) {
                try {
                  SendLaterFunctions.warn("Rebuilding summary: " + folder.URI);
                  lmf.getDatabaseWithReparse(null, null);
                } catch (ex) {
                  SendLaterFunctions.error("Unable to rebuild summary.")
                }
              } else {
                // Owl for Exchange, maybe others as well
                try {
                  let o = {};
                  let f = thisfolder.getDBFolderInfoAndDB(o);
                  messageenumerator = f.EnumerateMessages();
                } catch (ex) {
                  SendLaterFunctions.warn("Unable to get EnumerateMessages on DB as fallback");
                }
                if (messageenumerator) {
                  SendLaterFunctions.warn(".messages failed on " + folderUri +
                                          ", using .EnumerateMessages on DB instead");
                } else {
                  const window = Services.wm.getMostRecentWindow(null);
                  Services.prompt.alert(window, null, "Encountered a corrupt folder "+folderUri);
                  throw e;
                }
              }
            }

            if (!messageenumerator) {
              SendLaterFunctions.error(`Unable to get message enumerator for folder ${folderURI}`);
              return null;
            }

            while (messageenumerator.hasMoreElements()) {
              let next = messageenumerator.getNext();
              if (next) {
                N_MESSAGES++;
                let msgHdr = next.QueryInterface(Ci.nsIMsgDBHdr);
                const messageIdHeader = msgHdr.getStringProperty('message-id');
                SendLaterFunctions.debug(`Loading message header for ${msgHdr.messageKey} <${messageIdHeader}>`);

                let skipFlags = Ci.nsMsgMessageFlags.IMAPDeleted |
                                Ci.nsMsgMessageFlags.Expunged;
                if (msgHdr.flags & skipFlags) {
                  continue;
                }

                const sendAtHeader = msgHdr.getStringProperty('x-send-later-at');
                if (!sendAtHeader) {
                  SendLaterFunctions.debug(`No x-send-later headers in message ${msgHdr.messageKey}`);
                  continue;
                }

                const sendAtDate = new Date(sendAtHeader);
                if (onlyDueForSend && sendAtDate.getTime() > Date.now()) {
                  SendLaterFunctions.debug(`Message ${msgHdr.messageKey} not due for send until ${sendAtHeader}`);
                  continue;
                }

                let messageUri = folder.generateMessageURI(msgHdr.messageKey);

                const hdr = {
                  id: msgHdr.messageKey,
                  uri: messageUri
                }
                const allHdrKeys = [
                  "x-send-later-at", "x-send-later-recur", "x-send-later-args",
                  "x-send-later-cancel-on-reply", "x-send-later-uuid",
                  "message-id", "references"
                ];
                for (let key of allHdrKeys) {
                  hdr[key] = msgHdr.getStringProperty(key);
                }

                if (onlyHeaders) {
                  SendLaterFunctions.debug(`Returning headers for message ${hdr["message-id"]}`);
                  allMessages.push(hdr);
                  continue;
                }

                const messenger = Cc[
                  "@mozilla.org/messenger;1"
                ].createInstance(Ci.nsIMessenger);

                const streamListener = Cc[
                  "@mozilla.org/network/sync-stream-listener;1"
                ].createInstance(Ci.nsISyncStreamListener);

                const service = messenger.messageServiceFromURI(messageUri);

                await new Promise((resolve, reject) => {
                  service.streamMessage(
                    messageUri,
                    streamListener,
                    null,
                    {
                      OnStartRunningUrl() {},
                      OnStopRunningUrl(url, exitCode) {
                        SendLaterFunctions.debug(
                          `getRawMessage.streamListener.OnStopRunning ` +
                          `received ${streamListener.inputStream.available()} bytes ` +
                          `(exitCode: ${exitCode})`
                        );
                        if (exitCode === 0) {
                          resolve();
                        } else {
                          Cu.reportError(exitCode);
                          reject();
                        }
                      },
                    },
                    false,
                    ""
                  );
                }).catch((ex) => {
                  SendLaterFunctions.error(`Error reading message ${messageUri}`,ex);
                });

                const available = streamListener.inputStream.available();
                if (available > 0) {
                  hdr.raw = NetUtil.readInputStreamToString(
                    streamListener.inputStream,
                    available
                  );
                  allMessages.push(hdr);
                } else {
                  SendLaterFunctions.debug(`No data available for message ${messageUri}`);
                }
              } else {
                SendLaterFunctions.warn("Was promised more messages, but did not find them.");
              }
            }
          } else {
            SendLaterFunctions.error(`Unable to find folder ${accountId}:${path}`);
          }
          SendLaterFunctions.debug(`Processed ${N_MESSAGES} messages in folder ${folderUri}`);
          return allMessages;
        },

        async compactFolder(accountId, path) {
          let folder;
          if (path.toLowerCase() === "outbox") {
            folder = SendLaterFunctions.getUnsentMessagesFolder();
          } else {
            const uri = SendLaterFunctions.folderPathToURI(accountId, path);
            folder = MailServices.folderLookup.getFolderForURL(uri);
          }
          if (folder !== undefined) {
            let msgWindow = Cc[
              "@mozilla.org/messenger/msgwindow;1"
            ].createInstance();
            msgWindow = msgWindow.QueryInterface(Ci.nsIMsgWindow);
            folder.compact(null, msgWindow);
            SendLaterFunctions.debug("SL3U.compactFolder",`Compacted folder: ${path}`);
            return true;
          } else {
            SendLaterFunctions.debug("SL3U.compactFolder",`Could not get folder ${path} for compacting.`);
          }
          return false;
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
        async notifyStorageLocal(dataStr, startup) {
          let observerTopic = `extension:${extension.id}:ready`;
          let notificationTopic = `extension:${extension.id}:storage-local`;
          let Observer = {
            observe(subject, topic, data) {
              if (topic == observerTopic) {
                SendLaterFunctions.debug("SL3U.notifyStorageLocal",`Observer (${topic})`);
                Services.obs.removeObserver(Observer, observerTopic);
                Services.obs.notifyObservers(null, notificationTopic, dataStr);
              }
            },
          };
          SendLaterFunctions.debug("SL3U.notifyStorageLocal",` START - ${notificationTopic}`);
          if (startup) {
            Services.obs.addObserver(Observer, observerTopic);
          } else {
            Services.obs.notifyObservers(null, notificationTopic, dataStr);
            try {
              const data = JSON.parse(dataStr);
              SendLaterVars.logConsoleLevel = (data.logConsoleLevel||"all").toLowerCase();
            } catch (ex) {
              SendLaterFunctions.warn(
                `SL3U.notifyStorageLocal Unable to set SendLaterVars.logConsoleLevel`
              );
            }
          }
        },

        async injectScripts(filenames) {
          let listenerName = "injector";
          for (let filename of filenames) {
            listenerName += (/([^\/\.]+)\.[^\/]+$/.exec(filename)[1]);
          }
          listenerName += "Listener";
          SendLaterVars.scriptListeners.add(listenerName);

          ExtensionSupport.registerWindowListener(listenerName, {
            chromeURLs: [
              "chrome://messenger/content/messenger.xhtml",
              "chrome://messenger/content/messenger.xul",
            ],
            onLoadWindow(window) {
              (async () => {
                for (let filename of filenames) {
                  let windowContext = window.document.defaultView;
                  try {
                    let scriptURI = extension.rootURI.resolve(filename);
                    let script = await ChromeUtils.compileScript(scriptURI);
                    script.executeInGlobal(windowContext);
                    SendLaterFunctions.info(`onLoadWindow, inject script ${scriptURI}`);
                  } catch (ex) {
                    SendLaterFunctions.error("SL3U.injectScript","Unable to inject script.",ex);
                  }
                }
              })();
            }
          });
        },

        async startObservers() {
          try {
            const loadPrefs = async () => {
              try {
                // const ext = window.ExtensionParent.GlobalManager.extensionMap.get("sendlater3@kamens.us");
                // const localStorage = [...ext.views][0].apiCan.findAPIPath("storage.local");
                const localStorage = context.apiCan.findAPIPath("storage.local");
                const { preferences } =
                  await localStorage.callMethodInParentProcess(
                    "get",
                    [{ "preferences": {} }]
                  );
                SendLaterVars.logConsoleLevel =
                  (preferences.logConsoleLevel||"all").toLowerCase();
                return true;
              } catch (err) {
                // SendLaterFunctions.warn("Could not fetch preferences", err);
              }
              return false;
            };

            if (!await loadPrefs()) {
              const window = Services.wm.getMostRecentWindow(null);
              window.setTimeout(loadPrefs, 1000);
            }
          } catch {}

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
              SendLaterFunctions.debug("Binding to send later events like a barnicle.");
              window.sendLaterReplacedElements = {};

              window.setTimeout(() => {
                try {
                  const { document } = window;
                  const toolbarId = "composeToolbar2";
                  const toolbar = document.getElementById(toolbarId);

                  const widgetId = ExtensionCommon.makeWidgetId(extension.id);
                  const toolbarButtonId = `${widgetId}-composeAction-toolbarbutton`;
                  const windowURL =
                    "chrome://messenger/content/messengercompose/messengercompose.xhtml";
                  let currentSet = Services.xulStore.getValue(
                    windowURL,
                    toolbarId,
                    "currentset"
                  );
                  if (!currentSet) {
                    SendLaterFunctions.error("SL3U.bindKeyCodes.messengercompose.onLoadWindow",
                                             "Unable to find compose window toolbar area");
                  } else if (currentSet.includes(toolbarButtonId)) {
                    SendLaterFunctions.debug("Toolbar includes Send Later compose action button.");
                  } else {
                    SendLaterFunctions.debug("Adding Send Later toolbar button");
                    currentSet = currentSet.split(",");
                    currentSet.push(toolbarButtonId);
                    toolbar.currentSet = currentSet.join(",");
                    toolbar.setAttribute("currentset",toolbar.currentSet);
                    SendLaterFunctions.debug("Current toolbar action buttons:", currentSet);
                    Services.xulStore.setValue(
                      windowURL,
                      toolbarId,
                      "currentset",
                      currentSet.join(",")
                    );
                    // Services.xulStore.persist(toolbar, "currentset");
                  }

                  Services.xulStore.setValue(
                    windowURL,
                    toolbarId,
                    "collapsed",
                    "false"
                  );
                  toolbar.collapsed = false;
                  toolbar.hidden = false;

                  SendLaterFunctions.debug("Compose window has send later button now.");
                } catch (err) {
                  SendLaterFunctions.error("SL3U.bindKeyCodes.messengercompose.onLoadWindow",
                                           "Error enabling toolbar button", err);
                }

                try {
                  if (window.gEditingDraft) {
                    SendLaterFunctions.info(`Saving draft to overwrite any original SendLater headers.`);
                    window.GenericSendMessage(Ci.nsIMsgCompDeliverMode.SaveAsDraft);
                  } else {
                    SendLaterFunctions.debug(`We are not editing an existing draft message (${window.gEditingDraft})`);
                  }
                } catch (ex) {
                  SendLaterFunctions.error(`Error re-saving edited draft.`,ex);
                }
              }, 1000);

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
              } else {
                SendLaterFunctions.error("SL3U.bindKeyCodes.messengercompose.onLoadWindow",
                                         "Unable to add keycode listener for Alt+Shift+Enter");
              }

              // Highjack keycode presses for the actual Send Later button.
              const sendLaterKey = window.document.getElementById("key_sendLater");
              if (sendLaterKey) {
                window.sendLaterReplacedElements["key_sendLater"] = sendLaterKey;
                const keyClone = sendLaterKey.cloneNode(true);
                keyClone.setAttribute("oncommand", "//");
                keyClone.setAttribute("observes", "");
                keyClone.addEventListener('command', event => {
                  event.preventDefault();
                  SendLaterFunctions.keyCodeEventTracker.emit("key_sendLater");
                });
                sendLaterKey.parentNode.replaceChild(keyClone, sendLaterKey);
              } else {
                SendLaterFunctions.error("SL3U.bindKeyCodes.messengercompose.onLoadWindow",
                                         "Could not find key_sendLater element. " +
                                         "Cannot bind to sendlater keypress events.");
              }

              // And events from the send later File menu item
              const sendLaterCmd = window.document.getElementById("cmd_sendLater");
              if (sendLaterCmd) {
                window.sendLaterReplacedElements["cmd_sendLater"] = sendLaterCmd;
                const cmdClone = sendLaterCmd.cloneNode(true);
                cmdClone.setAttribute("oncommand", "//");
                cmdClone.addEventListener('command', event => {
                  event.preventDefault();
                  SendLaterFunctions.keyCodeEventTracker.emit("cmd_sendLater");
                });
                sendLaterCmd.parentNode.replaceChild(cmdClone, sendLaterCmd);
              } else {
                SendLaterFunctions.error("SL3U.bindKeyCodes.messengercompose.onLoadWindow",
                                         "Could not find cmd_sendLater element. " +
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
    SendLaterFunctions.debug("SL3U.close","Beginning close function");

    SendLaterFunctions.debug("Removing all msgcompose overlay elements");
    for (let cw of Services.wm.getEnumerator("msgcompose")) {
      const { document } = cw;
      const keyElement = document.getElementById("key-alt-shift-enter");
      if (keyElement) {
        keyElement.remove();
      }
      if (cw.sendLaterReplacedElements) {
        for (let elementId of Object.getOwnPropertyNames(cw.sendLaterReplacedElements)) {
          try {
            SendLaterFunctions.debug(`Replacing imposter element ${elementId}`);
            const imposter = document.getElementById(elementId);
            const original = cw.sendLaterReplacedElements[elementId];
            if (imposter && original) {
              imposter.parentNode.replaceChild(original, imposter);
            } else {
              SendLaterFunctions.debug(
                "Unable to swap out imposter key_sendLater element.",
                imposter, original);
            }
          } catch (ex) {
            SendLaterFunctions.warn(ex);
          }
        }
      } else {
        SendLaterFunctions.debug(`No imposter elements to restore`);
      }
    }

    SendLaterFunctions.debug("Removing all mail:3pane overlay elements");
    for (let cw of Services.wm.getEnumerator("mail:3pane")) {
      const overlayElements = cw.document.querySelectorAll(".sendlater-overlay");
      overlayElements.forEach(async e => {
        try {
          e.remove();
          SendLaterFunctions.debug("Removed element", e.id);
        } catch (err) {
          SendLaterFunctions.error("Unable to remove element",e, err);
        }
      });
    }

    // Stop listening for new message compose windows.
    try {
      ExtensionSupport.unregisterWindowListener("composeListener");
    } catch (err) {
      SendLaterFunctions.warn(`Could not deregister listener <composeListener>`,err);
    }
    for (let listener of SendLaterVars.scriptListeners) {
      try {
        ExtensionSupport.unregisterWindowListener(listener);
        SendLaterVars.scriptListeners.delete(listener);
      } catch (err) {
        SendLaterFunctions.warn(`Could not deregister listener <${listener}>`,err);
      }
    }

    // Invalidate the cache to ensure we start clean if extension is reloaded.
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);

    SendLaterFunctions.info("SL3U.close","Extension removed. Goodbye world.");
  }
};
