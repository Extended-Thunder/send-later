
var ExtensionSupport = globalThis.ExtensionSupport || ChromeUtils.import(
  "resource:///modules/ExtensionSupport.jsm"
).ExtensionSupport;
// var ExtensionParent = globalThis.ExtensionParent || ChromeUtils.import(
//   "resource://gre/modules/ExtensionParent.jsm"
// ).ExtensionParent;

var LegacyColumn = {

  // ExtensionParent,

  storageLocalMap: new Map(),

  getStorageLocal(key) {
    return this.storageLocalMap.get(key);
  },

  setStorageLocal(key, val) {
    this.storageLocalMap.set(key, val);
  },

  async getRawMessage(hdr) {
    let folder = hdr.folder.QueryInterface(Ci.nsIMsgFolder);
    let messageUri = folder.generateMessageURI(hdr.messageKey);
    const messenger = Cc[
        "@mozilla.org/messenger;1"
    ].createInstance(Ci.nsIMessenger);

    const streamListener = Cc[
        "@mozilla.org/network/sync-stream-listener;1"
    ].createInstance(Ci.nsISyncStreamListener);

    const service = messenger.messageServiceFromURI(messageUri);

    await new Promise((resolve, reject) => {
      service.streamMessage(
        messageUri,
        streamListener,
        null,
        {
          OnStartRunningUrl() {},
          OnStopRunningUrl(url, exitCode) {
            console.debug(
              `LegacyColumn.getRawMessage.streamListener.OnStopRunning ` +
              `received ${streamListener.inputStream.available()} bytes ` +
              `(exitCode: ${exitCode})`
            );
            if (exitCode === 0) {
              resolve();
            } else {
              Cu.reportError(exitCode);
              reject();
            }
          },
        },
        false,
        ""
      );
    }).catch((ex) => {
      console.error(`Error reading message ${messageUri}`,ex);
    });

    const available = streamListener.inputStream.available();
    if (available > 0) {
      const rawMessage = NetUtil.readInputStreamToString(
        streamListener.inputStream,
        available
      );
      return rawMessage;
    } else {
      console.debug(`No data available for message ${messageUri}`);
      return null;
    }
  },

  getHeader(content, header) {
    // Get header's value (e.g. "subject: foo bar    baz" returns "foo bar    baz")
    const regex = new RegExp(`^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,'im');
    const hdrContent = content.split(/\r\n\r\n/m)[0]+'\r\n';
    if (regex.test(hdrContent)) {
      const hdrLine = hdrContent.match(regex)[0];
      return hdrLine.replace(/[^:]*:/m,"").trim();
    } else {
      return undefined;
    }
  },

  checkValidSchedule(hdr) {
    const instanceUUID = this.getStorageLocal("instanceUUID");
    const msgId = hdr.getStringProperty('message-id');
    const CTPropertyName = `content-type-${msgId}`;
    const msgContentType = this.getStorageLocal(CTPropertyName);
    const sendAtStr = hdr.getStringProperty("x-send-later-at");
    const msgUuid = hdr.getStringProperty("x-send-later-uuid");
    let SLStatic = this.SLStatic;
    if (!sendAtStr) {
      return { valid: false, detail: "Not scheduled" };
    } else if (msgUuid !== instanceUUID) {
      return { valid: false, detail: `${msgUuid} != ${instanceUUID}`, msg: SLStatic.i18n.getMessage("incorrectUUID") };
    } else if (!msgContentType) {
      return { valid: false, detail: "Missing ContentType" };
    } else if (/encrypted/i.test(msgContentType)) {
      return { valid: false, detail: "Encrypted", msg: SLStatic.i18n.getMessage("EncryptionIncompatTitle") };
    }
    return { valid: true };
  },

  getSchedule(hdr) {
    const sendAtStr = hdr.getStringProperty("x-send-later-at");
    const recurStr = hdr.getStringProperty("x-send-later-recur");
    const argsStr = hdr.getStringProperty("x-send-later-args");
    const cancelStr = hdr.getStringProperty("x-send-later-cancel-on-reply");

    const schedule = { sendAt: new Date(sendAtStr) };
    schedule.recur = this.SLStatic.parseRecurSpec(recurStr);
    schedule.recur.cancelOnReply = cancelStr === "yes" || cancelStr === "true";
    schedule.recur.args = argsStr;

    return schedule;
  },
}

class MessageViewsCustomColumn {
  constructor(context, name, tooltip) {
    this.context = context;
    this.name = name;
    this.tooltip = tooltip;
    this.columnId = ExtensionCommon.makeWidgetId(
      `${context.extension.id}${name}-custom-column`
    );
    this.visibility = new Map();
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

  static waitForWindow(win) {
    return new Promise(resolve => {
      if (win.document.readyState == "complete")
        resolve();
      else
        win.addEventListener( "load", resolve, { once: true } );
    });
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
      flex: "1",
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

    this.addHandlerToWindow(window);
  }

  addHandlerToWindow(window) {
    let columnHandler = {
      getCellText(row, col) {
        const hdr = window.gDBView.getMsgHdrAt(row);
        const status = LegacyColumn.checkValidSchedule(hdr);

        if (status.detail === "Missing ContentType") {
          // The content-type header is not included in the MsgHdr object, so
          // we need to actually read the whole message, and find it manually.
          LegacyColumn.getRawMessage(hdr).then((rawMessage) => {
            const msgId = hdr.getStringProperty('message-id');
            const CTPropertyName = `content-type-${msgId}`;
            const msgContentType = LegacyColumn.getHeader(rawMessage, "content-type");
            LegacyColumn.setStorageLocal(CTPropertyName, msgContentType);
            window.gDBView.NoteChange(row, 1, 2);
          });
        }

        if (status.valid === true || status.detail === "Missing ContentType") {
          const schedule = LegacyColumn.getSchedule(hdr);
          const cellTxt = LegacyColumn.SLStatic.formatScheduleForUIColumn(schedule);
          return cellTxt;
        } else {
          return status.msg||"";
        }
      },
      getSortStringForRow(hdr) {
        // This should be ignored because isString returns false. Setting it anyway.
        return LegacyColumn.SLStatic.padNum(this.getSortLongForRow(hdr), 12);
      },
      isString() {
        return false;
      },
      getCellProperties(row, col, props) {},
      getRowProperties(row, props) {},
      getImageSrc(row, col) {
        return null;
      },
      getSortLongForRow(hdr) {
        const status = LegacyColumn.checkValidSchedule(hdr);
        if (status.valid === true) {
          const sendAtStr = hdr.getStringProperty("x-send-later-at");
          const sendAt = new Date(sendAtStr);
          // Numbers will be truncated. Be sure this fits in 32 bits
          return (sendAt.getTime()/1000)|0;
        } else if (status.detail === "Missing ContentType") {
          return (Math.pow(2,31)-3)|0;
        } else if (status.detail === "Encrypted") {
          return (Math.pow(2,31)-2)|0;
        } else { // Not scheduled or wrong UUID
          return (Math.pow(2,31)-1)|0;
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

    LegacyColumn = undefined;
    ExtensionSupport.unregisterWindowListener("customColumnWL");
  }

  getAPI(context) {
    context.callOnClose(this);

    let columns = new Map();
    this.columns = columns;

    for (let urlBase of ["utils/sugar-custom.js", "utils/static.js"]) {
      let url = context.extension.rootURI.resolve(urlBase);
      Services.scriptloader.loadSubScript(url, LegacyColumn);
    }

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
            throw new ExtensionUtils.ExtensionError("Cannot add columns with the same name");
          let column = new MessageViewsCustomColumn(context, name, tooltip);
          await column.addToCurrentWindows();
          columns.set(name, column);
        },

        async removeCustomColumn(name) {
          let column = columns.get(name);
          if (!column)
            throw new ExtensionUtils.ExtensionError("Cannot remove non-existent column");
          column.destroy();
          columns.delete(name);
        },

        async setPreference(key, value) {
          LegacyColumn.SLStatic[key] = value;
          LegacyColumn.setStorageLocal(key, value);
        },

        async setColumnVisible(name, visible, applyGlobal) {
          let column = columns.get(name);
          if (!column)
            throw new ExtensionUtils.ExtensionError("Cannot update non-existent column");
          column.setVisible(visible, applyGlobal);
        },
      }
    }
  }
};
