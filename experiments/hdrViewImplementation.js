var ExtensionSupport =
  globalThis.ExtensionSupport ||
  ChromeUtils.import("resource:///modules/ExtensionSupport.jsm")
    .ExtensionSupport;

var thunderbirdVersion = parseInt(Services.appinfo.version.split(".")[0]);

async function tb115(yes, no) {
  if (thunderbirdVersion >= 115) {
    if (yes) {
      if (typeof yes == "function") {
        return yes();
      } else {
        return yes;
      }
    }
  } else {
    if (no) {
      if (typeof no == "function") {
        return no();
      } else {
        return no;
      }
    }
  }
}

class CustomHdrRow {
  constructor(context, name) {
    this.context = context;
    this.name = name;
    this.rowId = ExtensionCommon.makeWidgetId(
      `${context.extension.id}-${name}-custom-hdr`,
    );
  }

  async getDocument(window) {
    return await tb115(
      () => {
        return window.gTabmail.currentAbout3Pane.document.getElementById(
          "messageBrowser",
        ).contentDocument;
      },
      () => {
        return window.document;
      },
    );
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
      await tb115(
        () => {
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
        },
        () => {
          newRowNode = document.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "div",
          );
          newRowNode.setAttribute("id", this.rowId);
          newRowNode.classList.add("message-header-row");

          let newLabelNode = document.createXULElement("label");
          newLabelNode.setAttribute("id", `${this.rowId}-label`);
          newLabelNode.setAttribute("value", this.name);
          newLabelNode.setAttribute("class", "message-header-label");

          newRowNode.appendChild(newLabelNode);

          // Create and append the new header value.
          let newHeaderNode = document.createElement("div", {
            is: "simple-header-row",
          });
          newHeaderNode.setAttribute("id", `${this.rowId}-content`);
          newHeaderNode.dataset.prettyHeaderName = this.name;
          newHeaderNode.dataset.headerName = this.rowId;
          newRowNode.appendChild(newHeaderNode);

          // Add the new row to the extra headers container.
          let topViewNode = document.getElementById("extraHeadersArea");
          topViewNode.appendChild(newRowNode);

          // You can't do this until after you add the node to the DOM because
          // adding it to the DOM causes a magic transformation.
          newHeaderNode.headerValue = value;
        },
      );
    } else {
      await tb115(
        () => {
          let valueNode = document.getElementById(`${this.rowId}Value`);
          valueNode.textContent = value;
        },
        () => {
          let valueNode = document.getElementById(`${this.rowId}-content`);
          valueNode.headerValue = value;
        },
      );
    }
  }
}

var headerView = class extends ExtensionCommon.ExtensionAPI {
  async close() {
    for (let hdrRow of this.hdrRows.values()) {
      for (let window of Services.wm.getEnumerator("mail:3pane")) {
        try {
          await hdrRow.remove(window);
        } catch (ex) {}
      }
    }
  }

  getAPI(context) {
    context.callOnClose(this);
    let hdrRows = new Map();
    this.hdrRows = hdrRows;

    return {
      headerView: {
        async addCustomHdrRow(windowId, name, value) {
          let window = context.extension.windowManager.get(windowId).window;
          let hdrRow = hdrRows.get(name);
          if (!hdrRow) {
            hdrRow = new CustomHdrRow(context, name);
            hdrRows.set(name, hdrRow);
          }
          await hdrRow.addToWindow(window, value);
        },

        async removeCustomHdrRow(windowId, name) {
          let window = context.extension.windowManager.get(windowId).window;
          let hdrRow = hdrRows.get(name);
          if (!hdrRow) {
            return;
          }
          await hdrRow.remove(window);
        },
      },
    };
  }
};
