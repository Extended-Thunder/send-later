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
          e.innerHTML = msg;
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
};

window.addEventListener("load", localizer.translateDocument(), false);
