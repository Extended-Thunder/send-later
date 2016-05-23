try {
    Components.utils.import("resource:///modules/gloda/log4moz.js");
}
catch (ex) {
}

var Sendlater3Util = {
    alert: function(window, title, text) {
        var promptService = Components
            .classes["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Components.interfaces.nsIPromptService);
        promptService.alert(window, title, text);
    },

    PrefService: Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch),

    pref: function(tail) {
        return "extensions.sendlater3." + tail;
    },

    getCharPref: function(tail) {
        var pref = Sendlater3Util.pref(tail);
        return Sendlater3Util.PrefService.getCharPref(pref);
    },

    setCharPref: function(tail, value) {
        var pref = Sendlater3Util.pref(tail);
        return Sendlater3Util.PrefService.setCharPref(pref, value);
    },

    getIntPref: function(tail) {
        var pref = Sendlater3Util.pref(tail);
        return Sendlater3Util.PrefService.getIntPref(pref);
    },

    setIntPref: function(tail, value) {
        var pref = Sendlater3Util.pref(tail);
        return Sendlater3Util.PrefService.setIntPref(pref, value);
    },

    getBoolPref: function(tail) {
        var pref = Sendlater3Util.pref(tail);
        return Sendlater3Util.PrefService.getBoolPref(pref);
    },

    setBoolPref: function(tail, value) {
        var pref = Sendlater3Util.pref(tail);
        return Sendlater3Util.PrefService.setBoolPref(pref, value);
    },

    _PromptBundle: null,

    isOnline: function() {
        if (Sendlater3Util.IsSeaMonkey()) {
            // MailOfflineMgr doesn't exist in SeaMonkey
            var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);
            return (!ioService.offline);
        }
        else {
            return MailOfflineMgr.isOnline();
        }
    },

    appName: function() {
        var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
            .getService(Components.interfaces.nsIXULAppInfo);
        return appInfo.name;
    },

    IsSeaMonkey: function() {
        return(Sendlater3Util.appName() == "SeaMonkey");
    },

    IsPostbox: function() {
        return(Sendlater3Util.appName() == "Postbox");
    },

    FindSubFolder: function(folder, name) {
        if (Sendlater3Util.IsPostbox()) {
            return folder.FindSubFolder(name);
        }
        else {
            return folder.findSubFolder(name);
        }
    },

    HeaderRowId: function() {
        if (Sendlater3Util.IsSeaMonkey()) {
            return "sendlater3-expanded-Box";
        }
        else {
            return "sendlater3-expanded-Row";
        }
    },

    ComposeToolboxName: function() {
        if (Sendlater3Util.IsPostbox()) {
            return "compose-toolbox2";
        }
        else {
            return "compose-toolbox";
        }
    },

    SetTreeAttribute: function(object, attribute, value) {
        // if object doesn't have setAttribute, it also doesn't have children
        try {
            object.setAttribute(attribute, value);
            var i;
            for (i = 0; i < object.childNodes.length; i++) {
                this.SetTreeAttribute(object.childNodes[i], attribute, value);
            }
        }
        catch (ex) {}
    },

    SetTreeProperty: function(object, property, value) {
        try {
            object[property] = value;
            var i;
            for (i = 0; i < object.childNodes.length; i++) {
                this.SetTreeProperty(object.childNodes[i], property, value);
            }
        }
        catch (ex) {}
    },

    PromptBundleGet: function(name) {
        Sendlater3Util.Entering("Sendlater3Util.PromptBundleGet", name);
        Sendlater3Util.Returning("Sendlater3Util.PromptBundleGet",
                                 Sendlater3Util._PromptBundle.getString(name));
        return Sendlater3Util._PromptBundle.getString(name);
    },

    PromptBundleGetFormatted: function(name, params) {
        Sendlater3Util.Entering("Sendlater3Util.PromptBundleGetFormatted", name,
                                params, length);
        var formatted = Sendlater3Util._PromptBundle
            .getFormattedString(name, params)
        Sendlater3Util.Returning("Sendlater3Util.PromptBundleGetFormatted",
                                 formatted);
        return formatted;
    },

    UpdatePref: function(key) {
        return Sendlater3Util.pref("update_needed." + key);
    },

    SetUpdatePref: function(key) {
        Sendlater3Util.Entering("Sendlater3Util.SetUpdatePref", key);
        Sendlater3Util.PrefService.setBoolPref(Sendlater3Util.UpdatePref(key),
                                               true);
        Sendlater3Util.Leaving("Sendlater3Util.SetUpdatePref", key);
    },

    GetUpdatePref: function(key) {
        Sendlater3Util.Entering("Sendlater3Util.GetUpdatePref", key);
        var pref = Sendlater3Util.UpdatePref(key);
        var value;
        try {
            value = Sendlater3Util.PrefService.getBoolPref(pref);
            Sendlater3Util.PrefService.deleteBranch(pref);
        }
        catch (ex) {
            value = false;
        }
        Sendlater3Util.Returning("Sendlater3Util.GetUpdatePref", value);
        return value;
    },

    ButtonLabel: function(num, btn) {
        Sendlater3Util.Entering("Sendlater3Util.ButtonLabel", num, btn);
        var label = Sendlater3Util.PrefService.
            getComplexValue(Sendlater3Util.pref("quickoptions." + num +
                                                ".label"),
                            Components.interfaces.nsISupportsString).data;
        if (label == "<from locale>") {
            label = btn.getAttribute("sl3label");
        }
        Sendlater3Util.Returning("Sendlater3Util.ButtonLabel", label);
        return label;
    },

    ShortcutClosure: function(num, validate) {
        Sendlater3Util.Entering("Sendlater3Util.ShortcutClosure", num, validate);
        if (validate == undefined) {
            validate = false;
        }
        var raw = Sendlater3Util.getCharPref("quickoptions." + num +
                                             ".valuestring");
        if (raw.match(/^[0-9]+$/)) {
            var func = function() { return raw; };
            Sendlater3Util.Returning("Sendlater3Util.ShortcutClosure", func);
            return func;
        }
        else if (raw.match(/^[A-Za-z_$][A-Za-z0-9_$]*$/)) {
            var func = window[raw];
            if (typeof(func) == "undefined") {
                Sendlater3Util.warn("Invalid setting for quick option " + num +
                                    ": function \"" + raw +
                                    "\" is not defined");
                return; // undefined
            }
            else if (typeof(func) != "function") {
                Sendlater3Util.warn("Invalid setting for quick option " + num +
                                    ": \"" + raw + "\" is not a function");
                return; // undefined
            }
            if (validate) {
                var v = func();
                if ((typeof(v) != "number") &&
                    ! (v instanceof Array && v.length &&
                       typeof(v[0]) == "number")) {
                    Sendlater3Util.warn("Invalid setting for quick option " +
                                        num + ": \"" + raw +
                                        "()\" does not return a number");
                    return; // undefined
                }
            }
            Sendlater3Util.Returning("Sendlater3Util.ShortcutClosure", func);
            return func;
        }
        Sendlater3Util.warn("Invalid setting for quick option " + num + ": \"" +
                            raw + "\" is neither a number nor a function " +
                            "that returns a number");
        return; // undefined
    },

    FormatDateTime: function(thisdate,includeTZ) {
        Sendlater3Util.Entering("Sendlater3Util.FormatDateTime", thisdate,
                                includeTZ);
        var s="";
        var sDaysOfWeek = [ "Sun","Mon","Tue","Wed","Thu","Fri","Sat" ];
        var sMonths= ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep",
                      "Oct","Nov","Dec"];

        var offset = thisdate.getTimezoneOffset();
        s += sDaysOfWeek[thisdate.getDay()];
        s += ", ";
        s += thisdate.getDate();
        s += " ";
        s += sMonths[thisdate.getMonth()];
        s += " ";
        s+=( thisdate.getFullYear());
        s += " ";
        var val = thisdate.getHours();
        if (val < 10)
            s += "0";
        s += val;
        s += ":";
        val = thisdate.getMinutes();
        if (val < 10)
            s += "0";
        s+= val;
        s += ":";
        val = thisdate.getSeconds();
        if (val < 10)
            s += "0";
        s+=val;
        if (includeTZ) {
            s += " ";
            if (offset < 0)
            {
                offset *= -1;
                s += "+";
            }
            else
                s += "-";

            val = Math.floor (offset / 60);
            if (val < 10)
                s += "0";
            s+=val;
            val = Math.floor (offset % 60);
            if (val < 10)
                s += "0";
            s+=val;
        }
        Sendlater3Util.Returning("Sendlater3Util.FormatDateTime", s);
        return s;
    },

    UnitTests: [],

    AddTest: function(test_name, test_function, test_args) {
        SL3U.UnitTests.push([test_name, test_function, test_args]);
    },

    RunTests: function(names) {
        for (var i in Sendlater3Util.UnitTests) {
            var params = Sendlater3Util.UnitTests[i];
            var name = params[0]
            var func = params[1]
            var args = params[2]

            if (names && names.indexOf(name) == -1)
                continue;

            try {
                var result = func.apply(null, args);
            }
            catch (ex) {
                Sendlater3Util.warn("TEST " + name + " EXCEPTION: " +
                                    ex.message);
                continue;
            }
            if (result === true) {
                Sendlater3Util.info("TEST " + name + " PASS");
            }
            else if (result === false) {
                Sendlater3Util.warn("TEST " + name + " FAIL");
            }
            else {
                Sendlater3Util.warn("TEST " + name + " FAIL " + result);
            }
        }
    },

    // Takes a recurrence specification string, returns a parsed version of it.
    // Eventually, this should be used everywhere that parses recurrence
    // strings, but it was added after much of that code was written, and I'm
    // not going to go back and refactor all of it now. However, it should
    // definitely be used for all newly added code that parses recurrence
    // strings.
    ParseRecurSpec: function(spec) {
        var params = spec.split(/\s+/);
        var parsed = {};
        parsed.type = params.shift();
        if (! /^(none|minutely|daily|weekly|monthly|yearly|function)$/.test(
            parsed.type))
            throw "Invalid recurrence type in " + spec;
        if (parsed.type == "none") {
            if (params.length)
                throw "Extra arguments in " + spec;
            return null;
        }
        if (parsed.type == "monthly") {
            if (! /^\d+$/.test(params[0]))
                throw "Invalid first monthly argument in " + spec;
            if (/^[1-9]\d*$/.test(params[1])) {
                parsed.monthly_day = {day: params.shift(),
                                      week: params.shift()};
                if (parsed.monthly_day.day > 6)
                    throw "Invalid monthly day argument in " + spec;
                if (parsed.monthly_day.week > 5)
                    throw "Invalid monthly week argument in " + spec;
            }
            else {
                parsed.monthly = params.shift();
                if (parsed.monthly > 31)
                    throw "Invalid monthly date argument in " + spec;
            }
        }
        else if (parsed.type == "yearly") {
            if (! /^\d+$/.test(params[0]))
                throw "Invalid first yearly argument in " + spec;
            if (! /^\d+$/.test(params[1]))
                throw "Invalid second yearly argument in " + spec;
            parsed.yearly = {month: params.shift(), date: params.shift()};
            if (parsed.yearly.month > 11)
                throw "Invalid yearly month argument in " + spec;
            if (parsed.yearly.date > 31)
                throw "Invalid yearly date argument in " + spec;
        }
        if (parsed.type == "function") {
            if (params.length != 1)
                throw "Invalid function recurrence spec " + spec;
            parsed.function = params.shift();
        }
        else {
            var slashIndex = params.indexOf("/");
            if (slashIndex > -1) {
                multiplier = params[slashIndex + 1];
                if (! /^\d+$/.test(multiplier))
                    throw "Invalid multiplier argument in " + spec;
                parsed.multiplier = multiplier;
                params.splice(slashIndex, slashIndex + 2);
            }
            var betweenIndex = params.indexOf("between");
            if (betweenIndex > -1) {
                startTime = params[betweenIndex + 1];
                if (! /^\d{3,4}$/.test(startTime))
                    throw "Invalid between start in " + spec;
                endTime = params[betweenIndex + 2];
                if (! /^\d{3,4}$/.test(endTime))
                    throw "Invalid between end in " + spec;
                parsed.between = {start: startTime, end: endTime};
                params.splice(betweenIndex, betweenIndex + 3);
            }
        }
        if (params.length)
            throw "Extra arguments in " + spec;
        return parsed;
    },

    ParseRecurTests: function() {
        function CompareRecurs(a, b) {
            if (!a && !b) return true;
            if (!a || !b) return false;
            if (a.type != b.type) return false;
            if (!a.monthly_day != !b.monthly_day) return false;
            if (a.monthly_day && (a.monthly_day.day != b.monthly_day.day ||
                                  a.monthly_day.week != b.monthly_day.week))
                return false;
            if (a.monthly != b.monthly) return false;
            if (!a.yearly != !b.yearly) return false;
            if (a.yearly && (a.yearly.month != b.yearly.month ||
                             a.yearly.date != b.yearly.date))
                return false;
            if (a.function != b.function) return false;
            if (a.multiplier != b.multiplier) return false;
            if (!a.between != !b.between) return false;
            if (a.between && (a.between.start != b.between.start ||
                              a.between.end != b.between.end))
                return false;
            return true;
        }

        function ParseRecurGoodTest(spec, expected) {
            var out = SL3U.ParseRecurSpec(spec);
            if (CompareRecurs(out, expected))
                return true;
            return("expected " + JSON.stringify(expected) + ", got " +
                   JSON.stringify(out));
            
        }

        var goodTests = [
            ["none", null],
            ["minutely", {type: "minutely"}],
            ["daily", {type: "daily"}],
            ["weekly", {type: "weekly"}],
            ["monthly 3", {type: "monthly", monthly: 3}],
            ["monthly 0 3", {type: "monthly", monthly_day: {day: 0, week: 3}}],
            ["yearly 10 5", {type: "yearly", yearly: {month: 10, date: 5}}],
            ["function froodle", {type: "function", "function": "froodle"}],
            ["minutely / 5", {type: "minutely", multiplier: 5}],
            ["minutely between 830 1730", {type: "minutely",
                                           between: {start: 830, end: 1730}}]
        ];
        for (var i in goodTests) {
            var test = goodTests[i];
            SL3U.AddTest("ParseRecurSpec " + test[0], ParseRecurGoodTest, test);
        }

        function ParseRecurBadTest(spec, expected) {
            try {
                var out = SL3U.ParseRecurSpec(spec);
                return "expected exception, got " + JSON.stringify(out);
            }
            catch (ex) {
                if (! ex.match(expected))
                    return "exception " + ex + " did not match " + expected;
                return true;
            }
        }

        var badTests = [
            ["bad-recurrence-type", "Invalid recurrence type"],
            ["none extra-arg", "Extra arguments"],
            ["monthly bad", "Invalid first monthly argument"],
            ["monthly 7 3", "Invalid monthly day argument"],
            ["monthly 4 6", "Invalid monthly week argument"],
            ["monthly 32", "Invalid monthly date argument"],
            ["yearly bad", "Invalid first yearly argument"],
            ["yearly 10 bad", "Invalid second yearly argument"],
            ["yearly 20 3", "Invalid yearly month argument"],
            ["yearly 10 40", "Invalid yearly date argument"],
            ["function", "Invalid function recurrence spec"],
            ["function foo bar", "Invalid function recurrence spec"],
            ["daily / bad", "Invalid multiplier argument"],
            ["minutely between 11111 1730", "Invalid between start"],
            ["daily between 1100 17305", "Invalid between end"],
            ["daily extra-argument", "Extra arguments"]
        ];

        for (var i in badTests) {
            var test = badTests[i];
            SL3U.AddTest("ParseRecurSpec " + test[0], ParseRecurBadTest, test);
        }
    },
            
    NextRecurTests: function() {
        function DeepCompare(a, b) {
            if (a instanceof Array) {
                if (b instanceof Array) {
                    if (a.length != b.length) {
                        return false;
                    }
                    var i;
                    for (i = 0; i < a.length; i++) {
                        if (! DeepCompare(a[i], b[i])) {
                            return false;
                        }
                    }
                    return true;
                }
                return false;
            }
            if (b instanceof Array) {
                return false;
            }
            if (a instanceof Date) {
                if (b instanceof Date) {
                    return a.getTime() == b.getTime();
                }
                return false;
            }
            return a == b;
        }

        function NextRecurNormalTest(sendat, recur, now, expected) {
            try {
                result = SL3U.NextRecurDate(
                    new Date(sendat), recur, new Date(now));
            }
            catch (ex) {
                return "Unexpected error: " + ex;
            }
            expected = new Date(expected);
            if (result.getTime() == expected.getTime()) {
                return true;
            }
            return "expected " + expected + ", got " + result;
        }

        function NextRecurExceptionTest(sendat, recur, now, expected) {
            try {
                result = SL3U.NextRecurDate(
                    new Date(sendat), recur, new Date(now));
                return "Expected exception, got " + result;
            }
            catch (ex) {
                if (ex.message.match(expected)) {
                    return true;
                }
                return "Expected exception matching " + expected + ", got " +
                    ex.message;
            }
        }

        function NextRecurFunctionTest(sendat, recur, now, args, func_name,
                                       func, expected) {
            window[func_name] = func;
            try {
                result = SL3U.NextRecurDate(
                    new Date(sendat), recur, new Date(now), args);
                delete window[func_name];
            }
            catch (ex) {
                delete window[func_name];
                return "Unexpected error: " + ex.message;
            }
            if (DeepCompare(result, expected)) {
                return true;
            }
            return "expected " + expected + ", got " + result;
        }

        function NextRecurFunctionExceptionTest(sendat, recur, now, func_name,
                                                func, expected) {
            window[func_name] = func;
            try {
                result = SL3U.NextRecurDate(
                    new Date(sendat), recur, new Date(now));
                delete window[func_name];
                return "Expected exception, got " + result;
            }
            catch (ex) {
                delete window[func_name];
                if (ex.message.match(expected)) {
                    return true;
                }
                return "Expected exception matching " + expected + ", got " +
                    ex.message;
            }
        }

        SL3U.AddTest("NextRecurDate daily", NextRecurNormalTest,
                     ["1/1/2012", "daily", "1/1/2012", "1/2/2012"]);
        SL3U.AddTest("NextRecurDate weekly", NextRecurNormalTest,
                     ["1/2/2012", "weekly", "1/10/2012", "1/16/2012"]);
        SL3U.AddTest("NextRecurDate monthly 5", NextRecurNormalTest,
                     ["1/5/2012", "monthly 5", "1/5/2012", "2/5/2012"]);
        SL3U.AddTest("NextRecurDate monthly 30", NextRecurNormalTest,
                     ["3/1/2012", "monthly 30", "3/1/2012", "3/30/2012"]);
        SL3U.AddTest("NextRecurDate monthly 0 3", NextRecurNormalTest,
                     ["4/15/2012", "monthly 0 3", "4/15/2012", "5/20/2012"]);
        SL3U.AddTest("NextRecurDate monthly 0 5", NextRecurNormalTest,
                     ["1/29/2012", "monthly 0 5", "1/30/2012", "4/29/2012"]);
        SL3U.AddTest("NextRecurDate yearly 1 29", NextRecurNormalTest,
                     ["2/29/2012", "yearly 1 29", "2/29/2012", "3/1/2013"]);
        SL3U.AddTest("NextRecurDate yearly 1 29 / 3", NextRecurNormalTest,
                     ["3/1/2013", "yearly 1 29 / 3", "3/1/2013", "2/29/2016"]);
        SL3U.AddTest("NextRecurDate minutely timely", NextRecurNormalTest,
                     ["1/1/2012 11:26:37", "minutely", "1/1/2012 11:26:50",
                      "1/1/2012 11:27:37"]);
        SL3U.AddTest("NextRecurDate minutely late", NextRecurNormalTest,
                     ["1/1/2012 11:26:37", "minutely", "1/1/2012 11:29:50",
                      "1/1/2012 11:30:37"]);
        SL3U.AddTest("NextRecurDate minutely / 5 timely", NextRecurNormalTest,
                     ["1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:26:50",
                      "1/1/2012 11:31:37"]);
        SL3U.AddTest("NextRecurDate minutely / 5 late", NextRecurNormalTest,
                     ["1/1/2012 11:26:37", "minutely / 5", "1/1/2012 11:35:05",
                      "1/1/2012 11:35:37"]);

        SL3U.AddTest("NextRecurDate nonexistent function",
                     NextRecurExceptionTest,
                     ["10/3/2012", "function foo", "10/3/2012",
                      "is not defined"]);
        SL3U.AddTest("NextRecurDate bad function type", NextRecurExceptionTest,
                     ["10/3/2012", "function Sendlater3Util", "10/3/2012",
                      "is not a function"]);
        SL3U.AddTest("NextRecurDate function doesn't return a value",
                     NextRecurFunctionExceptionTest,
                     ["10/3/2012", "function Test1", "10/3/2012", "Test1",
                      function() { return; }, "did not return a value"]);
        SL3U.AddTest("NextRecurDate function doesn't return number or array",
                     NextRecurFunctionExceptionTest,
                     ["10/3/2012", "function Test2", "10/3/2012", "Test2",
                      function() { return "foo"; },
                      "did not return number or array"]);
        SL3U.AddTest("NextRecurDate function returns too-short array",
                     NextRecurFunctionExceptionTest,
                     ["10/3/2012", "function Test3", "10/3/2012", "Test3",
                      function() { return new Array(); }, "is too short"]);
        SL3U.AddTest("NextRecurDate function did not start with a number",
                     NextRecurFunctionExceptionTest,
                     ["10/3/2012", "function Test4", "10/3/2012", "Test4",
                      function() { return new Array("monthly", "extra"); },
                      "did not start with a number"]);
        SL3U.AddTest("NextRecurDate function finished recurring",
                     NextRecurFunctionTest,
                     ["10/3/2012", "function Test5", "10/3/2012", null, "Test5",
                      function() { return -1; }, null]);

        var d1 = new Date();
        d1.setTime((new Date("10/3/2012")).getTime()+5*60*1000);
        SL3U.AddTest("NextRecurDate function returning minutes",
                     NextRecurFunctionTest,
                     ["10/3/2012", "function Test6", "10/4/2012", null, "Test6",
                      function() { return 5; }, [d1, null]]);

        var d2 = new Date();
        d2.setTime((new Date("10/3/2012")).getTime()+7*60*1000);
        SL3U.AddTest("NextRecurDate function returning array",
                     NextRecurFunctionTest,
                     ["10/3/2012", "function Test7", "10/4/2012", null, "Test7",
                      function() { return new Array(7, "monthly 5"); },
                      [d2, "monthly 5"]]);
        SL3U.AddTest("NextRecurDate function returning array with args",
                     NextRecurFunctionTest,
                     ["10/3/2012", "function Test8", "10/4/2012",
                      ["froodle"], "Test8", function(prev, args) {
                          if (args[0] != "froodle") {
                              throw "bad args: " + args;
                          }
                          return [7, "monthly 5", "freeble"];
                      }, [d2, "monthly 5", "freeble"]]);

        SL3U.AddTest("NextRecurDate between before", NextRecurNormalTest,
                     ["3/1/2016 17:00", "minutely / 600 between 0900 1700",
                      "3/1/2016 17:01", "3/2/2016 9:00"]);
        SL3U.AddTest("NextRecurDate between after", NextRecurNormalTest,
                     ["3/1/2016 16:45", "minutely / 60 between 0900 1700",
                      "3/1/2016 16:45", "3/2/2016 9:00"]);
        SL3U.AddTest("NextRecurDate between ok", NextRecurNormalTest,
                     ["3/1/2016 12:45", "minutely / 60 between 0900 1700",
                      "3/1/2016 12:46", "3/1/2016 13:45"]);
    },

    NextRecurFunction: function(next, recurSpec, args, recurArray) {
        var error;
        var funcName = recurArray[0];
        var func = window[funcName];
        if (typeof(func) == "undefined")
            throw new Error("Send Later: Invalid recurrence specification '" +
                            recurSpec + "': '" + funcName + "' is not defined");
        else if (typeof(func) != "function")
            throw new Error("Send Later: Invalid recurrence specification '" +
                            recurSpec + ": '" + funcName +
                            "' is not a function");
        var nextRecur = func(next, args);
        if (! nextRecur)
            throw new Error("Send Later: Recurrence function '" + funcName +
                            "' did not return a value");
        if (typeof(nextRecur) == "number") {
            if (nextRecur == -1)
                return null;
            next.setTime(next.getTime()+nextRecur*60*1000);
            return new Array(next, null);
        }

        if (! (nextRecur instanceof Array))
            throw new Error("Send Later: Recurrence function '" + funcName +
                            "' did not return number or array");
        if (nextRecur.length < 2)
            throw new Error("Send Later: Array returned by recurrence " +
                            "function '" + funcName + "' is too short");
        if (typeof(nextRecur[0]) != "number" &&
            ! (nextRecur[0] instanceof Date))
            throw new Error("Send Later: Array " + nextRecur +
                            " returned by recurrence function '" + funcName +
                            "' did not start with a number or Date");
        if (! (nextRecur[0] instanceof Date)) {
            next.setTime(next.getTime()+nextRecur[0]*60*1000);
            nextRecur[0] = next;
        }
        return nextRecur;
    },

    NextRecurDate: function(next, recurSpec, now, args) {
        Sendlater3Util.Entering("NextRecurDate", next, recurSpec, now, args);
        // Make sure we don't modify our input!
        next = new Date(next.getTime());

        var recurArray = recurSpec.split(/\s+/);
        var type = recurArray[0];
        recurArray.splice(0, 1);

        if (type == "function")
            return SL3U.NextRecurFunction(next, recurSpec, args, recurArray);

        var betweenIndex, betweenStart, betweenEnd;
        betweenIndex = recurArray.indexOf("between");
        if (betweenIndex > -1) {
            betweenStart = recurArray[betweenIndex + 1];
            betweenEnd = recurArray[betweenIndex + 2 ];
            recurArray.splice(betweenIndex, betweenIndex + 3);
        }

        var dayOfMonth, dayOfWeek, weekOfMonth, monthOfYear, recurCount;

        if (type == "monthly") {
            dayOfMonth = recurArray[0];
            recurArray.splice(0, 1);
            if ((recurArray.length > 0) && recurArray[0].match(/^[0-9]+/)) {
                dayOfWeek = dayOfMonth;
                dayOfMonth = null;
                weekOfMonth = recurArray[0];
                recurArray.splice(0, 1);
            }
        }
        else if (type == "yearly") {
            monthOfYear = recurArray[0];
            dayOfMonth = recurArray[1];
            recurArray.splice(0,2);
        }
        if ((recurArray.length > 1) && (recurArray[0] == "/")) {
            recurCount = recurArray[1];
            recurArray.splice(0, 2);
        }
        else
            recurCount = 1;
        if (recurArray.length > 0)
            throw "Send Later internal error: extra recurrence args: " +
                recurArray.toString();
        if (! now)
            now = new Date();

        var redo = false;

        while ((next <= now) || (recurCount > 0) || redo) {
            redo = false;
            switch (type) {
            case "minutely":
                next.setMinutes(next.getMinutes()+1)
                break;
            case "daily":
                next.setDate(next.getDate()+1);
                break;
            case "weekly":
                next.setDate(next.getDate()+7);
                break;
            case "monthly":
                // Two different algorithms are in play here, depending on
                // whether we're supposed to schedule on a day of the month or
                // a weekday of a week of the month.
                //
                // If the former, then either the current day of the month is
                // the same as the one we want, in which case we just move to
                // the next month, or it's not, in which case the "correct"
                // month didn't have that day (i.e., it's 29, 30, or 31 on a
                // month without that many days), so we ended up rolling
                // over. In that case, we set the day of the month of the
                // _current_ month, because we're already in the right month.
                //
                // If the latter, then first check if we're at the correct
                // weekday and week of the month. If so, then go to the first
                // day of the next month. After that, move forward to the
                // correct week of the month and weekday.  If that pushes us
                // past the end of the month, that means the month in question
                // doesn't have, e.g., a "5th Tuesday", so we need to set the
                // redo flag indicating that we need to go through the loop
                // again because we didn't successfully find a date.

                if (dayOfMonth != null) {
                    if (next.getDate() == dayOfMonth)
                        next.setMonth(next.getMonth()+1);
                    else
                        next.setDate(dayOfMonth);
                }
                else {
                    if ((next.getDay() == dayOfWeek) &&
                        (Math.ceil(next.getDate()/7) == weekOfMonth)) {
                        next.setDate(1);
                        next.setMonth(next.getMonth()+1);
                    }
                    else {}
                    next.setDate((weekOfMonth-1)*7+1);
                    while (next.getDay() != dayOfWeek)
                        next.setDate(next.getDate()+1);
                    if (Math.ceil(next.getDate()/7) != weekOfMonth)
                        redo = true;
                }
                break;
            case "yearly":
                next.setFullYear(next.getFullYear()+1);
                next.setMonth(monthOfYear);
                next.setDate(dayOfMonth);
                break;
            default:
                throw "Send Later internal error: unrecognized recurrence " +
                    "type: " + type;
                break;
            }

            recurCount--;
        }

        if (betweenIndex > -1)
            next = SL3U.AdjustDateForRestrictions(
                next, betweenStart, betweenEnd, null);

        return next;
    },

    FormatRecur: function(recurSpec) {
        var type, dayOfMonth, dayOfWeek, weekOfMonth, monthOfYear, recurCount;
        var str = "";

        var regex = /\s+between\s+(\d+)(\d\d)\s+(\d+)(\d\d)/
        var match = regex.exec(recurSpec);
        var betw_string = "";
        if (match) {
            betw_string = " " + SL3U.PromptBundleGetFormatted(
                "betw_times", [match[1], match[2], match[3], match[4]])
            recurSpec = recurSpec.replace(regex, "");
        }
        else {
            betw_string = "";
        }
        
        var recurArray = recurSpec.split(" ");
        type = recurArray[0];
        recurArray.splice(0, 1);

        if (type == "function") {
            return recurArray[0];
        }

        if (type == "monthly") {
            dayOfMonth = recurArray[0];
            recurArray.splice(0, 1);
            if ((recurArray.length > 0) && recurArray[0].match(/^[0-9]+/)) {
                dayOfWeek = dayOfMonth;
                dayOfMonth = null;
                weekOfMonth = recurArray[0];
                recurArray.splice(0, 1);
            }
        }
        else if (type == "yearly") {
            monthOfYear = recurArray[0];
            dayOfMonth = recurArray[1];
            recurArray.splice(0,2);
        }
        if ((recurArray.length > 1) && (recurArray[0] == "/")) {
            recurCount = recurArray[1];
            recurArray.splice(0, 2);
        }
        else {
            recurCount = 1;
        }
        if (recurArray.length > 0) {
            throw "Send Later internal error: extra recurrence args: " + recurArray.toString();
        }

        if (recurCount == 1) {
            str = SL3U.PromptBundleGet(type);
        }
        else {
            str = SL3U.PromptBundleGetFormatted("every_"+type, [recurCount]);
        }

        if (dayOfWeek != null) {
            str += ", " + SL3U.PromptBundleGetFormatted("everymonthly_short",
                                                        [SL3U.PromptBundleGet("ord"+weekOfMonth),
                                                         SL3U.PromptBundleGet("day"+dayOfWeek)]);
        }

        return str + betw_string;
    },

    RecurHeader: function(sendat, recur, args) {
        var header = {'X-Send-Later-Recur': recur};
        if (args) {
            header['X-Send-Later-Args'] = JSON.stringify(args);
        }
        return header;
    },

    // dt is a Date object for the scheduled send time we need to adjust.
    // start_time and end_time are numbers like YYMM, e.g., 10:00am is
    // 1000, 5:35pm is 1735, or null if there is no time restriction.
    // days is an array of numbers, with 0 being Sunday and 6 being Saturday,
    // or null if there is no day restriction.
    // Algorithm:
    // 1) Copy args so we don't modify them.
    // 2) If there is a time restriction and the scheduled time is before it,
    //    change it to the beginning of the time restriction.
    // 3) If there is a time restriction and the scheduled time is after it,
    //    change it to the beginning of the time restriction the next day.
    // 4) If there is a day restriction and the scheduled day isn't in it,
    //    change the day to the smallest day in the restriction that is larger
    //    than the scheduled day, or if there is none, then the smallest day in
    //    the restriction overall.
    AdjustDateForRestrictions: function(dt, start_time, end_time, days) {
        // 1)
        dt = new Date(dt);
        if (days) {
            days = days.slice();
        }
        else {
            days = [];
        }
        var scheduled_time = dt.getHours() * 100 + dt.getMinutes();
        // 2)
        if (start_time && scheduled_time < start_time) {
            dt.setHours(Math.floor(start_time / 100));
            dt.setMinutes(start_time % 100);
        }
        // 3)
        else if (end_time && scheduled_time > end_time) {
            dt.setDate(dt.getDate()+1);
            dt.setHours(Math.floor(start_time / 100));
            dt.setMinutes(start_time % 100);
        }
        // 4)
        if (days.length && days.indexOf(dt.getDay()) == -1) {
            days.sort();
            var want_day = days[days.indexOf(dt.getDay())+1];
            if (! want_day) {
                want_day = days[0];
            }
            while (dt.getDay() != want_day) {
                dt.setDate(dt.getDate()+1);
            }
        }
        return dt;
    },

    AdjustDateForRestrictionsTests: function() {
        function NormalTest(dt, start_time, end_time, days, expected) {
            var orig_dt = new Date(dt);
            var orig_days;
            if (days) {
                orig_days = days.slice();
            }
            result = SL3U.AdjustDateForRestrictions(dt, start_time, end_time,
                                                    days);
            if (orig_dt.getTime() != dt.getTime()) {
                throw "AdjustDateForRestrictions modified dt!";
            }
            if (orig_days && String(orig_days) != String(days)) {
                throw "AdjustedDateForRestrictions modified days!";
            }
            return expected.getTime() == result.getTime();
        }

        SL3U.AddTest("AdjustDateForRestrictions no-op", NormalTest,
                     [new Date("1/1/2016 10:37:00"), null, null, null,
                      new Date("1/1/2016 10:37:00")]);
        SL3U.AddTest("AdjustDateForRestrictions before start", NormalTest,
                     [new Date("1/1/2016 05:30:37"), 830, 1700, null,
                      new Date("1/1/2016 08:30:37")]);
        SL3U.AddTest("AdjustDateForRestrictions after end", NormalTest,
                     [new Date("1/1/2016 18:30:37"), 830, 1700, null,
                      new Date("1/2/2016 08:30:37")]);
        SL3U.AddTest("AdjustDateForRestrictions OK time", NormalTest,
                     [new Date("1/1/2016 12:37:00"), 830, 1700, null,
                      new Date("1/1/2016 12:37:00")]);
        SL3U.AddTest("AdjustDateForRestrictions start edge", NormalTest,
                     [new Date("1/1/2016 8:30:00"), 830, 1700, null,
                      new Date("1/1/2016 8:30:00")]);
        SL3U.AddTest("AdjustDateForRestrictions end edge", NormalTest,
                     [new Date("1/1/2016 17:00:00"), 830, 1700, null,
                      new Date("1/1/2016 17:00:00")]);
        SL3U.AddTest("AdjustDateForRestrictions OK day", NormalTest,
                     [new Date("1/1/2016 8:30:00"), null, null, [5],
                      new Date("1/1/2016 8:30:00")]);
        SL3U.AddTest("AdjustDateForRestrictions later day", NormalTest,
                     [new Date("1/1/2016 8:30:00"), null, null, [6],
                      new Date("1/2/2016 8:30:00")]);
        SL3U.AddTest("AdjustDateForRestrictions earlier day", NormalTest,
                     [new Date("1/1/2016 8:30:00"), null, null, [1, 2, 3],
                      new Date("1/4/2016 8:30:00")]);
    },

    logger: null,
    log_filter_string: null,

    log_filter: function(msg) {
        var filter_string = Sendlater3Util.getCharPref("logging.filter");
        if (filter_string != Sendlater3Util.log_filter_string) {
            if (filter_string) {
                Sendlater3Util.log_filter_re = new RegExp(filter_string);
            }
            Sendlater3Util.log_filter_string = filter_string;
        }
        if (filter_string) {
            return Sendlater3Util.log_filter_re.test(msg);
        }
        else {
            return true;
        }
    },

    warn: function(msg) {
        if (! Sendlater3Util.log_filter(msg)) {
            return;
        }
        try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.warn(msg);
        }
        catch (ex) {
        }
    },

    info: function(msg) {
        if (! Sendlater3Util.log_filter(msg)) {
            return;
        }
        try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.info(msg);
        }
        catch (ex) {
        }
    },

    dump: function(msg) {
        if (! Sendlater3Util.log_filter(msg)) {
            return;
        }
        try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.info(msg);
        }
        catch (ex) {
        }
    },

    debug: function(msg) {
        if (! Sendlater3Util.log_filter(msg)) {
            return;
        }
        try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.debug(msg);
        }
        catch (ex) {
        }
    },

    trace: function(msg) {
        if (! Sendlater3Util.log_filter(msg)) {
            return;
        }
        try {
            Sendlater3Util.initLogging();
            Sendlater3Util.logger.trace(msg);
        }
        catch (ex) {
        }
    },

    initLogging: function() {
        try {
            if (Sendlater3Util.logger == null) {
                Sendlater3Util.logger =
                    Log4Moz.getConfiguredLogger("extensions.sendlater3",
                                                Log4Moz.Level.Trace,
                                                Log4Moz.Level.Info,
                                                Log4Moz.Level.Debug);
                Sendlater3Util.logger.debug("Initialized logging");
            }
        }
        catch (ex) {
        }
    },

    reinitLogging: {
        observe: function() {
            try {
                Sendlater3Util.Entering("Sendlater3Util.reinitLogging.observe");
                // This is really disgusting.
                delete Log4Moz.repository._loggers["extensions.sendlater3"];
                Sendlater3Util.logger = null;
                Sendlater3Util.initLogging();
                Sendlater3Util.Leaving("Sendlater3Util.reinitLogging.observe");
            }
            catch (ex) {
            }
        },
    },

    // The Mail Merge add-on is using this, so don't change it without letting
    // the author know what's changing!
    getInstanceUuid: function() {
        var instance_uuid = Sendlater3Util.getCharPref("instance.uuid");
        if (! instance_uuid) {
            var uuidGenerator =
                Components.classes["@mozilla.org/uuid-generator;1"]
                .getService(Components.interfaces.nsIUUIDGenerator);
            instance_uuid = uuidGenerator.generateUUID().toString();
            Sendlater3Util.setCharPref("instance.uuid", instance_uuid);
        }
        return instance_uuid;
    },

    toSendDate: function(year, month, day, hour, min) {
        // We use an existing Date object to get the number of seconds
        // so that we don't end up sending every message at exactly
        // the same number of seconds past the minute. That would look
        // weird.
        var sendat = new Date();
        // We use an existing Date object to get the number of seconds
        // so that we don't end up sending every message at exactly
        // the same number of seconds past the minute. That would look
        // weird.
        sendat = new Date(parseInt(year), parseInt(month), parseInt(day),
                          parseInt(hour), parseInt(min), sendat.getSeconds(),
                          0);
        return sendat;
    },

    initUtil: function() {
        Sendlater3Util.Entering("Sendlater3Util.initUtil");
        Sendlater3Util._PromptBundle =
            document.getElementById("sendlater3-promptstrings");
        Sendlater3Util.PrefService
            .QueryInterface(Components.interfaces.nsIPrefBranch2);
        Sendlater3Util.consoleObserver =
            Sendlater3Util.PrefService.addObserver(
                Sendlater3Util.pref("logging.console"),
                Sendlater3Util.reinitLogging, false);
        Sendlater3Util.dumpObserver =
            Sendlater3Util.PrefService.addObserver(
                Sendlater3Util.pref("logging.dump"),
                Sendlater3Util.reinitLogging, false);
        Sendlater3Util.Leaving("Sendlater3Util.initUtil");
    },

    uninitUtil: function() {
        Sendlater3Util.Entering("Sendlater3Util.uninitUtil");
        Sendlater3Util.PrefService
            .QueryInterface(Components.interfaces.nsIPrefBranch2);
        Sendlater3Util.PrefService.removeObserver(
            Sendlater3Util.pref("logging.console"),
            Sendlater3Util.reinitLogging);
        Sendlater3Util.PrefService.removeObserver(
            Sendlater3Util.pref("logging.dump"),
            Sendlater3Util.reinitLogging);
        Sendlater3Util.Leaving("Sendlater3Util.uninitUtil");
    },

    DZFormat: function(val) {
        var ret;
        if (val < 10) ret = "0" + val; else ret = val;
        return ret;
    },

    copyService: null,
    fileNumber: 0,

    CopyStringMessageToFolder: function(content, folder, listener) {
        var dirService = Components
            .classes["@mozilla.org/file/directory_service;1"]
            .getService(Components.interfaces.nsIProperties);
        var tempDir = dirService.get("TmpD", Components.interfaces.nsIFile);
        var sfile = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsILocalFile);
        sfile.initWithPath(tempDir.path);
        sfile.appendRelativePath("tempMsg" + Sendlater3Util.getInstanceUuid()
                                 + Sendlater3Util.fileNumber++ + ".eml");
        var filePath = sfile.path;
        Sendlater3Util.dump("Saving message to " + filePath);
        if (sfile.exists()) sfile.remove(true);
        sfile.create(sfile.NORMAL_FILE_TYPE, 0600);
        var stream = Components
            .classes['@mozilla.org/network/file-output-stream;1']
            .createInstance(Components.interfaces.nsIFileOutputStream);
        stream.init(sfile, 2, 0x200, false);
        stream.write(content, content.length);
        stream.close();
        // Separate stream required for reading, since
        // nsIFileOutputStream is write-only on Windows (and for
        // that matter should probably be write-only on Linux as
        // well, since it's an *output* stream, but it doesn't
        // actually behave that way).
        sfile = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsILocalFile);
        sfile.initWithPath(filePath);
        listener.localFile = sfile;
        if (! Sendlater3Util.copyService) {
            Sendlater3Util.copyService = Components
                .classes["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Components.interfaces.nsIMsgCopyService);
        }
        if (Sendlater3Util.IsPostbox()) {
            Sendlater3Util.copyService.CopyFileMessage(sfile, folder, 0, "",
                                                       listener, msgWindow);
        }
        else {
            Sendlater3Util.copyService.CopyFileMessage(sfile, folder, null,
                                                       false, 0, "", listener,
                                                       msgWindow);
        }
    },

    WaitAndDelete: function(file_arg) {
        var timer = Components.classes["@mozilla.org/timer;1"]
            .createInstance(Components.interfaces.nsITimer);
        var callback = {
            file: file_arg,
            // creating a circular reference on purpose so objects won't be
            // deleted until we eliminate the circular reference.
            timer_ref: timer,
            notify: function(timer) {
                try {
                    this.file.remove(true);
                    this.timer_ref = undefined;
                    timer.cancel();
                    Sendlater3Util.dump("Successfully deleted queued "
                                        + this.file.path);
                }
                catch (ex) {
                    Sendlater3Util.dump("Failed to delete "
                                        + this.file.path);
                }
            }
        };
        timer.initWithCallback(callback, 100, Components.interfaces.nsITimer
                               .TYPE_REPEATING_SLACK);
    },

    alert_for_enigmail: function() {
        if (typeof Enigmail !== 'undefined') {
            if (SL3U.getBoolPref("disabled_for_enigmail"))
                // Already disabled, no need to alert.
                return true;
            SL3U.alert(null, SL3U.PromptBundleGet("EnigmailWarningTitle"),
                       SL3U.PromptBundleGet("EnigmailWarningText"));
            SL3U.setBoolPref("disabled_for_enigmail", true);
            return true;
        }
        if (SL3U.getBoolPref("disabled_for_enigmail"))
            SL3U.setBoolPref("disabled_for_enigmail", false);
        return false;
    },

    Entering: function() {
        var func = arguments[0];
        var msg = "Entering " + func;
        var a = new Array();
        var i;
        for (i = 1; i < arguments.length; i++) {
            a.push(arguments[i]);
        }
        if (a.length > 0) {
            msg = msg + "(" + a.join(", ") + ")";
        }
        Sendlater3Util.trace(msg);
    },

    Leaving: function(func) {
        Sendlater3Util.trace("Leaving " + func);
    },

    Returning: function(func, value) {
        Sendlater3Util.trace("Returning \"" + value + "\" from " + func);
    },

    Throwing: function(func, error) {
        Sendlater3Util.trace("Throwing \"" + error + "\" from " + func);
    }
};

var SL3U = Sendlater3Util;
//SL3U.NextRecurTests();
//SL3U.AdjustDateForRestrictionsTests();
//SL3U.ParseRecurTests();
//SL3U.RunTests();
