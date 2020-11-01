
var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
var gMessenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

var SendLaterHeaderView = {
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
  getSchedule(hdr) {
    const sendAtStr = hdr.getStringProperty("x-send-later-at");
    const recurStr = hdr.getStringProperty("x-send-later-recur");
    const argsStr = hdr.getStringProperty("x-send-later-args");
    const cancelStr = hdr.getStringProperty("x-send-later-cancel-on-reply");
    if (sendAtStr !== "") {
      const schedule = { sendAt: new Date(sendAtStr) };
      schedule.recur = SLStatic.parseRecurSpec(recurStr);
      schedule.recur.cancelOnReply = cancelStr === "yes" || cancelStr === "true";
      schedule.recur.args = argsStr;
      return schedule;
    } else {
      return null;
    }
  },

  ColumnHandler: {
    getCellText(row, col) {
      const hdr = gDBView.getMsgHdrAt(row);
      const schedule = SendLaterHeaderView.getSchedule(hdr);
      if (schedule !== null) {
        const cellTxt = SLStatic.formatScheduleForUIColumn(schedule);
        return cellTxt;
      } else {
        return "";
      }
    },
    getSortLongForRow(hdr) {
      const sendAtStr = hdr.getStringProperty("x-send-later-at");
      if (sendAtStr) {
        const sendAt = new Date(sendAtStr);
        return sendAt.getTime()|0;
      } else {
        return Number.MAX_SAFE_INTEGER|0;
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
                SLStatic.log(thisaccount.identities);
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
    observe: function (aMsgFolder, aTopic, aData) {
      SLStatic.debug("Entering function","SendLaterHeaderView.columnHandlerObserver.observe");
      if (gDBView) {
        SLStatic.log(`Adding column handler for ${SendLaterHeaderView.columnId}`);
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
      SLStatic.debug("StorageLocalMap:",storageMap);
      SLStatic.debug("Leaving function","SendLaterHeaderView.storageLocalObserver.observe");
    },
  },

  hideShowColumn() {
    SLStatic.debug("Entering function","SendLaterHeaderView.hideShowColumn");
    let col = document.getElementById("sendlater-colXSendLaterAt")
    if (!col) {
      return;
    }
    if (this.isDraftsFolder(gDBView.viewFolder)) {
      if (this.getStorageLocal("showColumn")) {
        SLStatic.debug("Setting SL column visible")
        col.hidden = false;
      } else {
        col.hidden = true;
      }
    } else {
      col.hidden = true;
    }
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
              document.getElementById("sendlater-expanded-Box").headerValue = hdrText;
              isHidden = false;
              SLStatic.debug(
                "headerView.js: onBeforeShowHeaderPane: showing header"
              );
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
    onStartHeaders: () => {},
    onEndHeaders: () => SendLaterHeaderView.onBeforeShowHeaderPane(),
    onBeforeShowHeaderPane: () => SendLaterHeaderView.onBeforeShowHeaderPaneWrapper(),
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
        <splitter class="tree-splitter"/>
        <treecol id="${this.columnId}"
                persist="ordinal width"
                flex="1"
                closemenu="none"
                currentView="unthreaded"
                label="${label}">
        </treecol>
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

  onLoad() {
    SLStatic.debug("Entering function","SendLaterHeaderView.onLoad");
    Services.obs.addObserver(this.storageLocalObserver, this.obsTopicStorageLocal);
    Services.obs.notifyObservers(null, this.obsNotificationReadyTopic);

    this.InitializeOverlayElements();
    gMessageListeners.push(this.headerListener);
    Services.obs.addObserver(this.columnHandlerObserver, "MsgCreateDBView", false);
    document.getElementById("folderTree").addEventListener(
      "select", this.hideShowColumn.bind(this), false);
    AddonManager.addAddonListener(this.AddonListener);
    SLStatic.debug("Leaving function","SendLaterHeaderView.onLoad");
  },

  onUnload() {
    SLStatic.debug("Entering function","SendLaterHeaderView.onUnload");
    if (gDBView) {
      try {
        gDBView.removeColumnHandler(this.columnId);
      } catch (ex) {}
    }
    Services.obs.removeObserver(this.columnHandlerObserver, "MsgCreateDBView");
    Services.obs.removeObserver(this.storageLocalObserver, this.obsTopicStorageLocal);
    AddonManager.removeAddonListener(this.AddonListener);
    const column = document.getElementById(this.columnId);
    if (column) { column.remove(); }
    const headerRow = document.getElementById(this.hdrRowId);
    if (headerRow) { headerRow.remove(); }

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
