Components.utils.import("resource://sendlater3/dateparse.jsm");

var Sendlater3Prompt = {
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

    CheckRecurring: function() {
	Sendlater3Prompt.SetRecurring(!document.getElementById("sendlater3-recur-none").selected);
    },

    StealControlReturn: function(ev) {
	if (ev.type == "keydown" && ev.ctrlKey && ev.keyCode == 13) {
	    Sendlater3Prompt.CallSendAt();
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
	document.getElementById("sendlater3-yearvalue")
	    .addEventListener("ValueChange",
			      Sendlater3Prompt.populateMonths, false);
	document.getElementById("sendlater3-monthvalue")
	    .addEventListener("ValueChange",
			      Sendlater3Prompt.populateDays, false);
	document.getElementById("sendlater3-dayvalue")
	    .addEventListener("ValueChange",
			      Sendlater3Prompt.updateSummary, false);
	document.getElementById("sendlater3-hourvalue").
	    addEventListener("ValueChange",
			     Sendlater3Prompt.updateSummary, false);
	document.getElementById("sendlater3-minvalue").
	    addEventListener("ValueChange",
			     Sendlater3Prompt.updateSummary, false);
	document.getElementById("sendlater3-time-text")
	    .addEventListener("ValueChange",
			     Sendlater3Prompt.updateSummary, false);
	Sendlater3Prompt.populateYears();
	Sendlater3Prompt.populateHours();
	Sendlater3Prompt.populateMins();
	var hhmm = new Date();
	document.getElementById("sendlater3-hourvalue").value = hhmm.getHours();
	document.getElementById("sendlater3-minvalue").value = hhmm.getMinutes();
	var i;
	for (i = 1; i <= 3; i++) {
	    document.getElementById("sendlater3-shortcutbtn_"+i).label=SL3U.ButtonLabel(i);
	    var value = SL3U.ShortcutValue(i);
	    if (value == undefined) {
		document.getElementById("sendlater3-shortcutbtn_" + i).hidden = true;
	    }
	    else {
		var cmd = "Sendlater3Prompt.CallSendAfter(" + value +
		    ");close();";
		// For the life of me, I can't figure out why I have to remove
		// these attributes before setting them, but if I don't, then
		// sometimes when the user changes one of the button values in
		// the middle of a session, the new value doesn't take effect
		// immediately. I found a Web page claiming that setAttribute
		// is unreliable because it sets the "default value" for the
		// attribute rather than the actual value, and that therefore
		// attributes should be set as properties (as shown for setting
		// the "hidden" attribute just below), but I tried using
		// ".oncommand = ..." instead of ".setAttribute("oncommand",
		// ...)" and it did not solve the problem. Only removing and
		// recreating the attribute seems to solve the problem. I
		// suppose now that I've got it working, it'll do, but I sure
		// wish I understood what's going on here inside the JavaScript
		// interpreter.
		document.getElementById("sendlater3-shortcutbtn_" + i)
		    .removeAttribute("oncommand");
		document.getElementById("sendlater3-quickbutton" + i + "-key")
		    .removeAttribute("oncommand");
		document.getElementById("sendlater3-shortcutbtn_" + i)
		    .setAttribute("oncommand", cmd);
		document.getElementById("sendlater3-quickbutton" + i + "-key")
		    .setAttribute("oncommand", cmd);
		document.getElementById("sendlater3-shortcutbtn_" + i).hidden = false;
	    }
	}

	var prevRecurring = window.arguments[0].previouslyRecurring;
	Sendlater3Prompt.SetRecurring(prevRecurring);
	if (prevRecurring) {
	    var settings = prevRecurring.split(" ");
	    var group = document.getElementById("sendlater3-recur-group");
	    group.selectedItem = document.getElementById("sendlater3-recur-"+settings[0]);
	}
	    
	var prevXSendLater = window.arguments[0].previouslyTimed;
	if (prevXSendLater) {
	   document.getElementById("sendlater3-yearvalue").value =
	       prevXSendLater.getFullYear();
	   document.getElementById("sendlater3-monthvalue").value =
	       prevXSendLater.getMonth();
	   document.getElementById("sendlater3-dayvalue").value =
	       prevXSendLater.getDate();
	   document.getElementById("sendlater3-hourvalue").value =
	       prevXSendLater.getHours();
	   document.getElementById("sendlater3-minvalue").value =
	       prevXSendLater.getMinutes();
	}
	if (document.getElementById("sendlater3-time-deck").selectedIndex == 0) {
	    document.getElementById("sendlater3-time-text").focus();
	}
	else {
	    document.getElementById("sendlater3-hourvalue").focus();
	}
	Sendlater3Prompt.AddControlReturnListeners(document);
        SL3U.Leaving("Sendlater3Prompt.SetOnLoad");
    },

    populateYears: function() {
        SL3U.Entering("Sendlater3Prompt.populateYears");
	var today = new Date();
	var container = document.getElementById("sendlater3-years");
	var i;
	for (i=0;i<5;i++)
	{
	      var newitem = document.createElement("menuitem");
	      newitem.setAttribute("label",(today.getFullYear()+i).toString());
	      newitem.setAttribute("value",(today.getFullYear()+i).toString());
	      container.appendChild(newitem);
	}

	document.getElementById("sendlater3-yearvalue").selectedIndex = 0;
        SL3U.Leaving("Sendlater3Prompt.populateYears");
    },

    populateMonths: function() {
        SL3U.Entering("Sendlater3Prompt.populateMonths");
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
	Sendlater3Prompt.clearChildren(container);
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
        SL3U.Leaving("Sendlater3Prompt.populateMonths");
    },

    populateDays: function() {
        SL3U.Entering("Sendlater3Prompt.populateDays");
	var today = new Date();

	var selectedyear =  document.getElementById("sendlater3-yearvalue").value;
	var selectedmonth =  document.getElementById("sendlater3-monthvalue").value;

	var container = document.getElementById("sendlater3-days");
	Sendlater3Prompt.clearChildren(container);
	var i=0;
        if ((selectedyear == today.getFullYear()) &&
            (selectedmonth == today.getMonth())) {
	    i = today.getDate() - 1;
	}
	for (;i<Sendlater3Prompt.getMaxDays(selectedyear,selectedmonth);i++) {
	    var newitem = document.createElement("menuitem");
	    newitem.setAttribute("label",(i+1).toString());
	    newitem.setAttribute("value",(i+1).toString());
	    container.appendChild(newitem);
	}
	document.getElementById("sendlater3-dayvalue").selectedIndex = 0;
        SL3U.Leaving("Sendlater3Prompt.populateDays");
    },

    populateHours: function() {
        SL3U.Entering("Sendlater3Prompt.populateHours");
	var container = document.getElementById("sendlater3-hours");
	var i;
	for (i=0;i<24;i++) {
	    var newitem = document.createElement("menuitem");
	    newitem.setAttribute("label",SL3U.DZFormat(i));
	    newitem.setAttribute("value",i.toString());
	    container.appendChild(newitem);
	}
        SL3U.Leaving("Sendlater3Prompt.populateHours");
    },

    populateMins: function() {
        SL3U.Entering("Sendlater3Prompt.populateMins");
	var container = document.getElementById("sendlater3-mins");
	var i;
	for (i=0;i<60;i++) {
	    var newitem = document.createElement("menuitem");
	    newitem.setAttribute("label",SL3U.DZFormat(i));
	    newitem.setAttribute("value",i.toString());
	    container.appendChild(newitem);
	}
        SL3U.Leaving("Sendlater3Prompt.populateMins");
    },

    updateSummary: function() {
        SL3U.Entering("Sendlater3Prompt.updateSummary");
	var whichUI = document.getElementById("sendlater3-time-deck").selectedIndex;
	var dateObj;
	if (whichUI == 0) {
	    var dateStr = document.getElementById("sendlater3-time-text").value;
	    if (dateStr) {
		try {
		    var dateObj = dateparse(dateStr);
		}
		catch (ex) {
		}
		if (! (dateObj && dateObj.isValid())) {
		    dateObj = null;
		}
	    }
	}
	else {
	    var selectedyear =  document.getElementById("sendlater3-yearvalue").value;
	    var selectedmonth =  document.getElementById("sendlater3-monthvalue").value;
	    var selecteddate =  document.getElementById("sendlater3-dayvalue").value;
	    var selectedhour =  document.getElementById("sendlater3-hourvalue").value;
	    var selectedmin =  document.getElementById("sendlater3-minvalue").value;
	    var dateObj = SL3U.toSendDate(selectedyear, selectedmonth, selecteddate,
					  selectedhour, selectedmin);
	}
	var button = document.getElementById("sendlater3-callsendat");
	if (dateObj) {
	    button.label = SL3U.PromptBundleGet("sendaround") + " "
		+ dateObj.toLocaleString();
	}
	else {
	    button.label = SL3U.PromptBundleGet("entervalid");
	}
//	document.getElementById("sendlater3-summary").value =
//	    SL3U.PromptBundleGet("willsendat") + " " + displayStr;
	document.getElementById("sendlater3-callsendat")
	    .setAttribute("disabled", ! dateObj);
        SL3U.Returning("Sendlater3Prompt.updateSummary", dateObj);
	return dateObj;
    },

    CheckTextEnter: function(event) {
	if (event.keyCode == KeyEvent.DOM_VK_RETURN) {
	    if (Sendlater3Prompt.updateSummary()) {
		Sendlater3Prompt.CallSendAt();
		return true;
	    }
	    return false;
	}
    },

    CallSendAfter: function(mins) {
        SL3U.Entering("Sendlater3Prompt.CallSendAfter", mins);
	var sendat = new Date();
	sendat.setTime(sendat.getTime()+mins*60*1000);
	window.arguments[0].finishCallback(sendat);
        SL3U.Leaving("Sendlater3Prompt.CallSendAfter");
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

    CallSendAt: function() {
        SL3U.Entering("Sendlater3Prompt.CallSendAt");
	var sendat = Sendlater3Prompt.updateSummary();
	var recur = document.getElementById("sendlater3-recur-group").selectedItem.id
	    .replace(/sendlater3-recur-/, "");
	if (recur == "none") {
	    recur = null;
	}
	window.arguments[0].finishCallback(sendat, recur);
        SL3U.Leaving("Sendlater3Prompt.CallSendAt");
    }
}

window.addEventListener("load", SL3U.initUtil, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
