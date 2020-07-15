const localizer = {
  translateDocument() {
    const elements = document.querySelectorAll(".localized");
    elements.forEach(async e => {
      try {
        const key = e.className.match(/__MSG_(.+)__/)[1];
        const mockArgs = [];
        let msg;
        do {
          msg = browser.i18n.getMessage(key,mockArgs);
          mockArgs.push("");
        } while(msg.indexOf(/\$\d/) !== -1);
        if (e.tagName === "INPUT") {
          e.value = msg;
        } else {
          e.innerHTML = msg;
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
};

if (typeof browser === "undefined" || typeof browserMocking === "boolean") {
  // For testing purposes, because the browser mock script needs to
  // asynchronously load translations.
  function waitAndTranslate() {
    if (browser.i18n.getMessage("delay120Label") === "delay120Label") {
      setTimeout(waitAndTranslate, 10);
    } else {
      localizer.translateDocument();
    }
  }
  window.addEventListener("load", waitAndTranslate, false);
  // window.addEventListener("load", () =>
  //   setTimeout(localizer.translateDocument,150), false);
} else {
  window.addEventListener("load", localizer.translateDocument, false);
}
