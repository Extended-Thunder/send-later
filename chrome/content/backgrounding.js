Components.utils.import("resource://sendlater3/logging.jsm");
Components.utils.import("resource://sendlater3/defaultPreferencesLoader.jsm");

var Sendlater3Backgrounding = function() {
    var shuttingDown = false;

    // Current Thunderbird nightly builds do not load default preferences
    // from overlay add-ons. They're probably going to fix this, but it may go
    // away again at some point in the future, and in any case we'll need to do
    // it ourselves when we convert from overlay to bootstrapped, and there
    // shouldn't be any harm in setting the default values of preferences twice
    // (i.e., both Thunderbird and our code doing it).
    // This is in a try/catch because if it fails it's probably because
    // setStringPref failed, in which case we're running inside an earlier
    // application version which has already loaded the default preferences
    // automatically.
    try {
        var loader = new DefaultPreferencesLoader();
        loader.parseUri(
            "chrome://sendlater3-defaults/content/preferences/sendlater3.js");
    } catch (ex) {}

    SL3U.initUtil();
    sl3log.Entering("Sendlater3Backgrounding");

    window.removeEventListener("load", Sendlater3Backgrounding, false);

    var lastMessagesPending = 0;
    var quitConfirmed = false;
    // We need to fetch these here because the prompt bundle doesn't
    // work while the app is being shut down.
    var scheduledMessagesWarningTitle =
        SL3U.PromptBundleGet("ScheduledMessagesWarningTitle");
    var scheduledMessagesWarningQuitRequest =
        SL3U.PromptBundleGetFormatted(
            "ScheduledMessagesWarningQuitRequested", [SL3U.appName()]);
    var scheduledMessagesWarningQuit =
        SL3U.PromptBundleGetFormatted(
            "ScheduledMessagesWarningQuit", [SL3U.appName()]);
    var confirmAgain = SL3U.PromptBundleGet("ConfirmAgain");

    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);

    var quitRequestedObserver = {
        observe: function(subject, topic, data) {
            if (! checkUuid(false, true)) {
                return;
            }
            if (! lastMessagesPending) {
                return;
            }
            if (! SL3U.getBoolPref("ask.quit")) {
                return;
            }
            quitConfirmed = true;
            var check = {value: true};
            var result = prompts.confirmCheck(
                null,
                scheduledMessagesWarningTitle,
                scheduledMessagesWarningQuitRequest,
                confirmAgain,
                check);
            if (! check.value) {
                SL3U.setBoolPref("ask.quit", false);
            }
            if (! result) {
                subject.QueryInterface(
                    Components.interfaces.nsISupportsPRBool);
                subject.data = true;
            }
        }
    }

    var quitObserver = {
        observe: function(subject, topic, data) {
            sl3log.Entering("quitObserver.observe");
            if (! checkUuid(false, true)) {
                sl3log.Returning("quitObserver.observe", "! checkUuid(false)");
                return;
            }
            if (quitConfirmed || ! lastMessagesPending) {
                sl3log.Returning("quitObserver.observe",
                                 "quitConfirmed || ! lastMessagesPending");
                return;
            }
            if (! SL3U.getBoolPref("ask.quit")) {
                sl3log.Returning("quitObserver.observe", "! ask.quit");
                return;
            }
            var check = {value: true};
            prompts.alertCheck(
                null,
                scheduledMessagesWarningTitle,
                scheduledMessagesWarningQuit,
                confirmAgain,
                check);
            if (! check.value) {
                SL3U.setBoolPref("ask.quit", false);
            }
            sl3log.Leaving("quitObserver.observe");
        }
    }

    function getUnsentMessagesFolder() {
	var msgSendLater = Components
	    .classes["@mozilla.org/messengercompose/sendlater;1"]
	    .getService(Components.interfaces.nsIMsgSendLater);
	return msgSendLater.getUnsentMessagesFolder(null);
    }

    var observerService =  Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(quitRequestedObserver,
                                "quit-application-requested", false);
    observerService.addObserver(quitObserver,
                                "quit-application-granted", false);

    var sentLastTime = {};
    var sentThisTime = {};
    var sentAlerted = {};

    var lateLastTime = {};
    var lateThisTime = {};

    var msgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
	.createInstance();
    msgWindow = msgWindow.QueryInterface(Components.interfaces.nsIMsgWindow);

    // If you add a message to the Outbox and call nsIMsgSendLater when it's
    // already in the middle of sending unsent messages, then it's possible
    // that the message you just added won't get sent. Therefore, when we add a
    // new message to the Outbox, we need to be aware of whether we're already
    // in the middle of sending unsent messages, and if so, then trigger
    // another send after it's finished.
    var wantToCompactOutbox = false;
    var sendingUnsentMessages = false;
    var needToSendUnsentMessages = false;
    var sendUnsentMessagesListener = {
	onStartSending: function(aTotalMessageCount) {
	    sl3log.Entering("Sendlater3Backgrounding.sendUnsentMessagesListener.onStartSending");
            wantToCompactOutbox =
                getUnsentMessagesFolder().getTotalMessages(false) > 0;
	    sendingUnsentMessages = true;
	    needToSendUnsentMessages = false;
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
	    sendingUnsentMessages = false;
	    if (needToSendUnsentMessages) {
		if (! SL3U.isOnline()) {
		    sl3log.warn("Deferring sendUnsentMessages while offline");
		}
		else {
		    try {
			var msgSendLater = Components
			    .classes["@mozilla.org/messengercompose/sendlater;1"]
			    .getService(Components.interfaces.nsIMsgSendLater);
			msgSendLater.sendUnsentMessages(null);
		    }
		    catch (ex) {
			SL3U.alert(window, null,
				   SL3U.PromptBundleGet("SendingUnsentError"));
			sl3log.warn(ex);
		    }
		}
	    }
            else if (wantToCompactOutbox &&
                     getUnsentMessagesFolder().getTotalMessages(false) == 0) {
                try {
                    fdrunsent = getUnsentMessagesFolder();
                    fdrunsent.compact(null, msgWindow);
                    wantToCompactOutbox = false;
                    sl3log.debug("Compacted Outbox");
                }
                catch (ex) {
                    sl3log.warn("Compacting Outbox failed: " + ex);
                }
            }
	    sl3log.Leaving("Sendlater3Backgrounding.sendUnsentMessagesListener.onStopSending");
	}
    }
    function queueSendUnsentMessages() {
	sl3log.Entering("Sendlater3Backgrounding.queueSendUnsentMessages");
	if (! SL3U.isOnline()) {
	    sl3log.warn("Deferring sendUnsentMessages while offline");
	}
	else if (sendingUnsentMessages) {
	    sl3log.debug("Deferring sendUnsentMessages");
	    needToSendUnsentMessages = true;
	}
	else {
	    try {
		var msgSendLater = Components
		    .classes["@mozilla.org/messengercompose/sendlater;1"]
		    .getService(Components.interfaces.nsIMsgSendLater);
		msgSendLater.sendUnsentMessages(null);
	    }
	    catch (ex) {
		SL3U.alert(window, null,
			   SL3U.PromptBundleGet("SendingUnsentError"));
		sl3log.warn(ex);
	    }
	}
	sl3log.Leaving("Sendlater3Backgrounding.queueSendUnsentMessages");
    }
    function addMsgSendLaterListener() {
	sl3log.Entering("Sendlater3Backgrounding.addMsgSendLaterListener");
	var msgSendLater = Components
	    .classes["@mozilla.org/messengercompose/sendlater;1"]
	    .getService(Components.interfaces.nsIMsgSendLater);
	msgSendLater.addListener(sendUnsentMessagesListener);
	sl3log.Leaving("Sendlater3Backgrounding.addMsgSendLaterListener");
    }
    function removeMsgSendLaterListener() {
	sl3log.Entering("Sendlater3Backgrounding.removeMsgSendLaterListener");
	var msgSendLater = Components
	    .classes["@mozilla.org/messengercompose/sendlater;1"]
	    .getService(Components.interfaces.nsIMsgSendLater);
	msgSendLater.removeListener(sendUnsentMessagesListener);
	sl3log.Leaving("Sendlater3Backgrounding.removeMsgSendLaterListener");
    }
    
    newMessageListener = {
        // Thunderbird 2 and Postbox
        itemAdded: function(item) {
            var aMsgHdr = item.QueryInterface(
                Components.interfaces.nsIMsgDBHdr);
            newMessageListener.msgAdded(aMsgHdr);
        },

        itemDeleted: function(item) {},
        itemMoveCopyCompleted: function(move, srcitems, destfolder) {},
        folderRenamed: function(oldName, newName) {},
        itemEvent: function(item, event, data) {},

        // Thunderbird 3
        msgAdded: function(aMsgHdr) {
            if (aMsgHdr.getStringProperty("x-send-later-at")) {
                if (! SL3U.getBoolPref("mark_drafts_read")) return;
                var readlist;
	        if (SL3U.IsPostbox()) {
		    readlist = Components.
                        classes["@mozilla.org/supports-array;1"]
		    .createInstance(Components.interfaces.nsISupportsArray);
		    readlist.AppendElement(aMsgHdr);
	        }
	        else {
		    readlist = Components.classes["@mozilla.org/array;1"]
		        .createInstance(Components.interfaces.nsIMutableArray);
		    readlist.appendElement(aMsgHdr, false);
	        }
	        aMsgHdr.folder.markMessagesRead(readlist, true);
            }
            else {
                cancelOnReplyHandler.addReply(aMsgHdr);
            }
        }
    };
    function addNewMessageListener() {
	var notificationService = Components
	    .classes["@mozilla.org/messenger/msgnotificationservice;1"]
	    .getService(Components.interfaces
			.nsIMsgFolderNotificationService);
	if (SL3U.IsPostbox())
	    notificationService.addListener(newMessageListener);
        else
	    notificationService.addListener(newMessageListener, 
					    notificationService.msgAdded);
    };
    function removeNewMessageListener() {
	var notificationService = Components
	    .classes["@mozilla.org/messenger/msgnotificationservice;1"]
	    .getService(Components.interfaces
			.nsIMsgFolderNotificationService);
        notificationService.removeListener(newMessageListener);
    };

    // I had to change the type of one of my preferences from int to char to be
    // able to add some new functionality. I couldn't find a way to change the
    // type of a preference for people who had the old version of the add-on
    // with the old preference installed. When I just changed its type from int
    // to string in the <preference ...> element in my XUL file and in my
    // references to it in my code, that didn't work -- I got errors trying to
    // use the preference. So the best idea I could come up with for solving
    // this problem is to replace the preference with a new one, migrate over
    // any old values, and delete the old one. I don't know if there's a better
    // way to do this.
    function MigrateQuickOptionValue(num) {
	var oldp = "quickoptions." + num + ".value";
	var newp = oldp + "string";
	
	var v;
	try {
	    v = SL3U.getIntPref(oldp);
	}
	catch (e) {}

	if (v != null) {
	    SL3U.setCharPref(newp, v);
	    SL3U.PrefService.deleteBranch(SL3U.pref(oldp));
	}
    }
    var i;
    for (i = 1; i <= 3; i++) {
	MigrateQuickOptionValue(i);
    }

    // If there are multiple open Thunderbird windows, then each of them is
    // going to load this overlay, which will wreak havoc when multiple windows
    // try to run our background processes at the same time. To avoid this
    // problem, we assign each instance of this overlay a unique ID, and we
    // store the ID of the currently active instance in the user's preferences,
    // along with the time when the active instance last started a background
    // pass. Every entry point function (e.g., event handlers, etc.) checks to
    // see if its unique ID is the one in the preferences. If so, then it
    // processed as normal -- it has the conch. Otherwise, if it's the main
    // callback function (CheckForSendLaterCallback) AND the last active
    // timestamp is >2x the current check interval, then it resets the active
    // instance to its own UUID and proceeds, thus taking over for the other
    // instance that has apparently given up the ghost.
    var uuid;
    function checkUuid(capturable, check_last) {
	if (! uuid) {
	    var uuidGenerator = 
		Components.classes["@mozilla.org/uuid-generator;1"]
		.getService(Components.interfaces.nsIUUIDGenerator);
	    uuid = uuidGenerator.generateUUID().toString();
	}
	var current_time = Math.round((new Date()).getTime() / 1000);
	var last_uuid = SL3U.getCharPref("activescanner.last_uuid");
	var active_uuid = SL3U.getCharPref("activescanner.uuid");
	var active_time = SL3U.getIntPref("activescanner.time");
	var timeout = Math.round(checkTimeout() / 1000);
	var func = "Sendlater3Backgrounding.checkUuid: ";
	var dbgMsg =
	    "uuid="         + uuid         + ", " +
	    "current_time=" + current_time + ", " +
	    "last_uuid="    + last_uuid  + ", " +
	    "active_uuid="  + active_uuid  + ", " +
	    "active_time="  + active_time  + ", " +
	    "timeout="      + timeout;
        if (active_time && active_time > current_time) {
            sl3log.warn("Detected window active time in the future (" +
                      active_time + " > " + current_time + ")! Resetting.");
	    SL3U.setIntPref("activescanner.time", current_time);
            active_time = current_time;
        }
        if (check_last && active_uuid == "" && last_uuid != "")
            active_uuid = last_uuid;
	if (active_uuid && active_uuid != "" && active_uuid != uuid) {
	    if (current_time - active_time > 2 * timeout) {
		if (capturable) {
		    sl3log.debug(func + "capturing: " + dbgMsg);
		    SL3U.setCharPref("activescanner.uuid", uuid);
		}
		else {
		    sl3log.debug(func + "can't capture: " + dbgMsg);
		    return false;
		}
	    }
	    else {
		sl3log.debug(func + "non-active window: " + dbgMsg);
		return false;
	    }
	}
	else if (active_uuid && active_uuid != "") {
	    sl3log.debug(func + "active window: " + dbgMsg);
	}
        else if (shuttingDown) {
            sl3log.debug(func + "shutting down, not capturing: " + dbgMsg);
            return false;
        }
	else {
	    sl3log.debug(func + "first window: " + dbgMsg);
	    SL3U.setCharPref("activescanner.uuid", uuid);
	    SL3U.setCharPref("activescanner.last_uuid", "");
	}
	SL3U.setIntPref("activescanner.time", current_time);
	return true;
    }

    function clearActiveUuidCallback() {
	if (! uuid) return;
	var active_uuid = SL3U.getCharPref("activescanner.uuid");
	if (active_uuid != uuid) return;
	var func = "Sendlater3Backgrounding.clearActiveUuidCallback: ";
	sl3log.debug(func + "clearing: uuid=" + uuid);
        SL3U.setCharPref("activescanner.last_uuid", uuid);
	SL3U.setCharPref("activescanner.uuid", "");
    }

    //mailnews.customDBHeaders 
    var wantedHeaders = new Object();
    ["x-send-later-at", "x-send-later-uuid", "x-send-later-recur",
     "x-send-later-cancel-on-reply", "x-send-later-args", "precedence",
     "auto-submitted"].forEach(function(h) { wantedHeaders[h] = 1; });
    var installedHeaders = new Object();
    var customHeadersString =
	SL3U.PrefService.getCharPref('mailnews.customDBHeaders');
    customHeadersString.split(/\s+/).forEach(function(h) {
        delete wantedHeaders[h.toLowerCase()]; });
    var changed = false;
    for (var h in wantedHeaders) {
        sl3log.info("Installing header " + h + " in customDBHeaders");
        changed = true;
        if (customHeadersString)
            customHeadersString += " " + h;
        else
            customHeadersString = h;
    }
    if (changed)
	SL3U.PrefService.setCharPref('mailnews.customDBHeaders',
				     customHeadersString);

    function checkTimeout() {
	var timeout = SL3U.getIntPref("checktimepref");
	var milli = false;
	try {
	    milli = SL3U.getBoolPref("checktimepref.is_milliseconds");
	}
	catch (ex) {}
	if (milli) {
	    return timeout;
	}
	else {
	    return timeout * 60000;
	}
    }

    function displayprogressbar() {
	return SL3U.getBoolPref("showprogress");
    }

    var DisplayMessages = new Array();

    var DisplayReportTimer;
    var DisplayReportCallback = {
	notify: function(timer) {
	    sl3log.Entering("Sendlater3Backgrounding.DisplayReportCallback.notify");
	    if (DisplayMessages.length>0) {
		var msg = DisplayMessages.shift();
		document.getElementById("sendlater3-status").value = msg;
	    }
	    else {
		timer.cancel();
	    }
	    sl3log.Leaving("Sendlater3Backgrounding.DisplayReportCallback.notify");
	}
    }

    function StatusReportMsg(msg) {
	sl3log.Entering("Sendlater3Backgrounding.StatusReportMsg");
	if (!DisplayMessages.length) {
	    DisplayReportTimer = Components.classes["@mozilla.org/timer;1"]
		.createInstance(Components.interfaces.nsITimer);
	    DisplayReportTimer.initWithCallback(
		DisplayReportCallback,
		300,
		Components.interfaces.nsITimer.TYPE_REPEATING_SLACK
	    );
	}
	DisplayMessages.push(msg);   
	sl3log.Leaving("Sendlater3Backgrounding.StatusReportMsg");
    }

    var MessagesPending=0;
    var ProgressValue;
    var ProgressMax;

    function ProgressSet(str, where) {
	var n = document.getElementById("sendlater3-anim");
	n.max = ProgressMax;
	n.value = ProgressValue;
	sl3log.debug(str+"("+where+"): value="+n.value+", max="+n.max+
		   ", ProgressValue="+ProgressValue+", ProgressMax="+
		   ProgressMax);
    }

    function ProgressClear(where) {
	ProgressValue = 0;
	ProgressMax = 0;
	ProgressSet("ProgressClear", where);
    }

    function ProgressAdd(where) {
	ProgressMax++;
	ProgressSet("ProgressAdd", where);
    }

    function ProgressFinish(where) {
	ProgressValue++;
	ProgressSet("ProgressFinish", where);
    }

    function CopyUnsentListener(content, uri, hdr, messageId, sendat, recur,
                                cancelOnReply, args) {
	this._content = content;
	this._uri = uri;
	this._hdr = hdr;
        this._messageId = messageId;
	this._sendat = sendat;
	this._recur = recur;
        this._cancelOnReply = cancelOnReply;
	this._args = args;
	sl3log.debug("Sendlater3Backgrounding.CopyUnsentListener: _sendat=" + 
		     this._sendat + ", _recur=" +  this._recur +
                     ", _cancelOnReply=" + this._cancelOnReply + ", _args=" + 
		     this._args);
    }

    var MessagesChecked = new Object();

    CopyUnsentListener.prototype = {
	QueryInterface : function(iid) {
	    sl3log.Entering("Sendlater3Backgrounding.CopyUnsentListener.QueryInterface");
	    if (iid.equals(Components.interfaces.nsIMsgCopyServiceListener) ||
		iid.equals(Components.interfaces.nsISupports)) {
		sl3log.Returning("Sendlater3Backgrounding.copyServiceListener.QueryInterface",
					 this);
		return this;
	    }
	    sl3log.Throwing("Sendlater3Backgrounding.CopyUnsentListener.QueryInterface",
				    Components.results.NS_NOINTERFACE);
	    throw Components.results.NS_NOINTERFACE;
	},

	OnProgress: function (progress, progressMax) {
	},

	OnStartCopy: function () {
	},

	OnStopCopy: function ( status ) {
	    sl3log.Entering("Sendlater3Backgrounding.CopyUnsentListener.OnStopCopy");
	    var copying = this.localFile;
	    if (copying.exists()) {
		try {
		    copying.remove(true);
		}
		catch (ex) {
		    // Windows still has it open.
		    sl3log.debug("Failed to delete " + copying.path +"; queuing.");
		    SL3U.WaitAndDelete(copying);
		}
	    }
	    if (! Components.isSuccessCode(status)) {
		Sendlater3Backgrounding.BackgroundTimer.cancel();
		Sendlater3Backgrounding.BackgroundTimer = undefined;
		SL3U.alert(window, null,
			   SL3U.PromptBundleGetFormatted("CopyUnsentError",
							 [status]));
		sl3log.Returning("Sendlater3Backgrounding.CopyUnsentListener.OnStopCopy", "");
		return;
	    }
	    sentThisTime[this._uri] = true;

	    var messageHDR = this._hdr;
	    var sendat = this._sendat;
	    var recur = this._recur;
            var cancelOnReply = this._cancelOnReply;
	    var args = this._args;
	    var folder = messageHDR.folder;
            deleteMessage(messageHDR);
	    if (SL3U.getBoolPref("sendunsentmessages")) {
		queueSendUnsentMessages();
		sl3log.info("Sending Message " + this._uri);
	    }
	    else {
		sl3log.info("Message " + this._uri + " deposited in Outbox.");
	    }
	    SetAnimTimer(3000);
            if (MessagesPending)
                MessagesPending--;
	    if (recur) {
                lastMessagesPending = ++MessagesPending;
		if (args) {
		    args = JSON.parse(args);
		}
		var next = SL3U.NextRecurDate(new Date(sendat), recur, null,
					      args);
		sl3log.debug("Got from NextRecurDate: " + next)
		if (! next) {
		    return;
		}
		if (next.splice) {
		    args = next;
		    recur = next[1];
		    next = next[0];
		    args.splice(0,2);
		}
		var content = this._content;
		var header = "\r\nX-Send-Later-At: " + SL3U.FormatDateTime(next, true) +
		    "\r\nX-Send-Later-Uuid: " + SL3U.getInstanceUuid() + "\r\n";
                if (cancelOnReply != "")
                    cancelOnReply += " " + this._messageId;
		var recurheader = SL3U.RecurHeader(
                    next, recur, cancelOnReply, args);
                for (name in recurheader) {
                    header += name + ": " + recurheader[name] + "\r\n";
                }
		content = content.replace(/\r\n\r\n/, header + "\r\n");
		content = content.replace(/^From .*\r\n/, "");
		sl3log.debug("Sendlater3Backgrounding.CopyUnsentListener.OnStopCopy: header=" + header);
		var listener = new CopyRecurListener(folder);
		SL3U.CopyStringMessageToFolder(content, folder, listener);
	    }
	    sl3log.Leaving("Sendlater3Backgrounding.CopyUnsentListener.OnStopCopy");
	},

	SetMessageKey: function (key ) {}
    };

    function CopyRecurListener(folder) {
	this._folder = folder;
    }

    CopyRecurListener.prototype = {
	QueryInterface : function(iid) {
	    if (iid.equals(Components.interfaces.nsIMsgCopyServiceListener) ||
		iid.equals(Components.interfaces.nsISupports)) {
		return this;
	    }
	    throw Components.results.NS_NOINTERFACE;
	},

	OnProgress: function (progress, progressMax) {},

	OnStartCopy: function () {},

	OnStopCopy: function ( status ) {
	    var copying = this.localFile;
	    if (copying.exists()) {
		try {
		    copying.remove(true);
		}
		catch (ex) {
		    // Windows still has it open.
		    sl3log.debug("Failed to delete " + copying.path +"; queuing.");
		    SL3U.WaitAndDelete(copying);
		}
	    }

	    if (! Components.isSuccessCode(status)) {
		Sendlater3Backgrounding.BackgroundTimer.cancel();
		Sendlater3Backgrounding.BackgroundTimer = undefined;
		SL3U.alert(window, null,
			   SL3U.PromptBundleGetFormatted("CopyRecurError",
							 [status]));
		return;
	    }
	},

	SetMessageKey: function (key) {
	    this._key = key;
	}
    };

    var AnimTimer = null;
    var AnimCallback = {
	notify: function(timer) {
	    sl3log.Entering("Sendlater3Backgrounding.AnimCallback.notify");
            cancelOnReplyHandler.rotate();
	    sl3log.debug("STATUS MESSAGE - " + MessagesPending);
	    if (document != null) {
		document.getElementById("sendlater3-deck").selectedIndex = 1;
		var strbundle =
		    document.getElementById("sendlater3-backgroundstrings");
		var status;

		if (MessagesPending > 0) {
		    status = strbundle.getString("PendingMessage") + " " +
			MessagesPending;
		}
		else {
                    lastMessagesPending = 0;
                    if (Sendlater3Backgrounding.BackgroundTimer) {
		        status = strbundle.getString("IdleMessage");
		    }
		    else {
		        status = strbundle.getString("DisabledMessage");
		    }
                }

		StatusReportMsg(strbundle.getString("MessageTag") + " [" + status + "]");
	    }
	    sl3log.Leaving("Sendlater3Backgrounding.AnimCallback.notify");
	}
    }
    function SetAnimTimer(timeout) {
	sl3log.Entering("Sendlater3Backgrounding.SetAnimTimer");
	if (AnimTimer != null) {
	    AnimTimer.cancel();
	}
	AnimTimer = Components.classes["@mozilla.org/timer;1"]
	    .createInstance(Components.interfaces.nsITimer);
	AnimTimer.initWithCallback(
	    AnimCallback,
	    timeout,
	    Components.interfaces.nsITimer.TYPE_ONE_SHOT
	);
	sl3log.Leaving("Sendlater3Backgrounding.SetAnimTimer");
    }

    // Can we assume that a read from a hung server will eventually time out
    // and cause onStopRequest to be called with an error status code, or are
    // we introducing a memory leak here by creating asynchronous listeners
    // that are going to hang around forever? That is, do we have to explicitly
    // set up timeouts to destroy the listeners that take too long to read? I'm
    // going to assume for now that we don't have to do that.

    var cycle = 0;

    function UriStreamListener(uri, messageHDR) {
	sl3log.Entering("Sendlater3Backgrounding.UriStreamListener", messageHDR);
    	this._content = "";
	this._cycle = cycle;
	this._uri = uri;
	this._messageHDR = messageHDR;
	this._header = messageHDR.getStringProperty("x-send-later-at");
	this._recur = messageHDR.getStringProperty("x-send-later-recur");
        this._cancelOnReply = messageHDR.getStringProperty(
            "x-send-later-cancel-on-reply");
	this._args = messageHDR.getStringProperty("x-send-later-args");
	sl3log.debug("Sendlater3Backgrounding.UriStreamListener: _uri=" +
                     this._uri + ", _header=" + this._header + ", _recur=" +
                     this._recur + ", _cancelOnReply=" + this._cancelOnReply +
                     ", _args=" + this._args);
	sl3log.Leaving("Sendlater3Backgrounding.UriStreamListener");
    }

    UriStreamListener.prototype = {
	QueryInterface: function(iid) {
	    // Sort of cheating, but we know this is going to be used safely.
	    if (iid.equals(Components.interfaces.nsIStreamListener) ||
		iid.equals(Components.interfaces.nsISupports)) {
		return this;
	    }
	    return null;
	},
	onStartRequest: function(aReq, aContext) {
	    sl3log.Entering("Sendlater3Backgrounding.UriStreamListener.onStartRequest");
	    sl3log.Leaving("Sendlater3Backgrounding.UriStreamListener.onStartRequest");
	},
	onStopRequest: function(aReq, aContext, aStatusCode) {
	    sl3log.Entering("Sendlater3Backgrounding.UriStreamListener.onStopRequest");
	    if (! checkUuid(false) || cycle != this._cycle || 
		this._content == "") {
		return;
	    }
	    var content = this._content;
	    var messageHDR = this._messageHDR;
	    this._messageHDR = null;
	    this._content = null;

	    // Simplify search & replace in header by putting a
	    // blank line at the beginning of the message, so that
	    // we can match header lines starting with \n, i.e., we
	    // can assume that there's always a newline immediately
	    // before any header line. This prevents false
	    // negatives when the header line we're looking for
	    // happens to be the first header line in the
	    // message. We'll remove the extra newline when we're
	    // done mucking with the headers.
	    content = "\n" + content;

            function replaceHeader(content, header, newValue) {
                var re, replacementText;
                if (newValue) {
                    replacementText = "\n" + header + ": " + newValue + "\n";
                } else {
                    replacementText = "\n";
                }
                re = new RegExp("\n" + header + ":.*\n([ \t].*\n)*", 'i');
                return content.replace(re, replacementText);
            }

            content = replaceHeader(content, "Date",
                                    SL3U.FormatDateTime(new Date(), true));
            content = replaceHeader(content, "X-Send-Later-At");
            content = replaceHeader(content, "X-Send-Later-Uuid");
            content = replaceHeader(content, "X-Send-Later-Recur");
            content = replaceHeader(content, "X-Send-Later-Cancel-On-Reply");
            content = replaceHeader(content, "X-Send-Later-Args");
            content = replaceHeader(content, "X-Enigmail-Draft-Status");
            content = replaceHeader(content, "Openpgp");

            var messageId;
            [content, messageId] = ReplaceMessageId(content, this._uri);

	    // Remove extra newline -- see comment above.
	    content = content.slice(1);

	    // There is a bug in Thunderbird (3.1, at least) where when
	    // a message is being sent from the user's Outbox and then
	    // a copy is being uploaded into an IMAP server's Sent
	    // Items folder, Thunderbird doesn't convert bare \n to
	    // \r\n before trying to upload the message copy.  This is
	    // a violation of the IMAP spec, and some IMAP servers,
	    // e.g., Cyrus IMAPd, reject the message because of the
	    // bare newlines.  So we have to make sure that the message
	    // has only \r\n line terminators in it before we put it
	    // into the Outbox.  It might *already* have \r\n line
	    // terminators in it, so first we replace \r\n with \n, and
	    // then we replace \n with \r\n.  The reason why we prepend
	    // a "From - <date>" line to the message before doing this
	    // is because if we don't, then CopyFileMessage will
	    // prepend a couple of useless X-Mozilla-* headers to the
	    // top of the message, and the headers it adds will end
	    // with bare \n's on them, so we're back to the original
	    // problem.
	    if (content.slice(0,5) != "From ") {
		content = "From - " + Date().toString() + "\n"
		    + content;
	    }
	    content = content.replace(/\n/g,"\r\n");

	    var msgSendLater = Components
		.classes["@mozilla.org/messengercompose/sendlater;1"]
		.getService(Components.interfaces.nsIMsgSendLater);
	    var fdrunsent = getUnsentMessagesFolder();
	    var listener = new CopyUnsentListener(content,
						  this._uri,
						  messageHDR,
                                                  messageId,
						  this._header,
						  this._recur,
                                                  this._cancelOnReply,
						  this._args)
	    SL3U.CopyStringMessageToFolder(content, fdrunsent,listener);
	    ProgressFinish("finish streaming message");
	    sl3log.Leaving("Sendlater3Backgrounding.UriStreamListener.onStopRequest");
	},
	onDataAvailable: function(aReq, aContext, aInputStream, aOffset,
				  aCount) {
	    sl3log.Entering("Sendlater3Backgrounding.UriStreamListener.onDataAvailable");
	    var uuidOk = checkUuid(false);
	    var cycleOk = cycle == this._cycle;
	    if (! (uuidOk && cycleOk)) {
		this._content = "";
		aInputStream.close();
		sl3log.Returning("Sendlater3Backgrounding.UriStreamListener.onDataAvailable",
			       uuidOk ? "obsolete cycle" : "inactive window");
		return;
	    }
	    var stream = Components
		.classes["@mozilla.org/scriptableinputstream;1"]
		.createInstance()
		.QueryInterface(Components.interfaces
				.nsIScriptableInputStream);
	    stream.init(aInputStream);
	    var data = stream.read(aCount);
	    data = data.replace(/\r\n/g, "\n");
	    if (this._content.length && this._content.slice(-1) == "\r"
		&& data.slice(0, 1) == "\n") {
		this._content = this._content.slice(0, this._content.length -1);
	    }
	    this._content += data;
	    sl3log.Leaving("Sendlater3Backgrounding.UriStreamListener.onDataAvailable");
	}
    };

    var cancelOnReplyHandler = new CancelOnReplyEngine();

    var CheckThisURIQueue = new Array();
    var CheckThisURITimer;

    var CheckThisURICallback = {
	notify: function (timer) {
	    sl3log.Entering("Sendlater3Backgrounding.CheckThisUriCallback.notify");

	    if (! checkUuid(false)) {
		CheckThisURIQueue = new Array();
		sl3log.Returning("Sendlater3Backgrounding.CheckThisUriCallback.notify", "");
		return;
	    }

	    if (CheckThisURIQueue.length == 0) {
		CheckThisURITimer.cancel();
                CheckThisURITimer = null;
		sl3log.Returning("Sendlater3Backgrounding.CheckThisUriCallback.notify", "");
		return;
	    }

	    var messageURI = CheckThisURIQueue.shift();
	    sl3log.debug("Checking message : " + messageURI);

	    if (MessagesChecked[messageURI]) {
		ProgressFinish("finish checking message");
		sl3log.debug("Skipping " + messageURI + " already checked");
		sl3log.Returning("Sendlater3Backgrounding.CheckThisUriCallback.notify", "(found in MessagesChecked)");
		return;
	    }

	    MessagesChecked[messageURI] = 1;

	    var MsgService = messenger.messageServiceFromURI(messageURI);
	    var messageHDR = messenger.msgHdrFromURI(messageURI);
	    var h_at = messageHDR.getStringProperty("x-send-later-at");
	    while (1) {
		if (! h_at) {
		    sl3log.debug(messageURI + ": no x-send-later-at");
		    break;
		}
		var h_uuid = messageHDR.getStringProperty("x-send-later-uuid");
		if (h_uuid != SL3U.getInstanceUuid()) {
		    sl3log.debug(messageURI + ": wrong uuid=" + h_uuid);
		    break;
		}
                if (! cancelOnReplyHandler.addDraft(messageHDR)) {
                    sl3log.debug(messageURI +
                                 ": skipping: deleted by cancel on reply");
                    break;
                }
		sl3log.debug(messageURI + ": good uuid=" + h_uuid);
		if (new Date() < new Date(h_at)) {
		    sl3log.debug(messageURI + ": early x-send-later-at=" + h_at);
		    lastMessagesPending = ++MessagesPending;
		    sl3log.debug(MessagesPending + " messages still pending");
		    break;
		}
                if ((new Date() - new Date(h_at)) / 1000 / 60 >
                    SL3U.getIntPref("late_grace_period") &&
                    SL3U.getBoolPref("block_late_messages")) {
                    lateThisTime[messageURI] = true;
                    if (! lateLastTime[messageURI])
                        SL3U.alert(window, null,
                                   SL3U.PromptBundleGetFormatted(
                                       "BlockedLateMessage",
                                       [messageHDR.getStringProperty("subject"),
                                        messageHDR.folder.URI,
                                        SL3U.getIntPref("late_grace_period")]));
		    lastMessagesPending = ++MessagesPending;
                    break;
                }
                var recur = messageHDR.getStringProperty("x-send-later-recur");
                if (recur)
                    recur = SL3U.ParseRecurSpec(recur);
                if (recur && (recur.between || recur.days) &&
                    SL3U.getBoolPref("enforce_restrictions")) {
                    var now = new Date();
                    var adjusted = SL3U.AdjustDateForRestrictions(
                        now,
                        recur.between ? recur.between.start : null,
                        recur.between ? recur.between.end : null,
                        recur.days);
                    if (now.getTime() != adjusted.getTime()) {
                        sl3log.debug(messageURI + ": enforcing restrictions on " +
                                   now + " until " + adjusted);
                        lastMessagesPending = ++MessagesPending;
                        sl3log.debug(MessagesPending + " messages still pending");
                        break;
                    }                        
                }
		sl3log.debug(messageURI + ": due x-send-later-at=" + h_at);
		if (! SL3U.getBoolPref("senddrafts")) {
		    sl3log.debug(messageURI + ": senddrafts is false");
		    break;
		}
		if (sentLastTime[messageURI]) {
		    sentThisTime[messageURI] = true;
		    if (! sentAlerted[messageURI]) {
		    	SL3U.alert(window, null,
		    		   SL3U.PromptBundleGetFormatted("MessageResendError",
		    						 [messageHDR.folder.URI]));
		    	sentAlerted[messageURI] = 1;
		    }
		    sl3log.warn("Skipping " + messageURI + " -- resend!");
		    break;
		}
                // Count messages being sent right now as pending until
                // they're done being sent and aren't recurring.
                MessagesPending++;
		ProgressAdd("start streaming message");
		MsgService.streamMessage(messageURI,
					 new UriStreamListener(messageURI, messageHDR),
					 msgWindow, null, false, null);
		break;
	    }
	    ProgressFinish("finish checking message");
	    SetAnimTimer(3000);
	    sl3log.Leaving("Sendlater3Backgrounding.CheckThisUriCallback.notify");
	}
    }

    // We use a queue of URIs to be checked, and only allow one URI to be
    // checked each time the timer fires, so that we don't block for a
    // long time checking drafts and cause the UI to hang or respond
    // sluggishly.
    function CheckThisURIQueueAdd(messageURI) {
	sl3log.Entering("Sendlater3Backgrounding.CheckThisURIQueueAdd", messageURI);
	if (! CheckThisURITimer) {
	    CheckThisURITimer = Components.classes["@mozilla.org/timer;1"]
		.createInstance(Components.interfaces.nsITimer);
	    CheckThisURITimer.initWithCallback(
		CheckThisURICallback,
		1,
		Components.interfaces.nsITimer.TYPE_REPEATING_SLACK
	    );
	}
	CheckThisURIQueue.push(messageURI);
	ProgressAdd("CheckThisURIQueueAdd");
	sl3log.Leaving("Sendlater3Backgrounding.CheckThisURIQueueAdd");
    }

    // folderstocheck is a hash of folders waiting to be checked in this
    // cycle. foldersdone is a hash of folders we've already checked in this
    // cycle. folderstocheck grows when we scan all the draft folders in
    // CheckForSendLaterCallback. folderstocheck shrinks and foldersdone grows
    // when we process a folder in the folderLoadListener. We need to keep
    // track of both folderstocheck and foldersdone because we call
    // updateFolder in CheckForSendLaterCallback as we add folders to
    // folderstocheck, and updateFolder sometimes calls the folderLoadListener
    // synchronously, so if we just kept track of folderstocheck and multiple
    // accounts were pointing at the same Drafts folder, then we could end up
    // processing that Drafts folder multiple times and miscounting pending
    // messages.
    var folderstocheck = new Object();
    var foldersdone = new Object();

    function CheckLoadedFolder(folder) {
	SetAnimTimer(3000);
	var thisfolder = folder
	    .QueryInterface(Components.interfaces.nsIMsgFolder);
	var messageenumerator;
	try {
	    if (SL3U.IsPostbox()) {
		messageenumerator = thisfolder.getMessages(msgWindow);
	    }
	    else {
		messageenumerator = thisfolder.messages;
	    }
	}
	catch (e) {
	    var lmf;
	    try {
		lmf = thisfolder
		    .QueryInterface(Components.interfaces
				    .nsIMsgLocalMailFolder);
	    }
	    catch (ex) {}
	    if ( // NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE
		(e.result == 0x80550005 ||
		 // NS_MSG_ERROR_FOLDER_SUMMARY_MISSING
		 e.result == 0x80550006) && lmf) {
		sl3log.debug("Rebuilding summary: " + folder.URI);
		try {
		    lmf.getDatabaseWithReparse(null, null);
		}
		catch (ex) {}
	    }
	    else {
		SL3U.alert(window, null,
			   SL3U.PromptBundleGetFormatted(
			       "CorruptFolderError",
			       [folder.URI]));
		throw e;
	    }
	}
	if ( messageenumerator ) {
	    sl3log.debug("Got Enumerator\n");
	    while ( messageenumerator.hasMoreElements() ) {
		var messageDBHDR = messageenumerator.getNext()
		    .QueryInterface(Components.interfaces
				    .nsIMsgDBHdr);
		var flags;
		if (SL3U.IsPostbox()) {
		    flags = 2097152 | 8; // Better way to do this?
		}
		else {
		    var f = Components.interfaces.nsMsgMessageFlags;
		    flags = f.IMAPDeleted | f.Expunged;
		}
		if (! (messageDBHDR.flags & flags)) {
		    var messageURI = thisfolder
			.getUriForMsg(messageDBHDR);
		    CheckThisURIQueueAdd(messageURI);
		}
	    }
	}
	else {
	    sl3log.debug("No Enumerator\n");
	}
    };

    var folderLoadListener = {
	OnItemEvent: function(folder, event) {
	    if (! folder) {
		sl3log.Returning("Sendlater3Backgrounding.folderLoadListener.OnItemEvent", "no folder");
		return;
	    }
	    sl3log.Entering("Sendlater3Backgrounding.folderLoadListener.OnItemEvent", folder.URI, event);

	    if (! checkUuid(false)) {
		sl3log.Returning("Sendlater3Backgrounding.folderLoadListener.OnItemEvent", "! checkUuid");
		return;
	    }

	    var eventType = event.toString();

	    if (eventType == "FolderLoaded") {
		if (folderstocheck[folder.URI]) {
		    SetAnimTimer(3000);
		    sl3log.debug("FolderLoaded checking: "+folder.URI);
		    delete folderstocheck[folder.URI];
		    foldersdone[folder.URI] = 1;
		    CheckLoadedFolder(folder);
		    ProgressFinish("finish checking folder");
		}
	    }
	    else if (eventType == "Immediate") {
		SetAnimTimer(3000);
		sl3log.debug("Immediate checking: "+folder.URI);
		CheckLoadedFolder(folder);
		ProgressFinish("finish checking folder");
	    }

	    sl3log.Leaving("Sendlater3Backgrounding.folderLoadListener.OnItemEvent");
	}
    };


    // https://bugzilla.mozilla.org/show_bug.cgi?id=889022
    if (! SL3U.IsPostbox()) {
	Components.utils.import("resource:///modules/MailUtils.js");
    }

    function getMsgFolderFromUri(uri, checkFolderAttributes) {
	var msgfolder = null;
	if (typeof MailUtils != 'undefined') {
	    return MailUtils.getFolderForURI(uri, checkFolderAttributes);
	}
	var resource = GetResourceFromUri(uri);
	msgfolder = resource.QueryInterface(Components.interfaces.nsIMsgFolder);
	if (checkFolderAttributes) {
	    if (!(msgfolder && (msgfolder.parent || msgfolder.isServer))) {
		msgfolder = null;
	    }
	}
	return msgfolder;
    };

    var CheckForSendLaterCallback = {
	notify: function (timer) {
	    sl3log.Entering("Sendlater3Backgrounding.CheckForSendLaterCallback.notify");

	    Sendlater3Backgrounding.BackgroundTimer.initWithCallback(
		CheckForSendLaterCallback,
		checkTimeout() + Math.ceil(Math.random()*3000)-1500,
		Components.interfaces.nsITimer.TYPE_ONE_SHOT
	    );

	    if (! checkUuid(true)) {
		sl3log.Returning("Sendlater3Backgrounding.CheckForSendLaterCallback.notify", "");
		return;
	    }

	    if (! (SL3U.getBoolPref("send_while_offline") ||
		   SL3U.isOnline())) {
		sl3log.debug("Deferring send while offline");
		sl3log.Returning("Sendlater3Backgrounding.CheckForSendLaterCallback.notify", "");
		return;
	    }		

	    sl3log.debug("One cycle of checking");

            // The reason why this is needed is incredibly annoying
            // and reflects a deficiency in Thunderbird...
            // 1. User asks to quit the application with File | Quit.
            // 2. There are pending scheduled messages.
            // 3. quitRequestedObserver above sets quitConfirmed to
            //    true.
            // 4. Some other quite-application-requested listener
            //    aborts the quit.
            // 5. Some time later, the user clicks the little red X to
            //    close the window.
            // 6. Because the user clicked the little red X instead of
            //    executing File | Quit, quitRequestedObserver is
            //    _not_ called.
            // 7. quitObserver is called.
            // 8. quitRequested is true from earlier, so quiteObserver
            //    doesn't prompt for confirmation. D'oh.
            // Unfortunately, there's no event to which we can listen
            // to find out when a quit is aborted, so the next time
            // through our check loop, we clear this value. *sigh*
            quitConfirmed = false;

	    MessagesPending = 0;
	    ProgressClear("CheckForSendLaterCallback.notify");

	    cycle++;

	    var accountManager = Components
		.classes["@mozilla.org/messenger/account-manager;1"]
		.getService(Components.interfaces.nsIMsgAccountManager);
	    var fdrlocal = accountManager.localFoldersServer.rootFolder;

	    sentLastTime = sentThisTime;
	    sentThisTime = {};

            lateLastTime = lateThisTime;
            lateThisTime = {};

	    for (uri in sentAlerted) {
		if (! MessagesChecked[uri]) {
		    delete sentAlerted[uri];
		    sl3log.debug("Removed from sentAlerted: " + uri);
		}
	    }

	    folderstocheck = new Object();
	    foldersdone = new Object();
	    MessagesChecked = new Object();

	    
	    sl3log.debug("Progress Animation SET");
	    if (displayprogressbar()) {
		document.getElementById("sendlater3-deck").selectedIndex = 0;
	    }

	    var CheckFolder = function(folder, schedule, msg) {
		var uri = folder.URI;
		if (folderstocheck[uri] || foldersdone[uri]) {
		    sl3log.debug("Already done - " + uri);
		    return;
		}
		if (schedule) {
		    folderstocheck[uri] = 1;
		    sl3log.debug("SCHEDULE " + msg + " - " + uri);
		    ProgressAdd(msg);
		    try {
			// Documentation for nsiMsgFolder says, "Note:
			// Even if the folder doesn't currently exist,
			// a nsIMsgFolder may be returned." When that
			// happens, the following line generates an
			// error. I can't find any way to check
			// whether the folder currently exists before
			// calling this, so I'm just discarding the
			// error.
			folder.updateFolder(msgWindow);
		    }
		    catch (e) {
			sl3log.debug("updateFolder on " + uri + " failed");
		    }
		}
		else {
		    foldersdone[uri] = 1;
		}
		// We need to do an immediate scan always, even if
		// we're also doing a scheduled scan, because
		// sometimes updateFolder doesn't generate a folder
		// loaded event. *sigh*
		sl3log.debug("IMMEDIATE " + msg + " - " + uri);
		ProgressAdd(msg + " immediate");
		folderLoadListener.OnItemEvent(folder, "Immediate");
	    }
	    
	    CheckFolder(SL3U.FindSubFolder(fdrlocal, "Drafts"), true,
			"local Drafts folder");
	    // Local Drafts folder might have different name, e.g., in other
	    // locales.
            var local_draft_pref;
            var draft_folder_pref = 'mail.identity.default.draft_folder';
            try {
                // Gecko 58+
                local_draft_pref = SL3U.PrefService.getStringPref(
                    draft_folder_pref);
            }
            catch (e) {
                local_draft_pref = SL3U.PrefService.getComplexValue(
                    draft_folder_pref,
                    Components.interfaces.nsISupportsString).data;
            }
	    sl3log.debug("mail.identity.default.draft_folder=" +local_draft_pref);
	    if (local_draft_pref) {
		var folder;
		// Will fail if folder doesn't exist
		try {
		    folder = getMsgFolderFromUri(local_draft_pref);
		}
		catch (e) {
		    sl3log.debug("default Drafts folder " + local_draft_pref +
			       " does not exist?");
		}
		if (folder) {
		    CheckFolder(folder, true, "default Drafts folder");
		}
	    }
	    var allaccounts = accountManager.accounts;

	    var acindex, numAccounts;

	    try {
		// Before Thunderbird 20
		numAccounts = allaccounts.Count();
	    }
	    catch (e) {
		numAccounts = allaccounts.length;
	    }

	    for (acindex = 0;acindex < numAccounts;acindex++) {
		SetAnimTimer(3000);
		var thisaccount;
		try {
		    thisaccount =  allaccounts
			.queryElementAt(acindex, Components.interfaces
					.nsIMsgAccount);
		}
		catch (e) {
		    // Before Thunderbird 20
		    thisaccount = allaccounts.GetElementAt(acindex);
 		    if (thisaccount) {
			thisaccount = thisaccount
			    .QueryInterface(Components.interfaces
					    .nsIMsgAccount);
		    }
		}
		if (thisaccount) {
		    var numIdentities;
		    try {
			// Before Thunderbird 20
			numIdentities = thisaccount.identities.Count();
		    }
		    catch (e) {
			numIdentities = thisaccount.identities.length;
		    }
		    sl3log.debug(thisaccount.incomingServer.type + 
			       " - Identities [" + numIdentities + "]");
		    switch (thisaccount.incomingServer.type) {
		    case "pop3":
		    case "imap":
			var identityNum;
			for (identityNum = 0; identityNum < numIdentities;
			     identityNum++) {
			    var identity;
			    try {
				identity = thisaccount.identities
				    .queryElementAt(identityNum,
						    Components.interfaces
						    .nsIMsgIdentity);
			    }
			    catch (e) {
				// Before Thunderbird 20
				identity = thisaccount.identities
				    .GetElementAt(identityNum)
				    .QueryInterface(Components.interfaces
						    .nsIMsgIdentity);
			    }
			    var thisfolder =
				getMsgFolderFromUri(identity.draftFolder);
			    var msg = "identity "+acindex+"."+identityNum+
				" Drafts folder";
			    var pref = "mail.server." + thisaccount
				.incomingServer.key + ".check_new_mail"
			    var pref_value;
			    try {
				pref_value = SL3U.PrefService
				    .getBoolPref(pref);
			    }
			    catch (e) {
				// If unset, defaults to true
				pref_value = true;
			    }
			    pref_value = SL3U.GetUpdatePref(identity.key) ||
				pref_value;
			    CheckFolder(thisfolder, pref_value, msg);
			}
			break;
		    default:
			sl3log.debug("skipping this server type - " +thisaccount);
			break;
		    }
		}
	    }
	    sl3log.Leaving("Sendlater3Backgrounding.CheckForSendLaterCallback.notify");
	}
    }

    var SetUpStatusBar = {
	observe: function() {
	    var showStatus = SL3U.getBoolPref("showstatus");
	    document.getElementById("sendlater3-panel")
		.setAttribute("hidden", ! showStatus);
	}
    };

    function StartMonitorCallback() {
	sl3log.Entering("Sendlater3Backgrounding.StartMonitorCallback");
	sl3log.debug("Starting monitor [for every " + checkTimeout() + "ms]");
	var mailSession = Components
	    .classes["@mozilla.org/messenger/services/session;1"]
	    .getService(Components.interfaces.nsIMsgMailSession);
	mailSession
	    .AddFolderListener(folderLoadListener,
			       Components.interfaces.nsIFolderListener.event);
	Sendlater3Backgrounding.BackgroundTimer = Components
	    .classes["@mozilla.org/timer;1"]
	    .createInstance(Components.interfaces.nsITimer);    
	Sendlater3Backgrounding.BackgroundTimer.initWithCallback(
	    CheckForSendLaterCallback,
	    2000,
	    Components.interfaces.nsITimer.TYPE_ONE_SHOT
	);
	sl3log.Leaving("Sendlater3Backgrounding.StartMonitorCallback");
    }

    function StopMonitorCallback() {
        shuttingDown = true;
	sl3log.Entering("Sendlater3Backgrounding.StopMonitorCallback");
	var mailSession = Components
	    .classes["@mozilla.org/messenger/services/session;1"]
	    .getService(Components.interfaces.nsIMsgMailSession);
	mailSession.RemoveFolderListener(folderLoadListener);
	if (Sendlater3Backgrounding.BackgroundTimer) {
	    Sendlater3Backgrounding.BackgroundTimer.cancel();
	    Sendlater3Backgrounding.BackgroundTimer = undefined;
	}
	clearActiveUuidCallback();
	removeMsgSendLaterListener();
        removeNewMessageListener();
	sl3log.Leaving("Sendlater3Backgrounding.StopMonitorCallback");
	SL3U.uninitUtil();
    }

    function ShouldDisplayReleaseNotes(old, current) {
	if (! old)
	    return false;
	if (old == current)
	    return false;
	if (current.indexOf("b") > -1)
	    // beta release
	    return true;
	var old_numbers = old.split(".");
	var current_numbers = current.split(".");
	if (current_numbers.length < 3)
	    return true;
	if (old_numbers[0] != current_numbers[0] ||
	    old_numbers[1] != current_numbers[1])
	    return true;
	return false;
    }

    function DisplayReleaseNotesCallback(addon) {
        if (! (addon && addon.version))
            return;
        let current_version = addon.version;
	let relnotes = SL3U.getCharPref("relnotes");

        // Migrate old preferences
        try {
            let value = SL3U.getBoolPref("dropdowns.showintoolbar");
            SL3U.setBoolPref("entry.showintoolbar", value);
            SL3U.PrefService.clearUserPref(
                SL3U.pref("dropdowns.showintoolbar"));
        }
        catch (ex) {}

        if (relnotes) {
            var numbers = relnotes.split(".");
            if ((numbers[0] < 4) &&
                SL3U.PrefService.prefHasUserValue(
                    SL3U.pref("checktimepref"))) {
                var old = SL3U.getIntPref("checktimepref");
                if (old < 60000) {
                    old = 60000;
                }
                var converted = Math.floor(old / 60000);
                SL3U.setIntPref("checktimepref", converted);
            }
        }

	SL3U.setCharPref("relnotes", current_version);
	Sendlater3Backgrounding.notesUrl =
            "https://blog.kamens.us/send-later-3/#notes-" + current_version;
        if (! ShouldDisplayReleaseNotes(relnotes, current_version))
            return;
	if (SL3U.IsPostbox())
            return;
        if (SL3U.IsSeaMonkey()) {
	    mediator = Components
		.classes['@mozilla.org/appshell/window-mediator;1']
		.getService(Components.interfaces.nsIWindowMediator)
            browser = mediator.getMostRecentWindow("navigator:browser");
            if (browser) {
                browser.gBrowser.loadOneTab(Sendlater3Backgrounding.notesUrl,
                                            {inBackground: false});
                Components.classes["@mozilla.org/timer;1"]
                    .createInstance(Components.interfaces.nsITimer)
                    .initWithCallback(
                        {notify: function(timer) {browser.focus();}}, 1000,
                        Components.interfaces.nsITimer.TYPE_ONE_SHOT);
            }
            else {
                Components.utils.import("resource://gre/modules/Services.jsm");
                let browserUrl;
                try {
                    browserUrl = Services.prefs.getCharPref(
                        "browser.chromeURL");
                }
                catch (e) {
                    browserUrl = "chrome://navigator/content/navigator.xul";
                }
                argstring = Components.classes["@mozilla.org/supports-string;1"]
                    .createInstance(Components.interfaces.nsISupportsString);
                argstring.data = Sendlater3Backgrounding.notesUrl;
                Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                    .getService(Components.interfaces.nsIWindowWatcher).
                    openWindow(null, browserUrl, "", "chrome,all,dialog=no",
                               argstring);
            }
            return;
        }
        // Thunderbird
        Components
            .classes['@mozilla.org/appshell/window-mediator;1']
            .getService(Components.interfaces.nsIWindowMediator)
            .getMostRecentWindow("mail:3pane")
            .document.getElementById("tabmail")
            .openTab("contentTab",
                     {contentPage: Sendlater3Backgrounding.notesUrl});

    }
    
    function DisplayReleaseNotes() {
        try {
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
            addon = AddonManager.getAddonByID("sendlater3@kamens.us",
                                              DisplayReleaseNotesCallback);
        }
        catch (e) {
            let enabledItems = null;
            try {
                enabledItems = SL3U.PrefService
                    .getCharPref("extensions.enabledAddons");
            }
            catch (e) {
                try {
                    enabledItems = SL3U.PrefService
                        .getCharPref("extensions.enabledItems");
                }
                catch (e) {}
            }

            if (! enabledItems)
                return;

            var matches = enabledItems.match(
                    /sendlater3(@|%40)kamens\.us:([^,]+)/);
            if (matches)
                DisplayReleaseNotesCallback({version: matches[2]})
        }
    }

    function ReplaceMessageId(content, uri) {
        // When we save a message in the Drafts folder, we put a Message-ID
        // field into it, because this allows us to leverage Thunderbird's
        // logic for determining what to put to the right of the "@" in the
        // Message ID, based on the identity of the user composing the message.
        // Now, however, we want to use a _different_ Message ID for the
        // message that actually gets sent, for two reasons:
        //
        // 1. Recurring messages should use a different message ID each
        //    time, not the same message ID for messages sent at different
        //    times.
        // 2. Some MTAs and IMAP servers may get confused and store messages in
        //    unexpected ways (or not at all) if they encounter different
        //    messages with the same message ID.
        //
        // We're going to try really hard to generate a sane message ID here:
        //
        // * If we can find X-Identity-Key in the draft -- and it absolutely
        //   should be there! -- then we'll use that to determine the identity
        //   to use to generate the new message ID.
        // * Otherwise, we'll log an error, use a random identity to generate
        //   the new message ID, and then replace the domain from the new ID
        //   with the domain from the old ID.
        // * If we can't find X-Identity-Key and there is no old message ID --
        //   ugh, that should never happen! -- then we'll log an error and
        //   substitute the domain of the email address in the From line as the
        //   domain for the new message ID.
        // * If all of the above fails and there's no email address we can
        //   recognize in the From line -- ugh, omg, how could that every
        //   happen? -- then we'll throw an exception, because we're out of
        //   ideas.
        
        var accounts = Components
            .classes["@mozilla.org/messenger/account-manager;1"]
            .getService(Components.interfaces.nsIMsgAccountManager);
        var compUtils = Components
            .classes["@mozilla.org/messengercompose/computils;1"]
            .createInstance(Components.interfaces.nsIMsgCompUtils);
        var newMessageId;
        var match = (/\nX-Identity-Key:\s*(\S+)/i.exec(content))[1];
        if (match) {
            var identity = accounts.getIdentity(match);
            if (identity) {
                newMessageId = compUtils.msgGenerateMessageId(identity);
                if (! newMessageId)
                    sl3log.error("MSGID: compUtils.msgGenerateMessageId(" +
                                 match + ") failed for " + uri);
            }
            else
                sl3log.error("MSGID: accounts.getIdentity(" + match +
                             ") failed for " + uri);
        } else
            sl3log.error("MSGID: Could not find X-Identity-Key in " + uri);
        if (! newMessageId) {
            var identity = accounts.allIdentities.enumerate().getNext();
            var fakeMessageId = compUtils.msgGenerateMessageId(identity);
            var mailbox;
            match = (/\nMessage-ID:\s*<(.*)>/i.exec(content))[1];
            if (match)
                mailbox = match;
            else {
                sl3log.error("MSGID: No Message-ID in " + uri);
                match = (/\nFrom:(.*)/i.exec(content))[1];
                if (! match)
                    throw new Error("MSGID: No From line in " + uri);
                var headerParser =
                    Components.classes["@mozilla.org/messenger/headerparser;1"]
                    .createInstance(Components.interfaces.nsIMsgHeaderParser);
                mailbox = (headerParser.
                           extractHeaderAddressMailboxes(match).
                           split(/,\s*/))[0];
                if (! mailbox)
                    throw new Error("MSGID: No mailbox in '" + match +
                                    "' for " + uri);
            }
            var domain = mailbox.substring(mailbox.indexOf("@") + 1);
            if (! domain)
                throw new Error("MSGID: No domain in '" + mailbox + "' for " +
                                uri);
            var oldMessageId = "<foo@" + domain + ">";
            newMessageId =
                fakeMessageId.substring(0, fakeMessageId.indexOf("@")) +
                oldMessageId.substring(oldMessageId.indexOf("@"));
        }

        // Extreme paranoia!
        if (/\nMessage-ID:.*<.*>/i.exec(content))
            // This should pretty much always be the code that executes.
            content = content.replace(/(\nMessage-ID:.*)<.*>/i,
                                      "$1" + newMessageId);
        else if (/\n\n/.exec(content)) {
            content = content.replace(
                    /\n\n/, "\nMessage-ID: " + newMessageId + "\n\n");
        }
        else if (/\n$/.exec(content)) {
            content = content + "Message-ID: " + newMessageId + "\n";
        }
        else {
            content = content + "\nMessage-ID: " + newMessageId + "\n";
        }

        return [content, newMessageId];
    }

    function CancelOnReplyEngine() {
        this.drafts = [];
        this.newDrafts = [];
        this.replies = [];
    }
    CancelOnReplyEngine.prototype.addDraft = function(hdr) {
        // Check if the specified draft has a corresponding reply. If so, then
        // delete the draft and return false. Otherwise, add it to our list of
        // drafts and return true;
        var xheader = hdr.getStringProperty("x-send-later-cancel-on-reply");
        if (! xheader) return true;
        var messageIds = xheader.split(/\s+/);
        // First thing in the header is "yes"
        messageIds.shift();
        for (var i in messageIds) {
            messageId = messageIds[i];
            if (messageId in this.replies) {
                deleteMessage(hdr);
                this.purgeReply(this.replies[messageId]);
                return false;
            }
        }
        for (var i in messageIds) {
            this.drafts[messageIds[i]] = this.newDrafts[messageIds[i]] = hdr;
        }
        sl3log.debug("Added draft <" + hdr.getStringProperty("message-id") +
                     "> (" + hdr.getStringProperty("subject") +
                     ") to cancel on reply engine");
        return true;
    };
    CancelOnReplyEngine.prototype.addReply = function(hdr) {
        // Check if the specified reply has any corresponding drafts. If so,
        // then delete the corresponding draft and remove it from our list.
        // Otherwise, add the reply to our list of replies. No meaningful
        // return value.
        if (hdr.getStringProperty("precedence") == "bulk") return;
        if (/^auto/i.test(hdr.getStringProperty("auto-submitted"))) return;
        var refsString = hdr.getStringProperty("references");
        if (! refsString) return;
        sl3log.debug("Checking new message <" +
                     hdr.getStringProperty("message-id") + "> (" +
                     hdr.getStringProperty("subject") +
                     ") in cancel on reply engine");
        refsString = refsString.replace(/>/g, "> ");
        var refs = refsString.split(/\s+/);
        for (var i in refs) {
            var ref = refs[i];
            var draft = this.newDrafts[ref] || this.drafts[ref];
            if (draft) {
                deleteMessage(draft);
                this.purgeDraft(draft);
                return;
            }
        }
        for (var i in refs) {
            this.replies[refs[i]] = hdr;
        }
    };
    CancelOnReplyEngine.prototype.rotate = function() {
        // Replace the old drafts list with the new one. Check if there are any
        // outstanding replies that have corresponding drafts. If so, then
        // delete the drafts and remove them from our list. When finished, clear
        // the list of pending replies. No meaningful return value.
        this.drafts = this.newDrafts;
        this.newDrafts = [];
        var draftsToPurge = [];
        var repliesToPurge = [];
        for (var referenceId in this.replies) {
            var reply = this.replies[referenceId];
            if (repliesToPurge.indexOf(reply) > -1) continue;
            repliesToPurge.push(reply);
            var draft = this.drafts[referenceId];
            if (! draft) continue;
            if (draftsToPurge.indexof(draft) > -1) continue;
            deleteMessage(draft);
            draftsToPurge.push(draft);
        }
        for (var i in draftsToPurge)
            this.purgeDraft(draftsToPurge[i]);
        this.replies = [];
        sl3log.debug("Rotated cancel on reply engine. Current drafts: " +
                     Object.keys(this.drafts).join(" "));
    };
    CancelOnReplyEngine.prototype.purgeDraft = function(hdr) {
        var xheader = hdr.getStringProperty("x-send-later-cancel-on-reply");
        if (! xheader) return;
        var messageIds = xheader.split(/\s+/);
        // First thing in the header is "yes"
        messageIds.shift();
        for (var i in messageIds) {
            delete this.drafts[messageIds[i]];
            delete this.newDrafts[messageIds[i]];
        }
    };
    CancelOnReplyEngine.prototype.purgeReply = function(hdr) {
        var refsString = hdr.getStringProperty("references");
        if (! refsString) return;
        refsString = refsString.replace(/>/g, "> ");
        var refs = refsString.split(/\s+/);
        for (var i in refs)
            delete this.replies[refs[i]];
    };

    function deleteMessage(hdr) {
        var dellist;
        if (SL3U.IsPostbox()) {
            dellist = Components.classes["@mozilla.org/supports-array;1"]
                .createInstance(Components.interfaces.nsISupportsArray);
            dellist.AppendElement(hdr);
        }
        else {
            dellist = Components.classes["@mozilla.org/array;1"]
                .createInstance(Components.interfaces.nsIMutableArray);
            dellist.appendElement(hdr, false);
        }
        hdr.folder.deleteMessages(dellist, msgWindow, true, false,
                                  null, false);
    };

    // BackgroundTimer = Components
    //     .classes["@mozilla.org/timer;1"]
    //     .createInstance(Components.interfaces.nsITimer);
    // BackgroundTimer.initWithCallback(
    //     StartMonitorCallback,
    //     5000,
    //     Components.interfaces.nsITimer.TYPE_ONE_SHOT
    //     );

    SetUpStatusBar.observe();
    SL3U.PrefService.addObserver(SL3U.pref("showstatus"),SetUpStatusBar, false);

    StartMonitorCallback();
    window.addEventListener("unload", StopMonitorCallback, false);

    DisplayReleaseNotes();

    sl3log.Leaving("Sendlater3Backgrounding");
    addMsgSendLaterListener();
    addNewMessageListener();

    var {KickstarterPopup} = Components.utils.import(
        "resource://sendlater3/kickstarter.jsm");
    KickstarterPopup(window, "chrome://sendlater3/content/kickstarter.xul");
}

window.addEventListener("load", Sendlater3Backgrounding, false);
