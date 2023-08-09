
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
      // Create new row.
      // I copied this structure from "expandedorganizationRow" in the DOM.
      newRowNode = document.createElement("html:div");
      newRowNode.id = this.rowId;
      newRowNode.classList.add("message-header-row");

      let boxNode = document.createElement("html:div");
      newRowNode.appendChild(boxNode);

      boxNode.id = `${this.rowId}Box`;
      boxNode.classList.add("header-row");
      boxNode.tabIndex = 0;

      let headingNode = document.createElement("html:span");
      boxNode.appendChild(headingNode);
      
      headingNode.id = `${this.rowId}Heading`;
      headingNode.classList.add("row-heading");
      headingNode.textContent = this.name;

      let sep = document.createElement("span");
      headingNode.appendChild(sep);

      sep.classList.add("screen-reader-only");
      sep.setAttribute("data-l10n-name", "field-separator");

      let valueNode = document.createElement("span");
      valueNode.id = `${this.rowId}Value`;
      valueNode.textContent = this.value;
      boxNode.appendChild(valueNode);

      // Add the new row to the extra headers container.
      let topViewNode = document.getElementById("messageHeader")
      topViewNode.appendChild(newRowNode);
    }
    else {
      let valueNode = document.getElementById(`${this.rowId}Value`);
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
