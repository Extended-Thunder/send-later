async function onLoad() {
  messenger.storage.onChanged.addListener(storageChanged);
  let { preferences, log } = await messenger.storage.local.get({
    preferences: {},
    log: "",
  });
  document
    .getElementById("internalLogLevel")
    .addEventListener("change", logLevelChanged);
  document.getElementById("clearButton").addEventListener("click", clearLog);
  document.getElementById("copyButton").addEventListener("click", copyLog);
  preferencesChanged(preferences);
  logChanged(log);
}

async function storageChanged(changes, areaName) {
  if (changes.preferences) preferencesChanged(changes.preferences.newValue);
  if (changes.log) logChanged(changes.log.newValue);
}

function preferencesChanged(preferences) {
  document.getElementById("internalLogLevel").value =
    preferences.logStorageLevel || "none";
}

function logChanged(log) {
  document.getElementById("logContent").innerText = log;
}

async function logLevelChanged() {
  let level = document.getElementById("internalLogLevel").value;
  let { preferences } = await messenger.storage.local.get({ preferences: {} });
  if (preferences.logStorageLevel == level) return;
  preferences.logStorageLevel = level;
  console.log("FOO2", level);
  await messenger.storage.local.set({ preferences });
}

async function clearLog() {
  await messenger.storage.local.set({ log: "" });
  // We don't need to explicitly clear the div here because the above storage
  // change will trigger our storage changed listener.
}

async function copyLog() {
  let elt = document.getElementById("logContent");
  let text = elt.innerText;
  await navigator.clipboard.writeText(text);
}

window.addEventListener("load", onLoad, false);
