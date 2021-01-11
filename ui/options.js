
// Functions related to the options UI (accessed via options.html)
const SLOptions = {
  builtinFuncs: ["ReadMeFirst", "BusinessHours", "DaysInARow", "Delay"],

  checkboxGroups: {},

  applyValue(id, value) {
    const element = document.getElementById(id);
    if (!element) {
      SLStatic.error(id, element, value);
    } else {
      if (element.tagName === "INPUT") {
          switch (element.type) {
              case "checkbox":
                element.checked = (value !== undefined) && value;
                break;
              case "text":
              case "number":
                element.value = (value !== undefined) ? value : "";
                break;
              case "radio":
                element.checked = (value !== undefined) && (element.value === value);
                break;
              default:
                SLStatic.error("SendLater: Unable to populate input element of type "+element.type);
          }
      } else if (element.tagName === "SELECT") {
        SLStatic.debug(`Applying stored default ${element.id}: ${value}`);
        const matchingChildren = [...element.childNodes].filter(opt =>
            opt.tagName === "OPTION" && opt.value.toLowerCase() === value.toLowerCase()
          );
        if (matchingChildren.length === 1) {
          element.value = matchingChildren[0].value;
        } else if (matchingChildren.length > 1) {
          SLStatic.log("[SendLater]: Multiple options match",value,element);
        } else {
          SLStatic.log("[SendLater]: Could not find value in element ",value,element);
        }
      }
    }
  },

  /*
   * There is already a translation string for "minutes late", but
   * it would be nice to allow the user to select "hours late" or
   * "days late". Rather than try to localize all of those strings,
   * we'll just hack something together from what we've got. That is,
   * get the locale strings for 'minutes' 'hours' and 'days' from
   * Sugar.js, then try to replace the word 'minutes' in the original
   * locale string with a dropdown offering alternatives. I assume this
   * should remain gramatically correct in all languages since it's
   * just substituting a pluralized noun with a different pluralized
   * noun in the same context.
   */
  replaceGracePeriodUnitSelect() {
    const unitLabel = document.getElementById("gracePeriodUnitLabel");
    if (!unitLabel) {
      // This probably means the label has already been replaced,
      // i.e. user reset all preferences, and the UI is refreshing.
      return;
    }

    const delayStr = browser.i18n.getMessage("blockLateMessagesPrefLabel2");

    const minutesStr = Sugar.Date.getLocale().units[10];
    const hoursStr = Sugar.Date.getLocale().units[11];
    const daysStr = Sugar.Date.getLocale().units[12];
    if ((new RegExp(minutesStr,"i")).test(delayStr)) {
      // Generate a dropdown menu for time units
      const unitSelect = document.createElement('select');
      unitSelect.id = "gracePeriodUnits";

      const mopt = document.createElement('option');
      mopt.value = "gracePeriodMinutes";
      mopt.textContent = minutesStr;
      unitSelect.appendChild(mopt);

      const hopt = document.createElement('option');
      hopt.value = "gracePeriodHours";
      hopt.textContent = hoursStr;
      unitSelect.appendChild(hopt);

      const dopt = document.createElement('option');
      dopt.value = "gracePeriodDays";
      dopt.textContent = daysStr;
      unitSelect.appendChild(dopt);

      unitSelect.value = "gracePeriodMinutes";

      // Split string, to replace time unit dropdown in gramatically
      // correct spot.
      const str2Spans = delayStr.split(minutesStr).map(v => {
        const spanElement = document.createElement('span');
        spanElement.textContent = v;
        return spanElement;
      });

      // Now, create a small div to contain the combined elements
      const unitOptions = document.createElement('div');
      unitOptions.style.display = "inline";
      unitOptions.style.whiteSpace = "nowrap";

      if (str2Spans[0].textContent !== "") {
        unitOptions.appendChild(str2Spans[0]);
      }
      unitOptions.appendChild(unitSelect);
      if (str2Spans[1].textContent !== "") {
        unitOptions.appendChild(str2Spans[1]);
      }

      // Swap out the original label with the new unit options
      unitLabel.replaceWith(unitOptions);
      unitSelect.addEventListener("change", SLOptions.updatePrefListener);
    }
  },

  /*
   * Grace period times are handled internally using minutes, but we
   * will attempt to display the option to select 'days' or 'hours', in
   * which case we need to convert the stored preferences into the
   * relevant UI units.
   */
  autoConvertGracePeriodUnits() {
    const gracePeriodUnits = document.getElementById("gracePeriodUnits");
    if (gracePeriodUnits) {
      const gracePeriodTime = document.getElementById("lateGracePeriod");
      const gracePeriodTimeValue = +gracePeriodTime.value;
      if (gracePeriodTimeValue > 60*24 &&
          gracePeriodTimeValue%(60*24) === 0) {
        gracePeriodUnits.value = "gracePeriodDays";
        gracePeriodTime.value = gracePeriodTimeValue/(60*24);
      } else if (gracePeriodTimeValue > 60 &&
                  gracePeriodTimeValue%60 === 0) {
        gracePeriodUnits.value = "gracePeriodHours";
        gracePeriodTime.value = gracePeriodTimeValue/60;
      } else {
        gracePeriodUnits.value = "gracePeriodMinutes";
      }
    }
  },

  async applyPrefsToUI() {
    // Sets all UI element states from stored preferences
    const ufuncPromise =
      browser.storage.local.get({ufuncs:{}}).then(({ ufuncs }) => {
        Object.keys(ufuncs).forEach(funcName => {
          SLStatic.debug(`Adding function element ${funcName}`);
          SLOptions.addFuncOption(funcName, false);
        })
      });

    const prefPromise =
      browser.storage.local.get({ preferences: {} }).then(({ preferences }) => {
        SLStatic.logConsoleLevel = (preferences.logConsoleLevel||"all").toLowerCase();
        for (let id of SLStatic.prefInputIds) {
          let prefVal = preferences[id];
          if (id === "checkTimePref" && preferences.checkTimePref_isMilliseconds) {
            prefVal /= 60000;
          }
          SLStatic.debug(`Setting ${id}: ${prefVal}`);
          SLOptions.applyValue(id, prefVal);
        }

        const checkTimePrefElement = document.getElementById("checkTimePref");
        if (preferences.checkTimePref_isMilliseconds) {
          checkTimePrefElement.step = 0.1;
        } else {
          checkTimePrefElement.step = 1.0;
        }

        try {
          // Attempt to setup UI alternative units for specifying
          // grace period time.
          SLOptions.replaceGracePeriodUnitSelect();
          SLOptions.autoConvertGracePeriodUnits();
        } catch (ex) {
          SLStatic.debug("Unable to set time unit label",ex);
        }
      });
    return await Promise.all([ufuncPromise, prefPromise]);
  },

  async saveUserFunction(name, body, help) {
    if ((name !== browser.i18n.getMessage("functionnameplaceholder")) &&
        !SLOptions.builtinFuncs.includes(name) &&
        validateFuncName(name) ) {
      SLStatic.info(`Storing user function ${name}`);
      const { ufuncs } = await browser.storage.local.get({ufuncs:{}});
      ufuncs[name] = { body, help };
      await browser.storage.local.set({ ufuncs });
      return true;
    } else {
      browser.runtime.sendMessage({
        action: "alert",
        title: browser.i18n.getMessage("BadSaveTitle"),
        text: browser.i18n.getMessage("BadSaveBody")
      });
      return false;
    }
  },

  addFuncOption(funcName, active) {
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

  showCheckMark(element, color) {
    // Appends a green checkmark as element's last sibling. Disappears after a
    // timeout (1.5 sec). If already displayed, then restart timeout.
    if (!color) {
      color = "green";
    }
    const checkmark = document.createElement("span");
    checkmark.textContent = String.fromCharCode(0x2714);
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

  showXMark(element, color) {
    // Appends a ballot X as element's last sibling. Disappears after a
    // timeout (1.5 sec). If already displayed, then restart timeout.
    if (!color) {
      color = "red";
    }
    const marker = document.createElement("span");
    marker.textContent = String.fromCharCode(0x2718);
    marker.style.color = color;
    marker.className = "success_icon";

    const p = element.parentNode;
    if (p.lastChild.className === 'success_icon') {
        p.replaceChild(marker, p.lastChild);
    } else {
        p.appendChild(marker);
    }
    setTimeout(() => marker.remove(), 1500);
  },

  async updatePrefListener(event) {
    // Respond to changes in UI input fields
    const element = event.target;
    const { preferences } = await browser.storage.local.get({"preferences":{}});

    const setRegularPref = (element) => {
      let id = element.id;
      let value = element.value;
      if (["lateGracePeriod", "gracePeriodUnits"].includes(id)) {
        const gracePeriodUnits = document.getElementById("gracePeriodUnits");
        const gracePeriodValue = document.getElementById("lateGracePeriod").value;
        if (gracePeriodUnits) {
          const multiplier = {
            "gracePeriodMinutes": 1,
            "gracePeriodHours": 60,
            "gracePeriodDays": 60*24
          };
          id = "lateGracePeriod";
          value = gracePeriodValue * multiplier[gracePeriodUnits.value];
        }
      } else if (id === "checkTimePref") {
        value *= (preferences.checkTimePref_isMilliseconds) ? 60000 : 1;
      } else if (id === "logConsoleLevel") {
        SLStatic.logConsoleLevel = value;
      }

      SLStatic.info(`Set option (${element.type}) ${id}: ${preferences[id]} -> ${value}`);
      preferences[id] = value;
      SLOptions.showCheckMark(element, "green");
    };

    try {
      if (element.tagName === "INPUT") {
        switch(element.type) {
          case "checkbox":
          case "radio":
            preferences[element.id] = element.checked;
            SLOptions.showCheckMark(element, "green");
            SLStatic.info(`Set option (radio) ${element.id}: ${element.checked}`);
            if (element.checked && SLOptions.checkboxGroups[element.id])
              for (const id2 of SLOptions.checkboxGroups[element.id]) {
                const element2 = document.getElementById(id2);
                if (element2.checked) {
                  element2.checked = false;
                  preferences[id2] = false;
                  SLStatic.info(`Set option (radio) ${id2}: false`);
                  SLOptions.showCheckMark(element2, "green");
                }
              }
            break;
          case "text":
          case "number":
            setRegularPref(element);
            break;
          default:
            throw new Error("Unexpected element type: "+element.type);
        }
      } else if (element.tagName === "SELECT") {
        setRegularPref(element);
      } else {
        throw new Error("Unable to process change in element: "+element);
      }

      await browser.storage.local.set({ preferences });
    } catch (ex) {
      SLStatic.error(ex);
      SLOptions.showXMark(element, "red");
    }
  },

  doubleCheckButtonClick(callback) {
    // Closure for event listeners on important buttons like reset preferences
    // and delete user functions. This returns a listener function that double
    // checks the user input before executing the real callback function.
    return (evt => {
      const confDiv = document.createElement("div");
      confDiv.style.margin = "0.25em 2em";
      confDiv.style.display = "block";

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

  exclusiveCheckboxSet(ids) {
    // Creates a set of checkbox elements in which a maximum of
    // one item can be selected at any time.
    ids.forEach(id1 => {
      SLOptions.checkboxGroups[id1] = [];
      ids.forEach(id2 => {
        if (id1 !== id2)
          SLOptions.checkboxGroups[id1].push(id2);
      });
    });
  },

  attachListeners() {
    // Attach listeners for all input fields
    for (const id of SLStatic.prefInputIds) {
      const el = document.getElementById(id);
      el.addEventListener("change", SLOptions.updatePrefListener);
    }

    SLOptions.exclusiveCheckboxSet(["sendDoesSL","sendDoesDelay"]);

    document.getElementById("functionEditorTitle").addEventListener("mousedown",
      (evt) => {
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

    document.getElementById("funcEditSave").addEventListener("click", evt => {
      const funcName = document.getElementById("functionName").value;
      const funcContent = document.getElementById("functionEditorContent").value;
      const funcHelp = document.getElementById("functionHelpText").value;
      SLOptions.saveUserFunction(funcName, funcContent, funcHelp).then(success => {
        if (success) {
          SLOptions.addFuncOption(funcName, true);
          SLOptions.showCheckMark(evt.target, "green");
        } else {
          document.getElementById("functionName").select();
          SLOptions.showXMark(evt.target, "red");
        }
      });
    });

    const resetAdvConfigEditor = (async () => {
      SLStatic.debug("Refreshing advanced config editor contents");
      const prefsNode = document.getElementById("advancedConfigText");
      prefsNode.disabled = true;
      prefsNode.value = "";
      const { preferences } = await browser.storage.local.get({"preferences":{}});
      prefsNode.value = JSON.stringify(preferences, null, 2);
      prefsNode.disabled = false;
    });

    document.getElementById("advancedEditorTitle").addEventListener("mousedown",
      (() => {
        const advEditorDiv = document.getElementById("advancedConfigEditor");
        const visIndicator = document.getElementById("advancedEditorVisibleIndicator");
        if (advEditorDiv.style.display === "none") {
          resetAdvConfigEditor().then(() => {
            advEditorDiv.style.display = "block";
            visIndicator.textContent = "-";
            setTimeout(() =>
              document.getElementById("advanced-section").scrollIntoView(
                true, /* align to top */),
              100);
          }).catch(SLStatic.error);
        } else {
          advEditorDiv.style.display = "none";
          visIndicator.textContent = "+";
        }
      }));

    document.getElementById("advancedEditReset").addEventListener("click",
      (evt => {
        resetAdvConfigEditor().then(() => {
          SLOptions.showCheckMark(evt.target, "green");
        }).catch(SLStatic.error);
      }));



    const saveAdvancedConfig = () => {
      const saveBtn = document.getElementById("advancedEditSave");
      const prefContent = document.getElementById("advancedConfigText").value;
      try {
        const prefs = JSON.parse(prefContent);
        if (prefs) {
          browser.storage.local.set({ preferences: prefs }).then(() => {
            SLOptions.applyPrefsToUI();
          });
          SLOptions.showCheckMark(saveBtn, "green");
        }
      } catch (err) {
        SLStatic.warn(`JSON parsing failed with error`,err);
        SLOptions.showXMark(saveBtn, "red");
        browser.runtime.sendMessage({
          action: "alert",
          title: "Warning",
          text: `Preferences were not saved. JSON parsing failed with message:\n\n${err}`
        });
      }
    };

    document.getElementById(
      "advancedEditSave"
    ).addEventListener("click", saveAdvancedConfig);

    document.addEventListener("keydown", (event) => {
      if (event.target === document.getElementById("advancedConfigText")) {
        if (event.ctrlKey && event.code === "KeyS") {
          saveAdvancedConfig();
        }
      }
    });

    // Verify with user before deleting a scheduling function
    const doubleCheckDeleteListener = SLOptions.doubleCheckButtonClick(
      (evt => {
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
      }));
    document.getElementById("funcEditDelete").addEventListener("click",
      (evt => {
        const funcNameSelect = document.getElementById("functionNames");
        const funcName = funcNameSelect.value;
        if ([...SLOptions.builtinFuncs, "newFunctionName"].includes(funcName)) {
          SLStatic.error("Trying to delete builtin user func.");
          return;
        } else {
          doubleCheckDeleteListener(evt);
        }
      }));

    document.getElementById("funcTestRun").addEventListener("click",
      (() => {
        const funcName = document.getElementById("functionName").value;
        const funcBody = document.getElementById("functionEditorContent").value;
        const funcTestDate = document.getElementById("functionTestDate").value;
        const funcTestTime = document.getElementById("functionTestTime").value;
        let testDateTime = null;
        if ((/\d\d\d\d.\d\d.\d\d/).test(funcTestDate) &&
            (/\d\d.\d\d/).test(funcTestTime)) {
          testDateTime = SLStatic.parseDateTime(funcTestDate, funcTestTime);
        }
        const funcTestArgs = document.getElementById("functionTestArgs").value;

        const { sendAt, nextspec, nextargs, error } =
          SLStatic.evaluateUfunc(
            funcName,
            funcBody,
            testDateTime,
            funcTestArgs ? SLStatic.parseArgs(funcTestArgs) : null
          );
        SLStatic.debug("User function returned:", {sendAt, nextspec, nextargs, error});
        const outputCell = document.getElementById("functionTestOutput");
        const mkSpan = function(text, bold) {
          const e = document.createElement("SPAN");
          e.style.fontWeight = bold ? 'bold' : 'normal';
          e.textContent = text;
          return e;
        };
        const mkBlock = function(...contents) {
          const div = document.createElement("DIV");
          div.style.display = 'block';
          contents.forEach(e => {
            div.appendChild(e);
          });
          return div;
        };

        outputCell.textContent = "";
        if (error) {
          outputCell.appendChild(mkSpan('Error:',true));
          outputCell.appendChild(mkSpan(error));
        } else {
          const nextStr = SLStatic.parseableDateTimeFormat(sendAt);
          outputCell.appendChild(mkBlock(mkSpan("next:",true), mkSpan(nextStr)));
          outputCell.appendChild(mkBlock(mkSpan("nextspec:",true), mkSpan(nextspec || "none")));
          outputCell.appendChild(mkBlock(mkSpan("nextargs:",true), mkSpan(nextargs || "")));
        }
      }));

    // And attach a listener to the "Reset Preferences" button
    const clearPrefsListener = SLOptions.doubleCheckButtonClick(
      (async () => {
        const { preferences } =
          await browser.storage.local.get({ preferences: {} });
        const defaults = await fetch(
          "/utils/defaultPrefs.json"
        ).then(ptxt => ptxt.json());

        for (let key of Object.keys(defaults)) {
          if (key !== "instanceUUID") {
            preferences[key] = defaults[key][1];
          }
        }

        await browser.storage.local.set({ preferences });

        SLOptions.applyPrefsToUI();
      }));
    const clearPrefsBtn = document.getElementById("clearPrefs");
    clearPrefsBtn.addEventListener("click", clearPrefsListener);
  },

  onLoad() {
    const funcTestDate = document.getElementById("functionTestDate");
    const funcTestTime = document.getElementById("functionTestTime");
    const fmtDate = new Intl.DateTimeFormat('en-CA',
      { year: "numeric", month: "2-digit", day: "2-digit" });
    const fmtTime = new Intl.DateTimeFormat('default',
      { hour: "2-digit", minute: "2-digit", hour12: false });

    const soon = new Date(Date.now() + 60 * 1000);
    funcTestDate.value = fmtDate.format(soon);
    funcTestTime.value = fmtTime.format(soon);

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
