var Sendlater3HeaderView = function() {
    SL3U.initUtil();

    var sendlater3columnHandler = {
	getCellText: function(row, col) {
	    SL3U.Entering("Sendlater3HeaderView.sendlater3columnHandler.getCellText", row, col);
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
		var retdate = new Date(retval);
		var dateFormatService = Components
		    .classes["@mozilla.org/intl/scriptabledateformat;1"]
                    .getService(Components.interfaces.nsIScriptableDateFormat);
		var val = dateFormatService
		    .FormatDateTime("",
				    dateFormatService.dateFormatShort,
				    dateFormatService.timeFormatNoSeconds,
				    retdate.getFullYear(),
				    retdate.getMonth()+1,
				    retdate.getDate(),
				    retdate.getHours(),
				    retdate.getMinutes(),
				    0);
		if (recur) {
		    val += " (" + SL3U.FormatRecur(recur) + ")";
		}
		SL3U.Returning("Sendlater3HeaderView.sendlater3columnHandler.getCellText", val);
		return val;
	    }
	    else {
		SL3U.Returning("Sendlater3HeaderView.sendlater3columnHandler.getCellText", null);
		return null;
	    }
	},

	getSortStringForRow: function(hdr) {
	    SL3U.Entering("Sendlater3HeaderView.sendlater3columnHandler.getSortStringForRow", hdr);
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
	    SL3U.Entering("Sendlater3HeaderView.sendlater3columnHandler.getSortLongForRow", hdr);
	    var dateStr = hdr.getStringProperty("x-send-later-at");
	    if (dateStr) {
		var hdrdate = new Date(dateStr);
		SL3U.Returning("Sendlater3HeaderView.sendlater3columnHandler.getSortLongForRow("+dateStr+")", hdrdate.valueOf()/1000);
		return hdrdate.valueOf()/1000;
	    }
	    else {
		SL3U.Returning("Sendlater3HeaderView.sendlater3columnHandler.getSortLongForRow", 0);
		return 0;
	    }
	}
    }

    function IsThisDraft(msgFolder) {
        uri = (msgFolder == null) ? "null" : msgFolder.URI;
	SL3U.Entering("Sendlater3HeaderView.IsThisDraft", uri);
	if (msgFolder == null) {
	    SL3U.Returning("Sendlater3HeaderView.IsThisDraft",
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
	    SL3U.Returning("Sendlater3HeaderView.IsThisDraft", "true (special)");
	    return true;
	}

	var accountManager = Components
	    .classes["@mozilla.org/messenger/account-manager;1"]
	    .getService(Components.interfaces.nsIMsgAccountManager);
	var fdrlocal = accountManager.localFoldersServer.rootFolder;
	if (SL3U.FindSubFolder(fdrlocal, "Drafts").URI == msgFolder.URI) {
	    SL3U.Returning("Sendlater3HeaderView.IsThisDraft", "true (local)");
	    return true;
	}
	if (SL3U.PrefService.getCharPref('mail.identity.default.draft_folder')
	    == msgFolder.URI) {
	    SL3U.Returning("Sendlater3HeaderView.IsThisDraft","true (default)");
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
		SL3U.Returning("Sendlater3HeaderView.IsThisDraft",
			       "true (identity)");
		return true;
	    }
	}

	SL3U.Returning("Sendlater3HeaderView.IsThisDraft", "false (not found)");
	return false;
    }

    function addSENDLATER3ColumnHandler() {
	SL3U.Entering("Sendlater3HeaderView.addSENDLATER3ColumnHandler");
	var folder;
	try {
	    folder = gDBView.viewFolder;
	}
	catch (ex) {
	    // TB2 bug
	    SL3U.warn("addSENDLATER3ColumnHandler: gDBView problem");
	    return;
	}
	if ( IsThisDraft(folder) ) {
	    if (SL3U.getBoolPref("showcolumn")) {
		document.getElementById("sendlater3-colXSendLaterAt").hidden = false;
	    }
	    else {
		document.getElementById("sendlater3-colXSendLaterAt").hidden = true;
	    }
	    gDBView.addColumnHandler("sendlater3-colXSendLaterAt",
				     sendlater3columnHandler);
	}
	else {
	    document.getElementById("sendlater3-colXSendLaterAt").hidden = true;
	}
	SL3U.Leaving("Sendlater3HeaderView.addSENDLATER3ColumnHandler");
    }

    function onBeforeShowHeaderPane() {
        SL3U.Entering("Sendlater3HeaderView.onBeforeShowHeaderPane");
        var hidden = true;
        if (SL3U.getBoolPref("showheader")) {
            SL3U.debug("headerView.js: onBeforeShowHeaderPane: showheader is true");
            if (IsThisDraft(gDBView.viewFolder)) {
                var msghdr = gDBView.hdrForFirstSelectedMessage;
                if (msghdr!=null) {
                    var sendat =msghdr.getStringProperty("x-send-later-at");
                    if (sendat) {
                        var xsendlater = new Date(sendat);
                        var val = xsendlater.toLocaleString();
                        var recur = msghdr
                            .getStringProperty("x-send-later-recur");
                        if (recur) {
                            val += " (" + SL3U.FormatRecur(recur) + ")";
                        }
                        document
                            .getElementById("sendlater3-expanded-Box")
                            .headerValue = val;
                        hidden = false;
                        SL3U.debug("headerView.js: onBeforeShowHeaderPane: showing header");
                    }	
                    else {
                        SL3U.debug("headerView.js: onBeforeShowHeaderPane: hiding header (empty)");
                    }
                }
                else {
                    SL3U.debug("headerView.js: onBeforeShowHeaderPane: hiding header (null msghdr)");
                }
            }
            else {
                SL3U.debug("headerView.js: onBeforeShowHeaderPane: hiding header (not draft)");
            }
        }
        else {
            SL3U.debug("headerView.js: onBeforeShowHeaderPane: showheader is false");
        }
        document.getElementById(SL3U.HeaderRowId()).hidden = hidden;
        SL3U.Leaving("Sendlater3HeaderView.sendlater3_HeaderDisplay.onBeforeShowHeaderPane");
    }

    function onBeforeShowHeaderPaneWrapper() {
        SL3U.debug("headerView.js: onBeforeShowHeaderPaneWrapper: Discarding " +
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
    window.document.getElementById('folderTree')
	.addEventListener("select",addSENDLATER3ColumnHandler,false);
}

window.addEventListener("load", Sendlater3HeaderView, false);
window.addEventListener("unload", SL3U.uninitUtil, false);
