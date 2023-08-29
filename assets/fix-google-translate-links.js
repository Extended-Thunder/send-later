// As of the 2023-08-29, Google Translate breaks links, i.e., it replaces them
// with links that don't work properly, and as far as I can tell there's no way
// to get it to stop replacing a particular link, so we just need to revert the
// links ourselves.

function fixLinks() {
  if (! /^https:\/\/[^\/]+\.translate\.goog\//.exec(document.URL)) {
    return;
  }
  for (let anchor of document.getElementsByTagName("a")) {
    let url = anchor.href.replace(/.*translate.google.com.*u=/, "");
    if (url != anchor.href) {
      url = decodeURIComponent(url);
      anchor.href=url;
    }
  }
}

window.addEventListener(
  "DOMContentLoaded",
  fixLinks,
  { once: true },
);
