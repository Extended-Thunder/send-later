var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function loadLocalScript(path) {
  let uri = Services.io.newURI(path, null, WL.extension.rootURI);
  Services.scriptloader.loadSubScript(uri.spec, this, "UTF-8");
}

loadLocalScript("experiments/notifyTools.js");
loadLocalScript("experiments/statusBar.js");

function onLoad(activatedWhileWindowOpen) {
  SendLaterStatusBar.onLoad(activatedWhileWindowOpen);

  notifyTools.enable();

  SendLaterStatusBar.onAfterLoad();
}

function onUnload(deactivatedWhileWindowOpen) {
  SendLaterStatusBar.onUnload(deactivatedWhileWindowOpen);

  if (deactivatedWhileWindowOpen)
    notifyTools.disable();
}