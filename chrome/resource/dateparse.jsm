var EXPORTED_SYMBOLS = ["dateparse"];

// Using mozIJSSubScriptLoader instead of Cu.import because I want to
// preserve sugar-1.2.5.min.js unmodified from the official
// distribution, and it doesn't define EXPORTED_SYMBOLS, which is
// required by CU.import.
var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
loader.loadSubScript("resource://sendlater3/sugar-1.2.5.min.js"); 

var didLocale = false;
var locale;

function getLocale() {
    if (! didLocale) {
	var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
            .getService(Components.interfaces.nsILocaleService);
	var localeObj = localeService.getApplicationLocale();
	locale = localeObj.getCategory("NSILOCALE_TIME");
	// Sugar may want just the first two characters of the locale.
	// And it may not recognize the locale at all. It throws an
	// error when an unrecognized locale is passed in and the
	// locale is needed.
	try {
	    Date.create().format(null, locale);
	}
	catch (ex) {
	    // Try just first two characters.
	    locale = locale.substr(0, 2);
	    try {
		Date.create().format(null, locale);
	    }
	    catch (ex) {
		// Even that is unrecognized, so use no locale.
		locale = null;
	    }
	}
	didLocale = true;
    }
    return locale;
}

function dateparse(date) {
    var locale = getLocale();
    var obj = Date.create(date, locale);
    if (! (obj.isValid || locale.substr(0, 2) == "en")) {
	// Fall back on English date rules
	obj = Date.create(date);
    }
    return obj;
}
