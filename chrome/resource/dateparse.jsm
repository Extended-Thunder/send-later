var EXPORTED_SYMBOLS = ["dateparse"];

// Using mozIJSSubScriptLoader instead of Cu.import because I want to
// preserve sugar.min.js unmodified from the official
// distribution, and it doesn't define EXPORTED_SYMBOLS, which is
// required by CU.import.
var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
loader.loadSubScript("resource://sendlater3/sugar.min.js"); 

var didLocale = false;
var locale;

Date.setLocale('pl', {
  hasPlural: true,
  months: ['Styczeń|Stycznia','Luty|Lutego','Marzec|Marca','Kwiecień|Kwietnia','Maj|Maja','Czerwiec|Czerwca','Lipiec|Lipca','Sierpień|Sierpnia','Wrzesień|Września','Październik|Października','Listopad|Listopada','Grudzień|Grudnia'],
  weekdays: ['Niedziela|Niedzielę','Poniedziałek','Wtorek','Środa|Środę','Czwartek','Piątek','Sobota|Sobotę'],
  units: ['milisekund:a|y|','sekund:a|y|','minut:a|y|','godzin:a|y|','dzień|dni','tydzień|tygodnie|tygodni','miesiące|miesiące|miesięcy','rok|lata|lat'],
  numbers: ['jeden|jedną','dwa|dwie','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć','dziesięć'],
  optionals: ['w|we', 'roku'],
  timeFormat : '{H}:{mm}:{ss}',
  shortFormat: '{d} {Month} {yyyy}',
  longFormat : '{d} {Month} {yyyy} {H}:{mm}',
  fullFormat : '{Weekday}, {d} {Month} {yyyy} {H}:{mm}:{ss}',
  pastFormat: '{num} {unit} {sign}',
  futureFormat: '{sign} {num} {unit}',
  '12hr': ['am','pm'],
  modifiers: [
    { name: 'day', src: 'przedwczoraj', value: -2 },
    { name: 'day', src: 'wczoraj', value: -1 },
    { name: 'day', src: 'dzisiaj|dziś', value: 0 },
    { name: 'day', src: 'jutro', value: 1 },
    { name: 'day', src: 'pojutrze', value: 2 },
    { name: 'sign', src: 'temu|przed', value: -1 },
    { name: 'sign', src: 'za', value: 1 },
    { name: 'shift', src: 'zeszły|zeszła|ostatni|ostatnia', value: -1 },
    { name: 'shift', src: 'następny|następna|następnego|przyszły|przyszła|przyszłego', value: 1 }
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
