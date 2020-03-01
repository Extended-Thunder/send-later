Components.utils.import("resource://sendlater3/dateparse.jsm");
Components.utils.import("resource://sendlater3/logging.jsm");

var Sendlater3ComposeToolbar = {
    timer: null,
    origCustomizeDone: null,

    elements: ["sendlater3-toolbar-text",
	       "sendlater3-toolbar-datepicker",
	       "sendlater3-toolbar-timepicker",
	       "sendlater3-toolbarbutton",
               "sendlater3-shortcutbtn_1",
               "sendlater3-shortcutbtn_2",
               "sendlater3-shortcutbtn_3"],

    SetRecurring: function(recurring) {
	for (var idnum in Sendlater3ComposeToolbar.elements) {
            var elt = Sendlater3ComposeToolbar.elements[idnum];
	    var obj = document.getElementById(elt);
	    if (obj) {
		obj["disabled"] = recurring;
	    }
	}
    },

    updateSummary: function(fromPicker) {
        sl3log.Entering("Sendlater3ComposeToolbar.updateSummary");
	var textField = document.getElementById("sendlater3-toolbar-text");
	var button = document.getElementById("sendlater3-toolbarbutton");
	var dateStr;
	if (textField) {
	    dateStr = textField.value;
	}
	else if (fromPicker) {
	    dateStr = fromPicker;
	}
	else {
	    dateStr = Sendlater3ComposeToolbar.pickersToText(true);
	}
	var dateObj;
	if (dateStr) {
	    try {
		var dateObj = sendlater3DateParse(dateStr);
	    }
	    catch (ex) {}
	    if (! (dateObj && dateObj.isValid())) {
		dateObj = null;
	    }
	    if (dateObj && ! fromPicker) {
		Sendlater3ComposeToolbar.dateToPickers(dateObj);
	    }
	}
	if (button) {
	    var disabled = Sendlater3Composing.prevRecurring 
		? true : (! dateObj);
            // In the past we have disabled this button until there was a valid
            // scheduled time from either the text box or the date/time picker.
            // However, we want the user to be able to click the button even
            // before we've got a valid time, in case they've e.g., edited the
            // time picker and then clicked the button immediately.
	    // button.setAttribute("disabled", disabled);
	    if (dateObj && textField) {
		button.label = SL3U.PromptBundleGet("sendaround") + " " +
		    sendlater3DateToSugarDate(dateObj)
		    .long('{long}', sendlater3SugarLocale());
	    }
	    else {
		button.label = button.getAttribute("sl3label");
	    }
	}
        sl3log.Returning("Sendlater3ComposeToolbar.updateSummary", dateObj);
	return dateObj;
    },

    dateToPickers: function(dateObj) {
	var datePicker = document.getElementById("sendlater3-toolbar-datepicker");
	var timePicker = document.getElementById("sendlater3-toolbar-timepicker");
	if (datePicker) {
	    datePicker.value = dateObj.format("{yyyy}-{MM}-{dd}");
	    timePicker.value = dateObj.format("{HH}:{mm}");
	}
    },

    pickersToText: function(fromUpdate) {
	sl3log.Entering("Sendlater3ComposeToolbar.pickersToText");
	var textField = document.getElementById("sendlater3-toolbar-text");
	var datePicker = document.getElementById("sendlater3-toolbar-datepicker");
	var timePicker = document.getElementById("sendlater3-toolbar-timepicker");
	if (! datePicker) {
	    sl3log.Returning("Sendlater3ComposeToolbar.pickersToText", false);
	    return false;
	}
	var date = datePicker.value;
	var time = timePicker.value;
	// Strip seconds from time
	time = time.replace(/(.*:.*):.*/, "$1");
	var val = date + " " + time;
	if (textField && ! fromUpdate) {
	    textField.value = val;
	    Sendlater3ComposeToolbar.updateSummary(val);
	}
	sl3log.Returning("Sendlater3ComposeToolbar.pickersToText", val);
	return val;
    },

    CheckTextEnter: function(event) {
	if (event.keyCode == KeyEvent.DOM_VK_RETURN &&
	    ! (event.altKey || event.ctrlKey || event.ShiftKey)) {
	    return Sendlater3ComposeToolbar.CallSendAt();
	}
    },

    SetOnLoad: function() {
	var t = Sendlater3ComposeToolbar;
	sl3log.Entering("Sendlater3ComposeToolbar.SetOnLoad");

	// We need to detect when the toolbar is first added to
	// the message window, so we can populate it at that
	// point.
	if (! t.origCustomizeDone) {
	    var name = SL3U.ComposeToolboxName();
	    t.origCustomizeDone = document.getElementById(name).customizeDone;
	    sl3log.debug("t.origCustomizeDone=" + t.origCustomizeDone);
	    document.getElementById(name).customizeDone = t.CustomizeDone;
	}

	var i;
	for (i = 1; i <= 3; i++) {
	    var btnName = "sendlater3-shortcutbtn_" + i;
	    var btn = document.getElementById(btnName);
	    var keyName = "sendlater3-quickbutton" + i + "-key";
	    var key = document.getElementById(keyName);
	    var closure = SL3U.ShortcutClosure(i);
	    if (closure != undefined) {
		// See http://stackoverflow.com/a/3273223
		var cmd = function(c) {
		    return function() {
			Sendlater3ComposeToolbar.CallSendAfter(c());
		    };
		}(closure);
		if (btn) {
		    btn.label = SL3U.ButtonLabel(i, btn);
		    // Setting .oncommand property and attribute works
		    // irregularly, so wipe both and use an event
		    // handler instead.
		    if (btn.sl3EventListener)
			btn.removeEventListener("command", btn.sl3EventListener,
						false);
		    btn.addEventListener("command", cmd, false);
		    btn.sl3EventListener = cmd;
		}
		if (key) {
		    if (key.sl3EventListener)
			key.removeEventListener("command", key.sl3EventListener,
						false);
		    key.addEventListener("command", cmd, false);
		    key.sl3EventListener = cmd;
		}
		cmd = undefined;
	    }
	}
	 
	var textField = document.getElementById("sendlater3-toolbar-text");
	if (Sendlater3Composing.prevXSendLater) {
	    sl3log.debug("PrevXSendlater is set to " +
		      Sendlater3Composing.prevXSendLater);
	    if (textField) {
		textField.value =
		    Sendlater3Composing.prevXSendLater
		    .format("{long}", sendlater3SugarLocale());
	    }
	    Sendlater3ComposeToolbar.dateToPickers(
		Sendlater3Composing.prevXSendLater);
	}
	else {
	    sl3log.debug("No previous time");
	    if (textField) {
		textField.value = "";
	    }
	}
	Sendlater3ComposeToolbar.SetRecurring(Sendlater3Composing.prevRecurring
					      ? true : false);
	Sendlater3ComposeToolbar.updateSummary();
	sl3log.Leaving("Sendlater3ComposeToolbar.SetOnLoad");
    },

    CustomizeDone: function(aToolboxChanged) {
	var t = Sendlater3ComposeToolbar;
	var err;
	sl3log.Entering("Sendlater3ComposeToolbar.CustomizeDone", aToolboxChanged);
	try {
	    t.origCustomizeDone(aToolboxChanged);
	} catch (e) {
	    err = e;
	}
	if (aToolboxChanged) {
	    t.SetOnLoad();
	}
	if (err != null) {
	    sl3log.debug("Sendlater3ComposeToolbar.CustomizeDone: throwing exception from original customizeDone function");
	    throw err;
	}
	sl3log.Leaving("Sendlater3ComposeToolbar.CustomizeDone");
    },

    CallSendAt: function(sendat) {
	sl3log.Entering("Sendlater3ComposeToolbar.CallSendAt");
        if (! sendat) {
	    sendat = Sendlater3ComposeToolbar.updateSummary();
            if (sendat)
                sendat = [sendat];
        }
	var ret = false;
	if (sendat) {
            var msgwindow = document.getElementById("msgcomposeWindow");
            msgwindow.sendlater3likethis = sendat;
            Sendlater3Composing.mySendLater();
	    ret = true;
	}
	sl3log.Returning("Sendlater3ComposeToolbar.CallSendAt", ret);
	return ret;
    },

    CallSendAfter: function(mins) {
	sl3log.Entering("Sendlater3ComposeToolbar.CallSendAfter");
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
        Sendlater3ComposeToolbar.CallSendAt([sendat, recur, args]);
	sl3log.Returning("Sendlater3ComposeToolbar.CallSendAfter", true);
	return true;
    },

    main: function() {
	SL3U.initUtil();
        if (SL3U.alert_for_enigmail()) {
            for (var id in Sendlater3ComposeToolbar.elements) {
                id = Sendlater3ComposeToolbar.elements[id]
                var element = document.getElementById(id);
                if (element) {
                    element.setAttribute("disabled", true);
                }
            }
            return;
        }

    	sl3log.Entering("Sendlater3ComposeToolbar.main");
        window.removeEventListener("load", Sendlater3ComposeToolbar.main, false);
	Sendlater3ComposeToolbar.SetOnLoad();
	document.getElementById("msgcomposeWindow").addEventListener("compose-window-reopen", Sendlater3ComposeToolbar.SetOnLoad, false);

        SL3U.initDatePicker(document.getElementById("sendlater3-toolbar-datepicker"));

    	sl3log.Leaving("Sendlater3ComposeToolbar.main");
    }
}

window.addEventListener("load", Sendlater3ComposeToolbar.main, false);
