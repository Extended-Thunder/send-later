
var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
var gMessenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

var SendLaterHeaderView = null;
var SendLaterFolderTreeListener = null;

function SetSendLaterColumnVisible(visible, isdoublecheck) {
  if (isdoublecheck) {
    SLStatic.debug(`Double checking column visibility (${visible})`);
  }

  let col = document.getElementById("sendlater-colXSendLaterAt")
  if (!col || !gDBView) {
    return;
  }
  SLStatic.debug(`Setting SL column visible: ${visible}`);
  if (visible) {
    col.removeAttribute("hidden");
  } else {
    col.setAttribute("hidden", "true");
  }

  if (!isdoublecheck) {
    setTimeout(() => SetSendLaterColumnVisible(visible, true), 500);
  }
}

SendLaterHeaderView = {
  get columnId() {
    return "sendlater-colXSendLaterAt";
  },
  get hdrRowId() {
    return "sendlater-expanded-Row";
  },
  get addonId() {
    return "sendlater3@kamens.us";
  },
  get obsTopicStorageLocal() {
    return `extension:${this.addonId}:storage-local`;
  },
  get obsNotificationReadyTopic() {
    return `extension:${this.addonId}:ready`;
  },
  _onBeforeShowHeaderPaneWarning: "headerView.js: onBeforeShowHeaderPane: Error accessing header row; " +
    "are you using an add-on like Mnenhy that changes how message " +
    "headers are displayed? Further warnings will be suppressed.",
  get onBeforeShowHeaderPaneWarning() {
    return this._onBeforeShowHeaderPaneWarning;
  },
  set onBeforeShowHeaderPaneWarning(value) {
    this._onBeforeShowHeaderPaneWarning = value;
  },
  get storageLocalMap() {
    return this._storageLocalMap || new Map();
  },
  set storageLocalMap(val) {
    this._storageLocalMap = val;
  },
  getStorageLocal(key) {
    return this.storageLocalMap.get(key);
  },
  setStorageLocal(key, val) {
    this.storageLocalMap.set(key, val);
  },
  async getRawMessage(hdr) {
    let folder = hdr.folder.QueryInterface(Ci.nsIMsgFolder);
    let messageUri = folder.generateMessageURI(hdr.messageKey);
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
            SLStatic.debug(
              `SendLaterHeaderView.getRawMessage.streamListener.OnStopRunning ` +
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
      SLStatic.error(`Error reading message ${messageUri}`,ex);
    });

    const available = streamListener.inputStream.available();
    if (available > 0) {
      const rawMessage = NetUtil.readInputStreamToString(
        streamListener.inputStream,
        available
      );
      return rawMessage;
    } else {
      SLStatic.debug(`No data available for message ${messageUri}`);
      return null;
    }
  },
  checkValidSchedule(hdr) {
    const instanceUUID = this.getStorageLocal("instanceUUID");
    const msgId = hdr.getStringProperty('message-id');
    const CTPropertyName = `content-type-${msgId}`;
    const msgContentType = this.getStorageLocal(CTPropertyName);
    const sendAtStr = hdr.getStringProperty("x-send-later-at");
    const msgUuid = hdr.getStringProperty("x-send-later-uuid");
    if (!sendAtStr) {
      return { valid: false, detail: "Not scheduled" };
    } else if (!msgContentType) {
      return { valid: false, detail: "Missing ContentType" };
    } else if (/encrypted/i.test(msgContentType)) {
      return { valid: false, detail: "Encrypted", msg: "Error: encrypted" };
    } else if (msgUuid !== instanceUUID) {
      return { valid: false, detail: "Wrong UUID", msg: `${msgUuid} != ${instanceUUID}` };
    }
    return { valid: true };
  },
  getSchedule(hdr) {
    const sendAtStr = hdr.getStringProperty("x-send-later-at");
    const recurStr = hdr.getStringProperty("x-send-later-recur");
    const argsStr = hdr.getStringProperty("x-send-later-args");
    const cancelStr = hdr.getStringProperty("x-send-later-cancel-on-reply");

    const schedule = { sendAt: new Date(sendAtStr) };
    schedule.recur = SLStatic.parseRecurSpec(recurStr);
    schedule.recur.cancelOnReply = cancelStr === "yes" || cancelStr === "true";
    schedule.recur.args = argsStr;

    return schedule;
  },

  ColumnHandler: {
    getCellText(row, col) {
      const hdr = gDBView.getMsgHdrAt(row);
      const status = SendLaterHeaderView.checkValidSchedule(hdr);

      if (status.detail === "Missing ContentType") {
        // The content-type header is not included in the MsgHdr object, so
        // we need to actually read the whole message, and find it manually.
        SendLaterHeaderView.getRawMessage(hdr).then((rawMessage) => {
          const msgId = hdr.getStringProperty('message-id');
          const CTPropertyName = `content-type-${msgId}`;
          const msgContentType = SLStatic.getHeader(rawMessage, "content-type");
          SendLaterHeaderView.setStorageLocal(CTPropertyName, msgContentType);
          gDBView.NoteChange(row, 1, 2);
        });
      }

      if (status.valid === true || status.detail === "Missing ContentType") {
        const schedule = SendLaterHeaderView.getSchedule(hdr);
        const cellTxt = SLStatic.formatScheduleForUIColumn(schedule);
        return cellTxt;
      } else {
        return status.msg||"";
      }
    },
    getSortLongForRow(hdr) {
      const status = SendLaterHeaderView.checkValidSchedule(hdr);
      if (status.valid === true) {
        const sendAtStr = hdr.getStringProperty("x-send-later-at");
        const sendAt = new Date(sendAtStr);
        // Numbers will be truncated. Be sure this fits in 32 bits
        return (sendAt.getTime()/1000)|0;
      } else if (status.detail === "Missing ContentType") {
        return (Math.pow(2,31)-3)|0;
      } else if (status.detail === "Encrypted") {
        return (Math.pow(2,31)-2)|0;
      } else { // Not scheduled or wrong UUID
        return (Math.pow(2,31)-1)|0;
      }
    },
    getSortStringForRow(hdr) {
      return null;
    },
    isString() {
      return false;
    },
    isEditable(row, col) {
      return false;
    },
    cycleCell(row, col) {},
    getImageSrc(row, col) {
      return null;
    },
    getCellProperties(row, col, props) {},
    getRowProperties(row, props) {}
  },

  isDraftsFolder(msgFolder) {
    const uri = (msgFolder === null) ? "null" : msgFolder.URI;
    SLStatic.debug("Entering function","SendLaterHeaderView.isDraftsFolder", uri);
    if (msgFolder === null) {
      SLStatic.debug("Returning from function",
        "SendLaterHeaderView.isDraftsFolder",
        "false (msgFolder == null)");
      return false;
    }

    let flag = Components.interfaces.nsMsgFolderFlags.Drafts;

    if (msgFolder.isSpecialFolder(flag, false)) {
      SLStatic.debug("Returning from function","SendLaterHeaderView.isDraftsFolder", "true (special)");
      return true;
    }

    let accountManager = Components.classes[
      "@mozilla.org/messenger/account-manager;1"
    ].getService(Components.interfaces.nsIMsgAccountManager);
    let fdrlocal = accountManager.localFoldersServer.rootFolder;

    const findSubFolder = function(folder, name) {
      return folder.findSubFolder(name);
    }

    if (findSubFolder(fdrlocal, "Drafts").URI === msgFolder.URI) {
      SLStatic.debug("Returning from function","SendLaterHeaderView.isDraftsFolder", "true (local)");
      return true;
    }
    if (
      Services.prefs.getCharPref("mail.identity.default.draft_folder") ===
      msgFolder.URI
    ) {
      SLStatic.debug("Returning from function","SendLaterHeaderView.isDraftsFolder", "true (default)");
      return true;
    }

    let allaccounts = accountManager.accounts;
    let acindex, numAccounts;
    numAccounts = allaccounts.length;
    for (acindex = 0; acindex < numAccounts; acindex++) {
      let thisaccount = allaccounts[acindex].QueryInterface(Ci.nsIMsgAccount);
      if (thisaccount) {
        let numIdentities = thisaccount.identities.length;
        switch (thisaccount.incomingServer.type) {
          case "pop3":
          case "imap":
          case "owl":
            let identityNum;
            for (identityNum = 0; identityNum < numIdentities; identityNum++) {
              try {
                let identity = thisaccount.identities[identityNum].QueryInterface(
                  Ci.nsIMsgIdentity
                );
                if (identity.draftFolder === msgFolder.URI) {
                  SLStatic.debug("Returning from function","SendLaterHeaderView.isDraftsFolder","true (identity)");
                  return true;
                }
              } catch (e) {
                SLStatic.warn("Error getting identity:", e);
              }
            }
            break;
          default:
            SLStatic.debug("skipping this server type - " + thisaccount);
            break;
        }
      }
    }

    SLStatic.debug("Returning from function","SendLaterHeaderView.isDraftsFolder", "false (not found)");
    return false;
  },

  columnHandlerObserver: {
    // Ci.nsIObserver
    observe(aMsgFolder, aTopic, aData) {
      SLStatic.debug("Entering function","SendLaterHeaderView.columnHandlerObserver.observe");
      if (gDBView) {
        SLStatic.debug(`Adding column handler for ${SendLaterHeaderView.columnId}`);
        gDBView.addColumnHandler(SendLaterHeaderView.columnId,
          SendLaterHeaderView.ColumnHandler);
      }
      SLStatic.debug("Leaving function","SendLaterHeaderView.columnHandlerObserver.observe");
    },
  },

  storageLocalObserver: {
    observe(subject, topic, data) {
      SLStatic.debug("Entering function","SendLaterHeaderView.storageLocalObserver.observe");
      const storageMap = ((storageLocalData) => {
        let localStorage = new Map();
        Object.entries(storageLocalData).forEach(([key, value]) =>
          localStorage.set(key, value)
          );
        return localStorage;
      })(JSON.parse(data));
      SendLaterHeaderView.storageLocalMap = storageMap;
      SLStatic.logConsoleLevel = (storageMap.get("logConsoleLevel")||"all").toLowerCase();
      SLStatic.debug("Leaving function","SendLaterHeaderView.storageLocalObserver.observe");
    },
  },

  hideShowColumn() {
    SLStatic.debug("Entering function","SendLaterHeaderView.hideShowColumn");
    if (!gDBView) {
      SLStatic.debug(`Leaving function SendLaterHeaderView.hideShowColumn. ` +
        `(gDBView is ${gDBView})`);
      return;
    }
    const visible =
      this.getStorageLocal("showColumn") &&
      this.isDraftsFolder(gDBView.viewFolder);

    SetSendLaterColumnVisible(visible, false);

    SLStatic.debug("Leaving function","SendLaterHeaderView.hideShowColumn");
  },

  onBeforeShowHeaderPane() {
    SLStatic.debug("Entering function","SendLaterHeaderView.onBeforeShowHeaderPane");
    let isHidden = true;
    if (SendLaterHeaderView.getStorageLocal("showHeader")) {
      SLStatic.debug("headerView.js: onBeforeShowHeaderPane: showheader is true");
      if (SendLaterHeaderView.isDraftsFolder(gDBView.viewFolder)) {
        let msghdr;
        try {
          msghdr = gDBView.hdrForFirstSelectedMessage;
        } catch (e) {
          msghdr = null;
        }
        if (msghdr != null) {
          let schedule = SendLaterHeaderView.getSchedule(msghdr);
          if (schedule !== null) {
            try {
              let hdrText = SLStatic.formatScheduleForUIColumn(schedule);
              const headerBoxElement = document.getElementById("sendlater-expanded-Box");
              if (headerBoxElement) {
                headerBoxElement.headerValue = hdrText;
                isHidden = false;
                SLStatic.debug(
                  "headerView.js: onBeforeShowHeaderPane: showing header"
                );
              } else {
                SLStatic.warn(`Unable to find sendlater-expanded-box element`);
              }

            } catch (e) {
              SLStatic.debug(e);
              if (SendLaterHeaderView.onBeforeShowHeaderPaneWarning) {
                SLStatic.warn(SendLaterHeaderView.onBeforeShowHeaderPaneWarning);
                SendLaterHeaderView.onBeforeShowHeaderPaneWarning = null;
              }
            }
          } else {
            SLStatic.debug("headerView.js: onBeforeShowHeaderPane: hiding header (empty)");
          }
        } else {
          SLStatic.debug("headerView.js: onBeforeShowHeaderPane: hiding header (null msghdr)");
        }
      } else {
        SLStatic.debug("headerView.js: onBeforeShowHeaderPane: hiding header (not draft)");
      }
    } else {
      SLStatic.debug("headerView.js: onBeforeShowHeaderPane: showheader is false");
    }
    try {
      document.getElementById(SendLaterHeaderView.hdrRowId).hidden = isHidden;
    } catch (e) {
      if (SendLaterHeaderView.onBeforeShowHeaderPaneWarning) {
        SLStatic.warn(SendLaterHeaderView.onBeforeShowHeaderPaneWarning);
        SendLaterHeaderView.onBeforeShowHeaderPaneWarning = null;
      }
    }
    SLStatic.debug("Leaving function","SendLaterHeaderView.sendlater_HeaderDisplay.onBeforeShowHeaderPane");
  },

  onBeforeShowHeaderPaneWrapper() {
    SLStatic.debug(
      "headerView.js: onBeforeShowHeaderPaneWrapper: Discarding " +
        "onEndHeaders and replacing onBeforeShowHeaderPane");
    this.headerListener.onEndHeaders = function () {};
    this.headerListener.onBeforeShowHeaderPane = this.onBeforeShowHeaderPane;
    this.onBeforeShowHeaderPane();
  },

  headerListener: {
    onStartHeaders() {},
    onEndHeaders() {
      SendLaterHeaderView.onBeforeShowHeaderPane()
    },
    onBeforeShowHeaderPane() {
      SendLaterHeaderView.onBeforeShowHeaderPaneWrapper()
    },
  },

  InitializeOverlayElements() {
    SLStatic.debug("Entering function","SendLaterHeaderView.InitializeOverlayElements");
    if (document.getElementById(this.columnId)) {
      SLStatic.debug("Leaving function","SendLaterHeaderView.InitializeOverlayElements (column exists)");
      return;
    }

    let label = SLStatic.i18n.getMessage("sendlater3header.label");

    // const subjectCol = document.getElementById("subjectCol");
    // let siblingElement = subjectCol.nextElementSibling.nextElementSibling;
    const threadCols = document.getElementById("threadCols");
    threadCols.insertBefore(
      MozXULElement.parseXULToFragment(`
        <treecol id="${this.columnId}"
                persist="ordinal width"
                flex="1"
                closemenu="none"
                currentView="unthreaded"
                label="${label}"
                class="sendlater-overlay">
        </treecol>
        <splitter class="tree-splitter sendlater-overlay"/>
        `),
      threadCols.firstChild
    );

    // Restore persisted attributes: hidden ordinal sortDirection width.
    let attributes = Services.xulStore.getAttributeEnumerator(
      document.URL, this.columnId);
    for (let attribute of attributes) {
      let value = Services.xulStore.getValue(
        document.URL, this.columnId, attribute);
      document.getElementById(this.columnId).setAttribute(attribute, value);
    }

    let newRowNode = document.getElementById(this.hdrRowId);
    if (!newRowNode) {
      newRowNode = document.createElementNS("http://www.w3.org/1999/xhtml", "tr");
      newRowNode.setAttribute("id", this.hdrRowId);
      let newLabelNode = document.createXULElement("label");
      newLabelNode.setAttribute("id", "sendlater-expanded-Label");
      newLabelNode.setAttribute("value", label);
      newLabelNode.setAttribute("class", "headerName");
      newLabelNode.setAttribute("control", "sendlater-expanded-Box");
      let newTHNode = document.createElementNS("http://www.w3.org/1999/xhtml", "th");
      newTHNode.appendChild(newLabelNode);
      newRowNode.appendChild(newTHNode);

      // Create and append the new header value.
      let newHeaderNode = document.createXULElement("mail-headerfield");
      newHeaderNode.setAttribute("id", "sendlater-expanded-Box");
      newHeaderNode.setAttribute("flex", "1");
      let newTDNode = document.createElementNS("http://www.w3.org/1999/xhtml", "td");
      newTDNode.appendChild(newHeaderNode);

      newRowNode.appendChild(newTDNode);

      // This new element needs to be inserted into the view...
      let topViewNode = document.getElementById("expandedHeaders2");
      topViewNode.appendChild(newRowNode);
    }

    SLStatic.debug("Leaving function","SendLaterHeaderView.InitializeOverlayElements");
  },

  AddonListener: {
    resetSession(addon, who) {
      if (addon.id != SendLaterHeaderView.addonId) {
        return;
      }
      SLStatic.debug("AddonListener.resetSession: who - " + who);
      SendLaterHeaderView.onUnload();
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
  },

  async onLoad() {
    try {
      const ext = window.ExtensionParent.GlobalManager.extensionMap.get("sendlater3@kamens.us");
      const localStorage = [...ext.views][0].apiCan.findAPIPath("storage.local");
      const { preferences } = await localStorage.callMethodInParentProcess("get", [{ "preferences": {} }]);

      let storageMap = new Map();
      Object.entries(preferences).forEach(([key, value]) => {
        storageMap.set(key, value);
      });
      this.storageLocalMap = storageMap;
      SLStatic.logConsoleLevel =
        (preferences.logConsoleLevel||"all").toLowerCase();
    } catch (err) { SLStatic.error("Could not fetch preferences", err); }

    SLStatic.debug("Entering function","SendLaterHeaderView.onLoad");

    Services.obs.addObserver(this.storageLocalObserver, this.obsTopicStorageLocal);
    Services.obs.notifyObservers(null, this.obsNotificationReadyTopic);

    this.InitializeOverlayElements();
    gMessageListeners.push(this.headerListener);
    Services.obs.addObserver(this.columnHandlerObserver, "MsgCreateDBView", false);
    SendLaterFolderTreeListener = this.hideShowColumn.bind(this);
    let e = document.getElementById("folderTree")
    e.addEventListener("select", SendLaterFolderTreeListener, false);
    // onLoad may have run when a folder is already being displayed.
    try {
      this.hideShowColumn();
      this.columnHandlerObserver.observe();
    } catch (ex) { /* or maybe not */ console.warn(ex); }
    AddonManager.addAddonListener(this.AddonListener);
    SLStatic.debug("Leaving function","SendLaterHeaderView.onLoad");
  },

  onUnload() {
    SLStatic.debug("Entering function","SendLaterHeaderView.onUnload");
    if (gDBView) {
      try {
        gDBView.removeColumnHandler(this.columnId);
      } catch (ex) {
        SLStatic.warn("Unable to remove Send Later column handler", ex);
      }
    }

    try {
      let e = document.getElementById("folderTree");
      e.removeEventListener("select", SendLaterFolderTreeListener, false);
      SLStatic.debug("Removed folderTree listener");
    } catch (ex) {
      SLStatic.warn("Unable to remove folderTree listener",ex);
    }

    try {
      Services.obs.removeObserver(this.columnHandlerObserver, "MsgCreateDBView");
    } catch (ex) { SLStatic.warn("Unable to remove msgcreatedbview observer", ex); }

    try {
      Services.obs.removeObserver(this.storageLocalObserver, this.obsTopicStorageLocal);
    } catch (ex) { SLStatic.warn("Unable to remove storagelocalobserver", ex); }

    try {
      AddonManager.removeAddonListener(this.AddonListener);
    } catch (ex) { SLStatic.warn("Unable to remove addon listener", ex); }

    try {
      const column = document.getElementById(this.columnId);
      if (column) { column.remove(); }
      const headerRow = document.getElementById(this.hdrRowId);
      if (headerRow) { headerRow.remove(); }
    } catch (ex) { SLStatic.warn("Unable to remove Send Later column elements", ex); }

    SLStatic.debug("Leaving function","SendLaterHeaderView.onUnload");
  }
};

if (window) {
  const checkFori18n = () => {
    if (typeof SLStatic !== "undefined" && SLStatic.i18n !== null) {
      SendLaterHeaderView.onLoad();
    } else {
      window.setTimeout(checkFori18n, 100);
    }
  };

  if (window.document.readyState == "complete") {
    checkFori18n();
  } else {
    window.addEventListener("load", checkFori18n, { once: true });
  }
}
