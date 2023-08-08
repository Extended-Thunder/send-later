
var ExtensionSupport = globalThis.ExtensionSupport || ChromeUtils.import(
  "resource:///modules/ExtensionSupport.jsm"
).ExtensionSupport;

class CustomHdrRow {
  constructor(context, name, value) {
    this.context = context;
    this.name = name;
    this.value = value;
    this.rowId = ExtensionCommon.makeWidgetId(
      `${context.extension.id}-${name}-custom-hdr`
    );
  }

  getDocument(window) {
    return window.gTabmail.currentAbout3Pane.document.
      getElementById("messageBrowser").contentDocument;
  }

  destroy() {
    if (this.destroyed)
      throw new Error("Unable to destroy ExtensionScriptParent twice");

    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      try {
        this.getDocument(window).getElementById(this.rowId).remove();
      } catch (ex) {
        console.error(ex);
      }
    }

    this.destroyed = true;
  }

  static waitForWindow(win) {
    return new Promise(resolve => {
      if (win.document.readyState == "complete")
        resolve();
      else
        win.addEventListener( "load", resolve, { once: true } );
    });
  }

  async addToCurrentWindows() {
    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      await CustomHdrRow.waitForWindow(window);
      this.addToWindow(window);
    }
  }

  addToWindow(window) {
    let document = this.getDocument(window);

    // If a row already exists, do not create another one
    let newRowNode = document.getElementById(this.rowId);
    if (!newRowNode) {
      // Create new collapsed row
      // TODO Logic copied from SimpleHeaderRow in mail/base/content/widgets/
      // header-fields.js. I wish I knew how to just import that code so I could
      // do document.createElement("simple-header-row") and have all this happen
      // automatically!
      // TODO The row heading and value are displaying on separate lines. I
      // don't know why or what the right way to fix it is.
      // TODO In the DOM this node shows up as "div" instead of "html:div". I'm
      // not sure whether this matters or how to fix it if it does matter.
      // I believe using `createElementNS` rather than `createElement` is
      // intended to avoid this problem, but it's not working.
      newRowNode = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div");
      newRowNode.id = this.rowId;
      newRowNode.dataset.headerName = this.rowId;
      newRowNode.dataset.prettyHeaderName = this.name;
      newRowNode.setAttribute("is", "simple-header-row");

      let heading = document.createElement("span");
      heading.id = `${newRowNode.dataset.headerName}Heading`;
      heading.classList.add("row-heading");
      let sep = document.createElement("span");
      sep.classList.add("screen-reader-only");
      sep.setAttribute("data-l10n-name", "field-separator");
      heading.appendChild(sep);
      document.l10n.setAttributes(
        heading,
        "message-header-custom-field",
        {
          fieldName: newRowNode.dataset.prettyHeaderName,
        }
      );
      newRowNode.appendChild(heading);

      newRowNode.classList.add("header-row");
      newRowNode.tabIndex = 0;

      let valueNode = document.createElement("span");
      valueNode.id = `${this.rowId}-value`;
      valueNode.textContent = this.value;
      newRowNode.appendChild(valueNode);

      // Add the new row to the extra headers container.
      let topViewNode = document.getElementById("extraHeadersArea")
      topViewNode.appendChild(newRowNode);
    }
    else {
      let valueNode = document.getElementById(`${this.rowId}-value`);
      valueNode.textContent = this.value;
    }
  }
}

var headerView = class extends ExtensionCommon.ExtensionAPI {
    close() {
      for (let hdrRow of this.hdrRows.values()) {
        try {
          hdrRow.destroy();
        } catch (ex) {
          console.error("Unable to destroy hdrRow:",ex);
        }
      }
    }

    getAPI(context) {
      context.callOnClose(this);
      let hdrRows = new Map();
      this.hdrRows = hdrRows;

      return {
        headerView: {

          async addCustomHdrRow({ name, value }) {
            let hdrRow = hdrRows.get(name);
            if (hdrRow) {
              hdrRow.value = value;
            }
            else {
              hdrRow = new CustomHdrRow(context, name, value);
            }
            await hdrRow.addToCurrentWindows();
            hdrRows.set(name, hdrRow);
          },

          async removeCustomHdrRow(name) {
            let hdrRow = hdrRows.get(name);
            if (!hdrRow)
              throw new ExtensionUtils.ExtensionError("Cannot remove non-existent hdrRow");
            hdrRow.destroy();
            hdrRows.delete(name);
          }
        }
      }
    }
}
