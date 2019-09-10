var Sendlater3Options = {
    mapping: [
        ["sendlater3-textintpref", "checktimepref", "int"],
        ["sendlater3-sendbuttonpref", "sendbutton", "bool"],
        ["sendlater3-altbindingpref", "alt_binding", "bool"],
        ["compose-window-hot-keys-pref", "compose_window_hot_keys", "bool"],
        ["sendlater3-markread-checkbox", "mark_drafts_read", "bool"],
        ["sendlater3-showcolumnpref", "showcolumn", "bool"],
        ["sendlater3-showheaderpref", "showheader", "bool"],
        ["sendlater3-showstatuspref", "showstatus", "bool"],
        ["sendlater3-sendunsentmessagespref", "sendunsentmessages", "bool"],
        ["sendlater3-block-late-messages-pref", "block_late_messages", "bool"],
        ["sendlater3-late-messages-grace-period-pref", "late_grace_period", "int"],
        ["sendlater3-enforce-restrictions-pref", "enforce_restrictions", "bool"],
        ["sendlater3-quickoption_label1", "quickoptions.1.label", "string"],
        ["sendlater3-quickoption_value1", "quickoptions.1.valuestring", "char"],
        ["sendlater3-quickoption_label2", "quickoptions.2.label", "string"],
        ["sendlater3-quickoption_value2", "quickoptions.2.valuestring", "char"],
        ["sendlater3-quickoption_label3", "quickoptions.3.label", "string"],
        ["sendlater3-quickoption_value3", "quickoptions.3.valuestring", "char"],
        ["sendlater3_dumplevel_menu", "logging.dump", "char"],
        ["sendlater3_consolelevel_menu", "logging.console", "char"],
    ],
        
    LoadPrefs: function() {
        Sendlater3Options.mapping.forEach(function(mapping) {
            var elt_id = mapping[0];
            var elt = document.getElementById(elt_id);
            var pref = mapping[1];
            var pref_type = mapping[2];
            var pref_func;
            switch (pref_type) {
            case "int":
                elt.value = SL3U.getIntPref(pref);
                break;
            case "bool":
                elt.checked = SL3U.getBoolPref(pref);
                break;
            case "string":
                elt.value = SL3U.getStringPref(pref);
                break;
            case "char":
                elt.value = SL3U.getCharPref(pref);
                break;
            default:
                throw new Error("Unrecognized pref type: " + pref_type);
            }
        });
        for (var i = 1; i <= 3; i++) {
            var elt_id = "sendlater3-quickoption_label" + i;
            var elt = document.getElementById(elt_id);
            if (elt.value == "<from locale>") {
                elt.value = elt.getAttribute("sl3label");
            }
        }
    },

    ValidatePrefs: function(event) {
	for (var i = 1; i <= 3; i++) {
            var elt_id = "sendlater3-quickoption_value" + i;
            var elt = document.getElementById(elt_id);
            var value = elt.value;
            var closure = SL3U.ShortcutClosure(i, value);
	    if (! closure) {
		var msg = SL3U.PromptBundleGetFormatted(
		    "OptionShortcutAlertText",
		    [i, value]);
		SL3U.alert(window,
			   SL3U.PromptBundleGet("OptionShortcutAlertTitle"),
			   msg);
                return false;
	    }

            var elt_id = "sendlater3-quickoption_label" + i;
            var elt = document.getElementById(elt_id);
            if (elt.value == elt.getAttribute("sl3label")) {
                elt.value = "<from locale>";
            }
	}
        Sendlater3Options.mapping.forEach(function(mapping) {
            var elt_id = mapping[0];
            var elt = document.getElementById(elt_id);
            var pref = mapping[1];
            var pref_type = mapping[2];
            var pref_func;
            switch (pref_type) {
            case "int":
                SL3U.setIntPref(pref, elt.value);
                break;
            case "bool":
                SL3U.setBoolPref(pref, elt.checked);
                break;
            case "string":
                SL3U.setStringPref(pref, elt.value);
                break;
            case "char":
                SL3U.setCharPref(pref, elt.value);
                break;
            default:
                throw new Error("Unrecognized pref type: " + pref_type);
            }
        });
        return true;
    },

    SetOnLoad: function() {
        window.removeEventListener("load", Sendlater3Options.SetOnLoad, false);
	SL3U.initUtil();
        document.addEventListener("dialogextra1", function(event) {
            console.log("dialogextra1");
            Sendlater3Options.LoadPrefs();
        });
        document.addEventListener("dialogaccept", function(event) {
            if (! Sendlater3Options.ValidatePrefs())
                event.preventDefault();
        });
        Sendlater3Options.LoadPrefs();
    },

    EnableLateBlock: function() {
        document.getElementById("sendlater3-block-late-messages-pref").checked =
            true;
    },

    funcEditor: function() {
        window.open("chrome://sendlater3/content/editor.xul",
                    "SendLaterFunctionEditor", "chrome,resizable");
    }
};

window.addEventListener("load", Sendlater3Options.SetOnLoad, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
