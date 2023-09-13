function onLoad() {
  let isBeta = window.location.href.includes('/next');
  console.log(isBeta);
  for (element of document.getElementsByClassName("beta-only")) {
    element.hidden = !isBeta;
  }
  for (element of document.getElementsByClassName("production-only")) {
    element.hidden = isBeta;
  }
}

window.addEventListener(
  "DOMContentLoaded",
  onLoad,
  { once: true },
);
