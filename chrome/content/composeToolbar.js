var Sendlater3ComposeToolbar = {
    timer: null,
    origCustomizeDone: null,

    SetRecurring: function(recurring) {
	var bar = document.getElementById("sendlater3_toolbar");
	if (bar) {
	    SL3U.SetTreeAttribute(bar, "disabled", recurring);
	}
    },

    updateModified: function() {
	var t = Sendlater3ComposeToolbar;
	SL3U.Entering("Sendlater3ComposeToolbar.updateModified");
	if (t.timer != null) {
	    SL3U.debug("Sendlater3ComposeToolbar.updateModified: canceling timer");
	    t.timer.cancel();
	    t.timer = null;
	}
	SL3U.Leaving("Sendlater3ComposeToolbar.updateModified");
    },

    setTimer: function() {
	SL3U.Entering("Sendlater3ComposeToolbar.setTimer");
	var now = new Date();
	var then = new Date(now.getTime());
	then.setMinutes(now.getMinutes()+1)
	then.setSeconds(0);
	if (this.timer != null) {
	    this.timer.cancel();
	}
	var ms = then.getTime() - now.getTime();
	this.timer = Components.classes["@mozilla.org/timer;1"]
	    .createInstance(Components.interfaces.nsITimer);
	this.timer.initWithCallback(this.TimerCallback, ms,
				    Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	SL3U.debug("Currently " + now + ", next tick is " +then+ ", ms = " +ms);
	SL3U.Leaving("Sendlater3ComposeToolbar.setTimer");
    },

    TimerCallback: {
	notify: function(timer) {
	    SL3U.Entering("Sendlater3ComposeToolbar.TimerCallback.notify");
	    Sendlater3ComposeToolbar.SetOnLoad();
	    SL3U.Leaving("Sendlater3ComposeToolbar.TimerCallback.notify");
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

	if (document.getElementById('sendlater3_toolbar')) {
	    // This is disgusting. We need to change the style
	    // attributes in TB2 on Linux, but we can't do it in
	    // chrome because chrome.manifest in TB2 doesn't support
	    // the os attribute. So we need to do it here. Ugh.
	    if (SL3U.IsThunderbird2() && SL3U.IsLinux()) {
		document.getElementById("sendlater3-hourvalue").style.paddingRight = "15px";
		document.getElementById("sendlater3-minvalue").style.paddingRight = "15px";
		document.getElementById("sendlater3-yearvalue").style.paddingRight = "15px";
		document.getElementById("sendlater3-monthvalue").style.paddingRight = "15px";
		document.getElementById("sendlater3-dayvalue").style.paddingRight = "15px";
	    }

	    document.getElementById("sendlater3-yearvalue")
		.removeEventListener("ValueChange", t.populateMonths, false);
	    document.getElementById("sendlater3-monthvalue")
		.removeEventListener("ValueChange", t.populateDays, false);
	    document.getElementById("sendlater3-yearvalue")
		.addEventListener("ValueChange", t.populateMonths, false);
	    document.getElementById("sendlater3-monthvalue")
		.addEventListener("ValueChange", t.populateDays, false);

	    document.getElementById("sendlater3-dayvalue")
		.addEventListener("ValueChange", t.updateModified, false);
	    document.getElementById("sendlater3-hourvalue")
		.addEventListener("ValueChange", t.updateModified, false);
	    document.getElementById("sendlater3-minvalue")
		.addEventListener("ValueChange", t.updateModified, false);
	    t.populateYears();
	    t.populateHours();
	    t.populateMins();
	    var hhmm = new Date();
	    document.getElementById("sendlater3-hourvalue").value = hhmm.getHours();
	    document.getElementById("sendlater3-minvalue").value = hhmm.getMinutes();
	    switch (document.getElementById("sendlater3_toolbar")
		    .parentNode.getAttribute("mode")) {
	    case "full":
	    case "icons":
		document.getElementById("sendlater3-toolbartimeicon")
		    .hidden = false;
		document.getElementById("sendlater3-toolbarcalicon")
		    .hidden = false;
		break;
	    default:
		document.getElementById("sendlater3-toolbartimeicon")
		    .hidden = true;
		document.getElementById("sendlater3-toolbarcalicon")
		    .hidden = true;
		break;
	    }

	    if (SL3U.getBoolPref("dropdowns.showintoolbar")) {
		// I tried putting these all inside one big box and just hiding
		// or showing that, but then theyall grew to fill the height of
		// the box and it was ugly, and I couldn't figure out how to
		// make that stop.
		document.getElementById("sendlater3-hourvalue").hidden = false;
		document.getElementById("sendlater3-colon").hidden = false;
		document.getElementById("sendlater3-minvalue").hidden = false;
		document.getElementById("sendlater3-calsep").hidden = false;
		document.getElementById("sendlater3-toolbarcalicon").hidden = false;
		document.getElementById("sendlater3-yearvalue").hidden = false;
		document.getElementById("sendlater3-monthvalue").hidden = false;
		document.getElementById("sendlater3-dayvalue").hidden = false;
		document.getElementById("sendlater3-toolsep").hidden = false;
		document.getElementById("sendlater3-toolbarbutton").hidden = false;
		document.getElementById("sendlater3-quicksep").hidden = false;
	    }
	    else {
		document.getElementById("sendlater3-hourvalue").hidden = true;
		document.getElementById("sendlater3-colon").hidden = true;
		document.getElementById("sendlater3-minvalue").hidden = true;
		document.getElementById("sendlater3-calsep").hidden = true;
		document.getElementById("sendlater3-toolbarcalicon").hidden = true;
		document.getElementById("sendlater3-yearvalue").hidden = true;
		document.getElementById("sendlater3-monthvalue").hidden = true;
		document.getElementById("sendlater3-dayvalue").hidden = true;
		document.getElementById("sendlater3-toolsep").hidden = true;
		document.getElementById("sendlater3-toolbarbutton").hidden = true;
		document.getElementById("sendlater3-quicksep").hidden = true;
	    }

	    var i;
	    for (i = 1; i <= 3; i++) {
		var btn = "sendlater3-shortcutbtn_" + i;
		var minutes = SL3U.ShortcutValue(i);
		if (t.showquickbutton(i) && minutes != undefined) {
		    var cmd = "Sendlater3ComposeToolbar.CallSendAfter(" +
			minutes + ");"
		    document.getElementById(btn).label = SL3U.ButtonLabel(i);
		    // See comment about removeAttribute above similar code
		    // in prompt.js.
		    document.getElementById(btn).removeAttribute("oncommand");
		    document.getElementById("sendlater3-quickbutton" + i + "-key")
			.removeAttribute("oncommand");
		    document.getElementById(btn).setAttribute("oncommand", cmd);
		    document.getElementById("sendlater3-quickbutton" + i + "-key")
			.setAttribute("oncommand", cmd);
		    document.getElementById(btn).hidden = false;
		}
		else {
		    document.getElementById(btn).hidden = true;
		}
	    }

	    if (Sendlater3Composing.prevXSendLater) {
		SL3U.dump("PrevXSendlater is Set to " +
			  Sendlater3Composing.prevXSendLater);
		document.getElementById("sendlater3-yearvalue").value =
		    Sendlater3Composing.prevXSendLater.getFullYear();
		document.getElementById("sendlater3-monthvalue").value =
		    Sendlater3Composing.prevXSendLater.getMonth();
		document.getElementById("sendlater3-dayvalue").value =
		    Sendlater3Composing.prevXSendLater.getDate();
		document.getElementById("sendlater3-hourvalue").value =
		    Sendlater3Composing.prevXSendLater.getHours();
		document.getElementById("sendlater3-minvalue").value =
		    Sendlater3Composing.prevXSendLater.getMinutes();
	    }
	    else {
		SL3U.dump("No previous time");
		t.setTimer();
	    }
	    if (Sendlater3Composing.prevRecurring) {
		Sendlater3ComposeToolbar.SetRecurring(true);
	    }
	}
	SL3U.Leaving("Sendlater3ComposeToolbar.SetOnLoad");
    },

    showquickbutton: function(num) {
	return SL3U.getBoolPref("quickoptions." + num + ".showintoolbar");
    },

    populateHours: function() {
	SL3U.Entering("Sendlater3ComposeToolbar.populateHours");
	var t = Sendlater3ComposeToolbar;
	var container = document.getElementById("sendlater3-hours");
	t.clearChildren(container);
	var i;
	for (i=0;i<24;i++) {
	    var newitem = document.createElement("menuitem");
	    newitem.setAttribute("label",SL3U.DZFormat(i));
	    newitem.setAttribute("value",i.toString());
	    container.appendChild(newitem);
	}
	SL3U.Leaving("Sendlater3ComposeToolbar.populateHours");
    },

    populateMins: function() {
	SL3U.Entering("Sendlater3ComposeToolbar.populateMins");
	var t = Sendlater3ComposeToolbar;
	var container = document.getElementById("sendlater3-mins");
	t.clearChildren(container);
	var i;
	for (i=0;i<60;i++) {
	    var newitem = document.createElement("menuitem");
	    newitem.setAttribute("label",SL3U.DZFormat(i));
	    newitem.setAttribute("value",i.toString());
	    container.appendChild(newitem);
	}
	SL3U.Leaving("Sendlater3ComposeToolbar.populateMins");
    },

    populateYears: function() {
	SL3U.Entering("Sendlater3ComposeToolbar.populateYears");
	var today = new Date();
	var t = Sendlater3ComposeToolbar;
	var container = document.getElementById("sendlater3-years");
	t.clearChildren(container);
	var i;
	for (i=0;i<5;i++) {
	    var newitem = document.createElement("menuitem");
	    newitem.setAttribute("label",
				 (today.getFullYear()+i).toString());
	    newitem.setAttribute("value",
				 (today.getFullYear()+i).toString());
	    container.appendChild(newitem);
	}

	document.getElementById("sendlater3-yearvalue").selectedIndex = 0;
	SL3U.Leaving("Sendlater3ComposeToolbar.populateYears");
    },

    clearChildren: function(element) {
	SL3U.Entering("Sendlater3ComposeToolbar.clearChildren");
	while (element.childNodes.length>0) {
	    element.removeChild(element.childNodes[0]);
	}
	SL3U.Leaving("Sendlater3ComposeToolbar.clearChildren");
    },

    populateMonths: function() {
	var t = Sendlater3ComposeToolbar;
	SL3U.Entering("Sendlater3ComposeToolbar.populateMonths");
	var selectedyear =  document.getElementById("sendlater3-yearvalue").value;
	var today = new Date();
	var monthStr = [ SL3U.PromptBundleGet("January"),
			 SL3U.PromptBundleGet("February"),
			 SL3U.PromptBundleGet("March"),
			 SL3U.PromptBundleGet("April"),
			 SL3U.PromptBundleGet("May"),
			 SL3U.PromptBundleGet("June"),
			 SL3U.PromptBundleGet("July"),
			 SL3U.PromptBundleGet("August"),
			 SL3U.PromptBundleGet("September"),
			 SL3U.PromptBundleGet("October"),
			 SL3U.PromptBundleGet("November"),
			 SL3U.PromptBundleGet("December") ];
	var container = document.getElementById("sendlater3-months");
	t.clearChildren(container);
	var i = 0;
	if (selectedyear == today.getFullYear()) {
	    i = today.getMonth();
	}
	for (;i<12;i++) {
	    var newitem = document.createElement("menuitem");
	    newitem.setAttribute("label",monthStr[i]);
	    newitem.setAttribute("value",i);
	    container.appendChild(newitem);
	}
	document.getElementById("sendlater3-monthvalue").selectedIndex = 0;
	SL3U.Leaving("Sendlater3ComposeToolbar.populateMonths");
    },

    getMaxDays: function(year,month) {
	SL3U.Entering("Sendlater3ComposeToolbar.getMaxDays");
	var oneDay = (1000 * 60 * 60 * 24);
	var today = new Date();
	today.setFullYear(parseInt(year));
	today.setDate(1);
	month++;
	today.setMonth(month);
	var bt = today.toString();
	today.setTime(today.valueOf() - oneDay);
	SL3U.Returning("Sendlater3ComposeToolbar.getMaxDays", today.getDate());
	return today.getDate();
    },

    populateDays: function() {
	var t = Sendlater3ComposeToolbar;
	SL3U.Entering("Sendlater3ComposeToolbar.populateDays");
	var today = new Date();

	var selectedyear =  document.getElementById("sendlater3-yearvalue").value;
	var selectedmonth =  document.getElementById("sendlater3-monthvalue").value;

	var container = document.getElementById("sendlater3-days");
	t.clearChildren(container);
	var i=0;
	if ((selectedyear == today.getFullYear()) &&
	    (selectedmonth == today.getMonth())) {
	    i = today.getDate() - 1;
	}
	var max = t.getMaxDays(selectedyear,selectedmonth);
	for (;i<max;i++) {
	    var newitem = document.createElement("menuitem");
	    newitem.setAttribute("label",(i+1).toString());
	    newitem.setAttribute("value",(i+1).toString());
	    container.appendChild(newitem);
	}
	document.getElementById("sendlater3-dayvalue").selectedIndex = 0;
	SL3U.Leaving("Sendlater3ComposeToolbar.populateDays");
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
	var selectedyear =  document.getElementById("sendlater3-yearvalue").value;
	var selectedmonth =  document.getElementById("sendlater3-monthvalue").value;
	var selecteddate =  document.getElementById("sendlater3-dayvalue").value;
	var selectedhour =  document.getElementById("sendlater3-hourvalue").value;
	var selectedmin =  document.getElementById("sendlater3-minvalue").value;
	var sendat = new SL3U.toSendDate(selectedyear, selectedmonth,
					 selecteddate, selectedhour,
					 selectedmin);

	Sendlater3Composing.SendAtTime(sendat);
	SL3U.Leaving("Sendlater3ComposeToolbar.CallSendAt");
    },

    CallSendAfter: function(mins) {
	SL3U.Entering("Sendlater3ComposeToolbar.CallSendAfter");
	var sendat = new Date();
	sendat.setTime(sendat.getTime()+mins*60*1000);
	Sendlater3Composing.SendAtTime(sendat);
	SL3U.Leaving("Sendlater3ComposeToolbar.CallSendAfter");
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
