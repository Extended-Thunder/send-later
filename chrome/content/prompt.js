Components.utils.import("resource://sendlater3/dateparse.jsm");

var Sendlater3Prompt = {
    loaded: false,

    BetweenStartUpdate: function() {
        document.getElementById("sendlater3-recur-between-checkbox").
            checked = true;
        return;
        // I wish it made sense to do the following, but it doesn't because the
        // timepicker is crap. Maybe some day.
        var startPicker = document.
            getElementById("sendlater3-recur-between-start");
        var endPicker = document.getElementById("sendlater3-recur-between-end");
        var startTime = startPicker.hour * 100 + startPicker.minute;
        var endTime = endPicker.hour * 100 + endPicker.minute;
        if (endTime < startTime) {
            endPicker.hour = startPicker.hour;
            endPicker.minute = startPicker.minute;
        }
    },

    BetweenEndUpdate: function() {
        document.getElementById("sendlater3-recur-between-checkbox").
            checked = true;
        return;
        // I wish it made sense to do the following, but it doesn't because the
        // timepicker is crap. Maybe some day.
        var startPicker = document.
            getElementById("sendlater3-recur-between-start");
        var endPicker = document.getElementById("sendlater3-recur-between-end");
        var startTime = startPicker.hour * 100 + startPicker.minute;
        var endTime = endPicker.hour * 100 + endPicker.minute;
        if (endTime < startTime) {
            startPicker.hour = endPicker.hour;
            startPicker.minute = endPicker.minute;
        }
    },        

    DayUpdate: function() {
        document.getElementById("sendlater3-recur-on-checkbox").checked = true;
    },
    
    // Disable preset buttons if recurrence is enabled, or vice versa
    SetRecurring: function(recurring) {
	var dis = !!recurring;
	var i;
	for (i = 1; i <= 3; i++) {
	    document.getElementById("sendlater3-shortcutbtn_" + i).disabled = dis;
	    document.getElementById("sendlater3-quickbutton" + i + "-key")
		.setAttribute("disabled", dis);
	}
    },

    CheckRecurring: function(dateObj) {
        SL3U.Entering("Sendlater3Prompt.CheckRecurring", dateObj);
        if (! Sendlater3Prompt.loaded) {
            SL3U.Returning("Sendlater3Prompt.CheckRecurring",
                           "not loaded yet");
            return;
        }
	var group = document.getElementById("sendlater3-recur-group");
	var selected = group.selectedItem;
	var which = selected.id.replace(/sendlater3-recur-/, "");
	var recurring = which != "none";
	Sendlater3Prompt.SetRecurring(recurring);
	document.getElementById("sendlater3-recur-every-deck").selectedIndex =
	    recurring ? 0 : -1;
	var everyLabel = document
	    .getElementById("sendlater3-recur-every-unit");
	if (! dateObj) {
	    dateObj = Sendlater3Prompt.updateSummary();
	}
	var desc;
	if (dateObj) {
	    var dayName = SL3U.PromptBundleGet("day" + dateObj.getDay());
	    var ordName = SL3U.PromptBundleGet("ord" + Math.ceil(dateObj.getDate()/7));
	    desc = SL3U.PromptBundleGetFormatted("everymonthly",
						 [ordName, dayName]);
	}
	else {
	    desc = SL3U.PromptBundleGet("everyempty");
	}
        if (desc) {
	    document.getElementById("sendlater3-recur-every-month-checkbox").label =
	        desc;
        }
	if (recurring) {
	    everyLabel.value = SL3U.PromptBundleGet("plural_" + which);
	    var checkbox = document
		.getElementById("sendlater3-recur-every-checkbox");
	    var textbox = document
		.getElementById("sendlater3-recur-every-value");
	    textbox.disabled = ! checkbox.checked;
	    var monthCheckbox = document
		.getElementById("sendlater3-recur-every-month-checkbox");
	    monthCheckbox.disabled = (which != "monthly") || ! dateObj;
            if (monthCheckbox.disabled) {
                monthCheckbox.checked = false;
            }
	}
	else {
	    everyLabel.value = "";
	}
        SL3U.Leaving("Sendlater3Prompt.CheckRecurring");
    },

    StealControlReturn: function(ev) {
	if (ev.type == "keydown" && ev.ctrlKey && ev.keyCode == 13 &&
	    Sendlater3Prompt.CallSendAt()) {
	    close();
	    ev.preventDefault();
	}
    },

    // I tried to figure out how to do this with XPath (document.evaluate)
    // and couldn't get it to work, probably because of namespace issues.
    AddControlReturnListeners: function(node) {
	if (node.nodeName == "button" && node.id != "sendlater3-callsendat") {
	    node.addEventListener("keydown", Sendlater3Prompt.StealControlReturn, true);
	}
	var children = node.childNodes;
	for (var i = 0; i < children.length; i++) {
	    Sendlater3Prompt.AddControlReturnListeners(children[i]);
	}
    },

    SetOnLoad: function() {
        SL3U.Entering("Sendlater3Prompt.SetOnLoad");
        window.removeEventListener("load", Sendlater3Prompt.SetOnLoad, false);
        SL3U.initUtil();
        Sendlater3Prompt.loaded = true;
	document.getElementById("sendlater3-time-text")
	    .addEventListener("ValueChange",
			     Sendlater3Prompt.updateSummary, false);
	var i;
	for (i = 1; i <= 3; i++) {
	    var btn = document.getElementById("sendlater3-shortcutbtn_"+i);
	    btn.label=SL3U.ButtonLabel(i, btn);
	    var key = document.getElementById("sendlater3-quickbutton" + i +
					      "-key")
	    var closure = SL3U.ShortcutClosure(i);
	    if (closure == undefined) {
		btn.hidden = true;
	    }
	    else {
		// See http://stackoverflow.com/a/3273223
		var cmd = function(c) {
		    return function() {
			Sendlater3Prompt.CallSendAfter(c()) && close();
		    };
		}(closure);
		btn.addEventListener("command", cmd, false);
		btn.hidden = false;
		key.addEventListener("command", cmd, false);
	    }
	}

	var prevRecurring = window.arguments[0].previouslyRecurring;
	Sendlater3Prompt.SetRecurring(prevRecurring);
	if (prevRecurring) {
	    var settings = SL3U.ParseRecurSpec(prevRecurring);
            if (settings.type != "function") {
	        var group = document.getElementById("sendlater3-recur-group");
	        group.selectedItem = document.getElementById(
                    "sendlater3-recur-" + settings.type);
            }
	    if (settings.monthly_day)
		document.
                getElementById("sendlater3-recur-every-month-checkbox").
		checked = true;
            if (settings.multiplier) {
		document.getElementById("sendlater3-recur-every-checkbox")
		    .checked = true;
		document.getElementById("sendlater3-recur-every-value")
		    .value = settings.multiplier;
	    }
            if (settings.between) {
                document.getElementById("sendlater3-recur-between-checkbox").
                    checked = true;
                var startPicker = document.getElementById(
                    "sendlater3-recur-between-start");
                var endPicker = document.getElementById(
                    "sendlater3-recur-between-end");
                startPicker.hour = Math.floor(settings.between.start / 100);
                startPicker.minute = settings.between.start % 100;
                endPicker.hour = Math.floor(settings.between.end / 100);
                endPicker.minute = settings.between.end % 100;
            }
            if (settings.days) {
                document.getElementById("sendlater3-recur-on-checkbox").
                    checked = true;
                for (var i = 0; i <= 6; i++)
                    if (settings.days.indexOf(i) > -1)
                        document.getElementById("sendlater3-recur-on-day" + i).
                            checked = true;
            }
	}
	    
	var prevXSendLater = window.arguments[0].previouslyTimed;
	if (prevXSendLater) {
	   document.getElementById("sendlater3-time-text").value =
	       prevXSendLater.format("long", sendlater3SugarLocale());
	    Sendlater3Prompt.updateSummary();
	}
        Sendlater3Prompt.CheckRecurring();
	document.getElementById("sendlater3-time-text").focus();
	Sendlater3Prompt.AddControlReturnListeners(document);
        SL3U.Leaving("Sendlater3Prompt.SetOnLoad");
    },

    pickersToText: function() {
	SL3U.Entering("Sendlater3Prompt.pickersToText");
	var textField = document.getElementById("sendlater3-time-text");
	var datePicker = document.getElementById("sendlater3-datepicker");
	var timePicker = document.getElementById("sendlater3-timepicker");
	var date = datePicker.value;
	var time = timePicker.value;
	// Strip seconds from time
	time = time.replace(/(.*:.*):.*/, "$1");
	textField.value = date + " " + time;
	Sendlater3Prompt.updateSummary(true);
	SL3U.Leaving("Sendlater3Prompt.pickersToText");
    },

    dateToPickers: function(dateObj) {
	var datePicker = document.getElementById("sendlater3-datepicker");
	var timePicker = document.getElementById("sendlater3-timepicker");
	datePicker.value = dateObj.format("{yyyy}-{MM}-{dd}");
	timePicker.value = dateObj.format("{HH}:{mm}");
    },

    updateSummary: function(fromPicker) {
        SL3U.Entering("Sendlater3Prompt.updateSummary");
        if (! Sendlater3Prompt.loaded) {
            SL3U.Returning("Sendlater3Prompt.updateSummary", "not yet loaded");
            return;
        }
	var dateObj;
	var dateStr = document.getElementById("sendlater3-time-text").value;
	if (dateStr) {
	    try {
		var dateObj = sendlater3DateParse(dateStr);
	    }
	    catch (ex) {
	    }
	    if (! (dateObj && dateObj.isValid())) {
		dateObj = null;
	    }
	}
	var button = document.getElementById("sendlater3-callsendat");
	if (dateObj) {
	    button.label = SL3U.PromptBundleGet("sendaround") + " "
		+ sendlater3DateToSugarDate(dateObj)
		.format('long', sendlater3SugarLocale());
	    Sendlater3Prompt.CheckRecurring(dateObj);
	    if (! fromPicker) {
		Sendlater3Prompt.dateToPickers(dateObj);
	    }
	}
	else {
	    button.label = SL3U.PromptBundleGet("entervalid");
	    var monthCheckbox = document.
                getElementById("sendlater3-recur-every-month-checkbox");
            monthCheckbox.disabled = true;
            monthCheckbox.label = SL3U.PromptBundleGet("everyempty")
            monthCheckbox.checked = false;
	}
	document.getElementById("sendlater3-callsendat")
	    .setAttribute("disabled", ! dateObj);
        SL3U.Returning("Sendlater3Prompt.updateSummary", dateObj);
	return dateObj;
    },

    CheckTextEnter: function(event) {
	SL3U.Entering("Sendlater3Prompt.CheckTextEnter");
	var ret = false;
	if (event.keyCode == KeyEvent.DOM_VK_RETURN &&
	    ! (event.altKey || event.ctrlKey || event.ShiftKey)) {
	    ret = Sendlater3Prompt.CallSendAt();
	}
	SL3U.Returning("Sendlater3Prompt.CheckTextEnter", ret);
	return ret;
    },

    CallSendAfter: function(mins) {
        SL3U.Entering("Sendlater3Prompt.CallSendAfter", mins);
	var sendat = new Date();
	var recur;
	var args;
	if (mins instanceof Array) {
	    args = mins;
	    recur = mins[1];
	    mins = mins[0];
	    args.splice(0,2);
	}
	if (mins instanceof Date) {
	    sendat.setTime(mins.getTime());
	}
	else if (mins == -1) {
	    return false;
	}
	else {
	    sendat.setTime(sendat.getTime()+mins*60*1000);
	}
	window.arguments[0].finishCallback(sendat, recur, args);
	SL3U.Leaving("Sendlater3Prompt.CallSendAfter");
	return true;
    },

    clearChildren: function(element) {
        SL3U.Entering("Sendlater3Prompt.clearChildren");
	while (element.childNodes.length>0) {
	    element.removeChild(element.childNodes[0]);
	}
        SL3U.Leaving("Sendlater3Prompt.clearChildren");
    },

    getMaxDays: function(year,month) {
        SL3U.Entering("Sendlater3Prompt.getMaxDays");
	var oneDay = (1000 * 60 * 60 * 24);
	var today = new Date();
	today.setFullYear(parseInt(year));
	today.setDate(1);
	month++;
	today.setMonth(month);
	var bt = today.toString();
	today.setTime(today.valueOf() - oneDay);
        SL3U.Returning("Sendlater3Prompt.getMaxDays", today.getDate());
	return today.getDate();
    },

    // Format:
    //
    // First field is none/minutely/daily/weekly/monthly/yearly/function
    //
    // If first field is monthly, then it is followed by either one or
    // two numbers. If one, then it's a single number for the day of
    // the month; otherwise, it's the day of the week followed by its
    // place within the month, e.g., "1 3" means the third Monday of
    // each month.
    //
    // If the first field is yearly, then the second and third fields
    // are the month (0-11) and date numbers for the yearly occurrence.
    //
    // After all of the above except function, "/ #" indicates a skip
    // value, e.g., "/ 2" means every 2, "/ 3" means every 3, etc. For
    // example, "daily / 3" means every 3 days, while "monthly 2 2 /
    // 2" means every other month on the second Tuesday of the month.
    //
    // If the first field is function, then the second field is the
    // name of a global function which will be called with one
    // argument, the previous scheduled send time (as a Date
    // object). It has three legal return values:
    //
    //   -1 - stop recurring, i.e., don't schedule any later instances
    //     of this message
    //
    //   integer 0 or greater - schedule this message the specified
    //     number of minutes into the future, then stop recurring
    //
    //   array [integer 0 or greater, recur-spec] - schedule this
    //     message the specified number of minutes into the future,
    //     with the specified recurrence specification for instances
    //     after this one
    //
    // The other fields can be followed by " between YYMM YYMM" to indicate a
    // time restriction or " on # ..." to indicate a day restriction.

    GetRecurString: function(dateObj) {
	var recur = document.getElementById("sendlater3-recur-group")
	    .selectedItem.id.replace(/sendlater3-recur-/, "");
	if (recur == "none") {
	    return [dateObj, null];
	}
        var startTime, endTime;
        if (document.getElementById("sendlater3-recur-between-checkbox").
            checked) {
            var startPicker = document.
                getElementById("sendlater3-recur-between-start");
            var endPicker = document.
                getElementById("sendlater3-recur-between-end");
            startTime = startPicker.hour * 100 + startPicker.minute;
            endTime = endPicker.hour * 100 + endPicker.minute;
            if (endTime < startTime) {
                SL3U.alert(null, SL3U.PromptBundleGet("endTimeWarningTitle"),
                           SL3U.PromptBundleGet("endTimeWarningBody"));
                throw "end time before start time";
            }
        }

        var days;
        if (document.getElementById("sendlater3-recur-on-checkbox").checked) {
            days = [];
            for (var i = 0; i <= 6; i++)
                if (document.getElementById("sendlater3-recur-on-day" + i).
                    checked)
                    days.push(i);
            if (! days.length) {
                SL3U.alert(null,
                           SL3U.PromptBundleGet("missingDaysWarningTitle"),
                           SL3U.PromptBundleGet("missingDaysWarningBody"));
                throw "day restriction enabled with no days specified";
            }
        }

        if ((startTime != undefined) || days) {
            adjusted = SL3U.AdjustDateForRestrictions(dateObj, startTime,
                                                      endTime, days);
            if (adjusted.getTime() != dateObj.getTime()) {
                var title = SL3U.PromptBundleGet("TimeMismatchConfirmTitle");
                var body = SL3U.PromptBundleGetFormatted(
                    "TimeMismatchConfirmBody", [dateObj, adjusted]);
                var prompts = Components.classes[
                    "@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Components.interfaces.nsIPromptService);
                if (! prompts.confirm(null, title, body)) {
                    throw "Scheduled send cancelled because of send time restriction mismatch";
                }
                dateObj = adjusted;
            }                
        }

	if (recur == "monthly") {
	    recur += " ";
	    if (document.getElementById("sendlater3-recur-every-month-checkbox").checked) {
		recur += dateObj.getDay() + " " +
		    Math.ceil(dateObj.getDate()/7);
	    }
	    else {
		recur += dateObj.getDate();
	    }
	}
	if (recur == "yearly") {
	    recur += " " + dateObj.getMonth() + " " + dateObj.getDate();
	}
	if (document.getElementById("sendlater3-recur-every-checkbox").checked){
	    recur += " / " + document
		.getElementById("sendlater3-recur-every-value").value;
	}
        if (startTime != undefined) {
            recur += " between " + SL3U.zeroPad(startTime, 3) + " " +
                SL3U.zeroPad(endTime, 3);
        }
        if (days) {
            recur += " on " + days.join(' ');
        }
	return [dateObj, recur];
    },

    CallSendAt: function() {
        SL3U.Entering("Sendlater3Prompt.CallSendAt");
	var sendat = Sendlater3Prompt.updateSummary();
	var ret = false;
	if (sendat) {
	    var recurArray = Sendlater3Prompt.GetRecurString(sendat);
            sendat = recurArray[0];
            var recur = recurArray[1];
	    window.arguments[0].finishCallback(sendat, recur);
	    ret = true;
	}
        SL3U.Returning("Sendlater3Prompt.CallSendAt", ret);
	return ret;
    }
}

window.addEventListener("load", Sendlater3Prompt.SetOnLoad, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
