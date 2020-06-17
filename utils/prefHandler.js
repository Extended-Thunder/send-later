// Migrate legacy preferences to local storage.
(function () {
  // This variable can be incremented in case we need future migrations.
  const CURRENT_LEGACY_MIGRATION = 1;

  const logPrefs = function() {
    browser.storage.local.get("preferences").then(storage => {
      const prefs = storage.preferences || {};
      if (["all", "trace", "debug"].includes(prefs["logConsoleLevel"])) {
        browser.storage.local.get().then(results => {
          Object.entries(results).forEach(([key, value]) => {
            console.debug(key, value)
          });
        });
      }
    });
  };

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
          if (legacyKey === null) {
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

        // Merge legacy preferences into undefined preference keys
        prefKeys.forEach(key => {
            if (prefs[key] === undefined) {
                prefs[key] = legacyPrefs[key];
            }
        });
        if (["all", "trace", "debug"].includes(prefs["logConsoleLevel"])) {
          console.debug("Legacy|Default preferences: ", legacyPrefs);
          console.debug("All preferences: ", prefs);
        }
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
      browser.SL3U.updatePrefs(JSON.stringify(prefs));
  }).catch(console.error);
})();

// Listen for preference change events, triggered when the SL3U experiment
// modifies a preference. Commit that change to local storage.
browser.SL3U.onSetPref.addListener(msg => {
  const { key, value } = JSON.parse(msg);
  browser.storage.local.get("preferences").then((storage) => {
    const prefs = {...(storage.preferences || {}), key: value };
    browser.storage.local.set({ preferences: prefs });
  });
});
