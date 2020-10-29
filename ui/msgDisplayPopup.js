const SLMsgDisplay = {
  async init() {
    const tabs = await browser.tabs.query({ active:true, currentWindow:true });
    const msg = { tabId: tabs[0].id, action: "getScheduleText" };
    const { scheduleTxt, err } = await browser.runtime.sendMessage(msg);
    if (err) {
      const titleNode  = document.createElement("DIV");
      titleNode.textContent = 'ERROR';
      titleNode.style.display = 'block';

      const msgNode = document.createElement("DIV");
      msgNode.textContent = ""+err;
      titleNode.style.display = 'block';

      const errElement = document.getElementById("error");
      errElement.textContent = "";
      errElement.appendChild(titleNode);
      errElement.appendChild(msgNode);
    } else {
      const contentElement = document.getElementById("content");
      contentElement.textContent = "";
      scheduleTxt.split("\n").forEach(segment => {
        const lineNode = document.createElement("DIV");
        lineNode.style.display = "block";
        lineNode.style.margin = "0px";
        lineNode.textContent = segment.trim();
        contentElement.appendChild(lineNode);
      });
    }
  }
}

window.addEventListener("load", SLMsgDisplay.init, false);
