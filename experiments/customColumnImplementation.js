var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { ExtensionUtils } = ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");
var { ExtensionError } = ExtensionUtils;
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { NetUtil } = ChromeUtils.import("resource://gre/modules/NetUtil.jsm");

var { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "gJunkThreshold",
  "mail.adaptivefilters.junk_threshold",
  90
);

var CustomColumnUtils = {

  msgTrackers: new Map(),

  contentTypeHeaders: new Map(),

  folderURIToPath(uri) {
    let path = Services.io.newURI(uri).filePath;
    return path.split("/").map(decodeURIComponent).join("/");
  },

  convertFolder(folder, accountId) {
    if (!folder) {
      return null;
    }
    if (!accountId) {
      let server = folder.server;
      let account = MailServices.accounts.FindAccountForServer(server);
      accountId = account.key;
    }

    let folderObject = {
      accountId,
      name: folder.prettyName,
      path: CustomColumnUtils.folderURIToPath(folder.URI),
    };

    const folderTypeMap = new Map([
      [Ci.nsMsgFolderFlags.Inbox, "inbox"],
      [Ci.nsMsgFolderFlags.Drafts, "drafts"],
      [Ci.nsMsgFolderFlags.SentMail, "sent"],
      [Ci.nsMsgFolderFlags.Trash, "trash"],
      [Ci.nsMsgFolderFlags.Templates, "templates"],
      [Ci.nsMsgFolderFlags.Archive, "archives"],
      [Ci.nsMsgFolderFlags.Junk, "junk"],
      [Ci.nsMsgFolderFlags.Queue, "outbox"],
    ]);

    for (let [flag, typeName] of folderTypeMap.entries()) {
      if (folder.flags & flag) {
        folderObject.type = typeName;
      }
    }

    return folderObject;
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
            if (exitCode === 0) {
              resolve();
            } else {
              console.debug(
                `SendLaterHeaderView.getRawMessage.streamListener.OnStopRunning ` +
                `received ${streamListener.inputStream.available()} bytes ` +
                `(exitCode: ${exitCode})`
              );
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
      return null;
    }
  },

  async getContentType(msgHdr) {
    // from SLStatic
    const getHeader = (content, header) => {
      // Get header's value (e.g. "subject: foo bar    baz" returns "foo bar    baz")
      const regex = new RegExp(`^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,'im');
      const hdrContent = content.split(/\r\n\r\n/m)[0]+'\r\n';
      if (regex.test(hdrContent))
        return (hdrContent.match(regex)[0]).replace(/[^:]*:/m,"").trim();
      else
        return undefined;
    };

    let contentType;
    if (CustomColumnUtils.contentTypeHeaders.has(msgHdr.messageId))
      contentType = CustomColumnUtils.contentTypeHeaders.get(msgHdr.messageId);
    else if (msgHdr.getStringProperty("content-type"))
      contentType = msgHdr.getStringProperty("content-type");
    else
      contentType = getHeader((await CustomColumnUtils.getRawMessage(msgHdr)), "content-type");
    CustomColumnUtils.contentTypeHeaders.set(msgHdr.messageId, contentType);
    return contentType;
  },

  /** From ext-mail.js
  * Converts an nsIMsgHdr to a simle object for use in messages.
  * This function WILL change as the API develops.
  * @return {Object}
  */
  async convertMessage(msgHdr) {
    if (!msgHdr)
      return null;

    let composeFields = Cc[
      "@mozilla.org/messengercompose/composefields;1"
    ].createInstance(Ci.nsIMsgCompFields);
    let junkScore = parseInt(msgHdr.getProperty("junkscore"), 10) || 0;

    let messageObject = {
      // id: messageTracker.getId(msgHdr),
      date: new Date(msgHdr.dateInSeconds * 1000),
      author: msgHdr.mime2DecodedAuthor,
      recipients: composeFields.splitRecipients(
        msgHdr.mime2DecodedRecipients,
        false
      ),
      ccList: composeFields.splitRecipients(msgHdr.ccList, false),
      bccList: composeFields.splitRecipients(msgHdr.bccList, false),
      subject: msgHdr.mime2DecodedSubject,
      read: msgHdr.isRead,
      flagged: msgHdr.isFlagged,
      junk: junkScore >= gJunkThreshold,
      junkScore,
      headerMessageId: msgHdr.messageId,
      customHeaders: {
        "x-send-later-at": msgHdr.getStringProperty("x-send-later-at"),
        "x-send-later-recur": msgHdr.getStringProperty("x-send-later-recur"),
        "x-send-later-args": msgHdr.getStringProperty("x-send-later-args"),
        "x-send-later-cancel-on-reply": msgHdr.getStringProperty("x-send-later-cancel-on-reply"),
        "x-send-later-uuid": msgHdr.getStringProperty("x-send-later-uuid"),
        "content-type": await CustomColumnUtils.getContentType(msgHdr)
      }
    };
    messageObject.folder = CustomColumnUtils.convertFolder(msgHdr.folder);
    let tags = msgHdr.getProperty("keywords");
    tags = tags ? tags.split(" ") : [];
    messageObject.tags = tags.filter(MailServices.tags.isValidKey);
    return messageObject;
  }
};

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
  }

  setVisible(visible, tabId) {
    try {
      let windows;
      if (tabId === -1)
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

  addHandlerToWindow(window, fire) {
    this.handlers.add(fire);

    let getValue = (msgHdr, field, row) => {
      if (CustomColumnUtils.msgTrackers.has(msgHdr.messageId))
        return CustomColumnUtils.msgTrackers.get(msgHdr.messageId)[field];

      CustomColumnUtils.convertMessage(msgHdr).then(msg =>
        fire.async(msg)
      ).then(result => {
        result.rowid = row;
        CustomColumnUtils.msgTrackers.set(msgHdr.messageId, result);
        if (row !== undefined)
          window.gDBView.NoteChange(row, 1, 2);
      }).catch(console.error);
      return "";
    };

    let columnHandler = {
      getCellText(row, col) {
        let msgHdr = window.gDBView.getMsgHdrAt(row);
        return getValue(msgHdr, "cellText", row);
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
        if (sorter !== "") {
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

    ExtensionSupport.registerWindowListener("customColumnWL",
      {
        chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
        async onLoadWindow(window) {
          await MessageViewsCustomColumn.waitForWindow(window);
          for (let column of columns.values())
            column.addToWindow(window);
        }
      });

    let columns = new Map();
    this.columns = columns;

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

        async invalidateRow(messageId) {
          if (CustomColumnUtils.msgTrackers.has(messageId)) {
            let treerow = CustomColumnUtils.msgTrackers.get(messageId);
            CustomColumnUtils.msgTrackers.delete(messageId);

            for (let window of Services.wm.getEnumerator("mail:3pane")) {
              if (window.gDBView)
                window.gDBView.NoteChange(treerow.rowid, 1, 2);
            }
          }
        },

        async setColumnVisible(name, visible, tabId) {
          let column = columns.get(name);
          if (!column)
            throw new ExtensionError("Cannot update non-existent column");
          column.setVisible(visible, tabId);
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