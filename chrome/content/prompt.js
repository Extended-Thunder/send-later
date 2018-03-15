Components.utils.import("resource://sendlater3/dateparse.jsm");
Components.utils.import("resource://sendlater3/ufuncs.jsm");
Components.utils.import("resource://sendlater3/logging.jsm");

var Sendlater3Prompt = {
    loaded: false,

    BetweenStartUpdate: function() {
        document.getElementById("sendlater3-recur-between-checkbox").
            checked = true;
        return;
        // // I wish it made sense to do the following, but it doesn't because the
        // // timepicker is crap. Maybe some day.
        // var startPicker = document.
        //     getElementById("sendlater3-recur-between-start");
        // var endPicker = document.getElementById("sendlater3-recur-between-end");
        // var startTime = startPicker.hour * 100 + startPicker.minute;
        // var endTime = endPicker.hour * 100 + endPicker.minute;
        // if (endTime < startTime) {
        //     endPicker.hour = startPicker.hour;
        //     endPicker.minute = startPicker.minute;
        // }
    },

    BetweenEndUpdate: function() {
        document.getElementById("sendlater3-recur-between-checkbox").
            checked = true;
        return;
        // // I wish it made sense to do the following, but it doesn't because the
        // // timepicker is crap. Maybe some day.
        // var startPicker = document.
        //     getElementById("sendlater3-recur-between-start");
        // var endPicker = document.getElementById("sendlater3-recur-between-end");
        // var startTime = startPicker.hour * 100 + startPicker.minute;
        // var endTime = endPicker.hour * 100 + endPicker.minute;
        // if (endTime < startTime) {
        //     startPicker.hour = endPicker.hour;
        //     startPicker.minute = endPicker.minute;
        // }
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

    functional: function() {
        // Returns true or false
        return document.getElementById("sendlater3-recur-group").
            selectedItem.id.replace(/sendlater3-recur-/, "") == "function";
    },

    fullyFunctional: function() {
        // Returns the function name if we are fully functional, or
        // false otherwise.
        if (! this.functional())
            return false;
        var selectedItem = document.getElementById("recur-menu").selectedItem;
        if (selectedItem && selectedItem.value) // Not empty string
            return selectedItem.value;
        return false;
    },

    CheckRecurring: function(dateObj) {
        sl3log.Entering("Sendlater3Prompt.CheckRecurring", dateObj);
        if (! Sendlater3Prompt.loaded) {
            sl3log.Returning("Sendlater3Prompt.CheckRecurring",
                           "not loaded yet");
            return;
        }
	var group = document.getElementById("sendlater3-recur-group");
	var selected = group.selectedItem;
	var which = selected.id.replace(/sendlater3-recur-/, "");
	var recurring = which != "none";
        var functional = this.functional();
	Sendlater3Prompt.SetRecurring(recurring);
        document.getElementById("sendlater3-cancel-on-reply-deck").
            selectedIndex = recurring ? 0 : -1;
	document.getElementById("sendlater3-recur-every-deck").selectedIndex =
	    functional ? 1 : (recurring ? 0 : -1);
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
	if (recurring && ! functional) {
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
        var fullyFunctional = this.fullyFunctional();
        document.getElementById("function-args").disabled =
            document.getElementById("calculate").disabled = ! fullyFunctional;
        document.getElementById("sendlater3-time-text").disabled =
            document.getElementById("sendlater3-datepicker").disabled =
            document.getElementById("sendlater3-timepicker").disabled =
            document.getElementById("sendlater3-recur-every-checkbox").disabled=
            functional;
        if (functional)
            // If ! functional, then this was handled properly above.
            document.getElementById("sendlater3-recur-every-value").disabled =
            true;

        sl3log.Leaving("Sendlater3Prompt.CheckRecurring");
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
        SL3U.initUtil();
        sl3log.Entering("Sendlater3Prompt.SetOnLoad");
        window.removeEventListener("load", Sendlater3Prompt.SetOnLoad, false);
        Sendlater3Prompt.loaded = true;
        var picker = document.getElementById("recur-menu");
        picker.appendItem("", "");
        picker.selectedIndex = 0;
        var funclist = sl3uf.list();
        for (var i in funclist) {
            var name, help, body;
            [name, help, body] = sl3uf.load(funclist[i]);
            var item = picker.appendItem(name, name);
            item.tooltipText = help;
        }
        if (! funclist.length) {
            document.getElementById("sendlater3-recur-function").disabled =
                true;
            picker.disabled = true;
        }
        var hb = document.getElementById("sendlater3-ancillary-buttons-hbox");
        if (! window.arguments[0].continueCallback) {
            var bt = document.getElementById("sendlater3-outbox-button");
            var flex = document.getElementById("sendlater3-outbox-flex");
            hb.removeChild(bt);
            hb.removeChild(flex);
        }
        if (! window.arguments[0].sendCallback) {
            var key = document.getElementById("sendlater3-send-now-key");
            var bt = document.getElementById("sendlater3-sendnow-button");
            var flex = document.getElementById("sendlater3-sendnow-flex");
            key.disabled = true;
            hb.removeChild(bt);
            hb.removeChild(flex);
        }
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

	var prevXSendLater = window.arguments[0].previouslyTimed;
        var prevRecurring = null;
        var prevCancelOnReply = "";
        var prevArgs = null;

        if (prevXSendLater) {
	    prevRecurring = window.arguments[0].previouslyRecurring;
            prevCancelOnReply =
                window.arguments[0].previouslyCancelOnReply || "";
	    prevArgs = window.arguments[0].previousArgs;
            prevXSendLater = prevXSendLater.format(
                "{long}", sendlater3SugarLocale());
        }
        else {
            let defaultsJson = SL3U.getCharPref("prompt.defaults");
            if (defaultsJson) {
                var defaults = JSON.parse(defaultsJson);
                prevXSendLater = defaults[0];
                prevRecurring = defaults[1];
                prevArgs = defaults[2];
                prevCancelOnReply = defaults[3];
            }
        }

	Sendlater3Prompt.SetRecurring(prevRecurring);
	if (prevRecurring) {
	    var settings = SL3U.ParseRecurSpec(prevRecurring);
	    var group = document.getElementById("sendlater3-recur-group");
	    group.selectedItem = document.getElementById(
                "sendlater3-recur-" + settings.type);
            if (settings.type == "function") {
                var funcname = settings.function.replace(/^ufunc:/, "");
                var menu = document.getElementById("recur-menu");
                // item 0 is an empty string
                for (var i = 1; i < menu.itemCount; i++) {
                    var item = menu.getItemAtIndex(i);
                    if (item.value == funcname) {
                        menu.selectedItem = item;
                        Sendlater3Prompt.onMenuChange();
                        break;
                    }
                }
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

        document.getElementById("sendlater3-cancel-on-reply-checkbox").checked =
            (prevCancelOnReply != "") ? true : false;
            
        if (prevArgs) {
            document.getElementById("function-args").value =
                sl3uf.unparseArgs(prevArgs);
        }

	if (prevXSendLater) {
	    document.getElementById("sendlater3-time-text").value =
                prevXSendLater;
	    Sendlater3Prompt.updateSummary();
	}

        if (prevCancelOnReply != "")
            document.getElementById("sendlater3-cancel-on-reply-checkbox").
            checked = true;

        Sendlater3Prompt.CheckRecurring();
	document.getElementById("sendlater3-time-text").focus();
	Sendlater3Prompt.AddControlReturnListeners(document);
        SL3U.initDatePicker(document.getElementById("sendlater3-datepicker"));
        sl3log.Leaving("Sendlater3Prompt.SetOnLoad");
    },

    pickersToText: function() {
	sl3log.Entering("Sendlater3Prompt.pickersToText");
	var textField = document.getElementById("sendlater3-time-text");
	var datePicker = document.getElementById("sendlater3-datepicker");
	var timePicker = document.getElementById("sendlater3-timepicker");
	var date = datePicker.value;
	var time = timePicker.value;
	// Strip seconds from time
	time = time.replace(/(.*:.*):.*/, "$1");
	textField.value = date + " " + time;
	Sendlater3Prompt.updateSummary(true);
	sl3log.Leaving("Sendlater3Prompt.pickersToText");
    },

    dateToPickers: function(dateObj) {
	var datePicker = document.getElementById("sendlater3-datepicker");
	var timePicker = document.getElementById("sendlater3-timepicker");
	datePicker.value = dateObj.format("{yyyy}-{MM}-{dd}");
	timePicker.value = dateObj.format("{HH}:{mm}");
    },

    updateSummary: function(fromPicker) {
        sl3log.Entering("Sendlater3Prompt.updateSummary");
        if (! Sendlater3Prompt.loaded) {
            sl3log.Returning("Sendlater3Prompt.updateSummary", "not yet loaded");
            return;
        }
        var functional = this.functional();
        var dateObj;
	var dateStr = document.getElementById("sendlater3-time-text").value;
        if (dateStr) {
            try {
                var dateObj = sendlater3DateParse(dateStr);
            }
            catch (ex) {}
            if (! (dateObj && dateObj.isValid()))
                dateObj = null;
        }
	var button = document.getElementById("sendlater3-callsendat");
        var enable_button = false;
	if (dateObj) {
            if (! functional) {
	        button.label = SL3U.PromptBundleGet("sendaround") + " "
		    + sendlater3DateToSugarDate(dateObj)
		    .format('{long}', sendlater3SugarLocale());
	        Sendlater3Prompt.CheckRecurring(dateObj);
                enable_button = true;
            }
	    if (! fromPicker)
		Sendlater3Prompt.dateToPickers(dateObj);
	}
        else if (! functional) {
	    button.label = SL3U.PromptBundleGet("entervalid");
            enable_button = false;
        }
        if (functional) {
            var fullyFunctional = this.fullyFunctional();
            if (fullyFunctional) {
                button.label = SL3U.PromptBundleGetFormatted(
                    "sendwithfunction", [fullyFunctional]);
                enable_button = true;
            }
            else {
                button.label = SL3U.PromptBundleGet("sendspecifyfunction");
                enable_button = false;
            }
        }
        if (functional || ! dateObj) {
	    var monthCheckbox = document.
                getElementById("sendlater3-recur-every-month-checkbox");
            monthCheckbox.disabled = true;
            monthCheckbox.label = SL3U.PromptBundleGet("everyempty")
            monthCheckbox.checked = false;
	}
	document.getElementById("sendlater3-callsendat")
	    .setAttribute("disabled", ! enable_button);
        sl3log.Returning("Sendlater3Prompt.updateSummary", dateObj);
	return dateObj;
    },

    CheckTextEnter: function(event) {
	sl3log.Entering("Sendlater3Prompt.CheckTextEnter");
	var ret = false;
	if (event.keyCode == KeyEvent.DOM_VK_RETURN &&
	    ! (event.altKey || event.ctrlKey || event.ShiftKey)) {
	    ret = Sendlater3Prompt.CallSendAt();
	}
	sl3log.Returning("Sendlater3Prompt.CheckTextEnter", ret);
	return ret;
    },

    CallSendAfter: function(mins) {
        sl3log.Entering("Sendlater3Prompt.CallSendAfter", mins);
	var sendat = new Date();
	var recur;
	var args;
        // http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
        // "Array objects created within one iframe do not share
        // [[Prototype]]’s with arrays created within another iframe. Their
        // constructors are different objects and so both instanceof and
        // constructor checks fail."
	if (mins && mins.splice) {
	    args = mins;
	    recur = mins[1];
	    mins = mins[0];
	    args.splice(0,2);
	}
	if (mins && mins.getTime) {
	    sendat.setTime(mins.getTime());
	}
	else if (mins == -1) {
	    return false;
	}
	else {
	    sendat.setTime(sendat.getTime()+mins*60*1000);
	}
	window.arguments[0].finishCallback(sendat, recur, false, args);
	sl3log.Leaving("Sendlater3Prompt.CallSendAfter");
	return true;
    },

    clearChildren: function(element) {
        sl3log.Entering("Sendlater3Prompt.clearChildren");
	while (element.childNodes.length>0) {
	    element.removeChild(element.childNodes[0]);
	}
        sl3log.Leaving("Sendlater3Prompt.clearChildren");
    },

    getMaxDays: function(year,month) {
        sl3log.Entering("Sendlater3Prompt.getMaxDays");
	var oneDay = (1000 * 60 * 60 * 24);
	var today = new Date();
	today.setFullYear(parseInt(year));
	today.setDate(1);
	month++;
	today.setMonth(month);
	var bt = today.toString();
	today.setTime(today.valueOf() - oneDay);
        sl3log.Returning("Sendlater3Prompt.getMaxDays", today.getDate());
	return today.getDate();
    },

    GetRecurStructure: function(dateObj, silent) {
	var recur = document.getElementById("sendlater3-recur-group")
	    .selectedItem.id.replace(/sendlater3-recur-/, "");
        var parsed = {type: recur};

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
                if (! silent) {
                    var title = SL3U.PromptBundleGet(
                        "TimeMismatchConfirmTitle");
                    var body = SL3U.PromptBundleGetFormatted(
                        "TimeMismatchConfirmBody", [dateObj, adjusted]);
                    var prompts = Components.classes[
                        "@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
                    if (! prompts.confirm(null, title, body)) {
                        throw "Scheduled send cancelled because of send time restriction mismatch";
                    }
                }
                dateObj = adjusted;
            }                
        }

        if (parsed.type == "function") {
            parsed.function = "ufunc:" + this.fullyFunctional();
        }
	else if (parsed.type == "monthly") {
	    if (document.getElementById("sendlater3-recur-every-month-checkbox")
                .checked)
                parsed.monthly_day = {day: dateObj.getDay(),
                                      week: Math.ceil(dateObj.getDate()/7)};
	    else
		parsed.monthly = dateObj.getDate();
	}
	else if (parsed.type == "yearly")
            parsed.yearly = {month: dateObj.getMonth(),
                             date: dateObj.getDate()};

	if (document.getElementById("sendlater3-recur-every-checkbox").checked)
            parsed.multiplier = document
		.getElementById("sendlater3-recur-every-value").value;

        if (startTime != undefined)
            parsed.between = {start: startTime, end: endTime};

        if (days)
            parsed.days = days;

        cancelOnReply = document.getElementById(
            "sendlater3-cancel-on-reply-checkbox").checked ? "yes" : "";

	return [dateObj, parsed, cancelOnReply];
    },

    CallSendAt: function() {
        sl3log.Entering("Sendlater3Prompt.CallSendAt");
        if (document.getElementById("save-defaults").checked) {
            try {
                var results = this.GetRecurStructure(new Date(), true);
                var sendat;
                if (results[1].type == "function")
                    sendat = "";
                else {
                    sendat = document.getElementById("sendlater3-time-text").
                        value;
                }
                var spec = SL3U.unparseRecurSpec(results[1]);
                var args = document.getElementById("function-args").value;
                var cancelOnReply = results[2];
                args = sl3uf.parseArgs(args);
                SL3U.setCharPref("prompt.defaults", JSON.stringify(
                    [sendat, spec, args, cancelOnReply]));
            }
            catch (ex) {}
        }
        else if (document.getElementById("clear-defaults").checked)
            SL3U.setCharPref("prompt.defaults", "");
        var sendat, spec, args, cancelOnReply;
        var functionName = this.fullyFunctional();
        if (functionName) {
            var results = this.onCalculate(true);
            if (! results) {
                sl3log.Leaving("Sendlater3Prompt.CallSendAt (bad function)",
                             false);
                return false;
            }
            sendat = results.shift();
            spec = results.shift();
            args = results.shift();
            cancelOnReply = results.shift();
        }
        else {
	    sendat = Sendlater3Prompt.updateSummary();
            if (! sendat) {
                sl3log.Leaving("Sendlater3Prompt.CallSendAt (not scheduled)",
                             false);
                return false;
            }
            [sendat, spec, cancelOnReply] = Sendlater3Prompt.
                GetRecurStructure(sendat);
        }
        spec = SL3U.unparseRecurSpec(spec);
	window.arguments[0].finishCallback(sendat, spec, cancelOnReply, args);
        sl3log.Returning("Sendlater3Prompt.CallSendAt", true);
	return true;
    },

    onMenuChange: function() {
        var radiogroup = document.getElementById("sendlater3-recur-group");
        radiogroup.selectedItem = document.getElementById(
            "sendlater3-recur-function");
        var menulist = document.getElementById("recur-menu");
        var helpicon = document.getElementById("recur-menu-help");
        helpicon.tooltipText = menulist.selectedItem.tooltipText;
        helpicon.hidden = false;
        if (! menulist.getItemAtIndex(0).value)
            menulist.removeItemAt(0);
    },

    onCalculate: function(interactive) {
        var argstring = document.getElementById("function-args").value;
        args = sl3uf.parseArgs(argstring);
        if (! args) {
            SL3U.alert(window,
                       SL3U.PromptBundleGet("InvalidArgsTitle"),
                       SL3U.PromptBundleGet("InvalidArgsBody"));
            return;
        }
        var funcname = document.getElementById("recur-menu").selectedItem.value;
        try {
            var results = SL3U.NextRecurFunction(
                null, null, {function: "ufunc:" + funcname}, args, true);
        }
        catch (ex) {
            SL3U.alert(window,
                       SL3U.PromptBundleGet("FunctionErrorTitle"),
                       SL3U.PromptBundleGetFormatted("FunctionErrorBody",
                                                     [ex]));
            return;
        }
        var sendat = results.shift(), spec;
        [sendat, spec, cancelOnReply] =
            this.GetRecurStructure(sendat, !interactive);
        var functionRecurString = results.shift(), newSpec;
        if (functionRecurString)
            newSpec = SL3U.ParseRecurSpec(functionRecurString);
        else
            newSpec = {type: "none"};
        if (spec.between)
            newSpec.between = spec.between;
        if (spec.days)
            newSpec.days = spec.days;

        document.getElementById("sendlater3-time-text").value =
            sendlater3DateToSugarDate(sendat).format(
                '{long}', sendlater3SugarLocale());
        this.updateSummary();
        // Returns adjusted date, parsed recurrence spec, and arguments (if
        // any) for the next invocation (if any).
        return [sendat, newSpec, results, cancelOnReply];
    }
}

window.addEventListener("load", Sendlater3Prompt.SetOnLoad, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
