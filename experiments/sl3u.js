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
  scriptListeners: new Set()
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
          console.debug("Already done - " + uri);
          return;
      }
      foldersdone[uri] = 1;
      console.log("Compacting folder",folder);
      //folder.compact(null, msgWindow);
      //const msgDb = folder.msgDatabase.QueryInterface(Ci.nsIMsgDatabase);
      const msgStore = folder.msgStore.QueryInterface(Ci.nsIMsgPluggableStore);
      //console.log(msgDb, msgStore);
      function CustomListener() {};
      CustomListener.prototype = {
        QueryInterface: ChromeUtils.generateQI(["nsIUrlListener"]),
        OnStopRunningUrl(url, exitCode) {
          console.log(url, exitCode);
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
          }
        },
        OnStartCopy() {},
        OnStopCopy(aExitCode) { console.log("OnStopCopy",aExitCode); },
        SetMessageKey(dstKey) { console.log("SetMessageKey",dstKey); }
      }
      const listener = (new CustomListener());
      try {
        /*
         * From comm/mailnews/base/public/nsIMsgPluggableStore.idl:
         * void rebuildIndex(in nsIMsgFolder aFolder, in nsIMsgDatabase aMsgDB,
         *                   in nsIMsgWindow aMsgWindow, in nsIUrlListener aListener);
         */
        console.log(folder instanceof Ci.nsIMsgFolder, folder.msgDatabase instanceof Ci.nsIMsgDatabase,
                    msgWindow instanceof Ci.nsIMsgWindow, listener instanceof (Ci.nsIUrlListener));
        msgStore.rebuildIndex(folder, folder.msgDatabase, msgWindow, listener);
      } catch (e) {
        console.error(e);
      }
    }
    let folder = fdrlocal.findSubFolder("Drafts");
    if (folder)
        CheckFolder(folder);
    else
        console.warn("SL3U.FindSubFolder(fdrlocal, \"Drafts\") " +
            "returned nothing");

    let draft_folder_pref = 'mail.identity.default.draft_folder';
    let local_draft_pref = Services.prefs.getStringPref(draft_folder_pref);
    console.debug("mail.identity.default.draft_folder=" + local_draft_pref);
    if (local_draft_pref) {
      try {
        folder = MailServices.folderLookup.getFolderForURL(local_draft_pref);
        //folder = MailUtils.getExistingFolder(local_draft_pref);
        if (folder) {
          CheckFolder(folder);
        }
      } catch (e) {
        console.debug("default Drafts folder " + local_draft_pref +
                        " does not exist?");
      }
    }
    let allaccounts = accountManager.accounts;
    let acindex, numAccounts;
    numAccounts = allaccounts.length;
    console.log(numAccounts, allaccounts);
    for (acindex = 0; acindex<numAccounts; acindex++) {
      let thisaccount = allaccounts[acindex].QueryInterface(Ci.nsIMsgAccount);
      if (thisaccount) {
        let numIdentities = thisaccount.identities.length;
        console.debug(
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
                console.log(thisaccount.identities);
                let identity = thisaccount.identities[identityNum].QueryInterface(Ci.nsIMsgIdentity);
                let thisfolder = MailServices.folderLookup.getFolderForURL(identity.draftFolder);
                CheckFolder(thisfolder);
              } catch (e) {
                console.warn("Error getting identity:",e);
              }
            }
            break;
          default:
            console.debug("skipping this server type - " + thisaccount);
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
      console.debug("Entering function:",functionName);
    },
    Leaving(functionName) {
      console.debug("Leaving function:",functionName);
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
                  console.warn("Deferring sendUnsentMessages while offline");
              } else {
                  try {
                      const msgSendLater = Components.classes[
                          "@mozilla.org/messengercompose/sendlater;1"
                        ].getService(Components.interfaces.nsIMsgSendLater);
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
      console.debug("AddonListener.resetSession: who - " + who);
      try {
        AddonManager.removeAddonListener(this);
      } catch (ex) { console.warn("Unable to remove addon listener", ex); }
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

        async setLegacyPref(name, dtype, value) {
          const prefName = `extensions.sendlater3.${name}`;

          switch (dtype) {
            case "bool": {
              const prefValue = (value === "true");
              try {
                Services.prefs.setBoolPref(prefName, prefValue);
                return true;
              } catch (err) {
                console.error(err);
                return false;
              }
            }
            case "int": {
              const prefValue = (Number(value)|0);
              try {
                Services.prefs.setIntPref(prefName, prefValue);
                return true;
              } catch (err) {
                console.error(err);
                return false;
              }
            }
            case "char": {
              const prefValue = value;
              try {
                Services.prefs.setCharPref(prefName, prefValue);
                return true;
              } catch (err) {
                console.error(err);
                return false;
              }
            }
            case "string": {
              const prefValue = value;
              try {
                Services.prefs.setStringPref(prefName, prefValue);
                return true;
              } catch (err) {
                console.error(err);
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
              console.error("Unable to save message to drafts", err);
              return false;
            }

            // Set reply forward message flags
            try {
              const type = cw.gMsgCompose.type;
              const originalURI = cw.gMsgCompose.originalMsgURI;
              console.debug("[SendLater]: Setting message reply/forward flags", type, originalURI);

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
                console.debug("SendLater: Unable to set reply / forward flags " +
                             "for message. Cannot find original message URI");
              }
            } catch (err) {
              console.warn("SendLater: Failed to set flag for reply / forward", err);
            }
            return true;
          } else {
            console.error(`SendLater: Message ID not set correctly, ${verifyId} != ${newMessageId}`);
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
            console.info(`Setting mailnews.customDBHeaders: ${customHdrString}` +
                         `\nPreviously: ${originals.join(" ")}`);
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
              console.log(`User input ${result ? "OK" : "Cancel"}`);
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
          const msgKey = draftUri.substr(draftUri.indexOf("#") + 1);
          if (!folder) {
            console.error("Cannot find folder");
            return;
          }
          try {
            console.info(`Deleting draft (${msgKey})`);
            if (folder.getFlag(Ci.nsMsgFolderFlags.Drafts)) {
              let msgs = Cc["@mozilla.org/array;1"].createInstance(
                Ci.nsIMutableArray
              );
              msgs.appendElement(folder.GetMessageHeader(msgKey));
              folder.deleteMessages(msgs, null, true, false, null, false);
            }
          } catch (ex) {
            // couldn't find header - perhaps an imap folder.
            console.debug(`couldn't find header - perhaps an imap folder.`);
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

        // async getMessageUri(accountId, path, messageKey) {
        //   const folderUri = SendLaterFunctions.folderPathToURI(accountId, path);
        //   const folder = MailServices.folderLookup.getFolderForURL(folderUri);
        //   if (folder) {
        //     const msgUri = folder.generateMessageURI(messageKey);
        //     if (msgUri) {
        //       console.log(`Got messageURI for ${messageKey}: ${msgUri}`);
        //       return msgUri;
        //     } else {
        //       console.warn(`Unable to find message ${accountId}:${path}:${messageKey}`);
        //     }
        //   } else {
        //     console.warn(`Unable to find folder ${accountId}:${path}`);
        //     return null;
        //   }
        // },

        async getAllScheduledMessages(accountId, path) {
          const folderUri = SendLaterFunctions.folderPathToURI(accountId, path);
          const folder = MailServices.folderLookup.getFolderForURL(folderUri);

          console.log(`Folder URI: ${folderUri}`);

          let allMessages = [];

          function hasHeader(content, header) {
            const regex = new RegExp(`^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,'im');
            const hdrContent = content.split(/\r\n\r\n/m)[0]+'\r\n';
            return regex.test(hdrContent);
          }

          let N_MESSAGES = 0;
          if (folder) {
            let thisfolder = folder.QueryInterface(Ci.nsIMsgFolder)
            let messageenumerator;
            try {
              messageenumerator = thisfolder.messages;
            } catch (e) {
              let lmf;
              try {
                lmf = thisfolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
              } catch (ex) {
                if (// NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE
                    (e.result == 0x80550005 ||
                    // NS_MSG_ERROR_FOLDER_SUMMARY_MISSING
                     e.result == 0x80550006) && lmf) {
                  try {
                    console.debug("Rebuilding summary: " + folder.URI);
                    lmf.getDatabaseWithReparse(null, null);
                  } catch (ex) {
                    console.warn("Unable to rebuild summary.")
                  }
                } else {
                  // Owl for Exchange, maybe others as well
                  try {
                    let o = {};
                    let f = thisfolder.getDBFolderInfoAndDB(o);
                    messageenumerator = f.EnumerateMessages();
                  } catch (ex) {
                    console.warn("Unable to get EnumerateMessages on DB as fallback");
                  }
                  if (messageenumerator) {
                    console.info(".messages failed on " + folderUri +
                                 ", using .EnumerateMessages on DB instead");
                  } else {
                    const window = Services.wm.getMostRecentWindow(null);
                    Services.prompt.alert(window, null, "Encountered a corrupt folder "+folderUri);
                    throw e;
                  }
                }
              }
            }

            if (!messageenumerator) {
              console.error("Unable to get message enumerator for folder.")
            }

            while (messageenumerator.hasMoreElements()) {
              let next = messageenumerator.getNext();
              if (next) {
                N_MESSAGES++;
                let msgHdr = next.QueryInterface(Ci.nsIMsgDBHdr);
                const messageIdHeader = msgHdr.getStringProperty('message-id');
                console.debug(`Loading message header for ${msgHdr.messageKey} <${messageIdHeader}>`);

                let skipFlags = Ci.nsMsgMessageFlags.IMAPDeleted |
                                Ci.nsMsgMessageFlags.Expunged;
                if (msgHdr.flags & skipFlags) {
                  continue;
                }

                let messageUri = folder.generateMessageURI(msgHdr.messageKey);

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
                        console.debug(
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
                  console.error(`Error reading message ${messageUri}`,ex);
                });

                const available = streamListener.inputStream.available();
                if (available > 0) {
                  const data = NetUtil.readInputStreamToString(
                    streamListener.inputStream,
                    available
                  );
                  if (hasHeader(data, "x-send-later-at")) {
                    console.debug(`Message has send later headers ${messageUri}`);
                    const hdr = {
                      id: msgHdr.messageKey,
                      uri: messageUri
                    };
                    allMessages.push({ hdr, data });
                  }
                } else {
                  console.debug(`No data available`);
                }
              } else {
                console.warn("Was promised more messages, but did not find them.");
              }
            }
          } else {
            console.error(`Unable to find folder ${accountId}:${path}`);
          }
          console.info(`Processed ${N_MESSAGES} messages in folder ${folderUri}`);
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
            console.debug(`Compacted folder: ${path}`);
            return true;
          } else {
            console.error(`Could not get folder ${path} for compacting.`);
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
                console.debug("notifyStorageLocal.Observer: " + topic);
                Services.obs.removeObserver(Observer, observerTopic);
                Services.obs.notifyObservers(null, notificationTopic, dataStr);
              }
            },
          };
          console.debug("notifyStorageLocal: START - " + notificationTopic);
          if (startup) {
            Services.obs.addObserver(Observer, observerTopic);
          } else {
            Services.obs.notifyObservers(null, notificationTopic, dataStr);
          }
        },

        async injectScript(filename) {
          let doInject = async function(aWindow, aFile) {
            let windowContext = aWindow.document.defaultView;
            try {
              let scriptURI = extension.rootURI.resolve(aFile);
              let script = await ChromeUtils.compileScript(scriptURI);
              script.executeInGlobal(windowContext);
            } catch (ex) {
              console.error("[SendLater]: Unable to inject script.",ex);
            }
          };

          // for (let window of Services.wm.getEnumerator("mail:3pane")) {
          //   //
          //   doInject(window, filename);
          // }

          let listenerName = "injector";
          listenerName += (/([^\/\.]+)\.[^\/]+$/.exec(filename)[1]);
          listenerName += "Listener";
          SendLaterVars.scriptListeners.add(listenerName);

          ExtensionSupport.registerWindowListener(listenerName, {
            chromeURLs: [
              "chrome://messenger/content/messenger.xhtml",
              "chrome://messenger/content/messenger.xul",
            ],
            onLoadWindow(window) {
              console.log(`[SendLater]: onLoadWindow, inject script ${filename}`);
              doInject(window, filename);
            }
          });
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
                    console.error("Unable to find compose window toolbar area");
                  } else if (currentSet.includes(toolbarButtonId)) {
                    console.debug("Toolbar includes Send Later compose action button.");
                  } else {
                    console.info("Adding Send Later toolbar button");
                    currentSet = currentSet.split(",");
                    currentSet.push(toolbarButtonId);
                    toolbar.currentSet = currentSet.join(",");
                    toolbar.setAttribute("currentset",toolbar.currentSet);
                    console.log("Current toolbar action buttons:", currentSet);
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

                  console.debug("Compose window has send later button now.");
                } catch (err) {
                  console.error("Error enabling toolbar button", err);
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
    try {
      ExtensionSupport.unregisterWindowListener("composeListener");
    } catch (err) {
      console.warn(`Could not deregister listener <composeListener>`,err);
    }
    for (let listener of SendLaterVars.scriptListeners) {
      try {
        ExtensionSupport.unregisterWindowListener(listener);
        SendLaterVars.scriptListeners.delete(listener);
      } catch (err) {
        console.warn(`Could not deregister listener <${listener}>`,err);
      }
    }

    // Invalidate the cache to ensure we start clean if extension is reloaded.
    Services.obs.notifyObservers(null, "startupcache-invalidate", null);

    console.log("[SendLater]: Extension removed. Goodbye world.");
  }
};
