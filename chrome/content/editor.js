Components.utils.import("resource://sendlater3/ufuncs.jsm");
Components.utils.import("resource://sendlater3/dateparse.jsm");

sl3e = {
    dirty: false,
    tested: true,
    selectedIndex: -1,

    onLoad: function() {
        // Take care: must use "sl3e", not "this", here, because it's called
        // as an event listener without the proper context to set "this".
        window.removeEventListener("load", sl3e.onLoad, false);
        SL3U.initUtil();
        first_use = SL3U.getBoolPref("editor.first_use");
        if (first_use) {
            if (! sl3uf.exists("ReadMeFirst"))
                sl3uf.save("ReadMeFirst",
                           SL3U.PromptBundleGet("EditorReadMeHelp"),
                           SL3U.PromptBundleGet("EditorReadMeCode"));
            if (! sl3uf.exists("BusinessHours"))
                sl3uf.save("BusinessHours",
                           SL3U.PromptBundleGet("BusinessHoursHelp"),
                           SL3U.PromptBundleGet("_BusinessHoursCode"));
            if (! sl3uf.exists("DaysInARow"))
                sl3uf.save("DaysInARow",
                           SL3U.PromptBundleGet("DaysInARowHelp"),
                           SL3U.PromptBundleGet("DaysInARowCode"));
        }
        sl3e.updatePicker();
        if (first_use) {
            sl3e.selectFunction("ReadMeFirst");
            SL3U.setBoolPref("editor.first_use", false);
        }
        // Doesn't get called automatically before window is visible.
        sl3e.onPickerChange();
    },

    onUnload: function() {
        // Take care: must use "sl3e", not "this", here, because it's called
        // as an event listener without the proper context to set "this".
        window.removeEventListener("unload", sl3e.onUnload, false);
        SL3U.uninitUtil();
    },

    selectFunction: function(which) {
        // Switches the function picker to the function with the specified name.
        var picker = document.getElementById("function-picker");
        for (var j = 1; j < picker.itemCount; j++)
            if (picker.getItemAtIndex(j).value == which) {
                picker.selectedIndex = j;
                this.onPickerChange();
                return;
            }
    },

    updatePicker: function() {
        // Synchronizes the contents of the function picker with the
        // current list of available functions. If the previously
        // selected value in the picker is no longer a valid function,
        // then marks the window clean and tested and switches the
        // picker to "(new)" ("onPickerChange" will take care of the
        // rest).
        var picker = document.getElementById("function-picker");
        var i, j;
        var existing_names = sl3uf.list();
        if (picker.selectedIndex != 0) {
            var selected = picker.selectedItem.value;
            var found_selected = false;
            for (i = 0; i < existing_names.length; i++)
                if (existing_names[i] == selected)
                    found_selected = true;
            if (! found_selected) {
                this.dirty = false;
                this.tested = true;
                picker.selectedIndex = 0;
                this.onPickerChange();
            }
        }
        i = 0;
        j = 1;
        while (i < existing_names.length) {
            existing = existing_names[i];
            var name, help, body;
            [name, help, body] = sl3uf.load(existing);

            if (j == picker.itemCount)
                in_menu = picker.appendItem(existing, existing);
            else
                in_menu = picker.getItemAtIndex(j);

            if (existing == in_menu.value) {
                i++;
                j++;
            }
            else if (existing < in_menu.value) {
                in_menu = picker.insertItemAt(j, existing, existing);
                i++;
                j++;
            }
            else {
                picker.removeItemAt(j);
                continue;
            }
            in_menu.tooltipText = help;
        }
    },

    onNameChange: function() {
        this.dirty = true;
        this.nameOk();
        this.updateButtons();
    },

    nameOk: function() {
        var field = document.getElementById("function-name");
        var valid = field.value && sl3uf.nameOk(field.value);
        if (valid || !field.value)
            field.removeAttribute("style");
        else
            field.setAttribute("style", "color: red");
        return valid;
    },

    onHelpChange: function() {
        this.dirty = true;
    },

    onCodeChange: function(event) {
        this.dirty = true;
        var field = event.target;
        this.tested = ! field.value;
        this.codeOk();
        this.updateButtons();
    },

    codeOk: function() {
        var field = document.getElementById("code");
        var valid = field.value && sl3uf.bodyOk(field.value);
        if (valid || !field.value)
            field.removeAttribute("style");
        else
            field.setAttribute("style", "color: red");
        return valid;
    },

    onArgumentsChange: function() {
        this.argumentsOk();
        this.updateButtons();
    },

    argumentsOk: function() {
        var field = document.getElementById("test-arguments");
        var valid = sl3uf.parseArgs(field.value);
        if (valid)
            field.removeAttribute("style");
        else
            field.setAttribute("style", "color: red");
        return valid;
    },

    onTimeChange: function() {
        this.timeOk();
        this.updateButtons();
    },

    timeOk: function() {
        var field = document.getElementById("test-time");
        var valid = ! field.value;
        if (! valid) {
            var dateObj;
            try {
                dateObj = sendlater3DateParse(field.value);
                valid = dateObj && dateObj.isValid();
            } catch (ex) {}
        }
        if (valid)
            field.removeAttribute("style");
        else
            field.setAttribute("style", "color: red");
        return valid;
    },

    updateRunButton: function() {
        var button = document.getElementById("run-test");
        // These need to be run separately rather than in one big logical
        // expression because some of them have side effects so we want to run
        // them all even if some of them return false.
        var disabled = false;
        disabled = ! this.nameOk() || disabled;
        disabled = ! this.codeOk() || disabled;
        disabled = ! this.argumentsOk() || disabled;
        disabled = ! this.timeOk() || disabled;
        button.disabled = disabled;
    },

    onRunButton: function() {
        var name = document.getElementById("function-name").value;
        var body = document.getElementById("code").value;
        var timeBox = document.getElementById("test-time");
        var timeString = timeBox.value;
        var time = timeString ? sendlater3DateParse(timeString) : null;
        var argBox = document.getElementById("test-arguments");
        var argString = argBox.value;
        var resultsBox = document.getElementById("test-results");
        var next, nextspec, nextargs, results;
        try {
            var args = sl3uf.parseArgs(argString);
            nextargs = sl3uf.call(name, body, time, args);
            if (nextargs && nextargs.splice) {
                next = nextargs[0];
                nextspec = nextargs[1];
                nextargs.splice(0, 2);
            }
            else {
                next = nextargs;
                nextargs = null;
            }
            if (! next)
                throw new Error(SL3U.PromptBundleGet("NoNextValueError"));
            if ((typeof(next) != "number") && ! next.getTime)
                throw new Error(SL3U.PromptBundleGetFormatted(
                    "BadNextValueError", [next]));
            if (nextargs && ! nextargs.splice)
                throw new Error(SL3U.PromptBundleGetFormatted(
                    "BadNextArgsError", [nextargs]));
            this.tested = true;
            results = [next, nextspec, nextargs];
        } catch (ex) {
            resultsBox.value = "Error: " + ex;
            return;
        }

        resultsBox.value = JSON.stringify(results);
        if (nextspec) {
            if (typeof(next) == "number") {
                var nextDate = new Date();
                nextDate.setTime(nextDate.getTime() + next * 60 * 1000);
                next = nextDate;
            }
            timeBox.value = sendlater3DateToSugarDate(next)
                .format("{long}", sendlater3SugarLocale());
            if (nextargs)
                argBox.value = sl3uf.unparseArgs(nextargs);
            else
                argBox.value = "";
        }
    },

    onPickerChange: function() {
        var picker = document.getElementById("function-picker");
        var newSelected = picker.selectedIndex;
        if (newSelected == this.selectedIndex)
            return;
        if (this.dirty) {
            var prompts = Components.classes[
                "@mozilla.org/embedcomp/prompt-service;1"].
                getService(Components.interfaces.nsIPromptService);
            var discard = prompts.confirm(
                window,
                SL3U.PromptBundleGet("DiscardConfirmTitle"),
                SL3U.PromptBundleGet("DiscardConfirmBody"));
            if (! discard) {
                picker.selectedIndex = this.selectedIndex;
                return;
            }
        }
        var name, code, help;
        if (newSelected == 0)
            name = code = help = "";
        else
            [name, help, code] = sl3uf.load(picker.selectedItem.value);
        var nameBox = document.getElementById("function-name");
        var codeBox = document.getElementById("code");
        nameBox.value = name;
        codeBox.value = code;
        document.getElementById("help-text").value = help;
        document.getElementById("test-time").value = "";
        document.getElementById("test-arguments").value = "";
        document.getElementById("test-results").value = "";
        if (newSelected == 0)
            nameBox.focus();
        else {
            codeBox.focus();
            codeBox.selectionStart = codeBox.selectionEnd = 0;
        }
        this.selectedIndex = newSelected;
        this.dirty = false;
        this.tested = true;
        this.updateButtons();
    },

    updateButtons: function() {
        var picker = document.getElementById("function-picker");
        document.getElementById("delete").disabled = picker.selectedIndex == 0;
        document.getElementById("save").disabled = ! this.dirty;
        document.getElementById("reset").disabled = ! this.dirty;
        this.updateRunButton();
    },

    onDelete: function() {
        var prompts = Components.classes[
            "@mozilla.org/embedcomp/prompt-service;1"].
            getService(Components.interfaces.nsIPromptService);
        var do_delete = prompts.confirm(
            window, SL3U.PromptBundleGet("AreYouSure"),
            SL3U.PromptBundleGet("FunctionDeleteConfirmBody"));
        if (do_delete) {
            var picker = document.getElementById("function-picker");
            sl3uf.remove(picker.selectedItem.value);
            this.updatePicker();
        }
    },

    onImport: function() {
        if (this.dirty) {
            var prompts = Components.classes[
                "@mozilla.org/embedcomp/prompt-service;1"].
                getService(Components.interfaces.nsIPromptService);
            var discard = prompts.confirm(
                window,
                SL3U.PromptBundleGet("DiscardConfirmTitle"),
                SL3U.PromptBundleGet("DiscardConfirmBody"));
            if (! discard)
                return;
        }
        var nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes["@mozilla.org/filepicker;1"].
            createInstance(nsIFilePicker);
        fp.init(window, SL3U.PromptBundleGet("ImportTitle"),
                nsIFilePicker.modeOpen);
        fp.appendFilter(SL3U.PromptBundleGet("SLJFilterLabel"), "*.slj");
        fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);
        fp.defaultExtension = "slj";
        fp.open(function (rv) {
            if (! ((rv == nsIFilePicker.returnOK ||
                    rv == nsIFilePicker.returnReplace)))
                return;
            var file = fp.file;
            try {
                var imported = sl3uf.import(file);
            }
            catch (ex) {
                pfx = SL3U.PromptBundleGet("ImportError");
                SL3U.alert(window, pfx, pfx + ": " + ex);
                return;
            }
            var picker = document.getElementById("function-picker");
            sl3e.selectedIndex = -1;
            sl3e.dirty = false;
            picker.selectedIndex = 0;
            sl3e.onPickerChange();
            document.getElementById("function-name").value = imported[0];
            document.getElementById("help-text").value = imported[1];
            document.getElementById("code").value = imported[2];
            sl3e.dirty = true;
            sl3e.updateButtons();
        });
    },

    onExport: function() {
        if (! (this.nameOk() && this.codeOk())) {
            SL3U.alert(window, SL3U.PromptBundleGet("BadSaveTitle"),
                       SL3U.PromptBundleGet("BadSaveBody"));
            return;
        }
        if (! this.tested) {
            var prompts = Components.classes[
                "@mozilla.org/embedcomp/prompt-service;1"].
                getService(Components.interfaces.nsIPromptService);
            var proceed = prompts.confirm(
                window,
                SL3U.PromptBundleGet("UntestedSaveTitle"),
                SL3U.PromptBundleGet("UntestedSaveBody"));
            if (! proceed)
                return;
        }
        var name = document.getElementById("function-name").value;
        var nsIFilePicker = Components.interfaces.nsIFilePicker;
        var fp = Components.classes["@mozilla.org/filepicker;1"].
            createInstance(nsIFilePicker);
        fp.init(window, SL3U.PromptBundleGet("ExportTitle"),
                nsIFilePicker.modeSave);
        fp.appendFilter(SL3U.PromptBundleGet("SLJFilterLabel"), "*.slj");
        fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);
        fp.defaultExtension = "slj";
        fp.defaultString = name + ".slj";
        var rv = fp.open(function (rv) {
            if (! ((rv == nsIFilePicker.returnOK ||
                    rv == nsIFilePicker.returnReplace)))
                return;
            var file = fp.file;
            var name = document.getElementById("function-name").value;
            var help = document.getElementById("help-text").value;
            var body = document.getElementById("code").value;
            sl3uf.export(name, help, body, file);
        });
    },

    onSave: function() {
        if (! (this.nameOk() && this.codeOk())) {
            SL3U.alert(window, SL3U.PromptBundleGet("BadSaveTitle"),
                       SL3U.PromptBundleGet("BadSaveBody"));
            return;
        }
        var prompts = Components.classes[
            "@mozilla.org/embedcomp/prompt-service;1"].
            getService(Components.interfaces.nsIPromptService);
        if (! this.tested) {
            var proceed = prompts.confirm(
                window,
                SL3U.PromptBundleGet("UntestedSaveTitle"),
                SL3U.PromptBundleGet("UntestedSaveBody"));
            if (! proceed)
                return;
        }
        var name = document.getElementById("function-name").value;
        var help = document.getElementById("help-text").value;
        var body = document.getElementById("code").value;
        var picker = document.getElementById("function-picker");
        if (picker.selectedIndex == 0) {
            // Check if we are trying to overwrite a function.
            if (sl3uf.exists(name)) {
                var proceed = prompts.confirm(
                    window,
                    SL3U.PromptBundleGet("ReplacingFunctionTitle"),
                    SL3U.PromptBundleGet("ReplacingFunctionBody"));
                if (! proceed)
                    return;
            }
            sl3uf.save(name, help, body);
            this.dirty = false;
            this.updatePicker();
            this.selectFunction(name);
            return;
        }
        var action;
        if (name != picker.selectedItem.value) {
            // The order of these buttons is screwy, but see
            // https://bugzilla.mozilla.org/show_bug.cgi?id=345067
            var action = prompts.confirmEx(
                window,
                SL3U.PromptBundleGet("RenameFunctionTitle"),
                SL3U.PromptBundleGetFormatted("RenameFunctionBody",
                                              [picker.selectedItem.value]),
                (prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_IS_STRING +
                 prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_CANCEL +
                 prompts.BUTTON_POS_2 * prompts.BUTTON_TITLE_IS_STRING +
                 prompts.BUTTON_POS_1_DEFAULT),
                SL3U.PromptBundleGet("RenameFunctionRenameButton"),
                null,
                SL3U.PromptBundleGet("RenameFunctionNewButton"),
                null, {});
            if (action == 1)
                return;
            sl3uf.save(name, help, body);
            this.dirty = false;
            if (action == 0)
                sl3uf.remove(picker.selectedItem.value);
            this.updatePicker();
            this.selectFunction(name);
            return;
        }
        sl3uf.save(name, help, body);
        this.dirty = false;
        this.updatePicker(); // In case help text has changed
        return;
    },

    onDiscard: function() {
        var prompts = Components.classes[
            "@mozilla.org/embedcomp/prompt-service;1"].
            getService(Components.interfaces.nsIPromptService);
        var proceed = prompts.confirm(
            window,
            SL3U.PromptBundleGet("DiscardConfirmTitle"),
            SL3U.PromptBundleGet("DiscardConfirmBody"));
        if (! proceed)
            return;
        this.selectedIndex = -1;
        this.dirty = false;
        this.onPickerChange();
    },

    onClose: function(is_event) {
        if (this.dirty) {
            var prompts = Components.classes[
                "@mozilla.org/embedcomp/prompt-service;1"].
                getService(Components.interfaces.nsIPromptService);
            var proceed = prompts.confirm(
                window,
                SL3U.PromptBundleGet("DiscardConfirmTitle"),
                SL3U.PromptBundleGet("DiscardConfirmBody"));
            if (! proceed)
                return false;
        }
        if (is_event)
            return true;
        window.close();
    },
}

// Wrapped in closures so "this" works inside the functions.
window.addEventListener("load", sl3e.onLoad, false);
window.addEventListener("unload", sl3e.onUnload, false);
