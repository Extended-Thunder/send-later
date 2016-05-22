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

    appName: function() {
	var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULAppInfo);
        return appInfo.name;
    },

    IsSeaMonkey: function() {
	return(Sendlater3Util.appName() == "SeaMonkey");
    },

    IsPostbox: function() {
	return(Sendlater3Util.appName() == "Postbox");
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

    SetTreeProperty: function(object, property, value) {
	try {
	    object[property] = value;
	    var i;
	    for (i = 0; i < object.childNodes.length; i++) {
		this.SetTreeProperty(object.childNodes[i], property, value);
	    }
	}
	catch (ex) {}
    },

    PromptBundleGet: function(name) {
	Sendlater3Util.Entering("Sendlater3Util.PromptBundleGet", name);
	Sendlater3Util.Returning("Sendlater3Util.PromptBundleGet",
				 Sendlater3Util._PromptBundle.getString(name));
	return Sendlater3Util._PromptBundle.getString(name);
    },

    PromptBundleGetFormatted: function(name, params) {
	Sendlater3Util.Entering("Sendlater3Util.PromptBundleGetFormatted", name,
				params, length);
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

    ButtonLabel: function(num, btn) {
	Sendlater3Util.Entering("Sendlater3Util.ButtonLabel", num, btn);
    	var label = Sendlater3Util.PrefService.
	    getComplexValue(Sendlater3Util.pref("quickoptions." + num +
						".label"),
			    Components.interfaces.nsISupportsString).data;
	if (label == "<from locale>") {
	    label = btn.getAttribute("sl3label");
	}
	Sendlater3Util.Returning("Sendlater3Util.ButtonLabel", label);
	return label;
    },

    ShortcutClosure: function(num, validate) {
	Sendlater3Util.Entering("Sendlater3Util.ShortcutClosure", num, validate);
	if (validate == undefined) {
	    validate = false;
	}
	var raw = Sendlater3Util.getCharPref("quickoptions." + num +
					     ".valuestring");
	if (raw.match(/^[0-9]+$/)) {
	    var func = function() { return raw; };
	    Sendlater3Util.Returning("Sendlater3Util.ShortcutClosure", func);
	    return func;
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
		if ((typeof(v) != "number") &&
		    ! (v instanceof Array && v.length &&
		       typeof(v[0]) == "number")) {
		    Sendlater3Util.warn("Invalid setting for quick option " +
					num + ": \"" + raw +
					"()\" does not return a number");
		    return; // undefined
		}
	    }
	    Sendlater3Util.Returning("Sendlater3Util.ShortcutClosure", func);
	    return func;
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
    	function DeepCompare(a, b) {
    	    if (a instanceof Array) {
    		if (b instanceof Array) {
    		    if (a.length != b.length) {
    			return false;
    		    }
    		    var i;
    		    for (i = 0; i < a.length; i++) {
    			if (! DeepCompare(a[i], b[i])) {
    			    return false;
    			}
    		    }
    		    return true;
    		}
    		return false;
    	    }
    	    if (b instanceof Array) {
    		return false;
    	    }
    	    if (a instanceof Date) {
    		if (b instanceof Date) {
    		    return a.getTime() == b.getTime();
    		}
    		return false;
    	    }
    	    return a == b;
    	}

    	window['Test1'] = function Test1() { return; };
    	window['Test2'] = function Test2() { return "foo"; };
    	window['Test3'] = function Test3() { return new Array(); };
    	window['Test4'] = function Test4() { return new Array("monthly", "extra"); };
    	window['Test5'] = function Test5() { return -1; };
    	window['Test6'] = function Test6() { return 5; };
    	window['Test7'] = function Test7() { return new Array(7, "monthly 5"); };
    	window['Test8'] = function Test8() { return new Array(7, "monthly 5", "freeble"); };
    	var d1 = new Date();
    	d1.setTime((new Date("10/3/2012")).getTime()+5*60*1000);
    	var d2 = new Date();
    	d2.setTime((new Date("10/3/2012")).getTime()+7*60*1000);
    	var tests = new Array(
    	    new Array("1/1/2012", "daily", "1/1/2012", "1/2/2012"),
    	    new Array("1/2/2012", "weekly", "1/10/2012", "1/16/2012"),
    	    new Array("1/5/2012", "monthly 5", "1/5/2012", "2/5/2012"),
    	    new Array("3/1/2012", "monthly 30", "3/1/2012", "3/30/2012"),
    	    new Array("4/15/2012", "monthly 0 3", "4/15/2012", "5/20/2012"),
    	    new Array("1/29/2012", "monthly 0 5", "1/30/2012", "4/29/2012"),
    	    new Array("2/29/2012", "yearly 1 29", "2/29/2012", "3/1/2013"),
    	    new Array("3/1/2013", "yearly 1 29 / 3", "3/1/2013", "2/29/2016"),
    	    new Array("10/3/2012", "function foo", "10/3/2012", "error is not defined"),
    	    new Array("10/3/2012", "function Sendlater3Util", "10/3/2012", "error is not a function"),
    	    new Array("10/3/2012", "function Test1", "10/3/2012", "error did not return a value"),
    	    new Array("10/3/2012", "function Test2", "10/3/2012", "error did not return number or array"),
    	    new Array("10/3/2012", "function Test3", "10/3/2012", "error is too short"),
    	    new Array("10/3/2012", "function Test4", "10/3/2012", "error did not start with a number"),
    	    new Array("10/3/2012", "function Test5", "10/3/2012", null),
    	    new Array("10/3/2012", "function Test6", "10/4/2012", new Array(d1, null)),
    	    new Array("10/3/2012", "function Test7", "10/4/2012", new Array(d2, "monthly 5")),
    	    new Array("10/3/2012", "function Test8", "10/4/2012", new Array(d2, "monthly 5", "freeble")),
            new Array("1/1/2012 11:26:37", "minutely", "1/1/2012 11:26:50", "1/1/2012 11:27:37"),
            new Array("1/1/2012 11:26:37", "minutely", "1/1/2012 11:29:50", "1/1/2012 11:30:37"),
            new Array("1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:26:50", "1/1/2012 11:31:37"),
            new Array("1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:35:05", "1/1/2012 11:35:37")
    	);

    	var i;
    	for (i in tests) {
    	    var test = tests[i];
    	    var errmsg = null;
    	    var result = null;
    	    try {
    		result = SL3U.NextRecurDate(new Date(test[0]),
    					    test[1],
    					    new Date(test[2]));
    	    }
    	    catch (ex) {
    		errmsg = ex.message;
    	    }
    	    if (errmsg) {
    		if (test[3] && test[3].match(/^error /)) {
    		    var expected = test[3].substring(6);
    		    if (errmsg.match(expected)) {
    			SL3U.warn("NextRecurTest: PASS " + i);
    		    }
    		    else {
    			SL3U.warn("NextRecurTest: FAIL " + i + 
    				  ", error string '" + errmsg + "' does not match '" +
    				 expected + "'");
    		    }
    		}
    		else {
    		    SL3U.warn("NextRecurTest: FAIL " + i +
    			      ", unexpected exception: " + errmsg);
    		}
    	    }
    	    else if (test[1].match(/^function/)) {
    		if (DeepCompare(result, test[3])) {
    		    SL3U.warn("NextRecurTest: PASS " + i);
    		}
    		else {
    		    SL3U.warn("NextRecurTest: FAIL " + i + ", expected DC " +
    			      test[3] + ", got " + result);
    		}
    	    }   
    	    else {
    		var expected = new Date(test[3]);
    		if (result.getTime() == expected.getTime()) {
    		    SL3U.warn("NextRecurTest: PASS " + i);
    		}
    		else {
    		    SL3U.warn("NextRecurTest: FAIL " + i + ", expected " +
    			      expected + ", got " + result);
    		}
    	    }
    	}
    },

    NextRecurDate: function(next, recurSpec, now, args) {
	Sendlater3Util.Entering("NextRecurDate", next, recurSpec, now, args);
	// Make sure we don't modify our input!
	next = new Date(next.getTime());

	var type, dayOfMonth, dayOfWeek, weekOfMonth, monthOfYear, recurCount;

	var recurArray = recurSpec.split(" ");
	type = recurArray[0];
	recurArray.splice(0, 1);

	if (type == "function") {
	    var error;
	    var funcName = recurArray[0];
	    var func = window[funcName];
	    if (typeof(func) == "undefined") {
		// test 8
		throw new Error("Send Later: Invalid recurrence specification '" +
				recurSpec + ": '" + funcName + "' is not defined");
	    }
	    else if (typeof(func) != "function") {
		// test 9
		throw new Error("Send Later: Invalid recurrence specification '" +
				recurSpec + ": '" + funcName + "' is not a function");
	    }
	    var nextRecur = func(next, args);
	    if (! nextRecur) {
		// test 10
		throw new Error("Send Later: Recurrence function '" + funcName +
				"' did not return a value");
	    }
	    if (typeof(nextRecur) == "number") {
		if (nextRecur == -1) {
		    // test 14
		    return null;
		}
		else {
		    // test 15
		    next.setTime(next.getTime()+nextRecur*60*1000);
		    return new Array(next, null);
		}
	    }
	    else {
		if (! (nextRecur instanceof Array)) {
		    // test 11
		    throw new Error("Send Later: Recurrence function '" + funcName +
				    "' did not return number or array");
		}
		if (nextRecur.length < 2) {
		    // test 12
		    throw new Error("Send Later: Array returned by recurrence " +
				    "function '" + funcName + "' is too short");
		}
		if (typeof(nextRecur[0]) != "number" && ! (nextRecur[0] instanceof Date)) {
		    // test 13
		    throw new Error("Send Later: Array " + nextRecur + " returned by recurrence " +
				    "function '" + funcName + "' did not start with " +
				    "a number or Date");
		}
		if (! (nextRecur[0] instanceof Date)) {
		    // test 16
		    next.setTime(next.getTime()+nextRecur[0]*60*1000);
		    nextRecur[0] = next;
		}
		return nextRecur;
	    }
	}

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
	    throw "Send Later internal error: extra recurrence args: " + recurArray.toString();
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
            case "minutely":
                next.setMinutes(next.getMinutes()+1)
                break;
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
		throw "Send Later internal error: unrecognized recurrence type: " + type;
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

	if (type == "function") {
	    return recurArray[0];
	}

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
	    throw "Send Later internal error: extra recurrence args: " + recurArray.toString();
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

    RecurHeader: function(sendat, recur, args) {
	var header = {'X-Send-Later-Recur': recur};
	if (args) {
            header['X-Send-Later-Args'] = JSON.stringify(args);
	}
	return header;
    },

    logger: null,
    log_filter_string: null,

    log_filter: function(msg) {
	var filter_string = Sendlater3Util.getCharPref("logging.filter");
	if (filter_string != Sendlater3Util.log_filter_string) {
	    if (filter_string) {
		Sendlater3Util.log_filter_re = new RegExp(filter_string);
	    }
	    Sendlater3Util.log_filter_string = filter_string;
	}
	if (filter_string) {
	    return Sendlater3Util.log_filter_re.test(msg);
	}
	else {
	    return true;
	}
    },

    warn: function(msg) {
	if (! Sendlater3Util.log_filter(msg)) {
	    return;
	}
	try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.warn(msg);
	}
	catch (ex) {
	}
    },

    dump: function(msg) {
	if (! Sendlater3Util.log_filter(msg)) {
	    return;
	}
	try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.info(msg);
	}
	catch (ex) {
	}
    },

    debug: function(msg) {
	if (! Sendlater3Util.log_filter(msg)) {
	    return;
	}
	try {
            Sendlater3Util.initLogging();
    	    Sendlater3Util.logger.debug(msg);
	}
	catch (ex) {
	}
    },

    trace: function(msg) {
	if (! Sendlater3Util.log_filter(msg)) {
	    return;
	}
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

    // The Mail Merge add-on is using this, so don't change it without letting
    // the author know what's changing!
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
        Sendlater3Util._PromptBundle =
            document.getElementById("sendlater3-promptstrings");
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

    alert_for_enigmail: function() {
        if (typeof Enigmail !== 'undefined') {
            if (SL3U.getBoolPref("disabled_for_enigmail"))
                // Already disabled, no need to alert.
                return true;
            SL3U.alert(null, SL3U.PromptBundleGet("EnigmailWarningTitle"),
                       SL3U.PromptBundleGet("EnigmailWarningText"));
            SL3U.setBoolPref("disabled_for_enigmail", true);
            return true;
        }
        if (SL3U.getBoolPref("disabled_for_enigmail"))
            SL3U.setBoolPref("disabled_for_enigmail", false);
        return false;
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
