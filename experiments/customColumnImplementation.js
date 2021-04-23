var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { ExtensionUtils } = ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");
var { ExtensionError } = ExtensionUtils;

class MessageViewsCustomColumn {
  constructor(context, name, tooltip) {
    this.context = context;
    this.name = name;
    this.tooltip = tooltip;
    this.columnId = ExtensionCommon.makeWidgetId(
      `${context.extension.id}${name}-custom-column`
    );
    this.visibility = new Map();
    this.handlers = new Set();
    this.msgTracker = new Map();
  }

  destroy() {
    if (this.destroyed)
      throw new Error("Unable to destroy ExtensionScriptParent twice");

    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      try {
        window.document.getElementById(this.columnId + "-splitter").remove();
        window.document.getElementById(this.columnId).remove();
      } catch (ex) {
        console.error(ex);
      }
    }

    if (this.observer !== undefined)
      Services.obs.removeObserver(this.observer, "MsgCreateDBView");

    this.destroyed = true;
  }

  async addToCurrentWindows() {
    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      await MessageViewsCustomColumn.waitForWindow(window);
      this.addToWindow(window);
    }
  }

  async addHandlerToCurrentWindows(fire) {
    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      await MessageViewsCustomColumn.waitForWindow(window);
      this.addHandlerToWindow(window, fire);
    }
  }

  static waitForWindow(win) {
    return new Promise(resolve => {
      if (win.document.readyState == "complete")
        resolve();
      else
        win.addEventListener( "load", resolve, { once: true } );
    });
  }

  async invalidateMessage(messageId) {
    if (this.msgTracker.has(messageId)) {
      let treerow = this.msgTracker.get(messageId);
      this.msgTracker.delete(messageId);
      for (let window of Services.wm.getEnumerator("mail:3pane")) {
        if (window.gDBView)
          window.gDBView.NoteChange(treerow.rowid, 1, 2);
      }
    }
  }

  setVisible(visible, applyGlobal) {
    try {
      let windows;
      if (applyGlobal)
        windows = Services.wm.getEnumerator("mail:3pane")
      else
        windows = [Services.wm.getMostRecentWindow(null)];

      for (let window of windows) {
        for (let id of [this.columnId, `${this.columnId}-splitter`]) {
          let e = window.document.getElementById(id);
          if (e && visible)
            e.removeAttribute("hidden");
          else if (e && !visible)
            e.setAttribute("hidden", "true");
        }
      }
    } catch (ex) {
      console.error("Unable to set column visible",ex);
    }
  }

  addToWindow(window) {
    let treecol = window.document.createXULElement("treecol");
    let column = {
      id: this.columnId,
      flex: 4,
      persist: "width hidden ordinal sortDirection",
      label: this.name,
      tooltiptext: this.tooltip,
    };
    for (let [key, value] of Object.entries(column)) {
      treecol.setAttribute(key, value);
    }
    let parent = window.document.getElementById("threadCols");
    parent.appendChild(treecol);
    let splitter = window.document.createXULElement("splitter");
    splitter.id = this.columnId + "-splitter";
    splitter.classList.add("tree-splitter");
    parent.appendChild(splitter);

    for (let handler of this.handlers)
      this.addHandlerToWindow(window, handler);
  }

  addHandlerToWindow(window, handler) {
    this.handlers.add(handler);

    let getValue = (msgHdr, field, row) => {
      if (this.msgTracker.has(msgHdr.messageId))
        return this.msgTracker.get(msgHdr.messageId)[field];

      let hdr = this.context.extension.messageManager.convert(msgHdr);
      handler.async(hdr).then(result => {
        result.rowid = row;
        this.msgTracker.set(msgHdr.messageId, result);
        if (row !== undefined)
          window.gDBView.NoteChange(row, 1, 2);
      }).catch(console.error);

      return null;
    };

    let columnHandler = {
      getCellText(row, col) {
        let msgHdr = window.gDBView.getMsgHdrAt(row);
        return getValue(msgHdr, "cellText", row)||"";
      },
      getSortStringForRow(msgHdr) {
        return null;
      },
      isString() {
        false;
      },
      getCellProperties(row, col, props) {},
      getRowProperties(row, props) {},
      getImageSrc(row, col) {
        return null;
      },
      getSortLongForRow(msgHdr) {
        // Note: "firm"-coding this for now
        // (i.e. hard coding backup values to fill
        //  before the cache has been populated).
        let sendAt = msgHdr.getStringProperty("x-send-later-at");
        let contentType = msgHdr.getStringProperty("content-type");
        let sorter = getValue(msgHdr, "sortValue");
        if (sorter !== null) {
          return sorter|0;
        } else if ((/encrypted/i).test(contentType)) {
          return (Math.pow(2,31)-1)|0;
        } else if (sendAt) {
          return ((new Date(sendAt)).getTime()/1000)|0;
        } else {
          return (Math.pow(2,31)-5)|0;
        }
      },
    };
    let columnId = this.columnId;

    this.observer = {
      observe(aMsgFolder, aTopic, aData) {
        if (window.gDBView)
          window.gDBView.addColumnHandler(columnId, columnHandler);
      }
    };

    Services.obs.addObserver(this.observer, "MsgCreateDBView", false);

    if (window.gDBView)
      this.observer.observe();
  }
}

var columnHandler = class extends ExtensionCommon.ExtensionAPI {
  close() {
    for (let column of this.columns.values())
      try {
        column.destroy();
      } catch (ex) {
        console.error("Unable to destroy column:",ex);
      }

    ExtensionSupport.unregisterWindowListener("customColumnWL");
  }

  getAPI(context) {
    context.callOnClose(this);

    let columns = new Map();
    this.columns = columns;

    ExtensionSupport.registerWindowListener("customColumnWL",
      {
        chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
        async onLoadWindow(window) {
          await MessageViewsCustomColumn.waitForWindow(window);
          for (let column of columns.values())
            column.addToWindow(window);
        }
      });

    return {
      columnHandler: {

        async addCustomColumn({ name, tooltip }) {
          if (columns.has(name))
            throw new ExtensionError("Cannot add columns with the same name");
          let column = new MessageViewsCustomColumn(context, name, tooltip);
          await column.addToCurrentWindows();
          columns.set(name, column);
        },

        async removeCustomColumn(name) {
          let column = columns.get(name);
          if (!column)
            throw new ExtensionError("Cannot remove non-existent column");
          column.destroy();
          columns.delete(name);
        },

        async invalidateMessage(id) {
          let msgHdr = context.extension.messageManager.get(id);
          for (let column of columns.values()) {
            column.invalidateMessage(msgHdr.messageId);
          }
        },

        async setColumnVisible(name, visible, applyGlobal) {
          let column = columns.get(name);
          if (!column)
            throw new ExtensionError("Cannot update non-existent column");
          column.setVisible(visible, applyGlobal);
        },

        onCustomColumnFill: new ExtensionCommon.EventManager({
          context,
          name: "columnHandler.onCustomColumnFill",
          register: (fire, name) => {
            let column = columns.get(name);
            if (!column) {
              throw new ExtensionError(
                "Cannot add a column fill handler for a column that has not been defined"
              );
            }
            column.addHandlerToCurrentWindows(fire).catch(console.error);
            return () => {};
          },
        }).api()
      }
    }
  }
};