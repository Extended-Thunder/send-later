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

    CheckRecurring: function(dateObj) {
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
	document.getElementById("sendlater3-recur-every-month-checkbox").label =
	    desc;
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
	}
	else {
	    everyLabel.value = "";
	}
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
	    var recur = settings[0];
	    settings.splice(0,1);
	    var group = document.getElementById("sendlater3-recur-group");
	    group.selectedItem = document.getElementById("sendlater3-recur-"+recur);
	    if (recur == "monthly") {
		settings.splice(0,1);
		if ((settings.length > 0) && settings[0].match(/^[0-9]+/)) {
		    document
			.getElementById("sendlater3-recur-every-month-checkbox")
			.checked = true;
		    settings.splice(0,1);
		}
	    }
	    else if (recur == "yearly") {
		settings.splice(0,2);
	    }
	    if ((settings.length > 1) && (settings[0] == "/")) {
		settings.splice(0,1);
		document.getElementById("sendlater3-recur-every-checkbox")
		    .checked = true;
		document.getElementById("sendlater3-recur-every-value")
		    .value = settings[0];
		settings.splice(0,1);
	    }
	    if (settings.length > 0) {
		throw "Send Later 3 internal error: unexpected recur setting fields: " +
		    settings.toString();
	    }
	}
	    
	var prevXSendLater = window.arguments[0].previouslyTimed;
	if (prevXSendLater) {
	   document.getElementById("sendlater3-time-text").value =
	       prevXSendLater.format("long", sugarLocale());
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
		    var dateObj = dateParse(dateStr);
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
		+ dateToSugarDate(dateObj).format('long', sugarLocale());
	    Sendlater3Prompt.CheckRecurring(dateObj);
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

    // Format:
    //
    // First field is none/daily/weekly/monthly/yearly
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
    // After all of the above, "/ #" indicates a skip value, e.g., "/
    // 2" means every 2, "/ 3" means every 3, etc. For example, "daily
    // / 3" means every 3 days, while "monthly 2 2 / 2" means every
    // other month on the second Tuesday of the month.

    GetRecurString: function(dateObj) {
	var recur = document.getElementById("sendlater3-recur-group")
	    .selectedItem.id.replace(/sendlater3-recur-/, "");
	if (recur == "none") {
	    return null;
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
	return recur;
    },

    CallSendAt: function() {
        SL3U.Entering("Sendlater3Prompt.CallSendAt");
	var sendat = Sendlater3Prompt.updateSummary();
	var recur = Sendlater3Prompt.GetRecurString(sendat);
	window.arguments[0].finishCallback(sendat, recur);
        SL3U.Leaving("Sendlater3Prompt.CallSendAt");
    }
}

window.addEventListener("load", SL3U.initUtil, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
