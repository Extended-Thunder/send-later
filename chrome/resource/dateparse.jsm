var EXPORTED_SYMBOLS = ["dateparse"];

// Using mozIJSSubScriptLoader instead of Cu.import because I want to
// preserve sugar-1.2.5.min.js unmodified from the official
// distribution, and it doesn't define EXPORTED_SYMBOLS, which is
// required by CU.import.
var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
loader.loadSubScript("resource://sendlater3/sugar-1.2.5.min.js"); 

var locale;

function dateparse(date) {
    if (! locale) {
	var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
            .getService(Components.interfaces.nsILocaleService);
	var localeObj = localeService.getApplicationLocale();
	locale = localeObj.getCategory("NSILOCALE_TIME");
    }
    return Date.create(date, locale);
}
