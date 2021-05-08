var SendLaterStatusBar = {
  setVisible(visible) {
    console.debug(`[SendLater] Statusbar menu: ${visible ? 'visible' : 'hidden'}`);
    let statusbutton = document.getElementById("sendlater3-panel");
    if (statusbutton) {
      if (visible)
        statusbutton.removeAttribute("hidden");
      else
        statusbutton.setAttribute("hidden", "true");
    }
  },

  setMessage(message) {
    let statusbutton = document.getElementById("sendlater3-panel");
    if (statusbutton)
      statusbutton.setAttribute("label", message);
  },

  onLoad() {
    window.openSendLaterOptionsPage = WL.messenger.runtime.openOptionsPage;

    const xulString = `
      <toolbarbutton id="sendlater3-panel" class="sendlater-overlay" hidden="true"
                    label="${WL.extension.localeData.localizeMessage("extensionName")}"
                    oncommand="document.getElementById('sendlater3-context-menu').openPopup(this, 'after_start')"
                    insertafter="statusTextBox" insertbefore="unreadMessageCount" />
      <menupopup id="sendlater3-context-menu" class="sendlater-overlay">
        <menuitem label="${WL.extension.localeData.localizeMessage("prefwindow.title")}"
          value="${WL.extension.localeData.localizeMessage("prefwindow.title")}"
          oncommand="openSendLaterOptionsPage();"/>
        <menuitem label="${WL.extension.localeData.localizeMessage("userGuideLabel")}"
          value="${WL.extension.localeData.localizeMessage("userGuideLabel")}"
          oncommand="Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService).loadURI(Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI('https://extended-thunder.github.io/send-later/', null, null));"/>
        <menuitem label="${WL.extension.localeData.localizeMessage("releasenotes.value")}"
          value="${WL.extension.localeData.localizeMessage("releasenotes.value")}"
          oncommand="Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService).loadURI(Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI('https://github.com/Extended-Thunder/send-later/releases', null, null));"/>
        <menuitem label="${WL.extension.localeData.localizeMessage("contactAuthorLabel")}"
          value="${WL.extension.localeData.localizeMessage("contactAuthorLabel")}"
          oncommand="Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService).loadURI(Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI('https://github.com/Extended-Thunder/send-later/discussions/278', null, null));"/>
        <menuitem label="${WL.extension.localeData.localizeMessage("donatelink.value")}"
          value="${WL.extension.localeData.localizeMessage("donatelink.value")}"
          oncommand="Components.classes['@mozilla.org/uriloader/external-protocol-service;1'].getService(Components.interfaces.nsIExternalProtocolService).loadURI(Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI('https://extended-thunder.github.io/send-later/#support-send-later', null, null));"/>
      </menupopup>`;

    WL.injectElements(xulString, []);

    notifyTools.registerListener(data => {
      switch (data.command) {
        case "showHideStatusbar":
          SendLaterStatusBar.setVisible(data.value === true);
          break;
        case "setStatusMessage":
          SendLaterStatusBar.setMessage(data.value);
          break;
      }
    });
  },

  async onAfterLoad() {
    notifyTools.notifyBackground({ command: "refreshStatus" });
  },

  onUnload() { }
}