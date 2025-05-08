var { ExtensionSupport } = ChromeUtils.importESModule(
  "resource:///modules/ExtensionSupport.sys.mjs",
);

var thunderbirdVersion = parseInt(Services.appinfo.version.split(".")[0]);

class CustomHdrRow {
  constructor(context, name) {
    this.context = context;
    this.name = name;
    this.rowId = ExtensionCommon.makeWidgetId(
      `${context.extension.id}-${name}-custom-hdr`,
    );
  }

  async getDocument(tab) {
    // Three possibilities:
    // 1. Message pane in 3pane tab
    // 2. Message in its own tab
    // 3. Message in its own window
    // Message pane in 3pane tab
    try {
      let doc =
        tab.nativeTab.chromeBrowser.contentDocument.getElementById(
          "messageBrowser",
        ).contentDocument;
      if (doc) {
        return doc;
      }
    } catch (ex) {}
    // Message in its own tab
    try {
      let doc = tab.nativeTab.chromeBrowser.contentDocument;
      if (doc.getElementById("messageHeader")) {
        return doc;
      }
    } catch (ex) {}
    // Message in its own window
    try {
      let doc =
        tab.nativeTab.document.getElementById(
          "messageBrowser",
        ).contentDocument;
      if (doc) {
        return doc;
      }
    } catch (ex) {}
  }

  async remove(window) {
    try {
      let elt = (await this.getDocument(window)).getElementById(this.rowId);
      if (elt) {
        elt.remove();
      }
    } catch (ex) {
      console.error(ex);
    }
  }

  async addToWindow(window, value) {
    let document = await this.getDocument(window);

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

      let sep = document.createElement("html:span");
      headingNode.appendChild(sep);

      sep.classList.add("screen-reader-only");
      sep.setAttribute("data-l10n-name", "field-separator");
      sep.textContent = ":";

      let valueNode = document.createElement("html:span");
      valueNode.id = `${this.rowId}Value`;
      valueNode.textContent = value;
      boxNode.appendChild(valueNode);

      // Add the new row to the extra headers container.
      let topViewNode = document.getElementById("messageHeader");
      topViewNode.appendChild(newRowNode);
    } else {
      let valueNode = document.getElementById(`${this.rowId}Value`);
      valueNode.textContent = value;
    }
  }
}

var headerView = class extends ExtensionCommon.ExtensionAPI {
  async close() {}

  getAPI(context) {
    context.callOnClose(this);
    let hdrRows = new Map();
    this.hdrRows = hdrRows;

    return {
      headerView: {
        async addCustomHdrRow(tabId, name, value) {
          let tab = context.extension.tabManager.get(tabId);
          let hdrRow = hdrRows.get(name);
          if (!hdrRow) {
            hdrRow = new CustomHdrRow(context, name);
            hdrRows.set(name, hdrRow);
          }
          await hdrRow.addToWindow(tab, value);
        },

        async removeCustomHdrRow(tabId, name) {
          let tab = context.extension.tabManager.get(tabId);
          let hdrRow = hdrRows.get(name);
          if (!hdrRow) {
            return;
          }
          await hdrRow.remove(tab);
        },
      },
    };
  }
};
