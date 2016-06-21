var Sendlater3Backgrounding = function() {
    SL3U.Entering("Sendlater3Backgrounding");

    window.removeEventListener("load", Sendlater3Backgrounding, false);
    SL3U.initUtil();

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
            if (! checkUuid(false)) {
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
            if (! checkUuid(false)) {
                return;
            }
            if (quitConfirmed || ! lastMessagesPending) {
                return;
            }
            if (! SL3U.getBoolPref("ask.quit")) {
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
        }
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
    var sendingUnsentMessages = false;
    var needToSendUnsentMessages = false;
    var sendUnsentMessagesListener = {
	onStartSending: function(aTotalMessageCount) {
	    SL3U.Entering("Sendlater3Backgrounding.sendUnsentMessagesListener.onStartSending");
	    sendingUnsentMessages = true;
	    needToSendUnsentMessages = false;
	    SL3U.Leaving("Sendlater3Backgrounding.sendUnsentMessagesListener.onStartSending");
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
	    SL3U.Entering("Sendlater3Backgrounding.sendUnsentMessagesListener.onStopSending");
	    sendingUnsentMessages = false;
	    if (needToSendUnsentMessages) {
		if (! SL3U.isOnline()) {
		    SL3U.warn("Deferring sendUnsentMessages while offline");
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
			SL3U.warn(ex);
		    }
		}
	    }
	    SL3U.Leaving("Sendlater3Backgrounding.sendUnsentMessagesListener.onStopSending");
	}
    }
    function queueSendUnsentMessages() {
	SL3U.Entering("Sendlater3Backgrounding.queueSendUnsentMessages");
	if (! SL3U.isOnline()) {
	    SL3U.warn("Deferring sendUnsentMessages while offline");
	}
	else if (sendingUnsentMessages) {
	    SL3U.debug("Deferring sendUnsentMessages");
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
		SL3U.warn(ex);
	    }
	}
	SL3U.Leaving("Sendlater3Backgrounding.queueSendUnsentMessages");
    }
    function addMsgSendLaterListener() {
	SL3U.Entering("Sendlater3Backgrounding.addMsgSendLaterListener");
	var msgSendLater = Components
	    .classes["@mozilla.org/messengercompose/sendlater;1"]
	    .getService(Components.interfaces.nsIMsgSendLater);
	msgSendLater.addListener(sendUnsentMessagesListener);
	SL3U.Leaving("Sendlater3Backgrounding.addMsgSendLaterListener");
    }
    function removeMsgSendLaterListener() {
	SL3U.Entering("Sendlater3Backgrounding.removeMsgSendLaterListener");
	var msgSendLater = Components
	    .classes["@mozilla.org/messengercompose/sendlater;1"]
	    .getService(Components.interfaces.nsIMsgSendLater);
	msgSendLater.removeListener(sendUnsentMessagesListener);
	SL3U.Leaving("Sendlater3Backgrounding.removeMsgSendLaterListener");
    }

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
    function checkUuid(capturable) {
	if (! uuid) {
	    var uuidGenerator = 
		Components.classes["@mozilla.org/uuid-generator;1"]
		.getService(Components.interfaces.nsIUUIDGenerator);
	    uuid = uuidGenerator.generateUUID().toString();
	}
	var current_time = Math.round((new Date()).getTime() / 1000);
	var active_uuid = SL3U.getCharPref("activescanner.uuid");
	var active_time = SL3U.getIntPref("activescanner.time");
	var timeout = Math.round(checkTimeout() / 1000);
	var func = "Sendlater3Backgrounding.checkUuid: ";
	var dbgMsg =
	    "uuid="         + uuid         + ", " +
	    "current_time=" + current_time + ", " +
	    "active_uuid="  + active_uuid  + ", " +
	    "active_time="  + active_time  + ", " +
	    "timeout="      + timeout;
        if (active_time && active_time > current_time) {
            SL3U.warn("Detected window active time in the future (" +
                      active_time + " > " + current_time + ")! Resetting.");
	    SL3U.setIntPref("activescanner.time", current_time);
            active_time = current_time;
        }
	if (active_uuid && active_uuid != "" && active_uuid != uuid) {
	    if (current_time - active_time > 2 * timeout) {
		if (capturable) {
		    SL3U.debug(func + "capturing: " + dbgMsg);
		    SL3U.setCharPref("activescanner.uuid", uuid);
		}
		else {
		    SL3U.debug(func + "can't capture: " + dbgMsg);
		    return false;
		}
	    }
	    else {
		SL3U.debug(func + "non-active window: " + dbgMsg);
		return false;
	    }
	}
	else if (active_uuid && active_uuid != "") {
	    SL3U.debug(func + "active window: " + dbgMsg);
	}
	else {
	    SL3U.debug(func + "first window: " + dbgMsg);
	    SL3U.setCharPref("activescanner.uuid", uuid);
	}
	SL3U.setIntPref("activescanner.time", current_time);
	return true;
    }

    function clearActiveUuidCallback() {
	if (! uuid) return;
	var active_uuid = SL3U.getCharPref("activescanner.uuid");
	if (active_uuid != uuid) return;
	var func = "Sendlater3Backgrounding.clearActiveUuidCallback: ";
	SL3U.debug(func + "clearing: uuid=" + uuid);
	SL3U.setCharPref("activescanner.uuid", "");
    }

    //mailnews.customDBHeaders 
    var installedCustomHeaders =
	SL3U.PrefService.getCharPref('mailnews.customDBHeaders');
    var changed = false;
    if (installedCustomHeaders.indexOf("x-send-later-at")<0) {
	SL3U.dump("Installing Custom X-Send-Later-At Header\n");
	installedCustomHeaders += " x-send-later-at";
	changed = true;
    }
    if (installedCustomHeaders.indexOf("x-send-later-uuid")<0) {
	SL3U.dump("Installing Custom X-Send-Later-Uuid Header\n");
	installedCustomHeaders += " x-send-later-uuid";
	changed = true;
    }
    if (installedCustomHeaders.indexOf("x-send-later-recur")<0) {
	SL3U.dump("Installing Custom X-Send-Later-Recur Header\n");
	installedCustomHeaders += " x-send-later-recur";
	changed = true;
    }
    if (installedCustomHeaders.indexOf("x-send-later-args")<0) {
	SL3U.dump("Installing Custom X-Send-Later-Args Header\n");
	installedCustomHeaders += " x-send-later-args";
	changed = true;
    }
    if (changed) {
	SL3U.PrefService.setCharPref('mailnews.customDBHeaders',
				     installedCustomHeaders);
    }

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
	    SL3U.Entering("Sendlater3Backgrounding.DisplayReportCallback.notify");
	    if (DisplayMessages.length>0) {
		var msg = DisplayMessages.shift();
		document.getElementById("sendlater3-status").value = msg;
	    }
	    else {
		timer.cancel();
	    }
	    SL3U.Leaving("Sendlater3Backgrounding.DisplayReportCallback.notify");
	}
    }

    function StatusReportMsg(msg) {
	SL3U.Entering("Sendlater3Backgrounding.StatusReportMsg");
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
	SL3U.Leaving("Sendlater3Backgrounding.StatusReportMsg");
    }

    var MessagesPending=0;
    var ProgressValue;
    var ProgressMax;

    function ProgressSet(str, where) {
	var n = document.getElementById("sendlater3-anim");
	n.max = ProgressMax;
	n.value = ProgressValue;
	SL3U.debug(str+"("+where+"): value="+n.value+", max="+n.max+
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

    function CopyUnsentListener(content, uri, hdr, sendat, recur, args) {
	this._content = content;
	this._uri = uri;
	this._hdr = hdr;
	this._sendat = sendat;
	this._recur = recur;
	this._args = args;
	SL3U.debug("Sendlater3Backgrounding.CopyUnsentListener: _sendat=" + 
		   this._sendat + ", _recur=" +  this._recur + ", _args=" + 
		   this._args);
    }

    var MessagesChecked = new Object();

    CopyUnsentListener.prototype = {
	QueryInterface : function(iid) {
	    SL3U.Entering("Sendlater3Backgrounding.CopyUnsentListener.QueryInterface");
	    if (iid.equals(Components.interfaces.nsIMsgCopyServiceListener) ||
		iid.equals(Components.interfaces.nsISupports)) {
		SL3U.Returning("Sendlater3Backgrounding.copyServiceListener.QueryInterface",
					 this);
		return this;
	    }
	    SL3U.Throwing("Sendlater3Backgrounding.CopyUnsentListener.QueryInterface",
				    Components.results.NS_NOINTERFACE);
	    throw Components.results.NS_NOINTERFACE;
	},

	OnProgress: function (progress, progressMax) {
	},

	OnStartCopy: function () {
	},

	OnStopCopy: function ( status ) {
	    SL3U.Entering("Sendlater3Backgrounding.CopyUnsentListener.OnStopCopy");
	    var copying = this.localFile;
	    if (copying.exists()) {
		try {
		    copying.remove(true);
		}
		catch (ex) {
		    // Windows still has it open.
		    SL3U.dump("Failed to delete " + copying.path +"; queuing.");
		    SL3U.WaitAndDelete(copying);
		}
	    }
	    if (! Components.isSuccessCode(status)) {
		Sendlater3Backgrounding.BackgroundTimer.cancel();
		Sendlater3Backgrounding.BackgroundTimer = undefined;
		SL3U.alert(window, null,
			   SL3U.PromptBundleGetFormatted("CopyUnsentError",
							 [status]));
		SL3U.Returning("Sendlater3Backgrounding.CopyUnsentListener.OnStopCopy", "");
		return;
	    }
	    sentThisTime[this._uri] = true;

	    var messageHDR = this._hdr;
	    var sendat = this._sendat;
	    var recur = this._recur;
	    var args = this._args;
	    var folder = messageHDR.folder;
	    var dellist;
	    if (SL3U.IsPostbox()) {
		dellist = Components.classes["@mozilla.org/supports-array;1"]
		    .createInstance(Components.interfaces.nsISupportsArray);
		dellist.AppendElement(messageHDR);
	    }
	    else {
		dellist = Components.classes["@mozilla.org/array;1"]
		    .createInstance(Components.interfaces.nsIMutableArray);
		dellist.appendElement(messageHDR, false);
	    }
	    messageHDR.folder.deleteMessages(dellist, msgWindow, true, false,
					     null, false);
	    if (SL3U.getBoolPref("sendunsentmessages")) {
		queueSendUnsentMessages();
		SL3U.dump ("Sending Message.");
	    }
	    else {
		SL3U.dump("Message deposited in Outbox.");
	    }
	    SetAnimTimer(3000);
	    if (recur) {
		if (args) {
		    args = JSON.parse(args);
		}
		var next = SL3U.NextRecurDate(new Date(sendat), recur, null,
					      args);
		SL3U.debug("Got from NextRecurDate: " + next)
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
		if (recur) {
		    var recurheader = SL3U.RecurHeader(next, recur, args);
                    for (name in recurheader) {
                        header += name + ": " + recurheader[name] + "\r\n";
                    }
		}
		content = content.replace(/\r\n\r\n/, header + "\r\n");
		content = content.replace(/^From .*\r\n/, "");
		SL3U.debug("Sendlater3Backgrounding.CopyUnsentListener.OnStopCopy: header=" + header);
		var listener = new CopyRecurListener(folder);
		SL3U.CopyStringMessageToFolder(content, folder, listener);
	    }
	    SL3U.Leaving("Sendlater3Backgrounding.CopyUnsentListener.OnStopCopy");
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
		    SL3U.dump("Failed to delete " + copying.path +"; queuing.");
		    SL3U.WaitAndDelete(copying);
		}
	    }

	    var listener = new Sendlater3Backgrounding
		.markReadListener(this._folder, this._key);
	    var notificationService = Components
		.classes["@mozilla.org/messenger/msgnotificationservice;1"]
		.getService(Components.interfaces
			    .nsIMsgFolderNotificationService);
	    if (SL3U.IsPostbox()) {
		notificationService.addListener(listener);
	    }
	    else {
		notificationService.addListener(listener, 
						notificationService.msgAdded);
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
	    SL3U.Entering("Sendlater3Backgrounding.AnimCallback.notify");
	    SL3U.debug("STATUS MESSAGE - " + MessagesPending);
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
	    SL3U.Leaving("Sendlater3Backgrounding.AnimCallback.notify");
	}
    }
    function SetAnimTimer(timeout) {
	SL3U.Entering("Sendlater3Backgrounding.SetAnimTimer");
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
	SL3U.Leaving("Sendlater3Backgrounding.SetAnimTimer");
    }

    function CheckDraftUuid(header, content) {
	var matches = content.match(/^X-Send-Later-Uuid:\s*(.*)/mi);
	if (matches) {
	    var draft_uuid = matches[1];
	    var instance_uuid = SL3U.getInstanceUuid();
	    if (draft_uuid != instance_uuid) {
		SL3U.debug("Skipping message with date " + header + " on uid" +
			   " mismatch (draft " + draft_uuid + " vs. instance " +
			   instance_uuid + ")");
		return false;
	    }
	    else {
		SL3U.debug("Draft uuid match: " + draft_uuid);
		return true;
	    }
	}
	else {
	    SL3U.debug("No draft uuid");
	    return true;
	}
    }

    // Can we assume that a read from a hung server will eventually time out
    // and cause onStopRequest to be called with an error status code, or are
    // we introducing a memory leak here by creating asynchronous listeners
    // that are going to hang around forever? That is, do we have to explicitly
    // set up timeouts to destroy the listeners that take too long to read? I'm
    // going to assume for now that we don't have to do that.

    var cycle = 0;

    function UriStreamListener(uri, messageHDR) {
	SL3U.Entering("Sendlater3Backgrounding.UriStreamListener", messageHDR);
    	this._content = "";
	this._cycle = cycle;
	this._uri = uri;
	this._messageHDR = messageHDR;
	this._header = messageHDR.getStringProperty("x-send-later-at");
	this._recur = messageHDR.getStringProperty("x-send-later-recur");
	this._args = messageHDR.getStringProperty("x-send-later-args");
	SL3U.debug("Sendlater3Backgrounding.UriStreamListener: _uri=" + this._uri +
		   ", _header=" + this._header + ", _recur=" + this._recur + ", _args=" +
		   this._args);
	SL3U.Leaving("Sendlater3Backgrounding.UriStreamListener");
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
	    SL3U.Entering("Sendlater3Backgrounding.UriStreamListener.onStartRequest");
	    SL3U.Leaving("Sendlater3Backgrounding.UriStreamListener.onStartRequest");
	},
	onStopRequest: function(aReq, aContext, aStatusCode) {
	    SL3U.Entering("Sendlater3Backgrounding.UriStreamListener.onStopRequest");
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

	    content = content
		.replace(/(\nDate:).*\n/i,"$1 " +
			 SL3U.FormatDateTime(new Date(), true)+"\n");
	    content = content.replace(/\nX-Send-Later-At:.*\n/i,
				      "\n");
	    content = content.replace(/\nX-Send-Later-Uuid:.*\n/i,
				      "\n");
	    content = content.replace(/\nX-Send-Later-Recur:.*\n/i,
				      "\n");
	    content = content.replace(/\nX-Send-Later-Args:.*\n/i,
				      "\n");
	    content = content.replace(/\nX-Enigmail-Draft-Status:.*\n/i,
				      "\n");

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
	    var fdrunsent = msgSendLater.getUnsentMessagesFolder(null);
	    var listener = new CopyUnsentListener(content,
						  this._uri,
						  messageHDR,
						  this._header,
						  this._recur,
						  this._args)
	    SL3U.CopyStringMessageToFolder(content, fdrunsent,listener);
	    ProgressFinish("finish streaming message");
	    SL3U.Leaving("Sendlater3Backgrounding.UriStreamListener.onStopRequest");
	},
	onDataAvailable: function(aReq, aContext, aInputStream, aOffset,
				  aCount) {
	    SL3U.Entering("Sendlater3Backgrounding.UriStreamListener.onDataAvailable");
	    var uuidOk = checkUuid(false);
	    var cycleOk = cycle == this._cycle;
	    if (! (uuidOk && cycleOk)) {
		this._content = "";
		aInputStream.close();
		SL3U.Returning("Sendlater3Backgrounding.UriStreamListener.onDataAvailable",
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
	    SL3U.Leaving("Sendlater3Backgrounding.UriStreamListener.onDataAvailable");
	}
    };

    var CheckThisURIQueue = new Array();
    var CheckThisURITimer;

    var CheckThisURICallback = {
	notify: function (timer) {
	    SL3U.Entering("Sendlater3Backgrounding.CheckThisUriCallback.notify");
	    if (CheckThisURIQueue.length == 0) {
		timer.cancel();
		SL3U.Returning("Sendlater3Backgrounding.CheckThisUriCallback.notify", "");
		return;
	    }

	    if (! checkUuid(false)) {
		CheckThisURIQueue = new Array();
		SL3U.Returning("Sendlater3Backgrounding.CheckThisUriCallback.notify", "");
		return;
	    }

	    var messageURI = CheckThisURIQueue.shift();
	    SL3U.debug("Checking message : " + messageURI);

	    if (MessagesChecked[messageURI]) {
		ProgressFinish("finish checking message");
		SL3U.debug("Skipping " + messageURI + " already checked");
		SL3U.Returning("Sendlater3Backgrounding.CheckThisUriCallback.notify", "(found in MessagesChecked)");
		return;
	    }

	    MessagesChecked[messageURI] = 1;

	    var MsgService = messenger.messageServiceFromURI(messageURI);
	    var messageHDR = messenger.msgHdrFromURI(messageURI);
	    var h_at = messageHDR.getStringProperty("x-send-later-at");
            var recur = messageHDR.getStringProperty("x-send-later-recur");
            if (recur)
                recur = SL3U.ParseRecurSpec(recur);
	    while (1) {
		if (! h_at) {
		    SL3U.debug(messageURI + ": no x-send-later-at");
		    break;
		}
		var h_uuid = messageHDR.getStringProperty("x-send-later-uuid");
		if (h_uuid != SL3U.getInstanceUuid()) {
		    SL3U.debug(messageURI + ": wrong uuid=" + h_uuid);
		    break;
		}
		SL3U.debug(messageURI + ": good uuid=" + h_uuid);
		if (new Date() < new Date(h_at)) {
		    SL3U.debug(messageURI + ": early x-send-later-at=" + h_at);
		    lastMessagesPending = ++MessagesPending;
		    SL3U.dump(MessagesPending + " messages still pending");
		    break;
		}
                SL3U.warn("Dorkle diff=" + ((new Date() - new Date(h_at)) / 1000 / 60));
                SL3U.warn("Dorkle late_grace_period=" + SL3U.getIntPref("late_grace_period"));
                SL3U.warn("Dorkle block_late_messages=" + SL3U.getBoolPref("block_late_messages"));
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
                if (recur && (recur.between || recur.days) &&
                    SL3U.getBoolPref("enforce_restrictions")) {
                    var now = new Date();
                    var adjusted = SL3U.AdjustDateForRestrictions(
                        now, recur.between.start, recur.between.end,
                        recur.days);
                    if (now.getTime() != adjusted.getTime()) {
                        SL3U.debug(messageURI + ": enforcing restrictions on " +
                                   now + " until " + adjusted);
                        lastMessagesPending = ++MessagesPending;
                        SL3U.dump(MessagesPending + " messages still pending");
                        break;
                    }                        
                }
		SL3U.debug(messageURI + ": due x-send-later-at=" + h_at);
		if (! SL3U.getBoolPref("senddrafts")) {
		    SL3U.debug(messageURI + ": senddrafts is false");
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
		    SL3U.warn("Skipping " + messageURI + " -- resend!");
		    break;
		}
		ProgressAdd("start streaming message");
		MsgService.streamMessage(messageURI,
					 new UriStreamListener(messageURI, messageHDR),
					 msgWindow, null, false, null);
		break;
	    }
	    ProgressFinish("finish checking message");
	    SetAnimTimer(3000);
	    SL3U.Leaving("Sendlater3Backgrounding.CheckThisUriCallback.notify");
	}
    }

    // We use a queue of URIs to be checked, and only allow one URI to be
    // checked each time the timer fires, so that we don't block for a
    // long time checking drafts and cause the UI to hang or respond
    // sluggishly.
    function CheckThisURIQueueAdd(messageURI) {
	SL3U.Entering("Sendlater3Backgrounding.CheckThisURIQueueAdd", messageURI);
	if (CheckThisURIQueue.length == 0) {
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
	SL3U.Leaving("Sendlater3Backgrounding.CheckThisURIQueueAdd");
    }

    // folderstocheck is a hash of folders waiting to be checked in this
    // cycle. foldersdone is a hash of folders we've already checked in this
    // cycle. folderstocheck grows when we scan all the draft folders in
    // CheckForSendLaterCallback. folderstocheck shrinks and foldersdone grows
    // when we process a folder in the folderLoadListener. We need to keep
    // track of both folderstocheck and folderstodone because we call
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
		SL3U.debug("Rebuilding summary: " + folder.URI);
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
	    SL3U.dump ("Got Enumerator\n");
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
	    SL3U.dump("No Enumerator\n");
	}
    };

    var folderLoadListener = {
	OnItemEvent: function(folder, event) {
	    if (! folder) {
		SL3U.Returning("Sendlater3Backgrounding.folderLoadListener.OnItemEvent", "no folder");
		return;
	    }
	    SL3U.Entering("Sendlater3Backgrounding.folderLoadListener.OnItemEvent", folder.URI, event);

	    if (! checkUuid(false)) {
		SL3U.Returning("Sendlater3Backgrounding.folderLoadListener.OnItemEvent", "! checkUuid");
		return;
	    }

	    var eventType = event.toString();

	    if (eventType == "FolderLoaded") {
		if (folderstocheck[folder.URI]) {
		    SetAnimTimer(3000);
		    SL3U.dump("FolderLoaded checking: "+folder.URI);
		    delete folderstocheck[folder.URI];
		    foldersdone[folder.URI] = 1;
		    CheckLoadedFolder(folder);
		    ProgressFinish("finish checking folder");
		}
	    }
	    else if (eventType == "Immediate") {
		SetAnimTimer(3000);
		SL3U.dump("Immediate checking: "+folder.URI);
		CheckLoadedFolder(folder);
		ProgressFinish("finish checking folder");
	    }

	    SL3U.Leaving("Sendlater3Backgrounding.folderLoadListener.OnItemEvent");
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
	    SL3U.Entering("Sendlater3Backgrounding.CheckForSendLaterCallback.notify");

	    Sendlater3Backgrounding.BackgroundTimer.initWithCallback(
		CheckForSendLaterCallback,
		checkTimeout() + Math.ceil(Math.random()*3000)-1500,
		Components.interfaces.nsITimer.TYPE_ONE_SHOT
	    );

	    if (! checkUuid(true)) {
		SL3U.Returning("Sendlater3Backgrounding.CheckForSendLaterCallback.notify", "");
		return;
	    }

	    if (! (SL3U.getBoolPref("send_while_offline") ||
		   SL3U.isOnline())) {
		SL3U.debug("Deferring send while offline");
		SL3U.Returning("Sendlater3Backgrounding.CheckForSendLaterCallback.notify", "");
		return;
	    }		

	    SL3U.debug("One cycle of checking");

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
		    SL3U.debug("Removed from sentAlerted: " + uri);
		}
	    }

	    folderstocheck = new Object();
	    foldersdone = new Object();
	    MessagesChecked = new Object();

	    
	    SL3U.debug("Progress Animation SET");
	    if (displayprogressbar()) {
		document.getElementById("sendlater3-deck").selectedIndex = 0;
	    }

	    var CheckFolder = function(folder, schedule, msg) {
		var uri = folder.URI;
		if (folderstocheck[uri] || foldersdone[uri]) {
		    SL3U.debug("Already done - " + uri);
		    return;
		}
		if (schedule) {
		    folderstocheck[uri] = 1;
		    SL3U.dump("SCHEDULE " + msg + " - " + uri);
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
			SL3U.debug("updateFolder on " + uri + " failed");
		    }
		}
		else {
		    foldersdone[uri] = 1;
		}
		// We need to do an immediate scan always, even if
		// we're also doing a scheduled scan, because
		// sometimes updateFolder doesn't generate a folder
		// loaded event. *sigh*
		SL3U.dump("IMMEDIATE " + msg + " - " + uri);
		ProgressAdd(msg + " immediate");
		folderLoadListener.OnItemEvent(folder, "Immediate");
	    }
	    
	    CheckFolder(SL3U.FindSubFolder(fdrlocal, "Drafts"), true,
			"local Drafts folder");
	    // Local Drafts folder might have different name, e.g., in other
	    // locales.
	    var local_draft_pref = SL3U.PrefService
		.getComplexValue('mail.identity.default.draft_folder',
				 Components.interfaces.nsISupportsString).data;
	    SL3U.debug("mail.identity.default.draft_folder=" +local_draft_pref);
	    if (local_draft_pref) {
		var folder;
		// Will fail if folder doesn't exist
		try {
		    folder = getMsgFolderFromUri(local_draft_pref);
		}
		catch (e) {
		    SL3U.debug("default Drafts folder " + local_draft_pref +
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
		SetAnimTimer(5000);
		SL3U.debug("Progress Animation RESET");
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
		    SL3U.debug(thisaccount.incomingServer.type + 
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
			SL3U.debug("skipping this server type - " +thisaccount);
			break;
		    }
		}
	    }
	    SL3U.Leaving("Sendlater3Backgrounding.CheckForSendLaterCallback.notify");
	}
    }

    var SetUpStatusBar = {
	observe: function() {
	    var showStatus = SL3U.getBoolPref("showstatus");
	    document.getElementById("sendlater3-deck")
		.setAttribute("hidden", ! showStatus);
	}
    };

    function StartMonitorCallback() {
	SL3U.Entering("Sendlater3Backgrounding.StartMonitorCallback");
	SL3U.debug("Starting monitor [for every " + checkTimeout() + "ms]");
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
	SL3U.Leaving("Sendlater3Backgrounding.StartMonitorCallback");
    }

    function StopMonitorCallback() {
	SL3U.Entering("Sendlater3Backgrounding.StopMonitorCallback");
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
	SL3U.Leaving("Sendlater3Backgrounding.StopMonitorCallback");
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
	if (old_numbers.length != current_numbers.length)
	    return true;
	if (old_numbers < 2)
	    return true;
	if (old_numbers[0] != current_numbers[0] ||
	    old_numbers[1] != current_numbers[1])
	    return true;
	return false;
    }
    
    function DisplayReleaseNotes() {
	if (! SL3U.IsPostbox()) {
	    var enabledItems;
	    try {
		var enabledItems = SL3U.PrefService
		    .getCharPref("extensions.enabledAddons");
	    }
	    catch (e) {
		var enabledItems = SL3U.PrefService
		    .getCharPref("extensions.enabledItems");
	    }

	    var matches = enabledItems.match(/sendlater3(@|%40)kamens\.us:([^,]+)/);
	    if (matches) {
		var current_version = matches[2];
		var relnotes = SL3U.getCharPref("relnotes");
		SL3U.setCharPref("relnotes", current_version);
		if (ShouldDisplayReleaseNotes(relnotes, current_version)) {
		    var url = "http://blog.kamens.us/send-later-3/#notes-" +
			current_version;
		    Components
			.classes['@mozilla.org/appshell/window-mediator;1']
			.getService(Components.interfaces.nsIWindowMediator)
			.getMostRecentWindow("mail:3pane")
			.document.getElementById("tabmail")
			.openTab("contentTab", {contentPage: url});

		    // Migrate old preferences
		    try {
			var value = SL3U.getBoolPref("dropdowns.showintoolbar");
			SL3U.setBoolPref("entry.showintoolbar", value);
			SL3U.PrefService.clearUserPref(SL3U.pref("dropdowns.showintoolbar"));
		    }
		    catch (ex) {}

		    var numbers = relnotes.split(".");
		    if ((numbers[0] < 4) &&
			SL3U.PrefService.prefHasUserValue(SL3U.pref("checktimepref"))) {
			var old = SL3U.getIntPref("checktimepref");
			if (old < 60000) {
			    old = 60000;
			}
			var converted = Math.floor(old / 60000);
			SL3U.setIntPref("checktimepref", converted);
		    }			
		}
	    }	
	}
    }

    // BackgroundTimer = Components
    //     .classes["@mozilla.org/timer;1"]
    //     .createInstance(Components.interfaces.nsITimer);
    // BackgroundTimer.initWithCallback(
    //     StartMonitorCallback,
    //     5000,
    //     Components.interfaces.nsITimer.TYPE_ONE_SHOT
    //     );

    SetUpStatusBar.observe();
    SL3U.PrefService.QueryInterface(Components.interfaces.nsIPrefBranch2);
    SL3U.PrefService.addObserver(SL3U.pref("showstatus"),SetUpStatusBar, false);

    StartMonitorCallback();
    window.addEventListener("unload", StopMonitorCallback, false);

    DisplayReleaseNotes();

    SL3U.Leaving("Sendlater3Backgrounding");
    addMsgSendLaterListener();
}

