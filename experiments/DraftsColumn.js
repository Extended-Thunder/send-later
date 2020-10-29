//"use strict";

// Much of this script inspired by/copied from the MessagePreview addon.

 var { utils: Cu, classes: Cc, interfaces: Ci } = Components;
 var { AppConstants } = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
 var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
 var gMessenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

 var SLDraftsColumn = {
   e(elementId) {
     return document.getElementById(elementId);
   },

   DE_BUG: false,

   get addonId() {
     return "sendlater3@kamens.us";
   },

   get obsTopicStorageLocal() {
     return `extension:${this.addonId}:storage-local`;
   },

   get obsNotificationReadyTopic() {
     return `extension:${this.addonId}:ready`;
   },

   get columnId() {
     return "sendLaterCol";
   },

   get Column() {
     return this.e(this.columnId);
   },

   get TreeColumn() {
     return GetThreadTree().columns[this.columnId];
   },

   get threadTreeChildren() {
     return GetThreadTree().getElementsByTagName("treechildren")[0];
   },

   /*
    *  Preferences.
    */
   get storageLocalMap() {
     return this._storageLocalMap || new Map();
   },

   set storageLocalMap(val) {
     this._storageLocalMap = val;
   },

   getStorageLocal(key) {
     return this.storageLocalMap.get(key);
   },

   get scheduleTooltipEnabledPref() {
     let prefKey = "scheduleTooltipEnabled";
     let prefValue = this.getStorageLocal(prefKey);
     let defaultValue = true;
     if (prefValue == undefined) {
       return defaultValue;
     }
     return prefValue;
   },

   get scheduleTextEnabledPref() {
     let prefKey = "scheduleTextEnabled";
     let prefValue = this.getStorageLocal(prefKey);
     let defaultValue = false;
     if (prefValue == undefined) {
       return defaultValue;
     }
     return prefValue;
   },

   // Must be true for schedule to be shown (checked in options) unless the
   // message is available offline.
   get imapAllowDownloadPref() {
     let prefKey = "imapAllowDownload";
     let prefValue = this.getStorageLocal(prefKey);
     let defaultValue = true;
     if (prefValue == undefined) {
       return defaultValue;
     }
     return prefValue;
   },

   // No reason not to be true.
   get imapSaneBodySize() {
     return true;
   },

   // Must be false for schedule to be shown, to allow a download if the message
   // isn't available locally.
   get imapPartsOnDemand() {
     return false;
   },

   // Throws if false for nntp.
   get encryptedParts() {
     return true;
   },

   imapNoAccess(msgHdr) {
     let server = msgHdr.folder.server;
     if (server.type != "imap") {
       return false;
     }
     let imapLoggedIn = server.QueryInterface(Ci.nsIImapServerSink)
       .userAuthenticated;
     return Boolean(!this.imapAllowDownloadPref || !imapLoggedIn);
   },

   /*
    * Strings.
    */

   getLocaleMessage(key, substitutions) {
     console.log("Returning locale message for "+key+": "+this.getStorageLocal(key));
     return this.getStorageLocal(key)||("UNDEFINED: "+key);
   },

   /*
    * Schedule.
    */
   // Schedule strings.
   get scheduleTitle() {
     return "Send Later";
   },
   get scheduleTitleNA() {
     return "Send Later not available.";
   },
   get scheduleNoAccess() {
     return "You are not logged in or have disallowed IMAP downloads";
   },
   get scheduleNNTP() {
     return "Send Later not available for newsgroups (NNTP)";
   },
   scheduleError(error) {
     return "Error checking headers: "+error;
   },

   onLoad() {
     console.debug("onLoad: START ");

     Services.obs.addObserver(this.Observer, this.obsTopicStorageLocal);
     Services.obs.notifyObservers(null, this.obsNotificationReadyTopic);

     Services.obs.addObserver(this.Observer, "MsgCreateDBView");
     Services.prefs.addObserver("mail.pane_config.dynamic", this.Observer);
     FolderDisplayListenerManager.registerListener(this.FolderDisplayListener);
     let tabmail = this.e("tabmail");
     if (tabmail) {
       tabmail.registerTabMonitor(this.TabMonitor);
     }

     AddonManager.addAddonListener(this.AddonListener);
     console.debug("onLoad: done ");
   },

   onUnload() {
     console.debug("onUnload: " + this.obsTopicStorageLocal);
     // RemoveObservers()
     if (gDBView) {
       try {
         gDBView.removeColumnHandler(this.columnId);
       } catch (ex) {
         // If not registered, there's an exception; it's ok.
       }
     }
     Services.obs.removeObserver(this.Observer, this.obsTopicStorageLocal);
     Services.obs.removeObserver(this.Observer, "MsgCreateDBView");
     Services.prefs.removeObserver("mail.pane_config.dynamic", this.Observer);

     FolderDisplayListenerManager.unregisterListener(this.FolderDisplayListener);
     let tabmail = this.e("tabmail");
     if (tabmail) {
       tabmail.unregisterTabMonitor(this.TabMonitor);
     }

     AddonManager.removeAddonListener(this.AddonListener);

     // RestoreOverrideFunctions()

     // RestoreOverlayElements()
     this.Column.remove();
     document.getElementById(`sortBy_${this.columnId}`).remove();

     // Remove iconic column sort indicators.
     let iconicTreecols = this.e("threadCols").querySelectorAll(
       "treecol.treecol-image"
     );
     for (let col of iconicTreecols) {
       if (col.lastElementChild.classList.contains("treecol-sortdirection")) {
         col.lastElementChild.remove();
       }
       if (col.lastElementChild.nodeName == "spring") {
         col.lastElementChild.remove();
       }
     }

     console.debug("onUnload: DONE");
   },

   InitializeOverlayElements() {
     console.debug("InitializeOverlayElements");
     if (this.TreeColumn) {
       return;
     }

     // console.debug("InitializeOverlayElements --> sendLaterCol");
     let label = this.getLocaleMessage("sendLaterColumnLabel");
     let tooltip = this.getLocaleMessage("sendLaterColumnTooltip");

     const splitter = window.document.createXULElement("splitter");
     splitter.setAttribute("class","tree-splitter");
     const col = window.document.createXULElement("treecol");
     col.id = this.columnId;
     col.setAttribute("persist","ordinal width");
     col.setAttribute("currentView","unthreaded");
     col.setAttribute("flex","1");
     col.setAttribute("width","32");
     col.setAttribute("closemenu","none");
     col.setAttribute("label",label);
     col.setAttribute("tooltiptext",tooltip);
     const treeCols = window.document.getElementById("threadCols");
     treeCols.appendChild(splitter);
     treeCols.appendChild(col);

     if (this.e(this.columnId)) {
       console.log("Added column element.");
     } else {
       console.warn("Column element is missing...");
     }

     // Restore persisted attributes: hidden ordinal sortDirection width.
     let attributes = Services.xulStore.getAttributeEnumerator(
       document.URL,
       this.columnId
     );
     for (let attribute of attributes) {
       let value = Services.xulStore.getValue(
         document.URL,
         this.columnId,
         attribute
       );
       this.Column.setAttribute(attribute, value);
     }
   },

   /*
    * Initialize the column display elements, and run on layout change which
    * recreates the custom element and loses this DOM change.
    */
   UpdateColumnElement() {
     let column = this.Column;
     let icon = column.querySelector(".treecol-icon");
     // console.debug("UpdateColumnElement: " + Boolean(icon));
     if (!icon) {
       // Add the icon if it's not already there.
       column.insertBefore(
         MozXULElement.parseXULToFragment(`
           <image class="treecol-icon"/>
           <spring flex="1"/>
         `),
         column.firstElementChild
       );
     }

     // // Fix Bug 323067.
     // let updateIconColumn = column => {
     //   if (
     //     !column.lastElementChild.classList.contains("treecol-sortdirection")
     //   ) {
     //     column.append(
     //       MozXULElement.parseXULToFragment(`
     //         <spring flex="1"/>
     //         <image class="treecol-sortdirection"/>
     //       `)
     //     );
     //   }
     // };
     //
     // let iconicTreecols = this.e("threadCols").querySelectorAll(
     //   "treecol.treecol-image"
     // );
     // for (let col of iconicTreecols) {
     //   updateIconColumn(col);
     // }
   },

   /*
    * Set the secondary sort indicator, on MsgCreateDBView, onSortChanged,
    * and on TabSwitched. Take care to handle custom columns.
    */
   UpdateSecondarySortIndicator() {
     // console.log("UpdateSecondarySortIndicator: START ");
     if (!gDBView) {
       return;
     }
     let curSecondarySortCol = this.e("threadCols").querySelector(
       "treecol[sortDirectionSecondary]"
     );
     if (curSecondarySortCol) {
       curSecondarySortCol.removeAttribute("sortDirectionSecondary");
     }

     let secondarySortCol;
     let secondarySortOrder =
       gDBView.secondarySortOrder == Ci.nsMsgViewSortOrder.ascending
         ? "ascending"
         : "descending";
     if (gFolderDisplay.view.showGroupedBySort) {
       // No secondary sorts within grouped view. Rather, it is always
       // byDate ascending.
       secondarySortCol = ConvertSortTypeToColumnID(Ci.nsMsgViewSortType.byDate);
       secondarySortOrder = "ascending";
     } else if (gDBView.secondarySortType == Ci.nsMsgViewSortType.byCustom) {
       secondarySortCol = gDBView.secondaryCustomColumn;
     } else {
       secondarySortCol = ConvertSortTypeToColumnID(gDBView.secondarySortType);
     }

     let col = this.e(secondarySortCol);
     // console.log(
     //   "UpdateSecondarySortIndicator: secondarySortCol:secondarySortOrder " +
     //     secondarySortCol +
     //     ":" +
     //     secondarySortOrder
     // );
     if (!col) {
       return;
     }
     if (
       gDBView.sortType == Ci.nsMsgViewSortType.byCustom &&
       gDBView.secondarySortType == Ci.nsMsgViewSortType.byCustom &&
       gDBView.curCustomColumn != gDBView.secondaryCustomColumn
     ) {
       // Make sure two custom column sorts display as expected.
       if (AppConstants.platform != "macosx") {
         // Cannot use this on osx. But on win/linux, the sort direction icon is
         // handled by css nicely.
         col.setAttribute("sortDirection", secondarySortOrder);
       }
       col.setAttribute("sortDirectionSecondary", secondarySortOrder);
       return;
     }
     if (
       gDBView.sortType != Ci.nsMsgViewSortType.byId &&
       gDBView.sortType != gDBView.secondarySortType &&
       !(
         gDBView.secondarySortType == Ci.nsMsgViewSortType.byId &&
         gDBView.secondarySortOrder == Ci.nsMsgViewSortOrder.descending
       )
     ) {
       // If sort is other than byId unique key, update secondary sort. Don't
       // show secondary if it's the same as primary (byDate) and if descending
       // byId (Order Received), which is not accurate.
       if (AppConstants.platform != "macosx") {
         // Cannot use this on osx. But on win/linux, the sort direction icon is
         // handled by css nicely.
         col.setAttribute("sortDirection", secondarySortOrder);
       }
       col.setAttribute("sortDirectionSecondary", secondarySortOrder);
     }
   },

   /*
    * Observer for custom column, show allBodyParts pref and layout change,
    * localeMessages and storageLocal (from experiments.js).
    */
   Observer: {
     observe(subject, topic, data) {
       console.debug(`observing: ${subject} ${topic}`);
       if (topic == "MsgCreateDBView") {
         // console.debug("Observer: " + topic + ", data - " + data);
         SLDraftsColumn.onMsgCreateDBView();
       } else if (
         topic == "nsPref:changed" &&
         data == "mail.pane_config.dynamic"
       ) {
         // console.debug("Observer: " + topic + ", data - " + data);
         window.setTimeout(() => SLDraftsColumn.UpdateColumnElement(), 100);
       } else if (topic == SLDraftsColumn.obsTopicStorageLocal) {
         SLDraftsColumn.storageLocalMap = new Map(JSON.parse(data));
         SLDraftsColumn.localeMessagesMap = new Map();
         SLDraftsColumn.InitializeOverlayElements();
       }
     },
   },

   TabMonitor: {
     monitorName: "SLDraftsColumn",
     onTabTitleChanged() {},
     onTabSwitched(tab, oldTab) {
       console.debug("onTabSwitched: title - " + tab.title);
       if (tab.mode.type == "folder" || tab.mode.name == "glodaList") {
         SLDraftsColumn.UpdateSecondarySortIndicator();
       }
     },
   },

   FolderDisplayListener: {
     onSortChanged(folderDisplay) {
       console.debug("onSortChanged: START ");
       SLDraftsColumn.UpdateSecondarySortIndicator();
     },
   },

   /*
    * Listener for addon status changes.
    */
   AddonListener: {
     resetSession(addon, who) {
       if (addon.id != SLDraftsColumn.addonId) {
         return;
       }
       // console.debug("AddonListener.resetSession: who - " + who);
       SLDraftsColumn.onUnload();
       console.info("[SendLater] Deregistering drafts column overlay");
     },
     onUninstalling(addon) {
       this.resetSession(addon, "onUninstalling");
     },
     onInstalling(addon) {
       this.resetSession(addon, "onInstalling");
     },
     onDisabling(addon) {
       this.resetSession(addon, "onDisabling");
     },
     // The listener is removed so these aren't run; they aren't needed as the
     // addon is installed by the addon system and runs our backgound.js loader.
     onEnabling(addon) {},
     onOperationCancelled(addon) {},
   },

   onMsgCreateDBView() {
     console.debug("[SendLater] in function onMsgCreateDBView");
     if (!gDBView) {
       return;
     }

     const showColumnPref = this.getStorageLocal("showColumn");
     const isDrafts = (gDBView.viewFolder !== null && gDBView.viewFolder.flags & Ci.nsMsgFolderFlags.Drafts);
     if (showColumnPref && isDrafts) {
       this.e(this.columnId).hidden = false;
       gDBView.addColumnHandler(SLDraftsColumn.columnId, SLDraftsColumn);
       // console.log("onMsgCreateDBView: addColumnHandler --> sendLaterCol");
       window.setTimeout(() => {
         SLDraftsColumn.UpdateColumnElement();
         SLDraftsColumn.UpdateSecondarySortIndicator();
       });
     } else {
       console.info('Hiding Send Later column.');
       window.setTimeout(()=>{this.e(this.columnId).hidden = true;});
     }
   },

   MsgSortByThisColumn() {
     if (gDBView && gDBView.db) {
       gDBView.db.dBFolderInfo.setProperty("customSortCol", this.columnId);
     }
     MsgSortThreadPane("byCustom");
   },

   setTooltip(tooltiptext) {
     this.threadTreeChildren.setAttribute("tooltiptext", tooltiptext);
     this.threadTreeChildren.setAttribute("tooltiptextowner", this.columnId);
   },

   removeTooltip(owner) {
     if (this.threadTreeChildren.getAttribute("tooltiptextowner") == owner) {
       this.threadTreeChildren.removeAttribute("tooltiptext");
       this.threadTreeChildren.removeAttribute("tooltiptextowner");
       // console.debug("removeTooltip: removed tooltip for - " + this.columnId);
     }
   },

   /**
    * nsITreeview.
    */
   isString() {
     return false;
   },
   isEditable(row, col) {
     return false;
   },
   cycleCell(row, col) {},
   getRowProperties(row) {
     return "";
   },
   getSortLongForRow(msgHdr) {
     if (this.hasSchedule(msgHdr)) {
       const schedule = this.getSchedule(msgHdr);
       if (schedule !== null && schedule.sendAt !== undefined) {
         return schedule.sendAt.getTime();
       } else {
         return Number.MAX_SAFE_INTEGER;
       }
     }
   },

   // getSortStringForRow(msgHdr) {
   //   // console.debug("getSortStringForRow: START ");
   //   return null;
   // },

   getImageSrc(row, col) {
     return null;
   },

   getCellProperties(row, col) {
     if (
       row < 0 ||
       row >= gDBView.rowCount ||
       !col ||
       col.id != this.columnId ||
       this.isGroupedBySortHdr(row)
     ) {
       return null;
     }

     // console.debug("getCellProperties: col - " + col.id);
     let props = [];
     props.push(this.columnId);

     let msgHdr = gDBView.getMsgHdrAt(row);
     // console.debug("getCellProperties: row:messageKey:gettingSchedule - " +
     //               row + ":" + msgHdr.messageKey + ":" +
     //               this.getInfo(msgHdr, "gettingSchedule"));
     if (this.getInfo(msgHdr, "gettingSchedule") !== undefined) {
       props.push("gettingSchedule");
       // console.debug("getCellProperties: messageKey:props - " +
       //               msgHdr.messageKey + ":" + props);
       return props.join(" ");
     }

     if (this.hasSchedule(msgHdr)) {
       props.push("hasOne");
     } else if (this.hasError(msgHdr)) {
       props.push("error");
     } else {
       props.push("unknown");
     }

     // If no imap access show no access decoration.
     if (this.imapNoAccess(msgHdr)) {
       props.push("allNoAccess");
       // console.debug("getCellProperties: messageKey:props - " +
       //               msgHdr.messageKey + ":" + props);
     }

     if (row == this.scheduleRow) {
       props.push("scheduleing");
     }
     // console.debug("getCellProperties: messageKey:row:scheduleRow - " +
     //               msgHdr.messageKey + ":" + row + ":" + this.scheduleRow);
     // console.debug("getCellProperties: messageKey:props:schedule - " +
     //               msgHdr.messageKey + ":" + props + ":" + schedule);

     return props.join(" ");
   },

   getCellText(row, col) {
     if (
       row < 0 ||
       row >= gDBView.rowCount ||
       !col ||
       col.id != this.columnId ||
       this.isGroupedBySortHdr(row)
     ) {
       return null;
     }
     // console.debug("getCellText: col - " + col.id);
     let msgHdr = gDBView.getMsgHdrAt(row);

     if (
       this.getInfo(msgHdr, "gettingSchedule") !== undefined ||
       this.imapNoAccess(msgHdr)
     ) {
       return null;
     }

     const schedule = this.getSchedule(msgHdr, row);
     return this.formatSchedule(schedule);
   },

   parseRawMessage(content) {
     const contentType = ""+content.match(/^content-type:[ ]*(.*)/im)[1];
     const regex = /(x-send-later-[a-z\-]*):[ ]*([^\r\n]*)/img;
     const hdrs = [...content.matchAll(regex)].reduce(
        (a,c)=>{ a[c[1].toLowerCase().trim()]=c[2]; return a; }, {});
     let schedule = { contentType };
     if (hdrs['x-send-later-at'] !== undefined) {
       schedule.sendAt = new Date(hdrs['x-send-later-at']);
       if (hdrs['x-send-later-recur']) {
        schedule.recur = SLStatic.parseRecurSpec(hdrs['x-send-later-recur']);
        schedule.recur.cancelOnReply = (hdrs['x-send-later-cancel-on-reply'] === "yes" ||
                                        hdrs['x-send-later-cancel-on-reply'] === "true");
        schedule.recur.args = hdrs['x-send-later-args'];
       }
     }
     return schedule;
   },

   formatSchedule(schedule) {
     if (schedule !== null && schedule['sendAt'] !== undefined) {
       return SLStatic.formatScheduleForUIColumn(schedule);
     } else {
       return "";
     }
   },

   isGroupedBySortHdr(row) {
     return (
       gFolderDisplay.view.showGroupedBySort &&
       row >= 0 &&
       (gDBView.isContainer(row) || gDBView.getLevel(row) == 0)
     );
   },

   /*
    * Perhaps use a synthetic mouse event instead, as tooltips time out for
    * long attachment reads.
    */
   invalidateCell(row, col, who) {
     if (row == -1) {
       return;
     }
     // console.debug("invalidateCell: DONE row:col.id:who - " +
     //               row + ":" + col.id + ":" + who);
     GetThreadTree().invalidateCell(row, col);
   }, // nsITreeview.

   hasSchedule(msgHdr) {
     return this.getInfo(msgHdr, "sendLater") !== undefined;
   },

   hasError(msgHdr) {
     return this.getInfo(msgHdr, "error") !== undefined;
   },

   getSchedule(msgHdr, row) {
     //console.debug("[SendLater] in function getSchedule(msgHdr, row)");
     // No msgHdr.
     if (!(msgHdr instanceof Ci.nsIMsgDBHdr)) {
       console.debug("[SendLater] getSchedule: Invalid header");
       return null;
     }
     // console.debug("getSchedule: START messageKey - " + msgHdr.messageKey);

     // For IMAP, not allowing download throws in MsgHdrToMimeMessage, and if
     // not signed in can't get the message. Show the appropriate tooltip
     // for schedule unavailable.
     if (msgHdr.folder.server.type == "imap") {
       if (this.imapNoAccess(msgHdr)) {
         let schedule = this.scheduleNoAccess;
         console.debug("getSchedule: IMAP no access, schedule - " + schedule);
         this.setInfo(msgHdr, "sendLater", schedule);
         this.gettingSchedule = false;

         return schedule;
       }
       // console.debug("getSchedule: IMAP OK, schedule - " + schedule);

       // If we have imap access, clear out the old tooltip for when we may not
       // have had access, if it is cached.
       if (this.getInfo(msgHdr, "sendLater") == this.scheduleNoAccess) {
         this.delInfo(msgHdr, "sendLater");
       }
     }

     let hasSchedule = this.hasSchedule(msgHdr);
     // console.debug("getSchedule: schedule:messageKey - " +
     //               schedule + ":" + msgHdr.messageKey);

     // Return the already cached schedule.
     if (hasSchedule) {
       return this.getInfo(msgHdr, "sendLater");
     }

     // console.debug("getSchedule: no schedule, CONTINUE ");

     // If neither option to display the schedule is enabled, don't get it if it
     // isn't already cached.
     if (!this.scheduleTooltipEnabledPref && !this.scheduleTextEnabledPref) {
       return null;
     }

     if (this.getInfo(msgHdr, "gettingSchedule") !== undefined) {
       return null;
     }
     this.setInfo(msgHdr, "gettingSchedule", row);
     this.invalidateCell(row, this.TreeColumn, "getSchedule");
     // console.debug(
     //   "getSchedule: schedule, scheduleRow:row - " + this.scheduleRow + ":" + row
     // );

     if (msgHdr.folder.server.type == "nntp") {
       this.schedule(msgHdr);
     } else {
       const getMsg = (async () => {
         let msgURI = msgHdr.folder.getUriForMsg(msgHdr);
         let msgService = gMessenger.messageServiceFromURI(msgURI);
         let streamListener = Cc[
             "@mozilla.org/network/sync-stream-listener;1"
           ].createInstance(Ci.nsISyncStreamListener);
         await new Promise((resolve, reject) => {
           msgService.streamMessage(
             msgURI,
             streamListener,
             null,
             {
               OnStartRunningUrl() {},
               OnStopRunningUrl(url, exitCode) {
                 if (exitCode !== 0) {
                   Cu.reportError(exitCode);
                   reject();
                   return;
                 }
                 resolve();
               },
             },
             false,
             "");
         }).catch((ex) => {
           console.error(`Error reading message `+ex);
         });

         let content = NetUtil.readInputStreamToString(
           streamListener.inputStream, streamListener.available());
         const schedule = this.parseRawMessage(content);
         this.setInfo(msgHdr, "sendLater", schedule);
         this.refreshView(msgHdr, this.getInfo(msgHdr, "sendLater"), "getSchedule");
       }).bind(this);
       getMsg();
     }

     return null;
   },

   getInfo(msgHdr, info) {
     // No msgHdr.
     if (!(msgHdr instanceof Ci.nsIMsgDBHdr)) {
       return undefined;
     }
     let msgKey = msgHdr.messageKey;
     let folderKey = msgHdr.folder.URI;
     if (
       !this._cache ||
       !(folderKey in this._cache) ||
       !(msgKey in this._cache[folderKey]) ||
       !(info in this._cache[folderKey][msgKey])
     ) {
       return undefined;
     }
     return this._cache[folderKey][msgKey][info];
   },

   setInfo(msgHdr, info, val) {
     let msgKey = msgHdr.messageKey;
     let folderKey = msgHdr.folder.URI;
     if (!this._cache) {
       this._cache = {};
     }
     if (!(folderKey in this._cache)) {
       this._cache[folderKey] = {};
     }
     if (!(msgKey in this._cache[folderKey])) {
       this._cache[folderKey][msgKey] = {};
     }
     this._cache[folderKey][msgKey][info] = val;
   },
   delInfo(msgHdr, info) {
     let msgKey = msgHdr.messageKey;
     let folderKey = msgHdr.folder.URI;
     if (
       !this._cache ||
       !(folderKey in this._cache) ||
       !(msgKey in this._cache[folderKey])
     ) {
       return;
     }
     delete this._cache[folderKey][msgKey][info];
   },

   // Schedule.
   _cache: {},
   scheduleRow: -1,
   gettingSchedule: false,

   /*
    * @param {String} url - The url.
    */
   urlHasCredentials(url) {
     let uri = makeURI(url);
     return Boolean(uri.username || uri.userPass);
   },

   /*
    * This is the imap://, mailbox://, news:// url for network requests.
    */
   getMsgUrlFromMsgHdr(msgHdr) {
     // No msgHdr.
     if (!(msgHdr instanceof Ci.nsIMsgDBHdr)) {
       return null;
     }
     let msgUri = msgHdr.folder.getUriForMsg(msgHdr);
     let msgService = messenger.messageServiceFromURI(msgUri);
     let urlObj = {};
     msgService.GetUrlForUri(msgUri, urlObj, null);
     let msgUrl = urlObj.value.spec;
     // console.debug("getMsgUrlFromMsgHdr: msgUrl - " + msgUrl);
     return msgUrl;
   },

   refreshView(msgHdr, schedule, who) {
     console.debug("[SendLater] in function refreshView(msgHdr, schedule, who)");
     // console.debug(
     //  "refreshView: messageKey:who - " + msgHdr.messageKey + ":" + who
     // );
     //this.setTooltip(this.formatSchedule(schedule));
     this.gettingSchedule = false;
     // console.dir(this._cache[msgHdr.folder.URI][msgHdr.messageKey]);
     let row = this.getInfo(msgHdr, "gettingSchedule");
     /* eslint-disable */
     // console.debug("refreshView: messageKey:row:who - " +
     //              msgHdr.messageKey + ":" + row + ":" + who);
     /* eslint-enable */
     if (this.hasSchedule(msgHdr)) {
       this.delInfo(msgHdr, "error");
     }
     if (this.hasError(msgHdr)) {
       this.delInfo(msgHdr, "sendLater");
     }
     if (this.hasSchedule(msgHdr) || this.hasError(msgHdr)) {
       this.delInfo(msgHdr, "gettingSchedule");
     }
     this.invalidateCell(row, this.TreeColumn, who);
   },

   async schedule(msgHdr) {
     console.debug("[SendLater] in function schedule(msgHdr)");
     let schedule;
     let hasSchedule = this.hasSchedule(msgHdr);
     if (hasSchedule) {
       // console.debug("schedule: EXISTS, messageKey:schedule - " +
       //               msgHdr.messageKey + "\n" + schedule);
       schedule = this.getInfo(msgHdr, "sendLater");
       this.refreshView(msgHdr, schedule, "schedule:exists");
       return;
     }

     let msgUrl = this.getMsgUrlFromMsgHdr(msgHdr);

     if (!msgUrl) {
       schedule = this.scheduleTitleNA + "\n\n";
       this.setInfo(msgHdr, "sendLater", schedule);
       this.refreshView(msgHdr, schedule, "schedule:single info");
       return;
     }

     // NOTE: For internal mailbox://, imap://, news:// urls  get the content
     // with getReader().read(). For urls with credentials (username, userPass)
     // such as imap, use a different method, as Request fails such urls with a
     // MSG_URL_HAS_CREDENTIALS error.
     if (this.urlHasCredentials(msgUrl) || msgHdr.folder.server.type == "nntp") {
       // console.debug("schedule: msgUrl has credentials - " + msgUrl);
       this._asyncFetch(msgHdr, msgUrl);
       return;
     }

     await this._fetch(msgHdr, msgUrl);
   },

   /*
    * Use fetch() api to read an attachment part, if it has no credentials.
    *
    * @param {nsIMsgHdr} msgHdr              - The msgHdr.
    * @param {String} msgUrl                 - The url.
    */
   async _fetch(msgHdr, msgUrl) {
     console.debug("[SendLater] in function _fetch");
     let options = { method: "GET" };
     let request = new Request(msgUrl, options);
     let schedule;
     let errorMessage;

     await fetch(request)
       .then(response => {
         if (!response.ok) {
           errorMessage = response.statusText + ", url - " + response.url;
           // console.warn("_fetch: fetch response error - " + errorMessage);
           return null;
         }
         // console.dir(response);
         return response;
       })
       .then(async response => {
         if (!response) {
           return;
         }
         // console.dir(response);
         // The below reads a stream. The first chunk is more than enough for
         // a schedule, so don't bother draining the stream, just cancel it.
         let reader = response.body.getReader();
         let decoder = new TextDecoder("utf-8");
         // let { value: chunk, done: readerDone } = await reader.read();
         let content = ""; // decoder.decode(chunk);
         while (true) {
           //reader.cancel();
           let { value: chunk, done: readerDone } = await reader.read();
           content += decoder.decode(chunk);
           // console.debug("_fetch: readerDone - " + readerDone);
           if (readerDone) {
             break;
           }
         }
         schedule = this.parseRawMessage(content);
         this.setInfo(msgHdr, "sendLater", schedule);
         this.refreshView(msgHdr, schedule, "_fetch:success");
       })
       .catch(error => {
         errorMessage = error.message;
         console.warn("_fetch: error - ", errorMessage);
       });

     if (errorMessage) {
       schedule = this.scheduleError(errorMessage);
       this.setInfo(msgHdr, "error", schedule);
       this.refreshView(msgHdr, schedule, "_fetch:error");
     }
   },

   /*
    * Use xpcom api to read an attachment part, if it has credentials.
    * TODO: maybe one day mailnews urls will be fixed to not have creds and we
    * can use fetch().
    *
    * @param {nsIMsgHdr} msgHdr              - The msgHdr.
    * @param {String} msgUrl                 - The url.
    */
   _asyncFetch(msgHdr, msgUrl) {
     console.debug("[SendLater] in function _asyncFetch(msgHdr, msgUrl)");
     let channel = NetUtil.newChannel({
       uri: msgUrl,
       loadingPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
       securityFlags: Ci.nsILoadInfo.SEC_REQUIRE_SAME_ORIGIN_DATA_INHERITS,
       contentPolicyType: Ci.nsIContentPolicy.TYPE_OTHER,
     });

     NetUtil.asyncFetch(channel, (inputStream, resultCode) => {
       let schedule;
       let errorMessage;
       if (Components.isSuccessCode(resultCode)) {
         try {
           let content = NetUtil.readInputStreamToString(
             inputStream,
             inputStream.available(),
             {
               charset: "utf-8",
               replacement:
                 Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER,
             }
           );
           console.debug("[SendLater] in function _fetch");
           schedule = this.parseRawMessage(content);
           this.setInfo(msgHdr, "sendLater", schedule);
           this.refreshView(msgHdr, schedule, "_fetch:success");
         } catch (ex) {
           errorMessage = ex.message;
           console.error("_asyncFetch: error - " + msgHdr.messageKey, ex);
         }
       } else {
         errorMessage = resultCode;
       }

       if (errorMessage) {
         schedule = this.scheduleError(errorMessage);
         this.setInfo(msgHdr, "error", schedule);
         this.refreshView(msgHdr, schedule, "_asyncFetch:error");
       }
     });
   },
 }; // SLDraftsColumn

 // console.debug("SLDraftsColumn: readystate - " + window.document.readyState);
 if (window.document.readyState == "complete") {
   SLDraftsColumn.onLoad();
   SLDraftsColumn.onMsgCreateDBView();
 } else {
   window.addEventListener(
     "load",
     () => { SLDraftsColumn.onLoad(); },
     { once: true }
   );
 }
