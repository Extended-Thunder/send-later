function Sendlater3AskDonate() {
    var url = "https://addons.mozilla.org/thunderbird/addon/send-later-3/contribute/roadblock/?src=send-ask";
    var protocolSvc = Components
	.classes["@mozilla.org/uriloader/external-protocol-service;1"]
        .getService(Components.interfaces.nsIExternalProtocolService);
    var uri = Components.classes["@mozilla.org/network/io-service;1"]
	.getService(Components.interfaces.nsIIOService)
        .newURI(url, null, null);
    protocolSvc.loadURI(uri);
    // -1 == already donated, -2 == stop asking
    SL3U.setIntPref("ask.sent", -1);
    window.close();
}

function Sendlater3AskRemind() {
    // Preferences were already updated when window was popped up.
    window.close();
}

function Sendlater3AskAlready() {
    // -1 == already donated, -2 == stop asking
    SL3U.setIntPref("ask.sent", -1);
    window.close();
}

function Sendlater3AskStop() {
    // -1 == already donated, -2 == stop asking
    SL3U.setIntPref("ask.sent", -2);
    window.close();
}

window.addEventListener("load", SL3U.initUtil, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
