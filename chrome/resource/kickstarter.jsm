const { utils: Cu, classes: Cc, interfaces: Ci } = Components;
const {Services} = ChromeUtils.import('resource://gre/modules/Services.jsm');
var EXPORTED_SYMBOLS = ["KickstarterPopup"];

var popUpWindow;

// window: window we're being called from
// popUpUrl: URL of the chrome file containing the pop-up XUL
// campaignUrl: URL of the Kickstarter campaign

function KickstarterPopup(window, popUpUrl, campaignUrl) {
    var prefBranch = Services.prefs.getBranch(
        // Using the same preferences branch for all of my add-ons so people
        // who use more than one of my add-ons don't see the pitch more than
        // once.
        "extensions.jik-kickstarter-campaign.");

    // If someone uses more than one of my add-ons and they upgrade them at the
    // same time then I don't want them to see the pitch multiple times, so use
    // some simple locking logic to prevent that.
    prefBranch.setStringPref("popUpUrl", popUpUrl);
    try {
        if (prefBranch.getStringPref("popUpUrl") != popUpUrl) {
            console.log("Skipping Kickstarter pop-up because somebody else " +
                        "is doing it at the same time");
            return;
        }
    } catch {
        console.log("Skipping Kickstarter pop-up because we failed to fetch " +
                    "popUpUrl preference immediately after setting it");
        return;
    }

    var now = unixTimestamp();

    try {
        if (now - prefBranch.getIntPref("popUpTimestamp") < 60) {
            console.log("Skipping Kickstarter pop-up because it was " +
                        "popped up less than a minute ago.");
            return;
        }
    } catch {}
    prefBranch.setIntPref("popUpTimestamp", now);

    try {
        if (prefBranch.getBoolPref("pledged")) {
            console.log("Skipping Kickstarter pop-up because already pledged");
            return;
        }
    } catch {}

    try {
        var postponed = prefBranch.getIntPref("postponed");
        var now = unixTimestamp();
        if (now - postponed < 7 * 24 * 60 * 60) {
            console.log("Skipping Kickstarter cleanup because it's less " +
                        "than a week since we were asked to remind later");
            return;
        }
        prefBranch.clearUserPref("postponed");
    } catch {}

    var args = {
        campaignUrl: campaignUrl,
        prefBranch: prefBranch,
    };
    popUpWindow = window.openDialog(popUpUrl, "KickstarterWindow", "", args);
    popUpWindow.addEventListener("load", onLoad);
}

function onLoad(event) {
    var window = popUpWindow;
    var document = window.document;
    document.getElementById("pledge-button").addEventListener(
        "click", onPledge, true);
    document.getElementById("remind-button").addEventListener(
        "click", onRemind, true);
    document.getElementById("already-button").addEventListener(
        "click", onAlready, true);
}

function onPledge() {
    var args = popUpWindow.arguments[0];
    var campaignUrl = args.campaignUrl;
    var uri = Cc["@mozilla.org/network/io-service;1"]
        .getService(Ci.nsIIOService)
        .newURI(campaignUrl, null, null);
    var protocolService =
        Cc["@mozilla.org/uriloader/external-protocol-service;1"]
        .getService(Ci.nsIExternalProtocolService);
    protocolService.loadURI(uri);
    var prefBranch = args.prefBranch;
    prefBranch.setBoolPref("pledged", true);
    prefBranch.clearUserPref("popUpUrl");
    popUpWindow.close();
}

function onRemind() {
    var now = unixTimestamp();
    var args = popUpWindow.arguments[0];
    var prefBranch = args.prefBranch;
    prefBranch.setIntPref("postponed", now);
    prefBranch.clearUserPref("popUpUrl");
    popUpWindow.close();
}

function onAlready() {
    var args = popUpWindow.arguments[0];
    var prefBranch = args.prefBranch;
    prefBranch.setBoolPref("pledged", true);
    prefBranch.clearUserPref("popUpUrl");
    popUpWindow.close();
}

function unixTimestamp() {
    return Math.round((new Date()).getTime() / 1000);
}
