var EXPORTED_SYMBOLS = ["dateparse"];

// Using mozIJSSubScriptLoader instead of Cu.import because I want to
// preserve sugar.min.js unmodified from the official
// distribution, and it doesn't define EXPORTED_SYMBOLS, which is
// required by CU.import.
var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
loader.loadSubScript("resource://sendlater3/sugar.min.js"); 
loader.loadSubScript("resource://sendlater3/sugar-sv.js"); 

var didLocale = false;
var locale;

Date.setLocale('pl', {
  hasPlural: true,
  months: ['Stycze\u0144|Stycznia','Luty|Lutego','Marzec|Marca','Kwiecie\u0144|Kwietnia','Maj|Maja','Czerwiec|Czerwca','Lipiec|Lipca','Sierpie\u0144|Sierpnia','Wrzesie\u0144|Wrze\u015bnia','Pa\u017adziernik|Pa\u017adziernika','Listopad|Listopada','Grudzie\u0144|Grudnia'],
  weekdays: ['Niedziela|Niedziel\u0119','Poniedzia\u0142ek','Wtorek','\U015Aroda|\U015Arod\u0119','Czwartek','Pi\u0105tek','Sobota|Sobot\u0119'],
  units: ['milisekund:a|y|','sekund:a|y|','minut:a|y|','godzin:a|y|','dzie\u0144|dni','tydzie\u0144|tygodnie|tygodni','miesi\u0105ce|miesi\u0105ce|miesi\u0119cy','rok|lata|lat'],
  numbers: ['jeden|jedn\u0105','dwa|dwie','trzy','cztery','pi\u0119\u0107','sze\u015b\u0107','siedem','osiem','dziewi\u0119\u0107','dziesi\u0119\u0107'],
  optionals: ['w|we', 'roku'],
  timeFormat : '{H}:{mm}:{ss}',
  shortFormat: '{d} {Month} {yyyy}',
  longFormat : '{d} {Month} {yyyy} {H}:{mm}',
  fullFormat : '{Weekday}, {d} {Month} {yyyy} {H}:{mm}:{ss}',
  pastFormat: '{num} {unit} {sign}',
  futureFormat: '{sign} {num} {unit}',
  '12hr': ['am','pm'],
  timeMarkers: ['o'],
  modifiers: [
    { name: 'day', src: 'przedwczoraj', value: -2 },
    { name: 'day', src: 'wczoraj', value: -1 },
    { name: 'day', src: 'dzisiaj|dzi\u015b', value: 0 },
    { name: 'day', src: 'jutro', value: 1 },
    { name: 'day', src: 'pojutrze', value: 2 },
    { name: 'sign', src: 'temu|przed', value: -1 },
    { name: 'sign', src: 'za', value: 1 },
    { name: 'shift', src: 'zesz\u0142y|zesz\u0142a|ostatni|ostatnia', value: -1 },
    { name: 'shift', src: 'nast\u0119pny|nast\u0119pna|nast\u0119pnego|przysz\u0142y|przysz\u0142a|przysz\u0142ego', value: 1 }
  ],
  formats: [
    '{num} {unit} {sign}',
    '{sign} {num} {unit}',
    '{month} {year}',
    '{shift} {unit=5-7}',
    '{0} {shift?} {weekday}'
  ],
  timeFormats: [
    '{date} {month} {year?} {1}',
    '{0} {shift?} {weekday}'
  ],
  timeSuffixes: []
});
Date.setLocale('en');

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

function dateparse(date) {
    var locale = getLocale();
    var obj = Date.future(date, locale);
    if (! (obj.isValid() || locale.substr(0, 2) == "en")) {
	// Fall back on English date rules
	obj = Date.future(date);
    }
    return obj;
}
