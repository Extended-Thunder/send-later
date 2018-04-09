function Sendlater3AskDonate() {
    var url = "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jik%40kamens%2eus&lc=US&item_name=Send%20Later%20add%2don%20%28%245%2e00%20recommended%20donation%2c%20but%20give%20what%20you%27d%20like%21%29&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donat";
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

function Sendlater3AskInit() {
    window.removeEventListener("load", Sendlater3AskInit, false);
    SL3U.initUtil();
}

window.addEventListener("load", Sendlater3AskInit, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
