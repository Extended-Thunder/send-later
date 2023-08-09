function buttonListener(evt) {
  let user_check = document.getElementById("userCheck");
  let button_ok = document.getElementById("button_ok");
  messenger.runtime.sendMessage({
    ok: (evt.target === button_ok),
    check: user_check.checked
  }).then(async () => {
    let window = await messenger.windows.getCurrent();
    messenger.windows.remove(window.id);
  });
}

function onLoad() {
  let params = (new URL(window.document.location)).searchParams;

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
    userCheck.checked = (params.get("checked") === "true");
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
}

window.addEventListener("load", onLoad);
