/*
Handles all things preference-related, including loading default preferences,
migrating from legacy preferences, and keeping the kludgey experiment preference
thing in sync with storage.local.
*/

const prefHandler = {
  // cache prefs locally
  prefs: null,

  getPrefs: async function() {
    if (!this.prefs) {
      const results = await browser.storage.local.get("preferences");
      this.prefs = results.preferences || {};
    }
    return this.prefs;
  },

  // SkipUpdateExperiments to prevent infinite loops when experiments
  // themselves update preferences.
  setPrefs: async function(prefs,skipUpdateExperiments) {
    let newPrefs = { ...(await this.getPrefs()), ...prefs };
    this.prefs = newPrefs;
    if (!skipUpdateExperiments)
      await this.updateExperimentPrefs()
    return browser.storage.local.set({"preferences": this.prefs});
  },

  setPref: async function(key,value,skipUpdateExperiments) {
    let newPref = {};
    newPref[key] = value;
    return this.setPrefs(newPref,skipUpdateExperiments);
  },

  getPref: async function(key) {
    return (await this.getPrefs())[key];
  },

  updateExperimentPrefs: async function() {
    let prefs = this.prefs || (await this.getPrefs());
    return await browser.SL3U.updatePrefs(JSON.stringify(prefs));
  }
};

// Listen for preference change events, triggered
// when the SL3U experiment changes a preference.
browser.SL3U.onSetPref.addListener(msg => {
  let { key, value } = JSON.parse(msg);
  prefHandler.setPref(key, value, true);
});

// Migrate legacy preferences to local storage.
(function () {
  // This variable can be incremented in case we need future migrations.
  const CURRENT_LEGACY_MIGRATION = 1;

  const logPrefs = function() {
    prefHandler.getPref("logConsoleLevel").then(logMode => {
      if (logMode === "Trace" || logMode === "All") {
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
            legacyVals.reduce((r,f,i) => {r[prefKeys[i]] = f; return r}, {})
          });

        console.debug("Legacy preferences: "+legacyPrefs);

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
      browser.storage.local.set({ preferences: prefs }).then(() => {
          // Initialize the (separate) experiments preferences cache.
          prefHandler.updateExperimentPrefs();
          logPrefs(); // Debug logging
      });
  }).catch(console.error);
})();
