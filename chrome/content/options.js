var Sendlater3Options = {
    ValidatePrefs: function() {
	var i;
	for (i = 1; i <= 3; i++) {
	    if (SL3U.ShortcutValue(i, true) == undefined) {
		var value = SL3U.getCharPref("quickoptions."+i+".valuestring");
		var msg = SL3U.PromptBundleGetFormatted(
		    "OptionShortcutAlertText",
		    [i, value]);
		SL3U.alert(window,
			   SL3U.PromptBundleGet("OptionShortcutAlertTitle"),
			   msg);
		return false;
	    }
	}
	return true;
    },

    SetOnLoad: function() {
	SL3U.initUtil();
	if (SL3U.IsThunderbird2()) {
	    document.getElementById("sendlater3-sendbutton_hbox").hidden = true;
	    document.getElementById("sendlater3-help_link").hidden = true;
	    document.getElementById("sendlater3-donate_link").hidden = true;
	}
	else {
	    document.getElementById("sendlater3-help_text").hidden = true;
	}
    }
};

window.addEventListener("load", Sendlater3Options.SetOnLoad, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
