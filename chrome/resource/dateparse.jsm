var EXPORTED_SYMBOLS = ["sendlater3DateParse", "sendlater3DateToSugarDate", "sendlater3SugarLocale"];

// Using mozIJSSubScriptLoader instead of Cu.import because I want to
// preserve SugarJS unmodified from the official
// distribution, and it doesn't define EXPORTED_SYMBOLS, which is
// required by CU.import.
var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
loader.loadSubScript("resource://sendlater3/sugar.js", null, "UTF-8"); 

// https://github.com/andrewplummer/Sugar/issues/605
Sugar.Date.extend();

var didLocale = false;
var locale;

function getLocale() {
    if (! didLocale) {
	didLocale = true;
        var locales;
        try {
	    var localeService = Components.classes[
                "@mozilla.org/intl/nslocaleservice;1"]
                .getService(Components.interfaces.nsILocaleService);
	    var localeObj = localeService.getApplicationLocale();
	    locales = [localeObj.getCategory("NSILOCALE_TIME")];
        }
        catch (ex) {
            try {
                locales = Components.classes[
                    "@mozilla.org/intl/localeservice;1"]
                    .getService(Components.interfaces.mozILocaleService)
                    .getRegionalPrefsLocales();
            }
            catch (ex) {
                locales = [];
            }
        }
        for (var l of locales) {
	    // Sugar may not recognize the locale. It throws an error when
	    // an unrecognized locale is passed in and the locale is
	    // needed.
	    try {
	        (new Date()).format(null, l);
                locale = l;
                return locale;
	    }
	    catch (ex) {}
        }
    }
    return locale;
}

function sendlater3DateParse(date) {
    // Sugar.Date.create is actually Sugar.Date.parse. It returns an unextended
    // Date object. Since we call Date.extend above, the core Date constructor
    // now returns an extended object, so we use that after parsing to create
    // an extended object.
    var locale = getLocale();
    var obj = new Date(
        Sugar.Date.create(date, {locale: locale, future: true}));
    if (! (obj.isValid() || locale.substr(0, 2) == "en")) {
	// Fall back on English date rules
	obj = new Date(Sugar.Date.create(date, {future: true}));
    }
    return obj;
}

function sendlater3DateToSugarDate(date) {
    return new Date(date);
}

function sendlater3SugarLocale() {
    return getLocale();
}