Sendlater3Backgrounding.markReadListener = function(folder, key) {
    this._folder = folder;
    this._key = key;
}

Sendlater3Backgrounding.markReadListener.prototype = {
    // Thunderbird 2 and Postbox
    itemAdded: function(item) {
	var aMsgHdr = item.QueryInterface(Components.interfaces.nsIMsgDBHdr);
	this.msgAdded(aMsgHdr);
    },

    // Thunderbird 3
    msgAdded: function(aMsgHdr) {
        var readlist;
	if (this._folder == aMsgHdr.folder &&
	    this._key == aMsgHdr.messageKey) {
	    if (SL3U.IsPostbox()) {
		readlist = Components.classes["@mozilla.org/supports-array;1"]
		    .createInstance(Components.interfaces.nsISupportsArray);
		readlist.AppendElement(aMsgHdr);
	    }
	    else {
		readlist = Components.classes["@mozilla.org/array;1"]
		    .createInstance(Components.interfaces.nsIMutableArray);
		readlist.appendElement(aMsgHdr, false);
	    }
	    aMsgHdr.folder.markMessagesRead(readlist, true);
	    dump("MarkRead\n");
	}
	var notificationService = Components
	    .classes["@mozilla.org/messenger/msgnotificationservice;1"]
	    .getService(Components.interfaces
			.nsIMsgFolderNotificationService);
	notificationService.removeListener(this);
    }
};

window.addEventListener("load", Sendlater3Backgrounding, false);
