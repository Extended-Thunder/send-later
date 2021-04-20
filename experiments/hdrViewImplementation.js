var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
var { ExtensionUtils } = ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");
var { ExtensionError } = ExtensionUtils;
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { NetUtil } = ChromeUtils.import("resource://gre/modules/NetUtil.jsm");

var { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

var HdrRowUtils = {
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
      path: HdrRowUtils.folderURIToPath(folder.URI),
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
    if (HdrRowUtils.contentTypeHeaders.has(msgHdr.messageId))
      contentType = HdrRowUtils.contentTypeHeaders.get(msgHdr.messageId);
    else if (msgHdr.getStringProperty("content-type"))
      contentType = msgHdr.getStringProperty("content-type");
    else
      contentType = getHeader((await HdrRowUtils.getRawMessage(msgHdr)), "content-type");
    HdrRowUtils.contentTypeHeaders.set(msgHdr.messageId, contentType);
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
        "content-type": await HdrRowUtils.getContentType(msgHdr)
      }
    };
    messageObject.folder = HdrRowUtils.convertFolder(msgHdr.folder);
    let tags = msgHdr.getProperty("keywords");
    tags = tags ? tags.split(" ") : [];
    messageObject.tags = tags.filter(MailServices.tags.isValidKey);
    return messageObject;
  }
};

class CustomHdrRow {
  constructor(extensionId, name, tooltip) {
    this.name = name;
    this.tooltip = tooltip;
    this.rowId = ExtensionCommon.makeWidgetId(
      `${extensionId}-${name}-custom-hdr`
    );
    this.handlers = new Set();
  }

  destroy() {
    if (this.destroyed)
      throw new Error("Unable to destroy ExtensionScriptParent twice");

    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      try {
        window.document.getElementById(this.rowId).remove();

        for (let i = 0; i < window.gMessageListeners.length; i++) {
          if (window.gMessageListeners[i].id === this.name) {
            window.gMessageListeners.splice(i, 1);
            console.log('Removed gMessageListener for header row:',this.name);
          }
        }
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
    let document = window.document;
    let newRowNode = document.createElementNS("http://www.w3.org/1999/xhtml", "tr");
    newRowNode.setAttribute("id", this.rowId);
    let newLabelNode = document.createXULElement("label");
    newLabelNode.setAttribute("id", `${this.rowId}-label`);
    newLabelNode.setAttribute("value", this.name);
    newLabelNode.setAttribute("class", "headerName");
    newLabelNode.setAttribute("control", "sendlater-expanded-Box");
    let newTHNode = document.createElementNS("http://www.w3.org/1999/xhtml", "th");
    newTHNode.appendChild(newLabelNode);
    newRowNode.appendChild(newTHNode);

    // Create and append the new header value.
    let newHeaderNode = document.createXULElement("mail-headerfield");
    newHeaderNode.setAttribute("id", `${this.rowId}-content`);
    newHeaderNode.setAttribute("flex", "1");
    let newTDNode = document.createElementNS("http://www.w3.org/1999/xhtml", "td");
    newTDNode.appendChild(newHeaderNode);

    newRowNode.appendChild(newTDNode);

    // This new element needs to be inserted into the view...
    let topViewNode = document.getElementById("expandedHeaders2");
    topViewNode.appendChild(newRowNode);

    for (let handler of this.handlers)
      this.addMsgListenerToWindow(window, handler);
  }

  async addMsgListenerToCurrentWindows(fire) {
    for (let window of Services.wm.getEnumerator("mail:3pane")) {
      await CustomHdrRow.waitForWindow(window);
      this.addMsgListenerToWindow(window, fire);
    }
  }

  addMsgListenerToWindow(window, handler) {
    this.handlers.add(handler);
    let name = this.name;
    let msgListener = {
      id: name,
      onStartHeaders() {},
      onEndHeaders() {}
    };
    msgListener.onBeforeShowHeaderPane = () => {
      window.document.getElementById(this.rowId).hidden = true;
      let msgHdr = window.gDBView.hdrForFirstSelectedMessage;
      if (msgHdr) {
        HdrRowUtils.convertMessage(msgHdr).then(hdr =>
          handler.async(hdr)
        ).then(result => {
            window.document.getElementById(this.rowId).hidden = !result.visible;
            window.document.getElementById(`${this.rowId}-content`).headerValue = result.text;
        }).catch(console.error);
      }
    };
    window.gMessageListeners.push(msgListener);
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

      ExtensionSupport.unregisterWindowListener("customHdrRowWL");
    }

    getAPI(context) {
      context.callOnClose(this);

      ExtensionSupport.registerWindowListener("customHdrRowWL",
        {
          chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
          async onLoadWindow(window) {
            await CustomHdrRow.waitForWindow(window);
            for (let hdrRow of hdrRows.values())
              hdrRow.addToWindow(window);
          }
        });

      let hdrRows = new Map();
      this.hdrRows = hdrRows;

      return {
        headerView: {

          async addCustomHdrRow({ name, tooltip }) {
            if (hdrRows.has(name))
              throw new ExtensionError("Cannot add hdrRows with the same name");
            let hdrRow = new CustomHdrRow(context.extension.id, name, tooltip);
            await hdrRow.addToCurrentWindows();
            hdrRows.set(name, hdrRow);
          },
  
          async removeCustomHdrRow(name) {
            let hdrRow = hdrRows.get(name);
            if (!hdrRow)
              throw new ExtensionError("Cannot remove non-existent hdrRow");
              hdrRow.destroy();
            hdrRows.delete(name);
          },
  
          onHeaderRowUpdate: new ExtensionCommon.EventManager({
            context,
            name: "headerView.onHeaderRowUpdate",
            register: (fire, name) => {
              let hdrRow = hdrRows.get(name);
              if (!hdrRow) {
                throw new ExtensionError(
                  "Cannot add a hdrRow fill handler for a hdrRow that has not been defined"
                );
              }
              hdrRow.addMsgListenerToCurrentWindows(fire).catch(console.error);
              return () => {};
            },
          }).api()
        }
      }
    }
  };