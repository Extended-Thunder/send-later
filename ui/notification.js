async function makeContentsVisible() {
  let body = document.getElementsByTagName("body")[0];
  let outerWidth = window.outerWidth;
  let outerHeight = window.outerHeight;
  let rect = body.getBoundingClientRect();
  let viewPortBottom =
    window.innerHeight || document.documentElement.clientHeight;
  let hidden = rect.bottom - viewPortBottom;
  if (hidden > 0) {
    if (hidden > outerHeight) {
      console.log(
        "Not resizing notification window, would have to >double it",
      );
      SLStatic.telemetrySend({
        event: "notResizingPopup",
        outerHeight: outerHeight,
        hidden: hidden,
      });
      return;
    }
    let apiWindow = await messenger.windows.getCurrent();
    messenger.windows.update(apiWindow.id, { height: outerHeight + hidden });
  }
}

function buttonListener(evt) {
  let user_check = document.getElementById("userCheck");
  let button_ok = document.getElementById("button_ok");
  messenger.runtime
    .sendMessage({
      ok: evt.target === button_ok,
      check: user_check.checked,
    })
    .then(async () => {
      let window = await messenger.windows.getCurrent();
      messenger.windows.remove(window.id);
    });
}

async function onLoad() {
  await SLStatic.cachePrefs();

  let params = new URL(window.document.location).searchParams;

  let message = document.getElementById("message");
  message.textContent = params.get("message");

  let button_ok = document.getElementById("button_ok");
  button_ok.value = browser.i18n.getMessage("okay");
  button_ok.addEventListener("click", buttonListener);

  let confirmDiv = document.getElementById("confirmDiv");
  if (/check/i.exec(params.get("type"))) {
    confirmDiv.style.display = "block";
    let userCheck = document.getElementById("userCheck");
    let checkboxLabel = document.getElementById("checkboxLabel");
    userCheck.checked = params.get("checked") === "true";
    checkboxLabel.textContent = `${params.get("checkLabel")}`;
  } else {
    confirmDiv.style.display = "none";
  }

  let button_cancel = document.getElementById("button_cancel");
  if (/confirm/i.exec(params.get("type"))) {
    button_cancel.style.display = "inline";
    button_cancel.value = browser.i18n.getMessage("cancel");
    button_cancel.addEventListener("click", buttonListener);
  } else {
    button_cancel.style.display = "none";
  }
  makeContentsVisible();
}

window.addEventListener("load", onLoad);
