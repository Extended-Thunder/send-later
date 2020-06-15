const sendDelay = function(delay) {
    return (async (event) => {
        const tabs = await browser.tabs.query({ active:true, currentWindow:true });
        const msg = { tabId: tabs[0].id };
        if (delay === 0) {
            msg.action = "doSendNow";
            msg.sendTime = null;
        } else {
            msg.action = "doSendLater";
            msg.sendTime = new Date(); // TODO: add delay
        }

        browser.runtime.sendMessage(msg);

        setTimeout(() => { // Close the popup.
          window.close();
        }, 0);
    });
};

const cancelButton = document.getElementById("cancel");
const sendNowButton = document.getElementById("send-now");
const delay15Button = document.getElementById("delay-15");
const delay30Button = document.getElementById("delay-30");
const delay120Button = document.getElementById("delay-120");

sendNowButton.addEventListener("click", sendDelay(0));
delay15Button.addEventListener("click", sendDelay(15));
delay30Button.addEventListener("click", sendDelay(30));
delay120Button.addEventListener("click", sendDelay(120));

cancelButton.addEventListener("click", async (event) => {
    browser.runtime.sendMessage({ action: "cancel" });
    setTimeout(() => { window.close(); }, 0);
});
