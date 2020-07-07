// Functions related to the options UI (accessed via options.html)
const SLOptions = {
  // HTML element IDs correspond to preference keys, and indirectly also to
  // localization strings.
  inputIds: ["checkTimePref", "sendDoesDelay", "sendDelay", "sendDoesSL",
            "altBinding", "markDraftsRead", "showColumn", "showHeader",
            "showStatus", "sendUnsentMsgs", "blockLateMessages", "lateGracePeriod",
            "enforceTimeRestrictions", "quickOptions1Label", "quickOptions1Value",
            "quickOptions2Label", "quickOptions2Value", "quickOptions3Label",
            "quickOptions3Value", "logDumpLevel", "logConsoleLevel"],

  async applyPrefsToUI() {
    // Saves the UI preferences to preference storage.
    browser.storage.local.get("preferences").then( (storage) => {
      const prefs = storage.preferences || {};
      for (const id of SLOptions.inputIds) {
        (async (e, v) => {
          if (e.tagName === "INPUT") {
              switch (e.type) {
                  case "checkbox":
                    e.checked = (v !== undefined) && v;
                    break;
                  case "text":
                  case "number":
                    e.value = v ? v : "";
                    break;
                  case "radio":
                    e.checked = (v !== undefined) && (e.value === v);
                    break;
                  default:
                    SLStatic.error("SendLater: Unable to populate input element of type "+e.type);
              }
          } else if (e.tagName === "SELECT") {
              e.value = v;
          }
        })(document.getElementById(id), prefs[id]);
      }
    });
  },

  async setPref(key, value) {
    // Sets a single preference to new value.
    browser.storage.local.get("preferences").then( (storage) => {
      const prefs = storage.preferences || {};
      prefs[key] = value;
      browser.SL3U.updatePrefs(JSON.stringify(prefs));
      browser.storage.local.set({ preferences: prefs });
    });
  },

  async showCheckMark(element, color) {
      // Appends a green checkmark as element's last sibling. Disappears after a
      // timeout (1.5 sec). If already displayed, then restart timeout.
      const checkmark = document.createElement("span");
      checkmark.textContent = "&#x2714;";
      checkmark.style.color = color;
      checkmark.className = "success_icon";

      const p = element.parentNode;
      if (p.lastChild.className === 'success_icon') {
          p.replaceChild(checkmark, p.lastChild);
      } else {
          p.appendChild(checkmark);
      }
      setTimeout(() => checkmark.remove(), 1500);
  },

  async updatePrefListener(event) {
    // Respond to changes in UI input fields
    const element = event.target;
    try {
      if (element.tagName === "INPUT") {
        switch(element.type) {
          case "checkbox":
          case "radio":
            SLOptions.setPref(element.id, element.checked);
            SLOptions.showCheckMark(element, "green");
            return;
          case "text":
          case "number":
            SLOptions.setPref(element.id, element.value);
            SLOptions.showCheckMark(element, "green");
            return;
          default:
            throw new Error("Unexpected element type: "+element.type);
        }
      } else if (element.tagName === "SELECT") {
        SLOptions.setPref(element.id, element.value);
        SLOptions.showCheckMark(element, "green");
        return;
      }
      throw new Error("Unable to process change in element: "+element);
    } catch (ex) {
      SLStatic.error(ex);
      SLOptions.showCheckMark(element, "red");
    }
  },

  async clearPrefsListener(clrEvent) {
    // Executes when user clicls the "Reset Preferences" button.
    const confDiv = document.createElement("div");
    confDiv.style.margin = "0 2em";
    confDiv.style.display = "inline";

    const confirmPrompt = document.createElement("span");
    confirmPrompt.textContent = "Are you sure?"; // browser.i18n.getMessage("confirmPrompt")
    confirmPrompt.style.fontWeight = "bold";
    confirmPrompt.style.color = "red";
    confirmPrompt.style.display = "inline";
    confirmPrompt.style.margin = "0 0.5em";
    confDiv.appendChild(confirmPrompt);

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "Yes"; // browser.i18n.getMessage("answerYes")
    confirmBtn.style.fontWeight = "bold";
    confirmBtn.style.display = "inline";
    confirmBtn.style.margin = "0 0.5em";
    confDiv.appendChild(confirmBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "No"; // browser.i18n.getMessage("answerNo")
    cancelBtn.style.fontWeight = "bold";
    cancelBtn.style.display = "inline";
    cancelBtn.style.margin = "0 0.5em";
    confDiv.appendChild(cancelBtn);

    confirmBtn.addEventListener("click", confClickEvent => {
        confDiv.remove();
        clrEvent.target.disabled = false;

        const defPrefs = "/utils/defaultPrefs.json";
        fetch(defPrefs).then(ptxt => ptxt.json()).then(defaults => {
            const prefs = Object.keys(defaults).reduce( (result,key) => {
                result[key]=defaults[key][1];
                return result;
            }, {});
            browser.SL3U.updatePrefs(JSON.stringify(prefs));
            return browser.storage.local.set({ preferences: prefs });
        }).then(() => SLOptions.applyPrefsToUI());
    });

    cancelBtn.addEventListener("click", cancelClickEvent => {
        confDiv.remove();
        clrEvent.target.disabled = false;
    });

    clrEvent.target.parentNode.appendChild(confDiv);
    clrEvent.target.disabled = true;
  },

  async attachListeners() {
    // Attach listeners for all input fields
    for (const id of SLOptions.inputIds) {
      const el = document.getElementById(id);
      el.addEventListener("change", SLOptions.updatePrefListener);
    }
    // And attach a listener to the "Reset Preferences" button
    const clearPrefsBtn = document.getElementById("clearPrefs");
    clearPrefsBtn.addEventListener("click", SLOptions.clearPrefsListener);
  },

  async onLoad() {
    SLOptions.applyPrefsToUI().then(() => {
      SLOptions.attachListeners();
    }).catch(SLStatic.error);
  }
};

window.addEventListener("load", SLOptions.onLoad, false);
