var Sendlater3Options = {
    ValidatePrefs: function() {
	var i;
	for (i = 1; i <= 3; i++) {
	    if (SL3U.ShortcutClosure(i, true) == undefined) {
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
        window.removeEventListener("load", Sendlater3Options.SetOnLoad, false);
	SL3U.initUtil();
	document.getElementById("sendlater3-help_text").hidden = true;
    }
};

window.addEventListener("load", Sendlater3Options.SetOnLoad, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
