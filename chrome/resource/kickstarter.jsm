const { utils: Cu, classes: Cc, interfaces: Ci } = Components;
const {Services} = Components.utils.import(
    'resource://gre/modules/Services.jsm');
var EXPORTED_SYMBOLS = ["KickstarterPopup"];

var campaignUrl = "https://www.kickstarter.com/projects/jik/" +
    "rewritten-add-ons-for-mozilla-thunderbirds-next-release";
var popUpDelay = 10000;
var prefRoot = "extensions.jik-kickstarter-campaign.";

var mainWindow;
var popUpWindow;
var popUpUrl;
var popUpKey;
var prefBranch;

// window: window we're being called from
// url: URL of the chrome file containing the pop-up XUL

function KickstarterPopup(window, url) {
    mainWindow = window;
    popUpUrl = url;
    KickstarterQueuePopup();
}

// The user might have more than one of my add-ons installed, and if
// so, then I want to eventually alert about all of them, until the
// user pledges.
//
// When Thunderbird starts up all of them are going to try to launch
// the popup at once, so we need to mediate that somehow. Here's how
// it works.
//
// In our preferences we keep track of which add-ons' popups have
// already been displayed and when, and of which add-ons' popups have
// been requested, and when.
//
// When one of the add-ons tries to launch the pop-up, it adds itself
// to the queue of requested popups, along with a timestamp and a
// random number which will be used later to determine which popup
// gets to drive the process in a few seconds. It then sets a timeout
// to finish in ten seconds.
//
// Ten seconds later it loads all of the requested popups that have
// been requested in the last 20 seconds and sorts them by the random
// number. If it's the first requested popup in the list, then it
// proceeds; otherwise it exits without doing anything because it's
// not driving.
//
// The add-on that's driving goes through the list of requested popups
// and finds one that isn't in the list of those that have already
// been displayed. If all of them are, then it clears the displayed
// list and arbitrarily picks one to display.
//
// It adds the popup that is about to be displayed to the list of
// those that have and then, finally, calls the actual function that
// displays the popup.

function KickstarterQueuePopup() {
    // Using the same preferences branch for all of my add-ons so
    // people who use more than one of my add-ons don't see the pitch
    // more than once.
    prefBranch = Services.prefs.getBranch(prefRoot);
    popUpKey = popUpUrl.split("/")[2];
    var prefix = "queue." + popUpKey + ".";
    prefBranch.setCharPref(prefix + "url", popUpUrl);
    prefBranch.setIntPref(prefix + "sortKey",
                          Math.round(Math.random() * 1000000));
    prefBranch.setIntPref(prefix + "time", unixTimestamp());
    mainWindow.setTimeout(KickstarterChoosePopup, popUpDelay);
}

function KickstarterChoosePopup() {
    var queueBranch = Services.prefs.getBranch(prefRoot + "queue.");
    var queueKeys = queueBranch.getChildList("", {});
    var now = unixTimestamp();
    var then = now - 20;
    var urls = {}, times = {}, sortKeys = {};
    for (var s of queueKeys) {
        var pieces = s.split(".");
        if (pieces[1] == "url")
            urls[pieces[0]] = queueBranch.getCharPref(s);
        else if (pieces[1] == "sortKey")
            sortKeys[pieces[0]] = queueBranch.getIntPref(s);
        else if (pieces[1] == "time")
            times[pieces[0]] = queueBranch.getIntPref(s);
    }
    var recent = [];
    for (var k in times)
        if (times[k] > then)
            recent.push(k);
    recent.sort((a, b) => { return sortKeys[a] - sortKeys[b]; });
    if (recent[0] != popUpKey)
        return;
    var wanted;
    var doneBranch = Services.prefs.getBranch(prefRoot + "done.");
    for (var k of recent) {
        try {
            if (! doneBranch.getIntPref(k)) { wanted = k; break; }
        }
        catch (e) { wanted = k; break; }
    }
    if (! wanted) {
        doneBranch.deleteBranch("");
        wanted = recent[0];
    }
    doneBranch.setIntPref(wanted, now);
    KickstarterDoPopup(urls[wanted]);
}

function KickstarterDoPopup(popUpUrl) {
    var now = unixTimestamp();

    try {
        if (now - prefBranch.getIntPref("popUpTimestamp") < 60)
            return;
    } catch (e) {}
    prefBranch.setIntPref("popUpTimestamp", now);

    try {
        if (prefBranch.getBoolPref("pledged"))
            return;
    } catch (e) {}

    try {
        var postponed = prefBranch.getIntPref("postponed");
        var now = unixTimestamp();
        if (now - postponed < 7 * 24 * 60 * 60)
            return;
        prefBranch.clearUserPref("postponed");
    } catch (e) {}

    var args = {
        campaignUrl: campaignUrl,
        prefBranch: prefBranch,
    };
    popUpWindow = mainWindow.openDialog(popUpUrl, "KickstarterWindow", "", args);
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
