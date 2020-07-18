const SLMsgDisplay = {
  async init() {
    const tabs = await browser.tabs.query({ active:true, currentWindow:true });
    const msg = { tabId: tabs[0].id, action: "getScheduleText" };
    const { scheduleTxt, err } = await browser.runtime.sendMessage(msg);
    if (err) {
      document.getElementById("error").innerHTML = "ERROR<br/>"+err;
    } else {
      document.getElementById("content").innerHTML = scheduleTxt;
    }
  }
}

window.addEventListener("load", SLMsgDisplay.init, false);
