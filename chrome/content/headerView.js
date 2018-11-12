Components.utils.import("resource://sendlater3/logging.jsm");

var Sendlater3HeaderView = function() {
    SL3U.initUtil();
    window.removeEventListener("load", Sendlater3HeaderView, false);

    var dtf = SL3U.DateTimeFormatHHMM();

    var sendlater3columnHandler = {
	getCellText: function(row, col) {
	    sl3log.Entering("Sendlater3HeaderView.sendlater3columnHandler.getCellText", row, col);
	    var hdr;
	    if (SL3U.IsPostbox()) {
		var key = gDBView.getKeyAt(row);
		var folder = gDBView.getFolderForViewIndex(row);
		hdr = folder.GetMessageHeader(key);
	    }
	    else {
		hdr = gDBView.getMsgHdrAt(row);
	    }
	    var retval = hdr.getStringProperty("x-send-later-at");
	    if (retval != "") {
		var recur = hdr.getStringProperty("x-send-later-recur");
                var cancelOnReply = hdr.getStringProperty(
                    "x-send-later-cancel-on-reply");
		var retdate = new Date(retval);
                var val = dtf.format(retdate);
		if (recur) {
                    var recurStr = SL3U.FormatRecur(recur, cancelOnReply);
                    if (recurStr)
		        val += " (" + recurStr + ")";
		}
		sl3log.Returning("Sendlater3HeaderView.sendlater3columnHandler.getCellText", val);
		return val;
	    }
	    else {
		sl3log.Returning("Sendlater3HeaderView.sendlater3columnHandler.getCellText", null);
		return null;
	    }
	},

	getSortStringForRow: function(hdr) {
	    sl3log.Entering("Sendlater3HeaderView.sendlater3columnHandler.getSortStringForRow", hdr);
	    return null;
	},
	
	isEditable:          function() {return false;},
	cycleCell:           function(aRow, acol) {},
	isString:            function() {return false;},
	getCellProperties:   function(row, col, props){},
	getImageSrc:         function(row, col) {return null;},
	getRowProperties:    function(row,props){},
	getColumnProperties: function(colid,col,props){},
	getSortLongForRow:   function(hdr) {
	    sl3log.Entering("Sendlater3HeaderView.sendlater3columnHandler.getSortLongForRow", hdr);
	    var dateStr = hdr.getStringProperty("x-send-later-at");
	    if (dateStr) {
		var hdrdate = new Date(dateStr);
		sl3log.Returning("Sendlater3HeaderView.sendlater3columnHandler.getSortLongForRow("+dateStr+")", hdrdate.valueOf()/1000);
		return hdrdate.valueOf()/1000;
	    }
	    else {
		sl3log.Returning("Sendlater3HeaderView.sendlater3columnHandler.getSortLongForRow", 0);
		return 0;
	    }
	}
    }

    function IsThisDraft(msgFolder) {
        uri = (msgFolder == null) ? "null" : msgFolder.URI;
	sl3log.Entering("Sendlater3HeaderView.IsThisDraft", uri);
	if (msgFolder == null) {
	    sl3log.Returning("Sendlater3HeaderView.IsThisDraft",
			   "false (msgFolder == null)");
	    return false;
	}

	var flag;
	try {
	    flag = Components.interfaces.nsMsgFolderFlags.Drafts;
	}
	catch (ex) {
	    // Postbox
	    flag = 0x0400;
	}

	if (msgFolder.isSpecialFolder(flag, false)) {
	    sl3log.Returning("Sendlater3HeaderView.IsThisDraft", "true (special)");
	    return true;
	}

	var accountManager = Components
	    .classes["@mozilla.org/messenger/account-manager;1"]
	    .getService(Components.interfaces.nsIMsgAccountManager);
	var fdrlocal = accountManager.localFoldersServer.rootFolder;
	if (SL3U.FindSubFolder(fdrlocal, "Drafts").URI == msgFolder.URI) {
	    sl3log.Returning("Sendlater3HeaderView.IsThisDraft", "true (local)");
	    return true;
	}
	if (SL3U.PrefService.getCharPref('mail.identity.default.draft_folder')
	    == msgFolder.URI) {
	    sl3log.Returning("Sendlater3HeaderView.IsThisDraft","true (default)");
	    return true;	
	}

	var identities;
	try {
	    identities = accountManager
		.getIdentitiesForServer(msgFolder.server);
	}
	catch (e) {
	    // Before Thunderbird 20
	    identities = accountManager
		.GetIdentitiesForServer(msgFolder.server);
	}

	var idindex;
	var numIdentities;
	try {
	    // Before Thunderbird 20
	    numIdentities = identities.Count();
	}
	catch (e) {
	    numIdentities = identities.length;
	}

	for (idindex = 0;idindex < numIdentities; idindex++) {
	    var identity;
	    try {
		identity = identities
		    .queryElementAt(idindex,
				    Components.interfaces.nsIMsgIdentity);
	    }
	    catch (e) {
		// Before Thunderbird 20
		identity = identities.GetElementAt(idindex)
		    .QueryInterface(Components.interfaces.nsIMsgIdentity);
	    }
	    if (identity.draftFolder == msgFolder.URI) {
		sl3log.Returning("Sendlater3HeaderView.IsThisDraft",
			       "true (identity)");
		return true;
	    }
	}

	sl3log.Returning("Sendlater3HeaderView.IsThisDraft", "false (not found)");
	return false;
    }

    var addColumnHandler = {
        // Components.interfaces.nsIObserver
        observe: function(aMsgFolder, aTopic, aData) {
	    sl3log.Entering("Sendlater3HeaderView.addColumnHandler.observe");
	    gDBView.addColumnHandler("sendlater3-colXSendLaterAt",
				     sendlater3columnHandler);
	    sl3log.Leaving("Sendlater3HeaderView.addColumnHandler.observe");
        }
    }

    function hideShowColumn() {
	sl3log.Entering("Sendlater3HeaderView.hideShowColumn");
	var folder;
	try {
	    folder = gDBView.viewFolder;
	}
	catch (ex) {
	    // TB2 bug
	    sl3log.warn("hideShowColumn: gDBView problem");
	    return;
	}
	if ( IsThisDraft(folder) ) {
	    if (SL3U.getBoolPref("showcolumn")) {
		document.getElementById("sendlater3-colXSendLaterAt").hidden = false;
	    }
	    else {
		document.getElementById("sendlater3-colXSendLaterAt").hidden = true;
	    }
	}
	else {
	    document.getElementById("sendlater3-colXSendLaterAt").hidden = true;
	}
	sl3log.Leaving("Sendlater3HeaderView.hideShowColumn");
    }

    function onBeforeShowHeaderPane() {
        sl3log.Entering("Sendlater3HeaderView.onBeforeShowHeaderPane");
        var hidden = true;
        if (SL3U.getBoolPref("showheader")) {
            sl3log.debug("headerView.js: onBeforeShowHeaderPane: showheader is true");
            if (IsThisDraft(gDBView.viewFolder)) {
                var msghdr;
                try { msghdr = gDBView.hdrForFirstSelectedMessage; }
                catch (e) { msghdr = null; }
                if (msghdr!=null) {
                    var sendat = msghdr.getStringProperty("x-send-later-at");
                    if (sendat) {
                        var xsendlater = new Date(sendat);
                        var val = dtf.format(xsendlater);
                        var recur = msghdr
                            .getStringProperty("x-send-later-recur");
                        var cancelOnReply = msghdr
                            .getStringProperty("x-send-later-cancel-on-reply");
                        recur = SL3U.FormatRecur(recur, cancelOnReply);
                        if (recur)
                            val += " (" + recur + ")";
                        try {
                            document
                                .getElementById("sendlater3-expanded-Box")
                                .headerValue = val;
                            hidden = false;
                            sl3log.debug("headerView.js: " +
                                       "onBeforeShowHeaderPane: " +
                                       "showing header");
                        }
                        catch (e) {
                            if (onBeforeShowHeaderPane.warning) {
                                sl3log.warn(onBeforeShowHeaderPane.warning);
                                onBeforeShowHeaderPane.warning = null;
                            }
                        }
                    }	
                    else {
                        sl3log.debug("headerView.js: onBeforeShowHeaderPane: hiding header (empty)");
                    }
                }
                else {
                    sl3log.debug("headerView.js: onBeforeShowHeaderPane: hiding header (null msghdr)");
                }
            }
            else {
                sl3log.debug("headerView.js: onBeforeShowHeaderPane: hiding header (not draft)");
            }
        }
        else {
            sl3log.debug("headerView.js: onBeforeShowHeaderPane: showheader is false");
        }
        try { document.getElementById(SL3U.HeaderRowId()).hidden = hidden; }
        catch (e) {
            if (onBeforeShowHeaderPane.warning) {
                sl3log.warn(onBeforeShowHeaderPane.warning);
                onBeforeShowHeaderPane.warning = null;
            }
        }
        sl3log.Leaving("Sendlater3HeaderView.sendlater3_HeaderDisplay.onBeforeShowHeaderPane");
    }

    onBeforeShowHeaderPane.warning =
        "headerView.js: onBeforeShowHeaderPane: Error accessing header row; " +
        "are you using an add-on like Mnenhy that changes how message " +
        "headers are displayed? Further warnings will be suppressed.";

    function onBeforeShowHeaderPaneWrapper() {
        sl3log.debug("headerView.js: onBeforeShowHeaderPaneWrapper: Discarding " +
                   "onEndHeaders and replacing onBeforeShowHeaderPane")
        headerListener.onEndHeaders = function() {};
        headerListener.onBeforeShowHeaderPane = onBeforeShowHeaderPane;
        onBeforeShowHeaderPane();
    }
        
    var headerListener = {
        onStartHeaders: function() {},
        onEndHeaders: onBeforeShowHeaderPane,
        onBeforeShowHeaderPane: onBeforeShowHeaderPaneWrapper
    };
    
    gMessageListeners.push(headerListener);
    var ObserverService = Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService);
    ObserverService.addObserver(addColumnHandler, "MsgCreateDBView", false);
    window.document.getElementById('folderTree')
	.addEventListener("select",hideShowColumn,false);
}

window.addEventListener("load", Sendlater3HeaderView, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
