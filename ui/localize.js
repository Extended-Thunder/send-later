const localizer = {
  translateDocument() {
    const elements = document.querySelectorAll(".localized");
    elements.forEach(async e => {
      try {
        const key = e.className.match(/__MSG_(.+)__/)[1];
        const msg = browser.i18n.getMessage(key);
        if (e.tagName === "INPUT") {
          e.value = msg;
        } else {
          e.textContent = msg;
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
  window.addEventListener("load", () =>
    setTimeout(localizer.translateDocument,150), false);
} else {
  window.addEventListener("load", localizer.translateDocument, false);
}
