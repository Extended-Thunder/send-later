try {
    Components.utils.import("resource:///modules/gloda/log4moz.js");
}
catch (ex) {
}

var Sendlater3Util = {
    alert: function(window, title, text) {
	var promptService = Components
	    .classes["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Components.interfaces.nsIPromptService);
	promptService.alert(window, title, text);
    },

    PrefService: Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch),

    pref: function(tail) {
	return "extensions.sendlater3." + tail;
    },

    getCharPref: function(tail) {
	var pref = Sendlater3Util.pref(tail);
	return Sendlater3Util.PrefService.getCharPref(pref);
    },

    setCharPref: function(tail, value) {
	var pref = Sendlater3Util.pref(tail);
	return Sendlater3Util.PrefService.setCharPref(pref, value);
    },

    getIntPref: function(tail) {
	var pref = Sendlater3Util.pref(tail);
	return Sendlater3Util.PrefService.getIntPref(pref);
    },

    setIntPref: function(tail, value) {
	var pref = Sendlater3Util.pref(tail);
	return Sendlater3Util.PrefService.setIntPref(pref, value);
    },

    getBoolPref: function(tail) {
	var pref = Sendlater3Util.pref(tail);
	return Sendlater3Util.PrefService.getBoolPref(pref);
    },

    setBoolPref: function(tail, value) {
	var pref = Sendlater3Util.pref(tail);
	return Sendlater3Util.PrefService.setBoolPref(pref, value);
    },

    _PromptBundle: null,

    isOnline: function() {
	if (Sendlater3Util.IsSeaMonkey()) {
	    // MailOfflineMgr doesn't exist in SeaMonkey
	    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);
	    return (!ioService.offline);
	}
	else {
	    return MailOfflineMgr.isOnline();
	}
    },

    IsSeaMonkey: function() {
	var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULAppInfo);
	return(appInfo.name == "SeaMonkey");
    },

    IsPostbox: function() {
	var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULAppInfo);
	return(appInfo.name == "Postbox");
    },

    FindSubFolder: function(folder, name) {
	if (Sendlater3Util.IsPostbox()) {
	    return folder.FindSubFolder(name);
	}
	else {
	    return folder.findSubFolder(name);
	}
    },

    HeaderRowId: function() {
	if (Sendlater3Util.IsSeaMonkey()) {
	    return "sendlater3-expanded-Box";
	}
	else {
	    return "sendlater3-expanded-Row";
	}
    },

    ComposeToolboxName: function() {
	if (Sendlater3Util.IsPostbox()) {
	    return "compose-toolbox2";
	}
	else {
	    return "compose-toolbox";
	}
    },

    SetTreeAttribute: function(object, attribute, value) {
	// if object doesn't have setAttribute, it also doesn't have children
	try {
	    object.setAttribute(attribute, value);
	    var i;
	    for (i = 0; i < object.childNodes.length; i++) {
		this.SetTreeAttribute(object.childNodes[i], attribute, value);
	    }
	}
	catch (ex) {}
    },

    PromptBundleGet: function(name) {
	Sendlater3Util.Entering("Sendlater3Util.PromptBundleGet", name);
	if (Sendlater3Util._PromptBundle == null) {
	    Sendlater3Util._PromptBundle =
		document.getElementById("sendlater3-promptstrings");
	}
	Sendlater3Util.Returning("Sendlater3Util.PromptBundleGet",
				 Sendlater3Util._PromptBundle.getString(name));
	return Sendlater3Util._PromptBundle.getString(name);
    },

    PromptBundleGetFormatted: function(name, params) {
	Sendlater3Util.Entering("Sendlater3Util.PromptBundleGetFormatted", name,
				params, length);
	if (Sendlater3Util._PromptBundle == null) {
	    Sendlater3Util._PromptBundle =
		document.getElementById("sendlater3-promptstrings");
	}
	var formatted = Sendlater3Util._PromptBundle
	    .getFormattedString(name, params)
	Sendlater3Util.Returning("Sendlater3Util.PromptBundleGetFormatted",
				 formatted);
	return formatted;
    },

    UpdatePref: function(key) {
	return Sendlater3Util.pref("update_needed." + key);
    },

    SetUpdatePref: function(key) {
	Sendlater3Util.Entering("Sendlater3Util.SetUpdatePref", key);
	Sendlater3Util.PrefService.setBoolPref(Sendlater3Util.UpdatePref(key),
					       true);
	Sendlater3Util.Leaving("Sendlater3Util.SetUpdatePref", key);
    },

    GetUpdatePref: function(key) {
	Sendlater3Util.Entering("Sendlater3Util.GetUpdatePref", key);
	var pref = Sendlater3Util.UpdatePref(key);
	var value;
	try {
	    value = Sendlater3Util.PrefService.getBoolPref(pref);
	    Sendlater3Util.PrefService.deleteBranch(pref);
	}
	catch (ex) {
	    value = false;
	}
	Sendlater3Util.Returning("Sendlater3Util.GetUpdatePref", value);
	return value;
    },

    ButtonLabel: function(num) {
	Sendlater3Util.Entering("Sendlater3Util.ButtonLabel", num);
    	var label = Sendlater3Util.PrefService.
	    getComplexValue(Sendlater3Util.pref("quickoptions." + num +
						".label"),
			    Components.interfaces.nsISupportsString).data;
	if (label == "<from locale>") {
	    label = Sendlater3Util.PromptBundleGet("Button" + num + "Label");
	}
	Sendlater3Util.Returning("Sendlater3Util.ButtonLabel", label);
	return label;
    },

    ShortcutValue: function(num, validate) {
	Sendlater3Util.Entering("Sendlater3Util.ShortcutValue", num, validate);
	if (validate == undefined) {
	    validate = false;
	}
	var raw = Sendlater3Util.getCharPref("quickoptions." + num +
					     ".valuestring");
	if (raw.match(/^[0-9]+$/)) {
	    Sendlater3Util.Returning("Sendlater3Util.ShortcutValue", raw);
	    return raw;
	}
	else if (raw.match(/^[A-Za-z_$][A-Za-z0-9_$]*$/)) {
	    var func = window[raw];
	    if (typeof(func) == "undefined") {
		Sendlater3Util.warn("Invalid setting for quick option " + num + 
				    ": function \"" + raw + 
				    "\" is not defined");
		return; // undefined
	    }
	    else if (typeof(func) != "function") {
		Sendlater3Util.warn("Invalid setting for quick option " + num + 
				    ": \"" + raw + "\" is not a function");
		return; // undefined
	    }
	    if (validate) {
		var v = func();
		if (typeof(v) != "number") {
		    Sendlater3Util.warn("Invalid setting for quick option " + 
					num + ": \"" + raw + 
					"()\" does not return a number");
		    return; // undefined
		}
	    }
	    v = raw + "()";
	    Sendlater3Util.Returning("Sendlater3Util.ShortcutValue", v);
	    return v;
	}
	Sendlater3Util.warn("Invalid setting for quick option " + num + ": \"" +
			    raw + "\" is neither a number nor a function " +
			    "that returns a number");
	return; // undefined
    },

    FormatDateTime: function(thisdate,includeTZ) {
	Sendlater3Util.Entering("Sendlater3Util.FormatDateTime", thisdate,
				includeTZ);
	var s="";
	var sDaysOfWeek = [ "Sun","Mon","Tue","Wed","Thu","Fri","Sat" ];
	var sMonths= ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep",
	    	      "Oct","Nov","Dec"];

	var offset = thisdate.getTimezoneOffset();
	s += sDaysOfWeek[thisdate.getDay()];
	s += ", ";
	s += thisdate.getDate();
	s += " ";
	s += sMonths[thisdate.getMonth()];
	s += " ";
	s+=( thisdate.getFullYear());
	s += " ";
	var val = thisdate.getHours();
	if (val < 10)
	    s += "0";
	s += val;
	s += ":";
	val = thisdate.getMinutes();
	if (val < 10)
	    s += "0";
	s+= val;
	s += ":";
	val = thisdate.getSeconds();
	if (val < 10)
	    s += "0";
	s+=val;
	if (includeTZ) {
	    s += " ";
	    if (offset < 0) 
	    {
		offset *= -1;
		s += "+";
	    }
	    else
		s += "-";

	    val = Math.floor (offset / 60);
	    if (val < 10)
		s += "0";
	    s+=val;
	    val = Math.floor (offset % 60);
	    if (val < 10)
		s += "0";
	    s+=val;
	}
	Sendlater3Util.Returning("Sendlater3Util.FormatDateTime", s);
	return s;
    },

    NextRecurTest: function() {
	var tests = new Array(
	    new Array("1/1/2012", "daily", "1/1/2012", "1/2/2012"),
	    new Array("1/2/2012", "weekly", "1/10/2012", "1/16/2012"),
	    new Array("1/5/2012", "monthly 5", "1/5/2012", "2/5/2012"),
	    new Array("3/1/2012", "monthly 30", "3/1/2012", "3/30/2012"),
	    new Array("4/15/2012", "monthly 0 3", "4/15/2012", "5/20/2012"),
	    new Array("1/29/2012", "monthly 0 5", "1/30/2012", "4/29/2012"),
	    new Array("2/29/2012", "yearly 1 29", "2/29/2012", "3/1/2013"),
	    new Array("3/1/2013", "yearly 1 29 / 3", "3/1/2013", "2/29/2016")
	);

	var i;
	for (i in tests) {
	    var test = tests[i];
	    var result = SL3U.NextRecurDate(new Date(test[0]),
					    test[1],
					    new Date(test[2]));
	    var expected = new Date(test[3]);
	    if (result.getTime() == expected.getTime()) {
		SL3U.warn("NextRecurTest: PASS " + i);
	    }
	    else {
		SL3U.warn("NextRecurTest: FAIL " + i + ", expected " +
			  expected + ", got " + result);
	    }
	}
    },

    NextRecurDate: function(next, recurSpec, now) {
	// Make sure we don't modify our input!
	next = new Date(next.getTime());

	var type, dayOfMonth, dayOfWeek, weekOfMonth, monthOfYear, recurCount;

	var recurArray = recurSpec.split(" ");
	type = recurArray[0];
	recurArray.splice(0, 1);
	if (type == "monthly") {
	    dayOfMonth = recurArray[0];
	    recurArray.splice(0, 1);
	    if ((recurArray.length > 0) && recurArray[0].match(/^[0-9]+/)) {
		dayOfWeek = dayOfMonth;
		dayOfMonth = null;
		weekOfMonth = recurArray[0];
		recurArray.splice(0, 1);
	    }
	}
	else if (type == "yearly") {
	    monthOfYear = recurArray[0];
	    dayOfMonth = recurArray[1];
	    recurArray.splice(0,2);
	}
	if ((recurArray.length > 1) && (recurArray[0] == "/")) {
	    recurCount = recurArray[1];
	    recurArray.splice(0, 2);
	}
	else {
	    recurCount = 1;
	}
	if (recurArray.length > 0) {
	    throw "Send Later 3 internal error: extra recurrence args: " + recurArray.toString();
	}

	if (! now) {
	    now = new Date();
	}

	var redo = false;

	// test 0: next < now
	// test 1: next > now
	// test 0: recurCount == 1
	// test 7: recurCount == 3
	while ((next <= now) || (recurCount > 0) || redo) {
	    redo = false;
	    switch (type) {
	    // test 0
	    case "daily":
		next.setDate(next.getDate()+1);
		break;
	    // test 1
	    case "weekly":
		next.setDate(next.getDate()+7);
		break;
	    case "monthly":
		// Two different algorithms are in play here,
		// depending on whether we're supposed to schedule on
		// a day of the month or a weekday of a week of the
		// month.
		//
		// If the former, then either the current day
		// of the month is the same as the one we want, in
		// which case we just move to the next month, or it's
		// not, in which case the "correct" month didn't have
		// that day (i.e., it's 29, 30, or 31 on a month
		// without that many days), so we ended up rolling
		// over. In that case, we set the day of the month of
		// the _current_ month, because we're already in the
		// right month.
		//
		// If the latter, then first check if we're at the
		// correct weekday and week of the month. If so, then
		// go to the first day of the next month. After that,
		// move forward to the correct week of the month and
		// weekday.  If that pushes us past the end of the
		// month, that means the month in question doesn't
		// have, e.g., a "5th Tuesday", so we need to set the
		// redo flag indicating that we need to go through the
		// loop again because we didn't successfully find a
		// date.

		if (dayOfMonth != null) {
		    // test 2
		    if (next.getDate() == dayOfMonth) {
			next.setMonth(next.getMonth()+1);
		    }
		    // test 3
		    else {
			next.setDate(dayOfMonth);
		    }
		}
		else {
		    // test 4
		    if ((next.getDay() == dayOfWeek) &&
			(Math.ceil(next.getDate()/7) == weekOfMonth)) {
			next.setDate(1);
			next.setMonth(next.getMonth()+1);
		    }
		    else {
			// test 5
		    }
		    next.setDate((weekOfMonth-1)*7+1);
		    while (next.getDay() != dayOfWeek) {
			next.setDate(next.getDate()+1);
		    }
		    if (Math.ceil(next.getDate()/7) != weekOfMonth) {
			redo = true;
		    }
		}
		break;
	    case "yearly":
		// test 6
		// test 7
		next.setFullYear(next.getFullYear()+1);
		next.setMonth(monthOfYear);
		next.setDate(dayOfMonth);
		break;
	    default:
		throw "Send Later 3 internal error: unrecognized recurrence type: " + type;
		break;
	    }
		
	    recurCount--;
	}

	return next;
    },

    FormatRecur: function(recurSpec) {
	var type, dayOfMonth, dayOfWeek, weekOfMonth, monthOfYear, recurCount;
	var str = "";

	var recurArray = recurSpec.split(" ");
	type = recurArray[0];
	recurArray.splice(0, 1);
	if (type == "monthly") {
	    dayOfMonth = recurArray[0];
	    recurArray.splice(0, 1);
	    if ((recurArray.length > 0) && recurArray[0].match(/^[0-9]+/)) {
		dayOfWeek = dayOfMonth;
		dayOfMonth = null;
		weekOfMonth = recurArray[0];
		recurArray.splice(0, 1);
	    }
	}
	else if (type == "yearly") {
	    monthOfYear = recurArray[0];
	    dayOfMonth = recurArray[1];
	    recurArray.splice(0,2);
	}
	if ((recurArray.length > 1) && (recurArray[0] == "/")) {
	    recurCount = recurArray[1];
	    recurArray.splice(0, 2);
	}
	else {
	    recurCount = 1;
	}
	if (recurArray.length > 0) {
	    throw "Send Later 3 internal error: extra recurrence args: " + recurArray.toString();
	}

	if (recurCount == 1) {
	    str = SL3U.PromptBundleGet(type);
	}
	else {
	    str = SL3U.PromptBundleGetFormatted("every_"+type, [recurCount]);
	}
	
	if (dayOfWeek != null) {
	    str += ", " + SL3U.PromptBundleGetFormatted("everymonthly_short",
							[SL3U.PromptBundleGet("ord"+weekOfMonth),
							 SL3U.PromptBundleGet("day"+dayOfWeek)]);
	}

	return str;
    },

    logger: null,

    warn: function(msg) {
	try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.warn(msg);
	}
	catch (ex) {
	}
    },

    dump: function(msg) {
	try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.info(msg);
	}
	catch (ex) {
	}
    },

    debug: function(msg) {
	try {
            Sendlater3Util.initLogging();
    	    Sendlater3Util.logger.debug(msg);
	}
	catch (ex) {
	}
    },

    trace: function(msg) {
	try {
            Sendlater3Util.initLogging();
    	    Sendlater3Util.logger.trace(msg);
	}
	catch (ex) {
	}
    },

    initLogging: function() {
	try {
	    if (Sendlater3Util.logger == null) {
		Sendlater3Util.logger =
		    Log4Moz.getConfiguredLogger("extensions.sendlater3",
						Log4Moz.Level.Trace,
						Log4Moz.Level.Info,
						Log4Moz.Level.Debug);
		Sendlater3Util.logger.debug("Initialized logging");
	    }
	}
	catch (ex) {
	}
    },

    reinitLogging: {
	observe: function() {
	    try {
		Sendlater3Util.Entering("Sendlater3Util.reinitLogging.observe");
		// This is really disgusting.
		delete Log4Moz.repository._loggers["extensions.sendlater3"];
		Sendlater3Util.logger = null;
		Sendlater3Util.initLogging();
		Sendlater3Util.Leaving("Sendlater3Util.reinitLogging.observe");
	    }
	    catch (ex) {
	    }
	},
    },

    getInstanceUuid: function() {
	var instance_uuid = Sendlater3Util.getCharPref("instance.uuid");
	if (! instance_uuid) {
	    var uuidGenerator = 
		Components.classes["@mozilla.org/uuid-generator;1"]
		.getService(Components.interfaces.nsIUUIDGenerator);
	    instance_uuid = uuidGenerator.generateUUID().toString();
	    Sendlater3Util.setCharPref("instance.uuid", instance_uuid);
	}
	return instance_uuid;
    },

    toSendDate: function(year, month, day, hour, min) {
	// We use an existing Date object to get the number of seconds
	// so that we don't end up sending every message at exactly
	// the same number of seconds past the minute. That would look
	// weird.
	var sendat = new Date();
	// We use an existing Date object to get the number of seconds
	// so that we don't end up sending every message at exactly
	// the same number of seconds past the minute. That would look
	// weird.
	sendat = new Date(parseInt(year), parseInt(month), parseInt(day),
			  parseInt(hour), parseInt(min), sendat.getSeconds(),
			  0);
	return sendat;
    },

    initUtil: function() {
	Sendlater3Util.Entering("Sendlater3Util.initUtil");
	Sendlater3Util.PrefService
	    .QueryInterface(Components.interfaces.nsIPrefBranch2);
	Sendlater3Util.consoleObserver =
	    Sendlater3Util.PrefService.addObserver(
		Sendlater3Util.pref("logging.console"),
		Sendlater3Util.reinitLogging, false);
	Sendlater3Util.dumpObserver =
	    Sendlater3Util.PrefService.addObserver(
		Sendlater3Util.pref("logging.dump"),
		Sendlater3Util.reinitLogging, false);
	Sendlater3Util.Leaving("Sendlater3Util.initUtil");
    },

    uninitUtil: function() {
	Sendlater3Util.Entering("Sendlater3Util.uninitUtil");
	Sendlater3Util.PrefService
	    .QueryInterface(Components.interfaces.nsIPrefBranch2);
	Sendlater3Util.PrefService.removeObserver(
	    Sendlater3Util.pref("logging.console"),
	    Sendlater3Util.reinitLogging);
	Sendlater3Util.PrefService.removeObserver(
	    Sendlater3Util.pref("logging.dump"),
	    Sendlater3Util.reinitLogging);
	Sendlater3Util.Leaving("Sendlater3Util.uninitUtil");
    },

    DZFormat: function(val) {
	var ret;
	if (val < 10) ret = "0" + val; else ret = val;
	return ret;
    },

    copyService: null,
    fileNumber: 0,

    CopyStringMessageToFolder: function(content, folder, listener) {
	var dirService = Components
	    .classes["@mozilla.org/file/directory_service;1"]
	    .getService(Components.interfaces.nsIProperties);
	var tempDir = dirService.get("TmpD", Components.interfaces.nsIFile);
	var sfile = Components.classes["@mozilla.org/file/local;1"]
	    .createInstance(Components.interfaces.nsILocalFile);
	sfile.initWithPath(tempDir.path);
	sfile.appendRelativePath("tempMsg" + Sendlater3Util.getInstanceUuid()
				 + Sendlater3Util.fileNumber++ + ".eml");
	var filePath = sfile.path;
	Sendlater3Util.dump("Saving message to " + filePath);
	if (sfile.exists()) sfile.remove(true);
	sfile.create(sfile.NORMAL_FILE_TYPE, 0600);
	var stream = Components
	    .classes['@mozilla.org/network/file-output-stream;1']
	    .createInstance(Components.interfaces.nsIFileOutputStream);
	stream.init(sfile, 2, 0x200, false);
	stream.write(content, content.length);
	stream.close();
	// Separate stream required for reading, since
	// nsIFileOutputStream is write-only on Windows (and for
	// that matter should probably be write-only on Linux as
	// well, since it's an *output* stream, but it doesn't
	// actually behave that way).
	sfile = Components.classes["@mozilla.org/file/local;1"]
	    .createInstance(Components.interfaces.nsILocalFile);
	sfile.initWithPath(filePath);
	listener.localFile = sfile;
	if (! Sendlater3Util.copyService) {
	    Sendlater3Util.copyService = Components
		.classes["@mozilla.org/messenger/messagecopyservice;1"]
		.getService(Components.interfaces.nsIMsgCopyService);
	}
	if (Sendlater3Util.IsPostbox()) {
	    Sendlater3Util.copyService.CopyFileMessage(sfile, folder, 0, "",
						       listener, msgWindow);
	}
	else {
	    Sendlater3Util.copyService.CopyFileMessage(sfile, folder, null,
						       false, 0, "", listener,
						       msgWindow);
	}
    },

    WaitAndDelete: function(file_arg) {
	var timer = Components.classes["@mozilla.org/timer;1"]
	    .createInstance(Components.interfaces.nsITimer);
	var callback = {
	    file: file_arg,
	    // creating a circular reference on purpose so objects won't be
	    // deleted until we eliminate the circular reference.
	    timer_ref: timer,
	    notify: function(timer) {
		try {
		    this.file.remove(true);
		    this.timer_ref = undefined;
		    timer.cancel();
		    Sendlater3Util.dump("Successfully deleted queued "
					+ this.file.path);
		}
		catch (ex) {
		    Sendlater3Util.dump("Failed to delete "
					+ this.file.path);
		}
	    }
	};
	timer.initWithCallback(callback, 100, Components.interfaces.nsITimer
			       .TYPE_REPEATING_SLACK);
    },

    Entering: function() {
    	var func = arguments[0];
	var msg = "Entering " + func;
	var a = new Array();
	var i;
	for (i = 1; i < arguments.length; i++) {
	    a.push(arguments[i]);
	}
	if (a.length > 0) {
	    msg = msg + "(" + a.join(", ") + ")";
	}
        Sendlater3Util.trace(msg);
    },

    Leaving: function(func) {
        Sendlater3Util.trace("Leaving " + func);
    },

    Returning: function(func, value) {
        Sendlater3Util.trace("Returning \"" + value + "\" from " + func);
    },

    Throwing: function(func, error) {
        Sendlater3Util.trace("Throwing \"" + error + "\" from " + func);
    }
};

var SL3U = Sendlater3Util;
