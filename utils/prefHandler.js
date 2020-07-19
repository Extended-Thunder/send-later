// Migrate legacy preferences to local storage.
(function () {
  // This variable can be incremented in case we need future migrations.
  const CURRENT_LEGACY_MIGRATION = 2;

  const logPrefs = function() {
    browser.storage.local.get("preferences").then(storage => {
      const prefs = storage.preferences || {};
      // if (["all", "trace", "debug"].includes(prefs["logConsoleLevel"])) {
      //   browser.storage.local.get().then(results => {
      //     Object.entries(results).forEach(([key, value]) => {
      //       console.debug(key, value)
      //     });
      //   });
      // }
    });
  };

  // Load the default user functions.
  (async () => {
    const { ufuncs } = await browser.storage.local.get({ufuncs:{}});
    const isComplete = (v => (v && v.body && v.help));
    if (!isComplete(ufuncs.ReadMeFirst) ||
        !isComplete(ufuncs.BusinessHours) ||
        !isComplete(ufuncs.DaysInARow) ||
        !isComplete(ufuncs.Delay)) {
      ufuncs.ReadMeFirst = {
        help:browser.i18n.getMessage("EditorReadMeHelp"),
        body:browser.i18n.getMessage("EditorReadMeCode")
      };
      ufuncs.BusinessHours = {
        help:browser.i18n.getMessage("BusinessHoursHelp"),
        body:browser.i18n.getMessage("_BusinessHoursCode")
      };
      ufuncs.DaysInARow = {
        help:browser.i18n.getMessage("DaysInARowHelp"),
        body:browser.i18n.getMessage("DaysInARowCode")
      };
      ufuncs.Delay = {
        help: browser.i18n.getMessage("DelayFunctionHelp"),
        body: "next = new Date(Date.now() + args[0]*60000);"
      };
      browser.storage.local.set({ ufuncs });
    }
  })();

  browser.storage.local.get("preferences").then(async (storage) => {
      const prefs = storage.preferences || {};
      prefs.migratedLegacy |= 0;

      if (prefs.migratedLegacy === 0) {
        // Merge any existing legacy preferences into the new storage system
        let prefKeys = [];
        let legacyValuePromises = [];

        // Load values from legacy storage, substitute defaults if not defined.
        const defaults = "/utils/defaultPrefs.json";
        let prefDefaults = await fetch(defaults).then(ptxt => ptxt.json());
        for (let prefName of Object.getOwnPropertyNames(prefDefaults)) {
          prefKeys.push(prefName);
          let dtype = prefDefaults[prefName][0];
          let defVal = prefDefaults[prefName][1];
          let legacyKey = prefDefaults[prefName][2];
          let pp; // Promise that resolves to this preference value.
          const isquickopt = prefName.match(/quickOptions(\d)Label/);
          if (isquickopt) {
            const localizedDelayLabel = [
              moment(new Date(Date.now()+60000*15)).fromNow(),
              moment(new Date(Date.now()+60000*30)).fromNow(),
              moment(new Date(Date.now()+60000*120)).fromNow()
            ][(+isquickopt[1])-1];
            pp = new Promise((resolve,reject) => resolve(localizedDelayLabel));
          } else if (legacyKey === null) {
            pp = new Promise((resolve,reject) => resolve(defVal));
          } else {
            pp = browser.SL3U.getLegacyPref(legacyKey, dtype, defVal.toString());
          }
          legacyValuePromises.push(pp);
        }
        // Combine keys and legacy/default values back into a single object.
        let legacyPrefs = await Promise.all(legacyValuePromises).then(
          legacyVals => {
            return legacyVals.reduce((r,f,i) => {r[prefKeys[i]] = f; return r}, {})
          });

        SLStatic.info("SendLater: migrating legacy/default preferences.");

        // Merge legacy preferences into undefined preference keys
        prefKeys.forEach(key => {
            if (prefs[key] === undefined) {
                prefs[key] = legacyPrefs[key];
            }
        });
      }
      return prefs;
  }).then(prefs => {
      if (prefs.migratedLegacy < CURRENT_LEGACY_MIGRATION) {
        // Possibly do further migrations
        prefs.migratedLegacy = CURRENT_LEGACY_MIGRATION;
      }
      return prefs;
  }).then(prefs => {
      // Put the migrated preferences back into local storage.
      browser.storage.local.set({ preferences: prefs }).then(()=>logPrefs());
  }).catch(console.error);
})();
