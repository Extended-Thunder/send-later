var EXPORTED_SYMBOLS = ["sl3log"];

try {
    Components.utils.import("resource:///modules/gloda/log4moz.js");
}
catch (ex) {
}

const Cc = Components.classes, Ci = Components.interfaces;

var prefService = null;
var logger = null;
var filter_re = null;

function log_filter(msg) {
    if (filter_re)
        return filter_re.test(msg);
    else
        return true;
}

function init() {
    if (logger)
        return;
    prefService = Cc["@mozilla.org/preferences-service;1"].
        getService(Ci.nsIPrefBranch);
    if (! ("addObserver" in prefService))
        prefService.QueryInterface(Components.interfaces.nsIPrefBranch2);
    var filter_string = prefService.getCharPref(
        "extensions.sendlater3.logging.filter");
    if (filter_string) {
        try {
            filter_re = new RegExp(filter_string);
        }
        catch (ex) {
            filter_re = null;
        }
    }
    else
        filter_re = null;
    try {
        logger = Log4Moz.getConfiguredLogger("extensions.sendlater3",
                                             Log4Moz.Level.Trace,
                                             Log4Moz.Level.Info,
                                             Log4Moz.Level.Debug);
        logger.debug("Initialized logging");
    }
    catch (ex) {}
    prefService.addObserver("extensions.sendlater3.logging.console",
                            reinitLogging, false);
    prefService.addObserver("extensions.sendlater3.logging.dump",
                            reinitLogging, false);
    prefService.addObserver("extensions.sendlater3.logging.filter",
                            reinitLogging, false);
}

var reinitLogging = {
    observe: function() {
        try {
            sl3log.Entering("sl3log.reinitLogging.observe");
            // This is really disgusting.
            delete Log4Moz.repository._loggers["extensions.sendlater3"];
            logger = null;
            sl3log.init();
            sl3log.Leaving("sl3log.reinitLogging.observe");
        }
        catch (ex) {}
    }
};

var sl3log = {
    Entering: function() {
        init();
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
        sl3log.trace(msg);
    },

    Leaving: function(func) {
        init();
        sl3log.trace("Leaving " + func);
    },

    Returning: function(func, value) {
        init();
        sl3log.trace("Returning \"" + value + "\" from " + func);
    },

    Throwing: function(func, error) {
        init();
        sl3log.trace("Throwing \"" + error + "\" from " + func);
    },

    error: function(msg) {
        init();
        if (! log_filter(msg)) return;
        try { logger.error(msg); } catch (ex) {}
    },

    warn: function(msg) {
        init();
        if (! log_filter(msg)) return;
        try { logger.warn(msg); } catch (ex) {}
    },

    info: function(msg) {
        init();
        if (! log_filter(msg)) return;
        try { logger.info(msg); } catch (ex) {}
    },

    config: function(msg) {
        init();
        if (! log_filter(msg)) return;
        try { logger.config(msg); } catch (ex) {}
    },

    debug: function(msg) {
        init();
        if (! log_filter(msg)) return;
        try { logger.debug(msg); } catch (ex) {}
    },

    trace: function(msg) {
        init();
        if (! log_filter(msg)) return;
        try { logger.trace(msg); } catch (ex) {}
    },
};
