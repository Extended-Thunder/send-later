
var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { AddonManager } = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
var gMessenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

function ShowSendLaterOptionsPage() {
  const ext = window.ExtensionParent.GlobalManager.extensionMap.get("sendlater3@kamens.us");
  const runtime = [...ext.views][0].apiCan.findAPIPath("runtime");
  runtime.openOptionsPage();
}

var SendLaterStatusbar = {
  get menuId() {
    return "sendlater3-panel";
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
  get storageLocalMap() {
    return this._storageLocalMap || new Map();
  },
  set storageLocalMap(val) {
    this._storageLocalMap = val;
  },
  getStorageLocal(key) {
    return this.storageLocalMap.get(key);
  },

  storageLocalObserver: {
    observe(subject, topic, data) {
      SLStatic.debug("Entering function","SendLaterStatusbar.storageLocalObserver.observe");
      const storageMap = ((storageLocalData) => {
        let localStorage = new Map();
        Object.entries(storageLocalData).forEach(([key, value]) =>
          localStorage.set(key, value)
          );
        return localStorage;
      })(JSON.parse(data));
      SendLaterStatusbar.storageLocalMap = storageMap;
      SLStatic.logConsoleLevel = (storageMap.get("logConsoleLevel")||"all").toLowerCase();
      SendLaterStatusbar.hideShowStatus();
      SLStatic.debug("Leaving function","SendLaterStatusbar.storageLocalObserver.observe");
    },
  },

  hideShowStatus() {
    SLStatic.debug("Entering function","SendLaterStatusbar.hideShowColumn");
    if (!gDBView) {
      SLStatic.debug(
        `Leaving function SendLaterStatusbar.hideShowColumn.`,
        `(gDBView is ${gDBView})`
      );
      return;
    }

    let statusbutton = document.getElementById("sendlater3-panel")
    if (statusbutton) {
      const visible = this.getStorageLocal("showStatus");
      SLStatic.debug(`Setting status visible: ${visible}`);
      if (visible) {
        statusbutton.removeAttribute("hidden");
      } else {
        statusbutton.setAttribute("hidden", "true");
      }
    }

    SLStatic.debug("Leaving function","SendLaterStatusbar.hideShowColumn");
  },

  InitializeOverlayElements() {
    SLStatic.debug("Entering function","SendLaterStatusbar.InitializeOverlayElements");
    if (document.getElementById(this.columnId)) {
      SLStatic.debug("Leaving function","SendLaterStatusbar.InitializeOverlayElements (column exists)");
      return;
    }

    const menuXUL = MozXULElement.parseXULToFragment(`
      <toolbarbutton id="sendlater3-panel" label="${SLStatic.i18n.getMessage("extensionName")}"
                    insertafter="statusTextBox" insertbefore="unreadMessageCount"
                    oncommand="document.getElementById('sendlater3-context-menu').openPopup(this, 'after_start')"
                    class="sendlater-overlay"/>
      <menupopup id="sendlater3-context-menu" class="sendlater-overlay">
        <menuitem label="${SLStatic.i18n.getMessage("prefwindow.title")}"
          value="${SLStatic.i18n.getMessage("prefwindow.title")}"
          oncommand="ShowSendLaterOptionsPage();"/>
        <menuitem label="${SLStatic.i18n.getMessage("userGuideLabel")}"
          value="${SLStatic.i18n.getMessage("userGuideLabel")}"
          oncommand="Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService).loadURI(Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI('https://extended-thunder.github.io/send-later/', null, null));"/>
        <menuitem label="${SLStatic.i18n.getMessage("releasenotes.value")}"
          value="${SLStatic.i18n.getMessage("releasenotes.value")}"
          oncommand="Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService).loadURI(Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI('https://github.com/Extended-Thunder/send-later/releases', null, null));"/>
        <menuitem label="${SLStatic.i18n.getMessage("contactAuthorLabel")}"
          value="${SLStatic.i18n.getMessage("contactAuthorLabel")}"
          oncommand="Components.classes['@mozilla.org/messengercompose;1'].getService(Components.interfaces.nsIMsgComposeService).OpenComposeWindowWithURI(null, Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI('https://github.com/Extended-Thunder/send-later/discussions/278', null, null));"/>
        <menuitem label="${SLStatic.i18n.getMessage("donatelink.value")}"
          value="${SLStatic.i18n.getMessage("donatelink.value")}"
          oncommand="Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService).loadURI(Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI('https://extended-thunder.github.io/send-later/#support-send-later', null, null));"/>
      </menupopup>`);
    const statusBar = document.getElementById("status-bar");
    statusBar.insertBefore(menuXUL, statusBar.firstChild.nextSibling);

    // Restore persisted attributes: hidden ordinal sortDirection width.
    let attributes = Services.xulStore.getAttributeEnumerator(document.URL, this.menuId);
    for (let attribute of attributes) {
      let value = Services.xulStore.getValue(document.URL, this.menuId, attribute);
      document.getElementById(this.menuId).setAttribute(attribute, value);
    }

    SLStatic.debug("Leaving function","SendLaterStatusbar.InitializeOverlayElements");
  },

  AddonListener: {
    resetSession(addon, who) {
      if (addon.id != SendLaterStatusbar.addonId) {
        return;
      }
      SLStatic.debug("AddonListener.resetSession: who - " + who);
      SendLaterStatusbar.onUnload();
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

    SLStatic.debug("Entering function","SendLaterStatusbar.onLoad");

    Services.obs.addObserver(this.storageLocalObserver, this.obsTopicStorageLocal);
    Services.obs.notifyObservers(null, this.obsNotificationReadyTopic);

    this.InitializeOverlayElements();

    try {
      this.hideShowStatus();
    } catch (ex) { console.warn(ex); }
    AddonManager.addAddonListener(this.AddonListener);
    SLStatic.debug("Leaving function","SendLaterStatusbar.onLoad");
  },

  onUnload() {
    SLStatic.debug("Entering function","SendLaterStatusbar.onUnload");

    try {
      let e = document.getElementById("status-bar");
      e.removeEventListener("select", SendLaterFolderTreeListener, false);
      SLStatic.debug("Removed folderTree listener");
    } catch (ex) {
      SLStatic.warn("Unable to remove folderTree listener",ex);
    }

    try {
      Services.obs.removeObserver(this.storageLocalObserver, this.obsTopicStorageLocal);
    } catch (ex) { SLStatic.warn("Unable to remove storagelocalobserver", ex); }

    try {
      AddonManager.removeAddonListener(this.AddonListener);
    } catch (ex) { SLStatic.warn("Unable to remove addon listener", ex); }

    try {
      const menu = document.getElementById(this.menuId);
      if (menu) { menu.remove(); }
    } catch (ex) { SLStatic.warn("Unable to remove Send Later column elements", ex); }

    SLStatic.debug("Leaving function","SendLaterStatusbar.onUnload");
  }
};

if (window) {
  const checkFori18n = () => {
    if (typeof SLStatic !== "undefined" && SLStatic.i18n !== null) {
      SendLaterStatusbar.onLoad();
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