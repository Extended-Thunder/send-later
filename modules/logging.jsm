var EXPORTED_SYMBOLS = ["Entering", "Leaving", "Returning", "Throwing", "error",
                          "warn", "info", "config", "debug", "trace"];
let { Log4Moz } = ChromeUtils.import("resource:///modules/gloda/Log4moz.jsm");

let logger = null;
let filter_re = null;

function log_filter(msg) {
    if (filter_re)
        return filter_re.test(msg);
    else
        return true;
}

function init() {
    if (logger)
        return;

    const filter_string = Services.prefs.getCharPref("extensions.sendlater3.logging.filter");
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
    Services.prefs.addObserver("extensions.sendlater3.logging.console",
        reinitLogging, false);
    Services.prefs.addObserver("extensions.sendlater3.logging.dump",
        reinitLogging, false);
    Services.prefs.addObserver("extensions.sendlater3.logging.filter",
        reinitLogging, false);
}

const reinitLogging = {
    observe: function() {
        try {
            Entering("reinitLogging.observe");
            // This is really disgusting.
            delete Log4Moz.repository._loggers["extensions.sendlater3"];
            logger = null;
            init();
            Leaving("reinitLogging.observe");
        }
        catch (ex) {}
    }
};

function Entering() {
    init();
    const func = arguments[0];
    let msg = "Entering " + func;
    const a = new Array();
    let i;
    for (i = 1; i < arguments.length; i++) {
        a.push(arguments[i]);
    }
    if (a.length > 0) {
        msg = msg + "(" + a.join(", ") + ")";
    }
    trace(msg);
};

function Leaving(func) {
    init();
    trace("Leaving " + func);
};

function Returning(func, value) {
    init();
    trace("Returning \"" + value + "\" from " + func);
};

function Throwing(func, error) {
    init();
    trace("Throwing \"" + error + "\" from " + func);
};

function error(msg) {
    init();
    if (! log_filter(msg)) return;
    try { logger.error(msg); } catch (ex) {}
};

function warn(msg) {
    init();
    if (! log_filter(msg)) return;
    try { logger.warn(msg); } catch (ex) {}
};

function info(msg) {
    init();
    if (! log_filter(msg)) return;
    try { logger.info(msg); } catch (ex) {}
};

function config(msg) {
    init();
    if (! log_filter(msg)) return;
    try { logger.config(msg); } catch (ex) {}
};

function debug(msg) {
    init();
    if (! log_filter(msg)) return;
    try { logger.debug(msg); } catch (ex) {}
};

function trace(msg) {
    init();
    if (! log_filter(msg)) return;
    try { logger.trace(msg); } catch (ex) {}
};
