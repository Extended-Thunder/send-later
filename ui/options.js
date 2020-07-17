// Functions related to the options UI (accessed via options.html)
const SLOptions = {
  // HTML element IDs correspond to preference keys, and indirectly also to
  // localization strings.
  inputIds: ["checkTimePref", "sendDoesDelay", "sendDelay", "sendDoesSL",
            "altBinding", "markDraftsRead", "showColumn", "showHeader",
            "showStatus", "blockLateMessages", "lateGracePeriod",
            "enforceTimeRestrictions", "quickOptions1Value",
            "quickOptions2Value", "quickOptions3Value", "logDumpLevel",
            "logConsoleLevel"],

  builtinFuncs: ["ReadMeFirst", "BusinessHours", "DaysInARow", "newFunctionName"],

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
    browser.storage.local.get({ufuncs:{}}).then( storage => {
      Object.keys(storage.ufuncs).forEach(funcName => {
        SLOptions.addFuncOption(funcName, false);
      })
    });
  },

  async setPref(key, value) {
    // Sets a single preference to new value.
    const { preferences } = await browser.storage.local.get({"preferences":{}});
    preferences[key] = value;
    await browser.storage.local.set({ preferences });
    browser.runtime.sendMessage({ action: "reloadPrefCache" });
  },

  async delUserFunction(funcName) {
    document.getElementById(`ufunc-${funcName}`).remove();
    const { ufuncs } = await browser.storage.local.get({ufuncs:{}});
    delete ufuncs[funcName];
    return browser.storage.local.set({ ufuncs });
  },

  async saveUserFunction(name, body, help) {
    if (validateFuncName(name) && !SLOptions.builtinFuncs.includes(name)) {
      SLStatic.info(`Storing user function ${name}`);
      const { ufuncs } = await browser.storage.local.get({ufuncs:{}});
      ufuncs[name] = { body, help };
      browser.storage.local.set({ ufuncs }).then(() => {
        browser.runtime.sendMessage({ action: "reloadUfuncs" });
      });
      return true;
    } else {
      browser.runtime.sendMessage({ action: "alert",
        title: browser.i18n.getMessage("BadSaveTitle"),
        text: browser.i18n.getMessage("BadSaveBody")});
      return false;
    }
  },

  async getUserFunction(funcName) {
    const { ufuncs } = await browser.storage.local.get({ufuncs:{}});
    return ufuncs[funcName];
  },

  async addFuncOption(funcName, active) {
    if (document.getElementById(`ufunc-${funcName}`)) {
      return;
    } else {
      const newOpt = document.createElement('option');
      newOpt.id = `ufunc-${funcName}`;
      newOpt.value = funcName;
      newOpt.textContent = funcName;

      const funcSelect = document.getElementById("functionNames");
      funcSelect.children[0].after(newOpt);
      if (active) {
        funcSelect.value = funcName;
      }
    }
  },

  async showCheckMark(element, color) {
      // Appends a green checkmark as element's last sibling. Disappears after a
      // timeout (1.5 sec). If already displayed, then restart timeout.
      const checkmark = document.createElement("span");
      checkmark.innerHTML = "&#x2714;";
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
            browser.storage.local.set({ preferences: prefs }).then(() => {
              browser.runtime.sendMessage({ action: "reloadPrefCache" });
            });
        }).then(() => SLOptions.applyPrefsToUI());
    });

    cancelBtn.addEventListener("click", cancelClickEvent => {
        confDiv.remove();
        clrEvent.target.disabled = false;
    });

    clrEvent.target.parentNode.appendChild(confDiv);
    clrEvent.target.disabled = true;
  },

  async checkBoxSetListeners(ids) {
    ids.forEach(id=>{
      document.getElementById(id).addEventListener("change", async evt => {
        if (evt.target.checked) {
          ids.forEach(async otherId => {
            if (otherId !== id) {
              document.getElementById(otherId).checked = false;
            }
          });
        }
      });
    });
  },

  async attachListeners() {
    // Attach listeners for all input fields
    for (const id of SLOptions.inputIds) {
      const el = document.getElementById(id);
      el.addEventListener("change", SLOptions.updatePrefListener);
    }

    SLOptions.checkBoxSetListeners(["sendDoesSL","sendDoesDelay"]);

    document.getElementById("functionEditorTitle").addEventListener("mousedown",
      async (evt) => {
        const funcEditorDiv = document.getElementById("FunctionEditorDiv");
        const visIndicator = document.getElementById("functionEditorVisibleIndicator");
        if (funcEditorDiv.style.display === "none") {
          funcEditorDiv.style.display = "block";
          visIndicator.textContent = "-";
        } else {
          funcEditorDiv.style.display = "none";
          visIndicator.textContent = "+";
        }
      }
    );

    const resetFunctionInput = (() => {
      const funcName = document.getElementById("functionNames").value;
      if (!funcName) {
        console.error(`Unspecified function: ${funcName}`)
        return;
      }

      const funcContentElmt = document.getElementById("functionEditorContent");
      const funcNameElmt = document.getElementById("functionName");
      const saveBtn = document.getElementById("funcEditSave");
      const resetBtn = document.getElementById("funcEditReset");
      const deleteBtn = document.getElementById("funcEditDelete");

      if (SLOptions.builtinFuncs.includes(funcName)) {
        funcContentElmt.disabled = true;
        funcNameElmt.disabled = true;
        saveBtn.disabled = true;
        resetBtn.disabled = true;
        deleteBtn.disabled = true;
        funcNameElmt.value = funcName;
      } else {
        funcContentElmt.disabled = false;
        funcNameElmt.disabled = false;
        saveBtn.disabled = false;
        if (funcName === "newFunctionName") {
          funcNameElmt.value = "";
          deleteBtn.disabled = true;
          resetBtn.disabled = true;
        } else {
          deleteBtn.disabled = false;
          resetBtn.disabled = false;
          funcNameElmt.value = funcName;
        }
      }

      SLOptions.getUserFunction(funcName).then(content => {
        funcContentElmt.value = content || "";
      });
    });

    document.getElementById("functionNames").addEventListener("change",
        resetFunctionInput);
    document.getElementById("funcEditReset").addEventListener("click",
        resetFunctionInput);
    document.getElementById("funcEditDelete").addEventListener("click", evt => {
      const funcNameSelect = document.getElementById("functionNames");
      const funcName = funcNameSelect.value;
      if ([...SLOptions.builtinFuncs, "newFunctionName"].includes(funcName)) {
        // Shouldn't be possible
        SLStatic.error("Trying to delete builtin user func.");
      } else {
        funcNameSelect.value = "ReadMeFirst";
        resetFunctionInput();
        SLOptions.delUserFunction(funcName);
      }
    });

    document.getElementById("funcEditSave").addEventListener("click", async evt => {
      const funcName = document.getElementById("functionName").value;
      const funcContent = document.getElementById("functionEditorContent").value;
      SLOptions.saveUserFunction(funcName, funcContent).then(success => {
        if (success) {
          SLOptions.addFuncOption(funcName, true);
          SLOptions.showCheckMark(evt.target, "green");
        }
      });
    });

    // And attach a listener to the "Reset Preferences" button
    const clearPrefsBtn = document.getElementById("clearPrefs");
    clearPrefsBtn.addEventListener("click", SLOptions.clearPrefsListener);
  },
  async onLoad() {
    setTimeout(async () => {
      const { ufuncs } = await browser.storage.local.get({ufuncs:{}});
      if (!ufuncs.ReadMeFirst || !ufuncs.BusinessHours || !ufuncs.DaysInARow) {
        ufuncs.ReadMeFirst = browser.i18n.getMessage("EditorReadMeCode");
        ufuncs.BusinessHours = browser.i18n.getMessage("_BusinessHoursCode");
        ufuncs.DaysInARow = browser.i18n.getMessage("DaysInARowCode");
        browser.storage.local.set({ ufuncs });
      }
    }, 1000);

    for (let id of ["functionEditorContent","functionName","funcEditSave","funcEditReset","funcEditDelete"]) {
      const el = document.getElementById(id);
      el.disabled = true;
    }

    SLOptions.applyPrefsToUI().then(
      SLOptions.attachListeners
    ).catch(SLStatic.error);
  }
};

window.addEventListener("load", SLOptions.onLoad, false);
