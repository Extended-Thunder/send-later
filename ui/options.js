// Functions related to the options UI (accessed via options.html)
function makeExpandable(titleId, indicatorId, bodyId) {
  document.getElementById(titleId).addEventListener("mousedown", (evt) => {
    const bodyElt = document.getElementById(bodyId);
    const visElt = document.getElementById(indicatorId);
    if (bodyElt.style.display === "none") {
      bodyElt.style.display = "block";
      visElt.textContent = "-";
    } else {
      bodyElt.style.display = "none";
      visElt.textContent = "+";
    }
  });
}

const SLOptions = {
  builtinFuncs: ["ReadMeFirst", "BusinessHours", "DaysInARow", "Delay"],

  checkboxGroups: {},

  applyValue(id, value) {
    const element = document.getElementById(id);
    if (!element) {
      return;
    } else {
      if (element.tagName === "INPUT") {
        switch (element.type) {
          case "checkbox":
            element.checked = value !== undefined && value;
            break;
          case "text":
          case "number":
            element.value = value !== undefined ? value : "";
            break;
          case "radio":
            element.checked = value !== undefined && element.value === value;
            break;
          default:
            SLStatic.error(
              "SendLater: Unable to populate input element of type " +
                element.type,
            );
        }
      } else if (element.tagName === "SELECT") {
        SLStatic.debug(`Applying stored default ${element.id}: ${value}`);
        const matchingChildren = [...element.childNodes].filter(
          (opt) =>
            opt.tagName === "OPTION" &&
            opt.value.toLowerCase() === value.toLowerCase(),
        );
        if (matchingChildren.length === 1) {
          element.value = matchingChildren[0].value;
        } else if (matchingChildren.length > 1) {
          SLStatic.log("[SendLater]: Multiple options match", value, element);
        } else {
          SLStatic.log(
            "[SendLater]: Could not find value in element ",
            value,
            element,
          );
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
    if (new RegExp(minutesStr, "i").test(delayStr)) {
      // Generate a dropdown menu for time units
      const unitSelect = document.createElement("select");
      unitSelect.id = "gracePeriodUnits";

      const mopt = document.createElement("option");
      mopt.value = "gracePeriodMinutes";
      mopt.textContent = minutesStr;
      unitSelect.appendChild(mopt);

      const hopt = document.createElement("option");
      hopt.value = "gracePeriodHours";
      hopt.textContent = hoursStr;
      unitSelect.appendChild(hopt);

      const dopt = document.createElement("option");
      dopt.value = "gracePeriodDays";
      dopt.textContent = daysStr;
      unitSelect.appendChild(dopt);

      unitSelect.value = "gracePeriodMinutes";

      // Split string, to replace time unit dropdown in gramatically
      // correct spot.
      const str2Spans = delayStr.split(minutesStr).map((v) => {
        const spanElement = document.createElement("span");
        spanElement.textContent = v;
        return spanElement;
      });

      // Now, create a small div to contain the combined elements
      const unitOptions = document.createElement("div");
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
      if (
        gracePeriodTimeValue > 60 * 24 &&
        gracePeriodTimeValue % (60 * 24) === 0
      ) {
        gracePeriodUnits.value = "gracePeriodDays";
        gracePeriodTime.value = gracePeriodTimeValue / (60 * 24);
      } else if (
        gracePeriodTimeValue > 60 &&
        gracePeriodTimeValue % 60 === 0
      ) {
        gracePeriodUnits.value = "gracePeriodHours";
        gracePeriodTime.value = gracePeriodTimeValue / 60;
      } else {
        gracePeriodUnits.value = "gracePeriodMinutes";
      }
    }
  },

  async applyPrefsToUI() {
    // Sets all UI element states from stored preferences
    let prefKeys = await SLStatic.userPrefKeys();

    SLOptions.addFuncOption("none", {
      displayName: browser.i18n.getMessage("selectNone"),
      value: "",
      inEditor: false,
    });

    const ufuncPromise = browser.storage.local
      .get({ ufuncs: {} })
      .then(({ ufuncs }) => {
        Object.keys(ufuncs).forEach((funcName) => {
          SLStatic.debug(`Adding function element ${funcName}`);
          SLOptions.addFuncOption(funcName);
        });
      });

    const prefPromise = browser.storage.local
      .get({ preferences: {} })
      .then(async ({ preferences }) => {
        SLStatic.logConsoleLevel = preferences.logConsoleLevel;
        for (let id of prefKeys) {
          let prefVal = preferences[id];
          SLStatic.debug(`Setting ${id}: ${prefVal}`);
          SLOptions.applyValue(id, prefVal);
        }

        const checkTimePrefElement = document.getElementById("checkTimePref");
        checkTimePrefElement.step = 1.0;

        try {
          // Attempt to setup UI alternative units for specifying
          // grace period time.
          SLOptions.replaceGracePeriodUnitSelect();
          SLOptions.autoConvertGracePeriodUnits();
        } catch (ex) {
          SLStatic.debug("Unable to set time unit label", ex);
        }

        let customDT = document.getElementById("customizeDateTime");
        let customDTDiv = document.getElementById("customDateTimeFormatsDiv");
        customDTDiv.style.display = customDT.checked ? "block" : "none";

        document.getElementById("subfolderName").disabled =
          !preferences.storeInSubfolder;
        document.getElementById("whitelistName").disabled = !(
          preferences.sendDoesSL || preferences.sendDoesDelay
        );

        await SLOptions.setUpActiveAccounts(preferences.ignoredAccounts);
      });
    return await Promise.all([ufuncPromise, prefPromise]);
  },

  async setUpActiveAccounts(ignoredAccounts) {
    ignoredAccounts = ignoredAccounts || [];
    let accountsList = document.getElementById("activeAccountsList");
    updating = accountsList.children.length > 0;
    for (let account of await messenger.accounts.list()) {
      // I don't know if this is comprehensive.
      if (
        !(
          ["imap", "pop3"].includes(account.type) ||
          account.type.startsWith("owl")
        )
      ) {
        continue;
      }
      checkboxId = `activeAccount-${account.id}-Checkbox`;
      if (updating) {
        let checkboxElt = document.getElementById(checkboxId);
        checkboxElt.checked = !ignoredAccounts.includes(account.id);
      } else {
        let labelElt = document.createElement("label");
        let checkboxElt = document.createElement("input");
        checkboxElt.id = checkboxId;
        checkboxElt.type = "checkbox";
        checkboxElt.class = "preference";
        checkboxElt.checked = !ignoredAccounts.includes(account.id);
        checkboxElt.addEventListener("change", SLOptions.activeAccountsChange);
        labelElt.appendChild(checkboxElt);
        let nameElt = document.createElement("span");
        nameElt.class = "option-label";
        nameElt.textContent = account.name;
        labelElt.appendChild(nameElt);
        accountsList.appendChild(labelElt);
      }
    }
  },

  // Scheduling a message while the preferences window is open could cause the
  // list of ignored accounts to change.
  async storageChangedListener(changes) {
    if (changes.preferences) {
      if (await SLOptions.updateAdvConfigEditor()) {
        await SLOptions.setUpActiveAccounts(
          changes.preferences.newValue.ignoredAccounts,
        );
      }
    }
  },

  async activeAccountsChange(event) {
    let { preferences } = await messenger.storage.local.get({
      preferences: {},
    });
    if (!preferences.ignoredAccounts) {
      preferences.ignoredAccounts = [];
    }
    let checkboxElt = event.target;
    let accountId = /activeAccount-(.*)-Checkbox/.exec(checkboxElt.id)[1];
    if (!accountId) {
      // This shouldn't happen :shrug:
      return;
    }
    if (checkboxElt.checked) {
      preferences.ignoredAccounts = preferences.ignoredAccounts.filter(
        (a) => a != accountId,
      );
    } else if (!preferences.ignoredAccounts.includes(accountId)) {
      preferences.ignoredAccounts.push(accountId);
    }
    preferences.ignoredAccounts.sort();
    await messenger.storage.local.set({ preferences }).then(() => {
      SLOptions.showCheckMark(checkboxElt);
    });
    await SLOptions.updateAdvConfigEditor();
  },

  async saveUserFunction(name, body, help) {
    if (
      name !== browser.i18n.getMessage("functionnameplaceholder") &&
      !SLOptions.builtinFuncs.includes(name) &&
      validateFuncName(name)
    ) {
      SLStatic.info(`Storing user function ${name}`);
      const { ufuncs } = await browser.storage.local.get({ ufuncs: {} });
      ufuncs[name] = { body, help };
      await browser.storage.local.set({ ufuncs });
      return true;
    } else {
      browser.runtime.sendMessage({
        action: "alert",
        title: browser.i18n.getMessage("BadSaveTitle"),
        text: browser.i18n.getMessage("BadSaveBody"),
      });
      return false;
    }
  },

  addFuncOption(funcName, options) {
    let active = options?.active || false;
    let displayName = options?.displayName ?? funcName;
    let value = options?.value ?? funcName;
    let inEditor = options?.inEditor ?? true;
    if (inEditor && !document.getElementById(`ufunc-${funcName}`)) {
      const newOpt = document.createElement("option");
      newOpt.id = `ufunc-${funcName}`;
      newOpt.value = value;
      newOpt.textContent = displayName;

      const funcSelect = document.getElementById("functionNames");
      funcSelect.children[0].after(newOpt);
      if (active) {
        funcSelect.value = value;
      }
    }
    if (funcName !== "ReadMeFirst") {
      let funcSelectors = {};
      funcSelectors[`ufunc-accel-ctrl-${funcName}`] = "accelCtrlfuncselect";
      funcSelectors[`ufunc-accel-shift-${funcName}`] = "accelShiftfuncselect";
      for (let i = 1; i < 4; i++)
        funcSelectors[
          `ufunc-shortcut-${i}-${funcName}`
        ] = `quickOptions${i}funcselect`;

      for (let key of Object.keys(funcSelectors)) {
        if (document.getElementById(key)) continue;
        let newOpt = document.createElement("option");
        newOpt.id = key;
        newOpt.value = value;
        newOpt.textContent = displayName;
        let funcSelect = document.getElementById(funcSelectors[key]);
        funcSelect.appendChild(newOpt);
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
    if (p.lastChild.className === "success_icon") {
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
    if (p.lastChild.className === "success_icon") {
      p.replaceChild(marker, p.lastChild);
    } else {
      p.appendChild(marker);
    }
    setTimeout(() => marker.remove(), 1500);
  },

  async updatePrefListener(event) {
    // Respond to changes in UI input fields
    const element = event.target;
    const { preferences } = await browser.storage.local.get({
      preferences: {},
    });

    // If subfolder checkbox was enabled and associated textbox is empty, set
    // it to extension name. Also make it writable.
    if (
      element.id == "storeInSubfolder" &&
      !preferences.storeInSubfolder &&
      element.checked
    ) {
      if (!preferences.subfolderName) {
        preferences.subfolderName = browser.i18n.getMessage("extensionName");
        let subfolderName = document.getElementById("subfolderName");
        subfolderName.value = preferences.subfolderName;
      }
      subfolderName.disabled = false;
    }
    // If subfolder checkbox was disabled then make subfolderName field
    // unwritable.
    else if (
      element.id == "storeInSubfolder" &&
      preferences.storeInSubfolder &&
      !element.checked
    ) {
      document.getElementById("subfolderName").disabled = true;
    }
    // If subfolder name was emptied, uncheck the associated checkbox and make
    // the textbox unwritable.
    else if (
      element.id == "subfolderName" &&
      !element.value &&
      preferences.subfolderName &&
      preferences.storeInSubfolder
    ) {
      preferences.storeInSubfolder = false;
      document.getElementById("storeInSubfolder").checked = false;
      element.disabled = true;
    }

    document.getElementById("whitelistName").disabled = !(
      document.getElementById("sendDoesSL").checked ||
      document.getElementById("sendDoesDelay").checked
    );

    // If one of the shortcut keys was changed to the value of a different
    // shortcut key, then clear that one.
    let match;
    if ((match = /^quickOptions(.)Key$/.exec(element.id))) {
      let keys = [1, 2, 3];
      let thisKey = match[1];
      let thisValue = element.value;
      if (thisValue.length) {
        for (let otherKey of keys.filter((k) => k != thisKey)) {
          let pref = `quickOptions${otherKey}Key`;
          let otherElement = document.getElementById(pref);
          if (otherElement.value == thisValue) {
            otherElement.value = "";
            preferences[pref] = "";
          }
        }
      }
    }

    const setRegularPref = (element) => {
      let id = element.id;
      let value = element.value;
      if (["lateGracePeriod", "gracePeriodUnits"].includes(id)) {
        const gracePeriodUnits = document.getElementById("gracePeriodUnits");
        const gracePeriodValue =
          document.getElementById("lateGracePeriod").value;
        if (gracePeriodUnits) {
          const multiplier = {
            gracePeriodMinutes: 1,
            gracePeriodHours: 60,
            gracePeriodDays: 60 * 24,
          };
          id = "lateGracePeriod";
          value = gracePeriodValue * multiplier[gracePeriodUnits.value];
        }
      } else if (id === "logConsoleLevel") {
        SLStatic.logConsoleLevel = value;
      } else if (["shortDateTimeFormat", "longDateTimeFormat"].includes(id)) {
        if (!SLOptions.checkDateFormat(element)) {
          SLOptions.showXMark(element, "red");
          return;
        }
      } else if (/^quickOptions.Key$/.exec(id)) {
        if (value.length && !SLStatic.shortcutKeys.includes(value)) {
          SLOptions.showXMark(element, "red");
          return;
        }
      }

      if (element.type == "number") {
        let numberValue;
        if (value == "") {
          // If you have a number input field and the user enters something
          // non-numeric, then it returns the empty string as its value.
          numberValue = NaN;
        } else {
          numberValue = Number(value);
        }
        if (isNaN(numberValue)) {
          SLStatic.info(`Invalid numerical value "${value}" for ${id}`);
          SLOptions.showXMark(element, "red");
          return;
        }
        value = numberValue;
      }

      SLStatic.info(
        `Set option (${element.type}) ${id}: ` +
          `${preferences[id]} -> ${value}`,
      );
      preferences[id] = value;
      SLOptions.showCheckMark(element, "green");
    };

    try {
      if (element.tagName === "INPUT") {
        switch (element.type) {
          case "checkbox":
          case "radio":
            preferences[element.id] = element.checked;
            SLOptions.showCheckMark(element, "green");
            SLStatic.info(
              `Set option (radio) ${element.id}: ${element.checked}`,
            );
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
            throw new Error("Unexpected element type: " + element.type);
        }
      } else if (element.tagName === "SELECT") {
        setRegularPref(element);
      } else {
        throw new Error("Unable to process change in element: " + element);
      }

      await browser.storage.local.set({ preferences });
      await SLOptions.updateAdvConfigEditor();
    } catch (ex) {
      SLStatic.error(ex);
      SLOptions.showXMark(element, "red");
    }
  },

  doubleCheckButtonClick(callback) {
    // Closure for event listeners on important buttons like reset preferences
    // and delete user functions. This returns a listener function that double
    // checks the user input before executing the real callback function.
    return (evt) => {
      const confDiv = document.createElement("div");
      confDiv.style.margin = "0.25em 2em";
      confDiv.style.display = "block";

      const confirmPrompt = document.createElement("span");
      confirmPrompt.textContent = browser.i18n.getMessage("AreYouSure");
      confirmPrompt.style.fontWeight = "bold";
      confirmPrompt.style.color = "red";
      confirmPrompt.style.display = "inline";
      confirmPrompt.style.margin = "0 0.5em";
      confDiv.appendChild(confirmPrompt);

      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.textContent = browser.i18n.getMessage("answerYes");
      confirmBtn.style.fontWeight = "bold";
      confirmBtn.style.display = "inline";
      confirmBtn.style.margin = "0 0.5em";
      confDiv.appendChild(confirmBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.textContent = browser.i18n.getMessage("answerNo");
      cancelBtn.style.fontWeight = "bold";
      cancelBtn.style.display = "inline";
      cancelBtn.style.margin = "0 0.5em";
      confDiv.appendChild(cancelBtn);

      confirmBtn.addEventListener("click", (confClickEvent) => {
        confDiv.remove();
        evt.target.disabled = false;
        callback(confClickEvent);
      });

      cancelBtn.addEventListener("click", (cancelClickEvent) => {
        confDiv.remove();
        evt.target.disabled = false;
      });

      evt.target.parentNode.appendChild(confDiv);
      evt.target.disabled = true;
    };
  },

  exclusiveCheckboxSet(ids) {
    // Creates a set of checkbox elements in which a maximum of
    // one item can be selected at any time.
    ids.forEach((id1) => {
      SLOptions.checkboxGroups[id1] = [];
      ids.forEach((id2) => {
        if (id1 !== id2) SLOptions.checkboxGroups[id1].push(id2);
      });
    });
  },

  async resetAdvConfigEditor(preferences) {
    SLStatic.debug("Refreshing advanced config editor contents");
    const prefsNode = document.getElementById("advancedConfigText");
    prefsNode.disabled = true;
    prefsNode.value = "";
    if (!preferences) {
      ({ preferences } = await browser.storage.local.get({
        preferences: {},
      }));
      SLOptions.advPrefs = preferences;
    }
    prefsNode.value = JSON.stringify(
      preferences,
      Object.keys(preferences).sort(),
      2,
    );
    prefsNode.disabled = false;
  },

  async updateAdvConfigEditor() {
    let currentContents;
    try {
      let prefContent = document.getElementById("advancedConfigText").value;
      currentContents = JSON.parse(prefContent);
    } catch (ex) {
      await SLOptions.resetAdvConfigEditor();
      return true;
    }
    let priorContents = SLOptions.advPrefs;
    let { preferences } = await browser.storage.local.get({
      preferences: {},
    });
    let changed;
    for (let key of Object.keys(preferences)) {
      if (String(preferences[key]) != String(priorContents[key])) {
        priorContents[key] = preferences[key];
        currentContents[key] = preferences[key];
        changed = true;
      }
    }
    if (changed) {
      await SLOptions.resetAdvConfigEditor(currentContents);
    }
    return changed;
  },

  async attachListeners() {
    // Attach listeners for all input fields
    let prefKeys = await SLStatic.userPrefKeys();
    for (const id of prefKeys) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", SLOptions.updatePrefListener);
      }
    }

    SLOptions.exclusiveCheckboxSet(["sendDoesSL", "sendDoesDelay"]);

    makeExpandable(
      "functionEditorTitle",
      "functionEditorVisibleIndicator",
      "FunctionEditorDiv",
    );
    makeExpandable(
      "activeAccountsTitle",
      "activeAccountsVisibleIndicator",
      "activeAccountsEditor",
    );
    makeExpandable(
      "advancedEditorTitle",
      "advancedEditorVisibleIndicator",
      "advancedConfigEditor",
    );

    const resetFunctionInput = () => {
      const funcName = document.getElementById("functionNames").value;
      if (!funcName) {
        SLStatic.error(`Unspecified function: ${funcName}`);
        return;
      }

      const funcContentElmt = document.getElementById("functionEditorContent");
      const funcHelpElmt = document.getElementById("functionHelpText");
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
          funcNameElmt.placeholder = browser.i18n.getMessage(
            "functionnameplaceholder",
          );
          funcNameElmt.value = "";
          funcContentElmt.placeholder =
            browser.i18n.getMessage("codeplaceholder");
          funcContentElmt.value = "";
          funcHelpElmt.placeholder = browser.i18n.getMessage(
            "helptextplaceholder",
          );
          funcHelpElmt.value = "";
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
    };

    document
      .getElementById("functionNames")
      .addEventListener("change", resetFunctionInput);
    document
      .getElementById("funcEditReset")
      .addEventListener("click", resetFunctionInput);

    document
      .getElementById("funcEditSave")
      .addEventListener("click", (evt) => {
        const funcName = document.getElementById("functionName").value;
        const funcContent = document.getElementById(
          "functionEditorContent",
        ).value;
        const funcHelp = document.getElementById("functionHelpText").value;
        SLOptions.saveUserFunction(funcName, funcContent, funcHelp).then(
          (success) => {
            if (success) {
              SLOptions.addFuncOption(funcName, { active: true });
              SLOptions.showCheckMark(evt.target, "green");
            } else {
              document.getElementById("functionName").select();
              SLOptions.showXMark(evt.target, "red");
            }
          },
        );
      });

    await SLOptions.resetAdvConfigEditor();

    document
      .getElementById("advancedEditReset")
      .addEventListener("click", (evt) => {
        SLOptions.resetAdvConfigEditor()
          .then(() => {
            SLOptions.showCheckMark(evt.target, "green");
          })
          .catch(SLStatic.error);
      });

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
        SLStatic.warn(`JSON parsing failed with error`, err);
        SLOptions.showXMark(saveBtn, "red");
        browser.runtime.sendMessage({
          action: "alert",
          title: "Warning",
          text:
            `Preferences were not saved. ` +
            `JSON parsing failed with message:\n\n${err}`,
        });
      }
    };

    document
      .getElementById("advancedEditSave")
      .addEventListener("click", saveAdvancedConfig);

    document.addEventListener("keydown", (event) => {
      if (event.target === document.getElementById("advancedConfigText")) {
        if (event.ctrlKey && event.key.toLowerCase() === "s") {
          saveAdvancedConfig();
        }
      }
    });

    // Verify with user before deleting a scheduling function
    const doubleCheckDeleteListener = SLOptions.doubleCheckButtonClick(
      (evt) => {
        const funcNameSelect = document.getElementById("functionNames");
        const funcName = funcNameSelect.value;
        funcNameSelect.value = "ReadMeFirst";
        resetFunctionInput();

        try {
          document.getElementById(`ufunc-${funcName}`).remove();
          document.getElementById(`ufunc-accel-ctrl-${funcName}`).remove();
          document.getElementById(`ufunc-accel-shift-${funcName}`).remove();
          for (let i = 1; i < 4; i++)
            document
              .getElementById(`ufunc-shortcut-${i}-${funcName}`)
              .remove();
        } catch (ex) {
          SLStatic.error("Unable to remove function selector element", ex);
        }

        browser.storage.local
          .get({ ufuncs: {} })
          .then(({ ufuncs }) => {
            delete ufuncs[funcName];
            browser.storage.local.set({ ufuncs });
          })
          .catch(SLStatic.error);
      },
    );
    document
      .getElementById("funcEditDelete")
      .addEventListener("click", (evt) => {
        const funcNameSelect = document.getElementById("functionNames");
        const funcName = funcNameSelect.value;
        if (
          [...SLOptions.builtinFuncs, "newFunctionName"].includes(funcName)
        ) {
          SLStatic.error("Trying to delete builtin user func.");
          return;
        } else {
          doubleCheckDeleteListener(evt);
        }
      });

    document.getElementById("funcTestRun").addEventListener("click", () => {
      const funcName = document.getElementById("functionName").value;
      const funcBody = document.getElementById("functionEditorContent").value;
      const funcTestDate = document.getElementById("functionTestDate").value;
      const funcTestTime = document.getElementById("functionTestTime").value;
      let testDateTime = null;
      if (
        /\d\d\d\d.\d\d.\d\d/.test(funcTestDate) &&
        /\d\d.\d\d/.test(funcTestTime)
      ) {
        testDateTime = SLStatic.parseDateTime(funcTestDate, funcTestTime);
      }
      const funcTestArgs = document.getElementById("functionTestArgs").value;

      const { sendAt, nextspec, nextargs, error } = SLStatic.evaluateUfunc(
        funcName,
        funcBody,
        testDateTime,
        funcTestArgs ? SLStatic.parseArgs(funcTestArgs) : null,
      );
      SLStatic.debug("User function returned:", {
        sendAt,
        nextspec,
        nextargs,
        error,
      });
      const outputCell = document.getElementById("functionTestOutput");
      const mkSpan = function (text, bold) {
        const e = document.createElement("SPAN");
        e.style.fontWeight = bold ? "bold" : "normal";
        e.textContent = text;
        return e;
      };
      const mkBlock = function (...contents) {
        const div = document.createElement("DIV");
        div.style.display = "block";
        contents.forEach((e) => {
          div.appendChild(e);
        });
        return div;
      };

      outputCell.textContent = "";
      if (error) {
        outputCell.appendChild(mkSpan("Error:", true));
        outputCell.appendChild(mkSpan(error));
      } else {
        const nextStr = SLStatic.parseableDateTimeFormat(sendAt);
        outputCell.appendChild(
          mkBlock(mkSpan("next:", true), mkSpan(nextStr)),
        );
        outputCell.appendChild(
          mkBlock(mkSpan("nextspec:", true), mkSpan(nextspec || "none")),
        );
        outputCell.appendChild(
          mkBlock(mkSpan("nextargs:", true), mkSpan(nextargs || "")),
        );
      }
    });

    document
      .getElementById("customizeDateTime")
      .addEventListener("change", (evt) => {
        let fmtDiv = document.getElementById("customDateTimeFormatsDiv");
        fmtDiv.style.display = evt.target.checked ? "block" : "none";
      });

    // And attach a listener to the "Reset Preferences" button
    const clearPrefsListener = SLOptions.doubleCheckButtonClick(async () => {
      const { preferences } = await browser.storage.local.get({
        preferences: {},
      });
      const defaults = await SLStatic.prefDefaults();

      for (let key of Object.keys(defaults)) {
        if (key !== "instanceUUID") {
          preferences[key] = defaults[key][1];
        }
      }

      await browser.storage.local.set({ preferences });

      SLOptions.applyPrefsToUI();
    });
    const clearPrefsBtn = document.getElementById("clearPrefs");
    clearPrefsBtn.addEventListener("click", clearPrefsListener);

    for (let id of ["shortDateTimeFormat", "longDateTimeFormat"]) {
      let elt = document.getElementById(id);
      elt.addEventListener("input", SLOptions.dateFormatChanged);
      SLOptions.checkDateFormat(elt);
    }
    messenger.storage.local.onChanged.addListener(
      SLOptions.storageChangedListener,
    );
  },

  dateFormatChanged(evt) {
    SLOptions.checkDateFormat(evt.target);
  },

  checkDateFormat(element) {
    SLStatic.trace("checkDateFormat", element);
    let id = element.id;
    let sampleId, defaultFunction;
    if (id == "shortDateTimeFormat") {
      sampleId = "sampleShortDateTime";
      defaultFunction = SLStatic.defaultShortHumanDateTimeFormat;
    } else {
      sampleId = "sampleLongDateTime";
      defaultFunction = SLStatic.defaultHumanDateTimeFormat;
    }
    let now = new Date();
    let fmt = element.value;
    let sample = document.getElementById(sampleId);
    let ret = true;
    if (fmt) {
      try {
        sample.textContent = SLStatic.customHumanDateTimeFormat(now, fmt);
      } catch (ex) {
        sample.textContent = browser.i18n.getMessage("invalidDateFormat");
        ret = false;
      }
    } else {
      sample.textContent = defaultFunction(now);
    }
    return ret;
  },

  async onLoad() {
    if (navigator.userAgent.indexOf("Mac") != -1)
      document.getElementById("accelCtrlLabel").textContent =
        browser.i18n.getMessage("accelCtrlLabel.MacOS");

    document.getElementById("whitelistPrefLabel").title =
      browser.i18n.getMessage("whitelistPrefTooltip", [
        browser.i18n.getMessage("sendButtonPrefLabel"),
        browser.i18n.getMessage("extensionName"),
      ]);

    const funcTestDate = document.getElementById("functionTestDate");
    const funcTestTime = document.getElementById("functionTestTime");
    const fmtDate = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const fmtTime = new Intl.DateTimeFormat("default", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const soon = new Date(Date.now() + 60 * 1000);
    funcTestDate.value = fmtDate.format(soon);
    funcTestTime.value = fmtTime.format(soon);

    for (let id of [
      "functionEditorContent",
      "functionHelpText",
      "functionName",
      "funcEditSave",
      "funcEditReset",
      "funcEditDelete",
    ]) {
      const el = document.getElementById(id);
      el.disabled = true;
    }

    await SLStatic.tb115(() => {
      document.getElementById("showColumnRow").hidden = true;
    });

    await SLOptions.applyPrefsToUI();
    await SLOptions.attachListeners();

    document.getElementById("userGuideLink").href =
      await SLTools.userGuideLink();
    document.getElementById("donateLink").href = await SLTools.userGuideLink(
      "#support-send-later",
    );
  },
};

window.addEventListener("load", SLOptions.onLoad, false);
