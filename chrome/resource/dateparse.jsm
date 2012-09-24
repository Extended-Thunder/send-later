var EXPORTED_SYMBOLS = ["dateParse", "dateToSugarDate", "sugarLocale"];

// Using mozIJSSubScriptLoader instead of Cu.import because I want to
// preserve sugar.min.js unmodified from the official
// distribution, and it doesn't define EXPORTED_SYMBOLS, which is
// required by CU.import.
var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
loader.loadSubScript("resource://sendlater3/sugar.min.js"); 

Date.addLocale('nl', {
  'plural': true,
  'months': 'januari,februari,maart,april,mei,juni,juli,augustus,september,oktober,november,december',
  'weekdays': 'zondag|zo,maandag|ma,dinsdag|di,woensdag|woe|wo,donderdag|do,vrijdag|vrij|vr,zaterdag|za',
  'units': 'milliseconde:|n,seconde:|n,minu:ut|ten,uur,dag:|en,we:ek|ken,maand:|en,jaar',
  'numbers': 'een,twee,drie,vier,vijf,zes,zeven,acht,negen',
  'optionals': '',
  'short':'{d} {Month} {yyyy}',
  'long': '{d} {Month} {yyyy} {H}:{mm}',
  'full': '{Weekday} {d} {Month} {yyyy} {H}:{mm}:{ss}',
  'past': '{num} {unit} {sign}',
  'future': '{num} {unit} {sign}',
  'duration': '{num} {unit}',
  'timeMarker': "'s|om",
  'ampm': 'am,pm', // I don't think Dutch actually uses am or pm
  'modifiers': [
    { 'name': 'day', 'src': 'gisteren', 'value': -1 },
    { 'name': 'day', 'src': 'vandaag', 'value': 0 },
    { 'name': 'day', 'src': 'morgen', 'value': 1 },
    { 'name': 'day', 'src': 'overmorgen', 'value': 2 },
    { 'name': 'sign', 'src': 'geleden', 'value': -1 },
    { 'name': 'sign', 'src': 'vanaf nu', 'value': 1 },
    { 'name': 'shift', 'src': 'laatste|vorige|afgelopen', 'value': -1 },
    { 'name': 'shift', 'src': 'volgend:|e', 'value': 1 }
  ],
  'dateParse': [
    '{num} {unit} {sign}',
    '{0} {unit=5-7} {shift}',
    '{0} {shift} {unit=5-7}'
  ],
  'timeParse': [
    '{weekday?} {date?} {month} {year?}',
    '{shift} {weekday}'
  ]
});

var didLocale = false;
var locale;

function getLocale() {
    if (! didLocale) {
	var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
            .getService(Components.interfaces.nsILocaleService);
	var localeObj = localeService.getApplicationLocale();
	locale = localeObj.getCategory("NSILOCALE_TIME");
	// Sugar may not recognize the locale. It throws an error when
	// an unrecognized locale is passed in and the locale is
	// needed.

	try {
	    Date.create().format(null, locale);
	}
	catch (ex) {
	    locale = null;
	}
	didLocale = true;
    }
    return locale;
}

function dateParse(date) {
    var locale = getLocale();
    var obj = Date.future(date, locale);
    if (! (obj.isValid() || locale.substr(0, 2) == "en")) {
	// Fall back on English date rules
	obj = Date.future(date);
    }
    return obj;
}

function dateToSugarDate(date) {
    try {
	return Date.create(date);
    }
    catch (e) {
	var d = new Date();
	d.setTime(date.getTime());
	return d;
    }
}

function sugarLocale() {
    return getLocale();
}
