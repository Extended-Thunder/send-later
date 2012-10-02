Components.utils.import("resource://sendlater3/dateparse.jsm");

var Sendlater3ComposeToolbar = {
    timer: null,
    origCustomizeDone: null,

    SetRecurring: function(recurring) {
	var ids = ["sendlater3-toolbar-text",
		   "sendlater3-toolbar-datepicker",
		   "sendlater3-toolbar-timepicker",
		   "sendlater3-toolbarbutton"];
	for (idnum in ids) {
	    var obj = document.getElementById(ids[idnum]);
	    if (obj) {
		obj["disabled"] = recurring;
	    }
	}
    },

    updateSummary: function(fromPicker) {
        SL3U.Entering("Sendlater3ComposeToolbar.updateSummary");
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
		var dateObj = dateParse(dateStr);
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
	    button.setAttribute("disabled", disabled);
	    if (dateObj && textField) {
		button.label = SL3U.PromptBundleGet("sendaround") + " " +
		    dateToSugarDate(dateObj).format('long', sugarLocale());
	    }
	    else {
		button.label = button.getAttribute("sl3label");
	    }
	}
        SL3U.Returning("Sendlater3ComposeToolbar.updateSummary", dateObj);
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
	SL3U.Entering("Sendlater3ComposeToolbar.pickersToText");
	var textField = document.getElementById("sendlater3-toolbar-text");
	var datePicker = document.getElementById("sendlater3-toolbar-datepicker");
	var timePicker = document.getElementById("sendlater3-toolbar-timepicker");
	if (! datePicker) {
	    SL3U.Returning("Sendlater3ComposeToolbar.pickersToText", false);
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
	SL3U.Returning("Sendlater3ComposeToolbar.pickersToText", val);
	return val;
    },

    CheckTextEnter: function(event) {
	if (event.keyCode == KeyEvent.DOM_VK_RETURN &&
	    ! (event.altKey || event.ctrlKey || event.ShiftKey)) {
	    if (Sendlater3ComposeToolbar.updateSummary()) {
		Sendlater3ComposeToolbar.CallSendAt();
		return true;
	    }
	    return false;
	}
    },

    SetOnLoad: function() {
	var t = Sendlater3ComposeToolbar;
	SL3U.Entering("Sendlater3ComposeToolbar.SetOnLoad");

	// We need to detect when the toolbar is first added to
	// the message window, so we can populate it at that
	// point.
	if (! t.origCustomizeDone) {
	    var name = SL3U.ComposeToolboxName();
	    t.origCustomizeDone = document.getElementById(name).customizeDone;
	    SL3U.debug("t.origCustomizeDone=" + t.origCustomizeDone);
	    document.getElementById(name).customizeDone = t.CustomizeDone;
	}

	var i;
	for (i = 1; i <= 3; i++) {
	    var btnName = "sendlater3-shortcutbtn_" + i;
	    var btn = document.getElementById(btnName);
	    var keyName = "sendlater3-quickbutton" + i + "-key";
	    var key = document.getElementById(keyName);
	    var minutes = SL3U.ShortcutValue(i);
	    if (minutes != undefined) {
		if (btn) {
		    var cmd = "Sendlater3ComposeToolbar.CallSendAfter(" +
			minutes + ");"
		    btn.label = SL3U.ButtonLabel(i, btn);
		    // See comment about removeAttribute above similar code
		    // in prompt.js.
		    btn.removeAttribute("oncommand");
		    btn.setAttribute("oncommand", cmd);
		}
		if (key) {
		    key.removeAttribute("oncommand");
		    key.setAttribute("oncommand", cmd);
		}
	    }
	}
	 
	var textField = document.getElementById("sendlater3-toolbar-text");
	if (Sendlater3Composing.prevXSendLater) {
	    SL3U.dump("PrevXSendlater is set to " +
		      Sendlater3Composing.prevXSendLater);
	    if (textField) {
		textField.value =
		    Sendlater3Composing.prevXSendLater.format("long",
							      sugarLocale());
	    }
	    Sendlater3ComposeToolbar.dateToPickers(
		Sendlater3Composing.prevXSendLater);
	}
	else {
	    SL3U.dump("No previous time");
	    if (textField) {
		textField.value = "";
	    }
	}
	Sendlater3ComposeToolbar.SetRecurring(Sendlater3Composing.prevRecurring
					      ? true : false);
	Sendlater3ComposeToolbar.updateSummary();
	SL3U.Leaving("Sendlater3ComposeToolbar.SetOnLoad");
    },

    CustomizeDone: function(aToolboxChanged) {
	var t = Sendlater3ComposeToolbar;
	var err;
	SL3U.Entering("Sendlater3ComposeToolbar.CustomizeDone", aToolboxChanged);
	try {
	    t.origCustomizeDone(aToolboxChanged);
	} catch (e) {
	    err = e;
	}
	if (aToolboxChanged) {
	    t.SetOnLoad();
	}
	if (err != null) {
	    SL3U.debug("Sendlater3ComposeToolbar.CustomizeDone: throwing exception from original customizeDone function");
	    throw err;
	}
	SL3U.Leaving("Sendlater3ComposeToolbar.CustomizeDone");
    },

    CallSendAt: function() {
	SL3U.Entering("Sendlater3ComposeToolbar.CallSendAt");
	var sendat = Sendlater3ComposeToolbar.updateSummary();
	if (sendat) {
	    Sendlater3Composing.SendAtTime(sendat);
	}
	else {
	    SL3U.warn("Sendlater3ComposeToolbar.CallSendAt unexpectedly called when there is no valid send time");
	}
	SL3U.Leaving("Sendlater3ComposeToolbar.CallSendAt");
    },

    CallSendAfter: function(mins) {
	SL3U.Entering("Sendlater3ComposeToolbar.CallSendAfter");
	var sendat = new Date();
	var recur;
	var args;
	if (mins instanceof Array) {
	    args = mins;
	    recur = mins[1];
	    mins = mins[0];
	    args.splice(0,2);
	}
	if (mins == -1) {
	    return false;
	}
	sendat.setTime(sendat.getTime()+mins*60*1000);
	Sendlater3Composing.SendAtTime(sendat, recur, args);
	SL3U.Returning("Sendlater3ComposeToolbar.CallSendAfter", true);
	return true;
    },

    main: function() {
    	SL3U.Entering("Sendlater3ComposeToolbar.main");
	SL3U.initUtil();
	Sendlater3ComposeToolbar.SetOnLoad();
	document.getElementById("msgcomposeWindow").addEventListener("compose-window-reopen", Sendlater3ComposeToolbar.SetOnLoad, false);

    	SL3U.Leaving("Sendlater3ComposeToolbar.main");
    }
}

window.addEventListener("load", Sendlater3ComposeToolbar.main, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
