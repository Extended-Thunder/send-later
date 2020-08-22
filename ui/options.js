// Functions related to the options UI (accessed via options.html)
const SLOptions = {
  // HTML element IDs correspond to preference keys, and indirectly also to
  // localization strings.
  inputIds: ["checkTimePref", "sendDoesDelay", "sendDelay", "sendDoesSL",
            "altBinding", "markDraftsRead", "showColumn", "showHeader",
            "showStatus", "blockLateMessages", "lateGracePeriod",
            "enforceTimeRestrictions", "logDumpLevel", "logConsoleLevel",
            "quickOptions1Label", "quickOptions1funcselect", "quickOptions1Args",
            "quickOptions2Label", "quickOptions2funcselect", "quickOptions2Args",
            "quickOptions3Label", "quickOptions3funcselect", "quickOptions3Args"],

  builtinFuncs: ["ReadMeFirst", "BusinessHours", "DaysInARow", "Delay"],

  checkboxGroups: {},

  async applyPrefsToUI() {
    // Saves the UI preferences to preference storage.
    await browser.storage.local.get({ufuncs:{}}).then( storage => {
      Object.keys(storage.ufuncs).forEach(funcName => {
        SLOptions.addFuncOption(funcName, false);
      })
    });
    browser.storage.local.get("preferences").then(storage => {
      const prefs = storage.preferences || {};
      for (const id of SLOptions.inputIds) {
        (async (e, v) => {
          if (!e) {
            SLStatic.error(id, e, v);
          } else {
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
          }
        })(document.getElementById(id), prefs[id]);
      }
    });
  },

  async saveUserFunction(name, body, help) {
    if ((name !== browser.i18n.getMessage("functionnameplaceholder")) &&
        !SLOptions.builtinFuncs.includes(name) &&
        validateFuncName(name) ) {
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

  async addFuncOption(funcName, active) {
    if (!document.getElementById(`ufunc-${funcName}`)) {
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
    if (funcName !== "ReadMeFirst") {
      for (let i=1; i<4; i++) {
        if (!document.getElementById(`ufunc-shortcut-${i}-${funcName}`)) {
          const newOpt = document.createElement('option');
          newOpt.id = `ufunc-shortcut-${i}-${funcName}`;
          newOpt.value = funcName;
          newOpt.textContent = funcName;

          const funcSelect = document.getElementById(`quickOptions${i}funcselect`);
          funcSelect.appendChild(newOpt);
        }
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
    const { preferences } = await browser.storage.local.get({"preferences":{}});
    try {
      if (element.tagName === "INPUT") {
        switch(element.type) {
          case "checkbox":
          case "radio":
            preferences[element.id] = element.checked;
            SLOptions.showCheckMark(element, "green");
            if (element.checked && SLOptions.checkboxGroups[element.id] !== null)
              for (const id2 of SLOptions.checkboxGroups[element.id]) {
                const element2 = document.getElementById(id2);
                if (element2.checked) {
                  element2.checked = false;
                  preferences[id2] = false;
                  SLOptions.showCheckMark(element2, "green");
                }
              }
            break;
          case "text":
          case "number":
            preferences[element.id] = element.value;
            SLOptions.showCheckMark(element, "green");
            break;
          default:
            throw new Error("Unexpected element type: "+element.type);
        }
      } else if (element.tagName === "SELECT") {
        preferences[element.id] = element.value;
        SLOptions.showCheckMark(element, "green");
        return;
      } else {
        throw new Error("Unable to process change in element: "+element);
      }

      await browser.storage.local.set({ preferences });
      await browser.runtime.sendMessage({ action: "reloadPrefCache" });
    } catch (ex) {
      SLStatic.error(ex);
      SLOptions.showCheckMark(element, "red");
    }
  },

  doubleCheckButtonClick(callback) {
    // Closure for event listeners on important buttons like reset preferences
    // and delete user functions. This returns a listener function that double
    // checks the user input before executing the real callback function.
    return (evt => {
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
          evt.target.disabled = false;
          callback(confClickEvent);
      });

      cancelBtn.addEventListener("click", cancelClickEvent => {
          confDiv.remove();
          evt.target.disabled = false;
      });

      evt.target.parentNode.appendChild(confDiv);
      evt.target.disabled = true;
    });
  },

  async checkBoxSetListeners(ids) {
    ids.forEach(id1 => {
      SLOptions.checkboxGroups[id1] = [];
      ids.forEach(async id2 => {
        if (id1 !== id2)
          SLOptions.checkboxGroups[id1].push(id2);
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
        SLStatic.error(`Unspecified function: ${funcName}`)
        return;
      }

      const funcContentElmt = document.getElementById("functionEditorContent");
      const funcHelpElmt = document.getElementById("functionHelpText")
      const funcNameElmt = document.getElementById("functionName");
      const saveBtn = document.getElementById("funcEditSave");
      const resetBtn = document.getElementById("funcEditReset");
      const deleteBtn = document.getElementById("funcEditDelete");

      if (SLOptions.builtinFuncs.includes(funcName)) {
        funcContentElmt.disabled = true;
        funcHelpElmt.disabled = true;
        funcNameElmt.disabled = true;
        saveBtn.disabled = true;
        resetBtn.disabled = true;
        deleteBtn.disabled = true;
        funcNameElmt.value = funcName;
      } else {
        funcContentElmt.disabled = false;
        funcHelpElmt.disabled = false;
        funcNameElmt.disabled = false;
        saveBtn.disabled = false;
        if (funcName === "newFunctionName") {
          funcNameElmt.value = browser.i18n.getMessage("functionnameplaceholder");
          funcContentElmt.value = browser.i18n.getMessage("codeplaceholder");
          funcHelpElmt.value = browser.i18n.getMessage("helptextplaceholder");
          deleteBtn.disabled = true;
          resetBtn.disabled = false;
        } else {
          deleteBtn.disabled = false;
          resetBtn.disabled = false;
          funcNameElmt.value = funcName;
        }
      }

      if (funcName !== "newFunctionName") {
        browser.storage.local.get({ ufuncs: {} }).then(({ ufuncs }) => {
          const thisFunc = ufuncs[funcName] || {};
          funcContentElmt.value = thisFunc.body || "";
          funcHelpElmt.value = thisFunc.help || "";
        });
      }
    });

    document.getElementById("functionNames").addEventListener("change",
        resetFunctionInput);
    document.getElementById("funcEditReset").addEventListener("click",
        resetFunctionInput);

    document.getElementById("funcEditSave").addEventListener("click", async evt => {
      const funcName = document.getElementById("functionName").value;
      const funcContent = document.getElementById("functionEditorContent").value;
      const funcHelp = document.getElementById("functionHelpText").value;
      SLOptions.saveUserFunction(funcName, funcContent, funcHelp).then(success => {
        if (success) {
          SLOptions.addFuncOption(funcName, true);
          SLOptions.showCheckMark(evt.target, "green");
        }
      });
    });

    // Verify with user before deleting a scheduling function
    const doubleCheckDeleteListener = SLOptions.doubleCheckButtonClick(evt => {
      const funcNameSelect = document.getElementById("functionNames");
      const funcName = funcNameSelect.value;
      funcNameSelect.value = "ReadMeFirst";
      resetFunctionInput();
      document.getElementById(`ufunc-${funcName}`).remove();
      for (let i=1; i<4; i++) {
        document.getElementById(`ufunc-shortcut-${i}-${funcName}`).remove();
      }
      browser.storage.local.get({ ufuncs: {} }).then(({ ufuncs }) => {
        delete ufuncs[funcName];
        browser.storage.local.set({ ufuncs });
      }).catch(SLStatic.error);
    });
    document.getElementById("funcEditDelete").addEventListener("click", evt => {
      const funcNameSelect = document.getElementById("functionNames");
      const funcName = funcNameSelect.value;
      if ([...SLOptions.builtinFuncs, "newFunctionName"].includes(funcName)) {
        SLStatic.error("Trying to delete builtin user func.");
        return;
      } else {
        doubleCheckDeleteListener(evt);
      }
    });

    document.getElementById("funcTestRun").addEventListener("click",
      async evt => {
        const funcName = document.getElementById("functionName").value;
        const funcBody = document.getElementById("functionEditorContent").value;
        const funcTestDate = document.getElementById("functionTestDate").value;
        const funcTestTime = document.getElementById("functionTestTime").value;
        const testDateTime = SLStatic.parseDateTime(funcTestDate, funcTestTime);
        const funcTestArgs = document.getElementById("functionTestArgs").value;
        const message = {
          action: "evaluateUfuncByContents",
          name: funcName,
          body: funcBody,
          time: testDateTime.getTime(),
          argStr: funcTestArgs
        };
        browser.runtime.sendMessage(message).then(response => {
          const outputCell = document.getElementById("functionTestOutput");
          if (response.err) {
            outputCell.innerHTML = "<b>Error:</b> " + response.err;
          } else {
            outputCell.innerHTML = `<b>next:</b> ${response.next}<br/>` +
              `<b>nextspec:</b> ${response.nextspec}<br/>` +
              `<b>nextargs:</b> ${response.nextargs}`;
          }
        });
      });

    // And attach a listener to the "Reset Preferences" button
    const clearPrefsListener = SLOptions.doubleCheckButtonClick(evt => {
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
    const clearPrefsBtn = document.getElementById("clearPrefs");
    clearPrefsBtn.addEventListener("click", clearPrefsListener);
  },
  async onLoad() {
    (() => {
      const funcTestDate = document.getElementById("functionTestDate");
      const funcTestTime = document.getElementById("functionTestTime");
      const fmtDate = new Intl.DateTimeFormat('en-CA',
        { year: "numeric", month: "2-digit", day: "2-digit" });
      const fmtTime = new Intl.DateTimeFormat('default',
        { hour: "2-digit", minute: "2-digit", hour12: false });

      const soon = new Date(Date.now() + 60 * 1000);
      funcTestDate.value = fmtDate.format(soon);
      funcTestTime.value = fmtTime.format(soon);
    })();

    for (let id of ["functionEditorContent","functionHelpText","functionName",
                    "funcEditSave","funcEditReset","funcEditDelete"]) {
      const el = document.getElementById(id);
      el.disabled = true;
    }

    SLOptions.applyPrefsToUI().then(
      SLOptions.attachListeners
    ).catch(SLStatic.error);
  }
};

window.addEventListener("load", SLOptions.onLoad, false);
