
function onLoad() {
  document.getElementById("button_ok").addEventListener("click", async () => {
    let { preferences } = await browser.storage.local.get({preferences: {}});
    let confirm = document.getElementById("confirmCheck");
    preferences.showEditAlert = (confirm.checked === true);
    await browser.storage.local.set({ preferences });
    console.log("[SendLater] Set showEditAlert preference:",preferences.showEditAlert);

    let win = await messenger.windows.getCurrent();
    messenger.windows.remove(win.id);
  });
}

window.addEventListener("load", onLoad);