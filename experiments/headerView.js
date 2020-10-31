
var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
var { AppConstants } = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var gMessenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

var Sendlater3HeaderView = function () {
  console.debug("Entering Sendlater3HeaderView");

  const columnId = "sendlater3-colXSendLaterAt";
  const addonId = "sendlater3@kamens.us";
  const obsTopicStorageLocal = `extension:${addonId}:storage-local`;
  const obsNotificationReadyTopic = `extension:${addonId}:ready`;
  let storageLocalMap = new Map();

  const sl3log = {
    Entering(functionName) {
      SLStatic.debug("Entering function:",functionName);
    },
    Leaving(functionName) {
      SLStatic.debug("Leaving function:",functionName);
    },
    Returning(functionName, value) {
      SLStatic.debug(`Returning "${value}" from function: <${functionName}>`);
    }
  };

  function getSchedule(hdr) {
    const sendAtStr = hdr.getStringProperty("x-send-later-at");
    const recurStr = hdr.getStringProperty("x-send-later-recur");
    const argsStr = hdr.getStringProperty("x-send-later-args");
    const cancelStr = hdr.getStringProperty("x-send-later-cancel-on-reply");
    if (sendAtStr !== "") {
      const schedule = { sendAt: new Date(sendAtStr) };
      schedule.cancelOnReply = cancelStr === "yes" || cancelStr === "true";
      schedule.args = argsStr;
      schedule.recur = SLStatic.parseRecurSpec(recurStr);
      return schedule;
    } else {
      return null;
    }
  }

  var sendlater3columnHandler = {
    getCellText(row, col) {
      const hdr = gDBView.getMsgHdrAt(row);
      const schedule = getSchedule(hdr);
      if (schedule !== null) {
        const cellTxt = SLStatic.formatScheduleForUIColumn(schedule);
        return cellTxt;
      } else {
        return "";
      }
    },
    getSortLongForRow(hdr) {
      const schedule = getSchedule(hdr);
      if (schedule !== null) {
        return schedule.sendAt.getTime();
      } else {
        return Number.MAX_SAFE_INTEGER;
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
    getRowProperties(row, props) {},
  };

  function isThisDraft(msgFolder) {
    uri = msgFolder == null ? "null" : msgFolder.URI;
    sl3log.Entering("Sendlater3HeaderView.IsThisDraft", uri);
    if (msgFolder == null) {
      sl3log.Returning(
        "Sendlater3HeaderView.IsThisDraft",
        "false (msgFolder == null)");
      return false;
    }

    let flag = Components.interfaces.nsMsgFolderFlags.Drafts;

    if (msgFolder.isSpecialFolder(flag, false)) {
      sl3log.Returning("Sendlater3HeaderView.IsThisDraft", "true (special)");
      return true;
    }

    let accountManager = Components.classes[
      "@mozilla.org/messenger/account-manager;1"
    ].getService(Components.interfaces.nsIMsgAccountManager);
    let fdrlocal = accountManager.localFoldersServer.rootFolder;

    const findSubFolder = function(folder, name) {
      return folder.findSubFolder(name);
    }

    if (findSubFolder(fdrlocal, "Drafts").URI == msgFolder.URI) {
      sl3log.Returning("Sendlater3HeaderView.IsThisDraft", "true (local)");
      return true;
    }
    if (
      Services.prefs.getCharPref("mail.identity.default.draft_folder") ==
      msgFolder.URI
    ) {
      sl3log.Returning("Sendlater3HeaderView.IsThisDraft", "true (default)");
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
                if (identity.draftFolder == msgFolder.URI) {
                  sl3log.Returning("Sendlater3HeaderView.IsThisDraft","true (identity)");
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

    sl3log.Returning("Sendlater3HeaderView.IsThisDraft", "false (not found)");
    return false;
  }

  var columnHandlerObserver = {
    // Ci.nsIObserver
    observe: function (aMsgFolder, aTopic, aData) {
      sl3log.Entering("Sendlater3HeaderView.columnHandlerObserver.observe");
      if (gDBView) {
        SLStatic.log("Adding column handler for",columnId);
        gDBView.addColumnHandler(columnId, sendlater3columnHandler);
        // window.setTimeout(() => { UpdateColumnElement(); });
      }
      sl3log.Leaving("Sendlater3HeaderView.columnHandlerObserver.observe");
    },
  };

  var storageLocalObserver = {
    observe(subject, topic, data) {
      let getStorageLocalMap = (storageLocalData) => {
        let localStorage = new Map();
        Object.entries(storageLocalData).forEach(([key, value]) =>
        localStorage.set(key, value)
        );
        return localStorage;
      };
      storageLocalMap = getStorageLocalMap(JSON.parse(data));
      console.log("StorageLocalMap:",storageLocalMap);
    },
  };

  function hideShowColumn() {
    sl3log.Entering("Sendlater3HeaderView.hideShowColumn");
    let col = document.getElementById("sendlater3-colXSendLaterAt")
    if (!col) {
      return;
    }
    if (isThisDraft(gDBView.viewFolder)) {
      if (storageLocalMap.get("showColumn")) {
        SLStatic.debug("Setting SL column visible")
        col.hidden = false;
      } else {
        col.hidden = true;
      }
    } else {
      col.hidden = true;
    }
    sl3log.Leaving("Sendlater3HeaderView.hideShowColumn");
  }

  function onBeforeShowHeaderPane() {
    sl3log.Entering("Sendlater3HeaderView.onBeforeShowHeaderPane");
    let isHidden = true;
    if (storageLocalMap.get("showHeader")) {
      SLStatic.debug("headerView.js: onBeforeShowHeaderPane: showheader is true");
      if (isThisDraft(gDBView.viewFolder)) {
        let msghdr;
        try {
          msghdr = gDBView.hdrForFirstSelectedMessage;
        } catch (e) {
          msghdr = null;
        }
        if (msghdr != null) {
          let schedule = getSchedule(msghdr);
          if (schedule !== null) {
            try {
              var hdrText = SLStatic.formatScheduleForUIColumn(schedule);
              document.getElementById("sendlater3-expanded-Box").headerValue = hdrText;
              isHidden = false;
              SLStatic.debug(
                "headerView.js: onBeforeShowHeaderPane: showing header"
              );
            } catch (e) {
              SLStatic.debug(e);
              if (onBeforeShowHeaderPane.warning) {
                SLStatic.warn(onBeforeShowHeaderPane.warning);
                onBeforeShowHeaderPane.warning = null;
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
      document.getElementById("sendlater3-expanded-Row").hidden = isHidden;
    } catch (e) {
      if (onBeforeShowHeaderPane.warning) {
        SLStatic.warn(onBeforeShowHeaderPane.warning);
        onBeforeShowHeaderPane.warning = null;
      }
    }
    sl3log.Leaving("Sendlater3HeaderView.sendlater3_HeaderDisplay.onBeforeShowHeaderPane");
  }

  onBeforeShowHeaderPane.warning =
    "headerView.js: onBeforeShowHeaderPane: Error accessing header row; " +
    "are you using an add-on like Mnenhy that changes how message " +
    "headers are displayed? Further warnings will be suppressed.";

  function onBeforeShowHeaderPaneWrapper() {
    SLStatic.debug(
      "headerView.js: onBeforeShowHeaderPaneWrapper: Discarding " +
        "onEndHeaders and replacing onBeforeShowHeaderPane");
    headerListener.onEndHeaders = function () {};
    headerListener.onBeforeShowHeaderPane = onBeforeShowHeaderPane;
    onBeforeShowHeaderPane();
  }

  var headerListener = {
    onStartHeaders: function () {},
    onEndHeaders: onBeforeShowHeaderPane,
    onBeforeShowHeaderPane: onBeforeShowHeaderPaneWrapper,
  };

  function InitializeOverlayElements() {
    sl3log.Entering("Sendlater3HeaderView.InitializeOverlayElements");
    while (document.getElementById(columnId)) {
      SLStatic.log("removing existing column");
      document.getElementById(columnId).remove();
    }
    if (GetThreadTree().columns[columnId]) {
      sl3log.Leaving("Sendlater3HeaderView.InitializeOverlayElements (column exists)");
      return;
    }

    let label = SLStatic.i18n.getMessage("sendlater3header.label");

    // const subjectCol = document.getElementById("subjectCol");
    // let siblingElement = subjectCol.nextElementSibling.nextElementSibling;
    const threadCols = document.getElementById("threadCols");
    threadCols.insertBefore(
      MozXULElement.parseXULToFragment(`
      <splitter class="tree-splitter"/>
      <treecol id="${columnId}"
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
      document.URL, columnId);
    for (let attribute of attributes) {
      let value = Services.xulStore.getValue(
        document.URL, columnId, attribute);
      document.getElementById(columnId).setAttribute(attribute, value);
    }

    let newRowNode = document.getElementById("sendlater3-expanded-Row");
    if (!newRowNode) {
      newRowNode = document.createElementNS("http://www.w3.org/1999/xhtml", "tr");
      newRowNode.setAttribute("id", "sendlater3-expanded-Row");
      let newLabelNode = document.createXULElement("label");
      newLabelNode.setAttribute("id", "sendlater3-expanded-Label");
      newLabelNode.setAttribute("value", label);
      newLabelNode.setAttribute("class", "headerName");
      newLabelNode.setAttribute("control", "sendlater3-expanded-Box");
      let newTHNode = document.createElementNS("http://www.w3.org/1999/xhtml", "th");
      newTHNode.appendChild(newLabelNode);
      newRowNode.appendChild(newTHNode);

      // Create and append the new header value.
      let newHeaderNode = document.createXULElement("mail-headerfield");
      newHeaderNode.setAttribute("id", "sendlater3-expanded-Box");
      newHeaderNode.setAttribute("flex", "1");
      let newTDNode = document.createElementNS("http://www.w3.org/1999/xhtml", "td");
      newTDNode.appendChild(newHeaderNode);

      newRowNode.appendChild(newTDNode);

      // This new element needs to be inserted into the view...
      let topViewNode = document.getElementById("expandedHeaders2");
      topViewNode.appendChild(newRowNode);
    }

    sl3log.Leaving("Sendlater3HeaderView.InitializeOverlayElements");
  }

  /*
   * Listener for addon status changes.
   */
  var AddonListener = {
    resetSession(addon, who) {
      if (addon.id != addonId) {
        return;
      }
      SLStatic.debug("AddonListener.resetSession: who - " + who);
      onUnload();
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
  }

  function onLoad() {
    sl3log.Entering("Sendlater3HeaderView.onLoad");
    InitializeOverlayElements();
    gMessageListeners.push(headerListener);
    Services.obs.addObserver(columnHandlerObserver, "MsgCreateDBView", false);
    document.getElementById("folderTree").addEventListener(
      "select", hideShowColumn, false);
    AddonManager.addAddonListener(AddonListener);
    sl3log.Leaving("Sendlater3HeaderView.onLoad");
  }

  function onUnload() {
    sl3log.Entering("Sendlater3HeaderView.onUnload");
    if (gDBView) {
      try {
        gDBView.removeColumnHandler(columnId);
      } catch (ex) {}
    }
    Services.obs.removeObserver(columnHandlerObserver, "MsgCreateDBView");
    Services.obs.removeObserver(storageLocalObserver, obsTopicStorageLocal);
    AddonManager.removeAddonListener(AddonListener);
    const column = document.getElementById(columnId);
    if (column) { column.remove(); }

    sl3log.Leaving("Sendlater3HeaderView.onUnload");
  }

  const doCheck = () => {
    if (typeof SLStatic !== "undefined" && SLStatic.i18n !== null) {
      onLoad();
    } else {
      setTimeout(doCheck, 100);
    }
  }

  Services.obs.addObserver(storageLocalObserver, obsTopicStorageLocal);
  Services.obs.notifyObservers(null, obsNotificationReadyTopic);
  doCheck();
};

Sendlater3HeaderView();
