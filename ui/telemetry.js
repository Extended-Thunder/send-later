let privacyUrl = SLStatic.translationURL(
  "https://extended-thunder.github.io/send-later/privacy-policy.html",
);

function init() {
  let name = browser.i18n.getMessage("extensionName");
  let title = browser.i18n.getMessage("TelemetryAskTitle", [name]);
  document.title = title;
  document.getElementById("TelemetryAskTitle").innerHTML = title;
  let pp = browser.i18n.getMessage("PrivacyPolicy");
  let privacyBlurb = `<a href="${privacyUrl}">${pp}</a>`;
  let text = browser.i18n.getMessage("TelemetryAskText", [name, privacyBlurb]);
  document.getElementById("TelemetryAskText").innerHTML = text;
  let yesButton = document.getElementById("TelemetryAskYes");
  yesButton.value = browser.i18n.getMessage("TelemetryAskYes");
  yesButton.addEventListener("click", onClickYes);
  let noButton = document.getElementById("TelemetryAskNo");
  noButton.value = browser.i18n.getMessage("TelemetryAskNo");
  noButton.addEventListener("click", onClickNo);
}

async function onClick(enable) {
  let { preferences } = await messenger.storage.local.get({ preferences: {} });
  preferences.telemetryAsked = true;
  preferences.telemetryEnabled = enable;
  await messenger.storage.local.set({ preferences });
  window.close();
}

function onClickYes() {
  onClick(true);
}

function onClickNo() {
  onClick(false);
}

window.addEventListener("load", init, false);
