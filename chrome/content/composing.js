var Sendlater3Composing = {
    sComposeMsgsBundle: null,

    composeListener: {
	NotifyComposeBodyReady: function() {
	    gContentChanged = true;
	    AutoSave();
	    gContentChanged = false;
	    if (SL3U.getBoolPref("show_edit_alert")) {
		SL3U.alert(window, null,
			   SL3U.PromptBundleGet("draftSaveWarning"));
	    }
	},
	NotifyComposeFieldsReady: function() {},
	ComposeProcessDone: function() {},
	SaveInFolderDone: function() {}
    },

    CheckSendAt2: function(where, send_button) {
	SL3U.Entering("Sendlater3Composing.CheckSendAt2(from " + where + ")");
	Sendlater3Composing.CheckSendAt(send_button);
    },

    setBindings: {
	observe: function() {
	    if (! SL3U.getBoolPref("alt_binding")) {
		document.getElementById("key_sendLater")
		    .setAttribute("oncommand",
				  "Sendlater3Composing.CheckSendAt2('key_sendLater binding created in Sendlater3Composing.setBindings.observe')");
		document.getElementById("sendlater3-key_sendLater3")
		    .setAttribute("disabled", true);
	    }
	    else {
		document.getElementById("key_sendLater")
		    .setAttribute("oncommand", "Sendlater3Composing.builtInSendLater();");
		document.getElementById("sendlater3-key_sendLater3")
		    .setAttribute("disabled", false);
	    }
	}
    },

    builtInSendLater: function() {
	document.getElementById("msgcomposeWindow")
	    .setAttribute("sending_later", true);
	goDoCommand("cmd_sendLater");
    },

    main: function() {
	SL3U.initUtil();

	sComposeMsgsBundle = document.getElementById("bundle_composeMsgs");

	function CheckForXSendLater() {
	    SL3U.Entering("Sendlater3Composing.main.CheckforXSendLater");
	    Sendlater3Composing.prevXSendLater = false;
	    Sendlater3Composing.prevRecurring = false;
	    if (gMsgCompose != null) {
		var msgCompFields = gMsgCompose.compFields;
		if (msgCompFields && msgCompFields.draftId!="") {
		    var messageURI = msgCompFields.draftId.replace(/\?.*/, "");
		    SL3U.dump("Checking " + messageURI);
		    var accountManager = Components
			.classes["@mozilla.org/messenger/account-manager;1"]
			.getService(Components.interfaces
				    .nsIMsgAccountManager);
		    var messenger = Components
			.classes["@mozilla.org/messenger;1"]
			.getService(Components.interfaces.nsIMessenger);
		    var content = "";
		    var MsgService = messenger
			.messageServiceFromURI(messageURI);
		    var messageHDR = messenger.msgHdrFromURI(messageURI);
		    var hdr = messageHDR.getStringProperty("x-send-later-at");
		    if (hdr) {
			Sendlater3Composing.prevXSendLater = new Date(hdr);
			gMsgCompose.RegisterStateListener(Sendlater3Composing
							  .composeListener);
		    }
		    hdr = messageHDR.getStringProperty("x-send-later-recur");
		    if (hdr)
			Sendlater3Composing.prevRecurring = hdr;
			
		    SL3U.dump("prevXSendLater= " +
			      Sendlater3Composing.prevXSendLater +
			      ", prevRecurring=" +
			      Sendlater3Composing.prevRecurring);
		}
	    }
	    SL3U.PrefService.addObserver(SL3U.pref("alt_binding"),
					 Sendlater3Composing.setBindings,
					 false);
	    Sendlater3Composing.setBindings.observe();
	    SL3U.Leaving("Sendlater3Composing.main.CheckforXSendLater");
	}                            

	var mysleventListener = {
	    handleEvent : function(event) {
		var msgcomposeWindow = document
		    .getElementById("msgcomposeWindow");
		msgcomposeWindow.removeAttribute("sending_later");
		msgcomposeWindow.removeAttribute("sl3_send_button");
		CheckForXSendLater(); 
	    } 
	}

	var sendMessageListener = {
	    handleEvent: function(event) {
		var msgcomposeWindow = document
		    .getElementById("msgcomposeWindow");
		if (msgcomposeWindow.getAttribute("sending_later")) {
		    msgcomposeWindow.removeAttribute("sending_later");
		    return;
		}
		var msgtype = msgcomposeWindow.getAttribute("msgtype");
		if ((msgtype == nsIMsgCompDeliverMode.Now ||
		     msgtype == nsIMsgCompDeliverMode.Background) &&
		    SL3U.getBoolPref("sendbutton")) {
		    Sendlater3Composing.CheckSendAt2("Sendlater3Composing.main.sendMessageListener.handleEvent condition #1", true);
		    event.preventDefault();
		}
		if (msgtype == nsIMsgCompDeliverMode.Later) {
		    Sendlater3Composing.CheckSendAt2("Sendlater3Composing.main.sendMessageListener.handleEvent condition #2", true);
		    event.preventDefault();
		}
	    }
	}

	var msgcomposeWindow = document.getElementById("msgcomposeWindow");
	msgcomposeWindow.addEventListener("compose-window-init",
					  mysleventListener, false);
	// When window is first loaded compose-window-init is not generated.
	mysleventListener.handleEvent(null);
	if (! SL3U.IsThunderbird2()) {
	    // This doesn't work on Thunderbird 2, since its
	    // GenericSendFunction doesn't check PreventDefault.
	    msgcomposeWindow.addEventListener("compose-send-message",
					      sendMessageListener, false);
	}

	if (typeof(DoSpellCheckBeforeSend) == 'function' &&
	    DoSpellCheckBeforeSend !=
	    Sendlater3Composing.MyDoSpellCheckBeforeSend) {
	    Sendlater3Composing.OldDoSpellCheckBeforeSend =
		DoSpellCheckBeforeSend;
	    DoSpellCheckBeforeSend =
		Sendlater3Composing.MyDoSpellCheckBeforeSend;
	}
    },

    CheckSendAt: function(send_button) {
	SL3U.Entering("Sendlater3Composing.CheckSendAt");
	if (send_button)
	    document.getElementById("msgcomposeWindow")
		.setAttribute("sl3_send_button", true);
	else
	    document.getElementById("msgcomposeWindow")
		.removeAttribute("sl3_send_button");
	window.openDialog("chrome://sendlater3/content/prompt.xul",
			  "SendAtWindow", "modal,chrome,centerscreen", 
			  { finishCallback: Sendlater3Composing.SendAtTime,
			    continueCallback: function() {
				var w = document
				    .getElementById("msgcomposeWindow");
				w.setAttribute("sending_later", true);
			      Sendlater3Composing.ContinueSendLater();
			    },
			    sendCallback: function() {
				var w = document
				    .getElementById("msgcomposeWindow");
				w.setAttribute("sending_later", true);
				SendMessage();
			    },
			    cancelCallback: Sendlater3Composing.CancelSendLater,
			    previouslyTimed: Sendlater3Composing.prevXSendLater,
			    previouslyRecurring: Sendlater3Composing.prevRecurring,
 });
	SL3U.Leaving("Sendlater3Composing.CheckSendAt");
    },

    ReallySendAtTimer: null,
    ReallySendAtClosure: null,
    ReallySendAtCallback: {
	notify: function (timer) {
	    SL3U.Entering("Sendlater3Composing.ReallySendAtCallback.notify", timer);
	    var sendat = Sendlater3Composing.ReallySendAtClosure.at;
	    var recur = Sendlater3Composing.ReallySendAtClosure.recur;

	    // If it has been at least a week since we last asked the
	    // user to donate, and the user has scheduled at least
	    // five messages since the last time we asked, and the
	    // user hasn't previously told us to stop asking, pop up a
	    // donation dialog.
	    var p1 = "ask.time";
	    var p2 = "ask.sent";
	    var last_ask = SL3U.getIntPref(p1);
	    var sent = SL3U.getIntPref(p2);
	    var now = Math.round((new Date()).getTime() / 1000);
	    if ((sent >= 4) && (last_ask > 0) &&
		(now - last_ask >= 60 * 60 * 24 * 7)) {
		SL3U.setIntPref(p1, now);
		SL3U.setIntPref(p2, 0);
		window.openDialog("chrome://sendlater3/content/ask.xul",
				  "AskWindow", "modal,chrome,centerscreen", {});
	    }
	    else if (sent > -1) {
		if (last_ask == 0) {
		    SL3U.setIntPref(p1, now);
		}
		SL3U.setIntPref(p2, sent + 1);
	    }

	    gCloseWindowAfterSave = true;
	    var identity = getCurrentIdentity();
	    if (SL3U.IsPostbox()) {
		Sendlater3Composing.GenericSendMessagePostbox(
		    nsIMsgCompDeliverMode.SaveAsDraft,
		    sendat, recur);
	    }
	    else if (SL3U.IsThunderbird2()) {
		Sendlater3Composing.GenericSendMessageTB2(
		    nsIMsgCompDeliverMode.SaveAsDraft,
		    sendat, recur);
	    }
	    else {
		Sendlater3Composing.GenericSendMessage(
		    nsIMsgCompDeliverMode.SaveAsDraft,
		    sendat, recur);
	    }

	    SL3U.SetUpdatePref(identity.key);
	    defaultSaveOperation = "draft";
	    SL3U.Leaving("Sendlater3Composing.ReallySendAtCallback.notify");
	}
    },

    RecurHeader: function(sendat, recur) {
	var header = "X-Send-Later-Recur: " + recur;
	switch (recur) {
	case "monthly":
	    header += " " + sendat.getDate();
	    break;
	case "yearly":
	    header += " " + sendat.getMonth() + " " + sendat.getDate();
	    break;
	}
	header += "\r\n";
	return header;
    },

    SendAtTime: function(sendat, recur_value) {
	SL3U.Entering("Sendlater3Composing.SendAtTime", sendat, recur_value);
	Sendlater3Composing.ReallySendAtClosure = { at: sendat,
						    recur: recur_value };
	Sendlater3Composing.ReallySendAtTimer = Components
	    .classes["@mozilla.org/timer;1"]
	    .createInstance(Components.interfaces.nsITimer);
	Sendlater3Composing.ReallySendAtTimer.initWithCallback(
	    Sendlater3Composing.ReallySendAtCallback,
	    500,
	    Components.interfaces.nsITimer.TYPE_ONE_SHOT
	);
	SL3U.Leaving("Sendlater3Composing.SendAtTime");
    },

    ContinueSendLaterTimer: null,
    ContinueSendLaterCallback: {
	notify: function (timer) {
	    SL3U.Entering("Sendlater3Composing.ContinueSendLaterCallback.notify");
	    goDoCommand('cmd_sendLater');
	    SL3U.Leaving("Sendlater3Composing.ContinueSendLaterCallback.notify");
	}
    },

    ContinueSendLater: function() {
	SL3U.Entering("Sendlater3Composing.ContinueSendLater");
	Sendlater3Composing.ContinueSendLaterTimer = Components
	    .classes["@mozilla.org/timer;1"]
	    .createInstance(Components.interfaces.nsITimer);
	Sendlater3Composing.ContinueSendLaterTimer.initWithCallback(
	    Sendlater3Composing.ContinueSendLaterCallback,
	    500,
	    Components.interfaces.nsITimer.TYPE_ONE_SHOT
	);
	SL3U.Leaving("Sendlater3Composing.ContinueSendLater");
    },

    CancelSendLater: function() {},

    prevXSendLater: false,
    prevRecurring: false,

    MyDoSpellCheckBeforeSend: function() {
	var msgcomposeWindow = document
	    .getElementById("msgcomposeWindow");
	if (msgcomposeWindow.getAttribute("sl3_send_button"))
	    return false;
	if (Sendlater3Composing.OldDoSpellCheckBeforeSend === undefined)
	    return SL3U.PrefService.getBoolPref("mail.SpellCheckBeforeSend");
	else
	    return Sendlater3Composing.OldDoSpellCheckBeforeSend();
    },

    // Copied from MsgComposeCommands.js in Fedora 10 Thunderbird
    // 2.0.0.23.
    // SENDLATER3 CHANGED: Added "TB2" to end of function name, added
    // "sendat", "recur" arguments.
    GenericSendMessageTB2: function( msgType, sendat, recur )
    {
      dump("GenericSendMessage from XUL\n");

      dump("Identity = " + getCurrentIdentity() + "\n");

      if (gMsgCompose != null)
      {
	var msgCompFields = gMsgCompose.compFields;
	if (msgCompFields)
	{
	  Recipients2CompFields(msgCompFields);

	  // BEGIN SENDLATER3 ADDED
	  var head = "X-Send-Later-At: " + SL3U.FormatDateTime(sendat,true) +
		"\r\n" + "X-Send-Later-Uuid: " + SL3U.getInstanceUuid() +"\r\n";
	  if (recur) {
	      head += Sendlater3Composing.RecurHeader(sendat, recur);
	  }
	  msgCompFields.otherRandomHeaders += head;
	  // END SENDLATER3 ADDED

	  var subject = GetMsgSubjectElement().value;
	  msgCompFields.subject = subject;
	  Attachments2CompFields(msgCompFields);

	  if (msgType == nsIMsgCompDeliverMode.Now || msgType == nsIMsgCompDeliverMode.Later
	      // BEGIN SENDLATER3 ADDED
	      // Note that when this function is called, msgType will
	      // always be SaveAsDraft, but I'm just adding this condition
	      // here rather than getting rid of the conditional to keep
	      // the number of changes to the copied code as small as
	      // possible, to make it easier to merge new versions of that
	      // code in later.
	      || msgType == nsIMsgCompDeliverMode.SaveAsDraft
	      // END SENDLATER3 ADDED
	     )
	  {
	    //Do we need to check the spelling?
	    if (sPrefs.getBoolPref("mail.SpellCheckBeforeSend"))
	    {
	      // We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
	      // therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
	      SetMsgBodyFrameFocus();
	      window.cancelSendMessage = false;
	      try {
		window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank",
			"chrome,close,titlebar,modal", true, true);
	      }
	      catch(ex){}
	      if(window.cancelSendMessage)
		return;
	    }

	    // Check if we have a subject, else ask user for confirmation
	    if (subject == "")
	    {
	      if (gPromptService)
	      {
		var result = {value:sComposeMsgsBundle.getString("defaultSubject")};
		if (gPromptService.prompt(
			window,
			sComposeMsgsBundle.getString("sendMsgTitle"),
			sComposeMsgsBundle.getString("subjectDlogMessage"),
			result,
			null,
			{value:0}))
		{
		  msgCompFields.subject = result.value;
		  var subjectInputElem = GetMsgSubjectElement();
		  subjectInputElem.value = result.value;
		}
		else
		  return;
	      }
	    }

	    // check if the user tries to send a message to a newsgroup through a mail account
	    var currentAccountKey = getCurrentAccountKey();
	    var account = gAccountManager.getAccount(currentAccountKey);
	    if (!account)
	    {
	      throw "UNEXPECTED: currentAccountKey '" + currentAccountKey +
		  "' has no matching account!";
	    }
	    var servertype = account.incomingServer.type;

	    if (servertype != "nntp" && msgCompFields.newsgroups != "")
	    {
	      // default to ask user if the pref is not set
	      var dontAskAgain = sPrefs.getBoolPref("mail.compose.dontWarnMail2Newsgroup");

	      if (!dontAskAgain)
	      {
		var checkbox = {value:false};
		var okToProceed = gPromptService.confirmCheck(
				      window,
				      sComposeMsgsBundle.getString("sendMsgTitle"),
				      sComposeMsgsBundle.getString("recipientDlogMessage"),
				      sComposeMsgsBundle.getString("CheckMsg"),
				      checkbox);

		if (!okToProceed)
		  return;

		if (checkbox.value)
		  sPrefs.setBoolPref(kDontAskAgainPref, true);
	      }

	      // remove newsgroups to prevent news_p to be set
	      // in nsMsgComposeAndSend::DeliverMessage()
	      msgCompFields.newsgroups = "";
	    }

	    // Before sending the message, check what to do with HTML message, eventually abort.
	    var convert = DetermineConvertibility();
	    var action = DetermineHTMLAction(convert);
	    // check if e-mail addresses are complete, in case user
	    // has turned off autocomplete to local domain.
	    if (!CheckValidEmailAddress(msgCompFields.to, msgCompFields.cc, msgCompFields.bcc))
	      return;

	    if (action == nsIMsgCompSendFormat.AskUser)
	    {
	      var recommAction = (convert == nsIMsgCompConvertible.No)
				 ? nsIMsgCompSendFormat.AskUser
				 : nsIMsgCompSendFormat.PlainText;
	      var result2 = {action:recommAction,
			     convertible:convert,
			     abort:false};
	      window.openDialog("chrome://messenger/content/messengercompose/askSendFormat.xul",
				"askSendFormatDialog", "chrome,modal,titlebar,centerscreen",
				result2);
	      if (result2.abort)
		return;
	      action = result2.action;
	    }

	    // we will remember the users "send format" decision
	    // in the address collector code (see nsAbAddressCollecter::CollectAddress())
	    // by using msgCompFields.forcePlainText and msgCompFields.useMultipartAlternative
	    // to determine the nsIAbPreferMailFormat (unknown, plaintext, or html)
	    // if the user sends both, we remember html.
	    switch (action)
	    {
	      case nsIMsgCompSendFormat.PlainText:
		msgCompFields.forcePlainText = true;
		msgCompFields.useMultipartAlternative = false;
		break;
	      case nsIMsgCompSendFormat.HTML:
		msgCompFields.forcePlainText = false;
		msgCompFields.useMultipartAlternative = false;
		break;
	      case nsIMsgCompSendFormat.Both:
		msgCompFields.forcePlainText = false;
		msgCompFields.useMultipartAlternative = true;
		break;
	       default: dump("\###SendMessage Error: invalid action value\n"); return;
	    }
	  }

	  // hook for extra compose pre-processing
	  var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	  observerService.notifyObservers(window, "mail:composeOnSend", null);

	  // Check if the headers of composing mail can be converted to a mail charset.
	  if (msgType == nsIMsgCompDeliverMode.Now || 
	    msgType == nsIMsgCompDeliverMode.Later ||
	    msgType == nsIMsgCompDeliverMode.Save || 
	    msgType == nsIMsgCompDeliverMode.SaveAsDraft || 
	    msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft || 
	    msgType == nsIMsgCompDeliverMode.SaveAsTemplate) 
	  {
	    var fallbackCharset = new Object;
	    if (gPromptService && 
		!gMsgCompose.checkCharsetConversion(getCurrentIdentity(), fallbackCharset)) 
	    {
	      var dlgTitle = sComposeMsgsBundle.getString("initErrorDlogTitle");
	      var dlgText = sComposeMsgsBundle.getString("12553");  // NS_ERROR_MSG_MULTILINGUAL_SEND
	      var result3 = gPromptService.confirmEx(window, dlgTitle, dlgText,
		  (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_0) +
		  (gPromptService.BUTTON_TITLE_CANCEL * gPromptService.BUTTON_POS_1) +
		  (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_2),
		  sComposeMsgsBundle.getString('sendInUTF8'), 
		  null,
		  sComposeMsgsBundle.getString('sendAnyway'), null, {value:0}); 
	      switch(result3)
	      {
		case 0: 
		  fallbackCharset.value = "UTF-8";
		  break;
		case 1:  // cancel
		  return;
		case 2:  // send anyway
		  msgCompFields.needToCheckCharset = false;
		  break;
	      }
	    }
	    if (fallbackCharset && 
		fallbackCharset.value && fallbackCharset.value != "")
	      gMsgCompose.SetDocumentCharset(fallbackCharset.value);
	  }
	  try {

	    // just before we try to send the message, fire off the compose-send-message event for listeners
	    // such as smime so they can do any pre-security work such as fetching certificates before sending
	    var event = document.createEvent('Events');
	    event.initEvent('compose-send-message', false, true);
	    // SENDLATER3 ADDED
	    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
	    msgcomposeWindow.setAttribute("sending_later", true);
	    // END SENDLATER3 ADDED
	    // SENDLATER3 CHANGED: Use msgcomposeWindow variable instead of
	    // calling document.getElementById("msgcomposeWindow").
	    msgcomposeWindow.dispatchEvent(event);
	    gAutoSaving = (msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft);
	    // disable the ui if we're not auto-saving
	    if (!gAutoSaving)
	    {
	      gWindowLocked = true;
	      disableEditableFields();
	      updateComposeItems();
	    }
	    // if we're auto saving, mark the body as not changed here, and not
	    // when the save is done, because the user might change it between now
	    // and when the save is done.
	    else 
	      SetContentAndBodyAsUnmodified();

	    var progress = Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);
	    if (progress)
	    {
	      progress.registerListener(progressListener);
	      gSendOrSaveOperationInProgress = true;
	    }
	    msgWindow.SetDOMWindow(window);
	    msgWindow.rootDocShell.allowAuth = true;
	    // SENDLATER3 ADDED
	    var type = gMsgCompose.type;
	    var originalURI = gMsgCompose.originalMsgURI;
	    // END SENDLATER3 ADDED
	    gMsgCompose.SendMsg(msgType, getCurrentIdentity(), currentAccountKey, msgWindow, progress);
	    // SENDLATER3 ADDED
	    Sendlater3Composing.SetReplyForwardedFlag(type,
						      originalURI);
	    // END SENDLATER3 ADDED
	  }
	  catch (ex) {
	    dump("failed to SendMsg: " + ex + "\n");
	    gWindowLocked = false;
	    enableEditableFields();
	    updateComposeItems();
	  }
	}
      }
      else
	dump("###SendMessage Error: composeAppCore is null!\n");
    },

    // Copied from mail/components/compose/content/MsgComposeCommands.js
    // in Postbox 2 source.
    // SENDLATER3 CHANGED: Added "Postbox" to end of function name; added
    // "sendat", "recur" arguments.
    GenericSendMessagePostbox: function(msgType, sendat, recur,
				  aDontClearReferencesOnSubjectChange)
    {
      dump("GenericSendMessage from XUL\n");

      dump("Identity = " + getCurrentIdentity() + "\n");

      if (gMsgCompose != null)
      {
	// if we are in the middle of an auto save then abort it
	if (msgType != nsIMsgCompDeliverMode.AutoSaveAsDraft && gAutoSaveKickedIn)
	  gMsgCompose.abort();

	var msgCompFields = gMsgCompose.compFields;
	if (msgCompFields)
	{
	  Recipients2CompFields(msgCompFields);

	  // BEGIN SENDLATER3 ADDED
	  var head = "X-Send-Later-At: " + SL3U.FormatDateTime(sendat,true) +
		"\r\n" + "X-Send-Later-Uuid: " + SL3U.getInstanceUuid() +"\r\n";
	  if (recur) {
	      head += Sendlater3Composing.RecurHeader(sendat, recur);
	  }
	  msgCompFields.otherRandomHeaders += head;
	  // END SENDLATER3 ADDED

	  var subject = GetMsgSubjectElement().value;
	  // if the subject has changed, clear the references.
	  // unless the new subject begins with "Re: ", in which case this might be someone fixing the subject on a reply
	  // see bug #3051 and bug #3552 for details
	  if (!aDontClearReferencesOnSubjectChange && (msgCompFields.subject != subject) && (subject.substr(0, 4).toLowerCase() != "re: "))
	  {
	    msgCompFields.references = "";
	    // if this was a reply, change it to be a new message
	    // so that we don't mark the original message as replied in nsMsgCompose::ProcessReplyFlags()
	    // see bug #3541 for details
	    if (gMsgCompose.type == nsIMsgCompType.Reply ||
		gMsgCompose.type == nsIMsgCompType.ReplyAll ||
		gMsgCompose.type == nsIMsgCompType.ReplyToList ||
		gMsgCompose.type == nsIMsgCompType.ReplyToGroup ||
		gMsgCompose.type == nsIMsgCompType.ReplyToSender ||
		gMsgCompose.type == nsIMsgCompType.ReplyToSenderAndGroup)
	    {  
	      gMsgCompose.type = nsIMsgCompType.New;
	    }
	  }
	  msgCompFields.subject = subject;
	  Attachments2CompFields(msgCompFields);

	  // save off the tag state
	  gMsgCompose.compFields.tagKeys = gTagKeys;
	  var globalIndex = Cc['@mozilla.org/msg-global-index;1'].getService(Ci.nsIMsgGlobalIndex);
	  globalIndex.log("gTagKeys on send = " + gTagKeys);

	  if (msgType == nsIMsgCompDeliverMode.Now ||
	      msgType == nsIMsgCompDeliverMode.Later ||
	      msgType == nsIMsgCompDeliverMode.Background
	      // BEGIN SENDLATER3 ADDED
	      // Note that when this function is called, msgType will
	      // always be SaveAsDraft, but I'm just adding this condition
	      // here rather than getting rid of the conditional to keep
	      // the number of changes to the copied code as small as
	      // possible, to make it easier to merge new versions of that
	      // code in later.
	      || msgType == nsIMsgCompDeliverMode.SaveAsDraft
	      // END SENDLATER3 ADDED
	     )
	  {
	    //Do we need to check the spelling?
	    // SENDLATER3 CHANGED: use MyDoSpellCheckBeforeSend
	    // NOTE: Eventually, when my DoSpellCheckBeforeSend patch to the
	    // standard GenericSendMessage function is shipped with Postbox,
	    // we'll be able to just call DoSpellCheckBeforeSend here like in
	    // the standard function.
	    if (Sendlater3Composing.MyDoSpellCheckBeforeSend())
	    {
	      // We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
	      // therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
	      SetMsgBodyFrameFocus();
	      window.cancelSendMessage = false;
	      try {
		window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank",
			"chrome,close,titlebar,modal", true, true);
	      }
	      catch(ex){}
	      if(window.cancelSendMessage)
		return;
	    }

	    // Check if we have a subject, else ask user for confirmation
	    if (subject == "")
	    {
	      if (gPromptService)
	      {
		var result = {value:sComposeMsgsBundle.getString("defaultSubject")};
		if (gPromptService.prompt(
			window,
			sComposeMsgsBundle.getString("sendMsgTitle"),
			sComposeMsgsBundle.getString("subjectDlogMessage"),
			result,
			null,
			{value:0}))
		{
		  msgCompFields.subject = result.value;
		  var subjectInputElem = GetMsgSubjectElement();
		  subjectInputElem.value = result.value;
		}
		else
		  return;
	      }
	    }

	    // Alert the user if
	    //  - the button to remind about attachments was clicked, or
	    //  - the aggressive pref is set and the notification was not dismissed
	    // and the message (still) contains attachment keywords.
	    if ((gRemindLater || (sPrefs.getBoolPref("mail.compose.attachment_reminder_aggressive")
		 /* && document.getElementById("attachmentNotificationBox").currentNotification */)) &&
		ShouldShowAttachmentNotification(false)) {
	      var bundle = document.getElementById("bundle_composeMsgs");
	      var flags = gPromptService.BUTTON_POS_0 * gPromptService.BUTTON_TITLE_IS_STRING +
			  gPromptService.BUTTON_POS_1 * gPromptService.BUTTON_TITLE_IS_STRING;
	      var hadForgotten = gPromptService.confirmEx(window,
				   bundle.getString("attachmentReminderTitle"),
				   bundle.getString("attachmentReminderMsg"),
				   flags,
				   bundle.getString("pbAttachmentReminderFalseAlarm"),
				   bundle.getString("pbAttachmentReminderYesIForgot"),
				   null, null, {value:0});
	      if (hadForgotten)
	      {
		EnsureAttachmentSidebarIsOpen();
		return;
	      }
	    }

	    // check if the user tries to send a message to a newsgroup through a mail account
	    var currentAccountKey = getCurrentAccountKey();
	    var account = gAccountManager.getAccount(currentAccountKey);
	    if (!account)
	    {
	      throw "UNEXPECTED: currentAccountKey '" + currentAccountKey +
		  "' has no matching account!";
	    }
	    var servertype = account.incomingServer.type;

	    if (servertype != "nntp" && msgCompFields.newsgroups != "")
	    {
	      // default to ask user if the pref is not set
	      var dontAskAgain = sPrefs.getBoolPref("mail.compose.dontWarnMail2Newsgroup");

	      if (!dontAskAgain)
	      {
		var checkbox = {value:false};
		var okToProceed = gPromptService.confirmCheck(
				      window,
				      sComposeMsgsBundle.getString("sendMsgTitle"),
				      sComposeMsgsBundle.getString("recipientDlogMessage"),
				      sComposeMsgsBundle.getString("CheckMsg"),
				      checkbox);

		if (!okToProceed)
		  return;

		if (checkbox.value)
		  sPrefs.setBoolPref(kDontAskAgainPref, true);
	      }

	      // remove newsgroups to prevent news_p to be set
	      // in nsMsgComposeAndSend::DeliverMessage()
	      msgCompFields.newsgroups = "";
	    }

	    // Before sending the message, check what to do with HTML message, eventually abort.
	    var convert = DetermineConvertibility();
	    var action = DetermineHTMLAction(convert);
	    // check if e-mail addresses are complete, in case user
	    // has turned off autocomplete to local domain.
	    if (!CheckValidEmailAddress(msgCompFields.to, msgCompFields.cc, msgCompFields.bcc))
	      return;

	    if (action == nsIMsgCompSendFormat.AskUser)
	    {
	      var recommAction = (convert == nsIMsgCompConvertible.No)
				 ? nsIMsgCompSendFormat.AskUser
				 : nsIMsgCompSendFormat.PlainText;
	      var result2 = {action:recommAction,
			     convertible:convert,
			     abort:false};
	      window.openDialog("chrome://messenger/content/messengercompose/askSendFormat.xul",
				"askSendFormatDialog", "chrome,modal,titlebar,centerscreen",
				result2);
	      if (result2.abort)
		return;
	      action = result2.action;
	    }

	    // we will remember the users "send format" decision
	    // in the address collector code (see nsAbAddressCollecter::CollectAddress())
	    // by using msgCompFields.forcePlainText and msgCompFields.useMultipartAlternative
	    // to determine the nsIAbPreferMailFormat (unknown, plaintext, or html)
	    // if the user sends both, we remember html.
	    switch (action)
	    {
	      case nsIMsgCompSendFormat.PlainText:
		msgCompFields.forcePlainText = true;
		msgCompFields.useMultipartAlternative = false;
		break;
	      case nsIMsgCompSendFormat.HTML:
		msgCompFields.forcePlainText = false;
		msgCompFields.useMultipartAlternative = false;
		break;
	      case nsIMsgCompSendFormat.Both:
		msgCompFields.forcePlainText = false;
		msgCompFields.useMultipartAlternative = true;
		break;
	       default: dump("\###SendMessage Error: invalid action value\n"); return;
	    }
	  }

	  // hook for extra compose pre-processing
	  var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	  observerService.notifyObservers(window, "mail:composeOnSend", null);

	  // Check if the headers of composing mail can be converted to a mail charset.
	  if (msgType == nsIMsgCompDeliverMode.Now || 
	    msgType == nsIMsgCompDeliverMode.Later ||
	    msgType == nsIMsgCompDeliverMode.Background ||
	    msgType == nsIMsgCompDeliverMode.Save || 
	    msgType == nsIMsgCompDeliverMode.SaveAsDraft || 
	    msgType == nsIMsgCompDeliverMode.SaveMessageEdits || 
	    msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft || 
	    msgType == nsIMsgCompDeliverMode.SaveAsTemplate) 
	  {
	    var fallbackCharset = new Object;
	    if (gPromptService && 
		!gMsgCompose.checkCharsetConversion(getCurrentIdentity(), fallbackCharset)) 
	    {
	      // 0 = convert to utf8, 1 = ask, 2 = send anyways
	      // see bug #1368 for details
	      var result3 = sPrefs.getIntPref("pb.message.convert_on_send");
	      if (result3 == 1)
	      {
		var dlgTitle = sComposeMsgsBundle.getString("initErrorDlogTitle");
		var dlgText = sComposeMsgsBundle.getString("12553");  // NS_ERROR_MSG_MULTILINGUAL_SEND
		result3 = gPromptService.confirmEx(window, dlgTitle, dlgText,
		  (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_0) +
		  (gPromptService.BUTTON_TITLE_CANCEL * gPromptService.BUTTON_POS_1) +
		  (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_2),
		  sComposeMsgsBundle.getString('sendInUTF8'), 
		  null,
		  sComposeMsgsBundle.getString('sendAnyway'), null, {value:0}); 
	      }

	      switch(result3)
	      {
		case 0: 
		  fallbackCharset.value = "UTF-8";
		  break;
		case 1:  // cancel
		  return;
		case 2:  // send anyway
		  msgCompFields.needToCheckCharset = false;
		  break;
	      }
	    }
	    if (fallbackCharset && 
		fallbackCharset.value && fallbackCharset.value != "")
	      gMsgCompose.SetDocumentCharset(fallbackCharset.value);
	  }
	  try {

	    // just before we try to send the message, fire off the compose-send-message event for listeners
	    // such as smime so they can do any pre-security work such as fetching certificates before sending
	    var event = document.createEvent('UIEvents');
	    event.initEvent('compose-send-message', false, true);
	    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
	    // SENDLATER3 ADDED
	    msgcomposeWindow.setAttribute("sending_later", true);
	    // END SENDLATER3 ADDED
	    msgcomposeWindow.setAttribute("msgtype", msgType);
	    msgcomposeWindow.dispatchEvent(event);
	    if (event.getPreventDefault())
	      throw Components.results.NS_ERROR_ABORT;

	    gAutoSaving = (msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft);
	    // disable the ui if we're not auto-saving
	    if (!gAutoSaving)
	    {
	      gWindowLocked = true;
	      disableEditableFields();
	      updateComposeItems();
	    }
	    // if we're auto saving, mark the body as not changed here, and not
	    // when the save is done, because the user might change it between now
	    // and when the save is done.
	    else 
	      SetContentAndBodyAsUnmodified();

	    var progress = Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);
	    if (progress)
	    {
	      progress.registerListener(progressListener);
	      gSendOrSaveOperationInProgress = true;
	    }
	    msgWindow.domWindow = window;
	    msgWindow.rootDocShell.allowAuth = true;
	    // SENDLATER3 ADDED
	    var type = gMsgCompose.type;
	    var originalURI = gMsgCompose.originalMsgURI;
	    // END SENDLATER3 ADDED
	    gMsgCompose.SendMsg(msgType, getCurrentIdentity(), currentAccountKey, msgWindow, progress);
	    // SENDLATER3 ADDED
	    Sendlater3Composing.SetReplyForwardedFlag(type,
						      originalURI);
	    // END SENDLATER3 ADDED
	    // only tag slam on send if we have references.  we don't want to tag slam the original thread
	    // this can happen if we've changed the subject (and cleared the references) or if we are sending a template.
	    // see bug #3476 for details
	    if (gMsgCompose.compFields.tagKeys && gMsgCompose.originalMsgURI &&
		gMsgCompose.compFields.references &&
		(msgType == nsIMsgCompDeliverMode.Now ||
		 msgType == nsIMsgCompDeliverMode.Later ||
		 msgType == nsIMsgCompDeliverMode.Background))
	    {
	      pbTagMessageConversationOnSend(gMsgCompose.originalMsgURI, gMsgCompose.compFields.tagKeys);
	    }
	  }
	  catch (ex) {
	    dump("failed to SendMsg: " + ex + "\n");
	    gWindowLocked = false;
	    enableEditableFields();
	    updateComposeItems();
	  }
	}
      }
      else
	dump("###SendMessage Error: composeAppCore is null!\n");
    },

    // Copied from mail/components/compose/content/MsgComposeCommands.js
    // in Thunderbird 3.1 source. Unfortunately, I can't find a better way
    // than this to interpose Send Later into the message send flow.
    // SENDLATER3 CHANGED: Added "sendat", "recur" arguments.
    GenericSendMessage: function( msgType, sendat, recur)
    {
	// SENDLATER3 CHANGED: Added Entering invocation
	SL3U.Entering("Sendlater3Composing.GenericSendMessage");
	if (gMsgCompose != null)
	{
	    var msgCompFields = gMsgCompose.compFields;
	    if (msgCompFields)
	    {
		Recipients2CompFields(msgCompFields);

		// BEGIN SENDLATER3 ADDED
		var head = "X-Send-Later-At: " +
		    SL3U.FormatDateTime(sendat,true) + "\r\n" +
		    "X-Send-Later-Uuid: " + SL3U.getInstanceUuid() + "\r\n";
		if (recur) {
		    head += Sendlater3Composing.RecurHeader(sendat, recur);
		}
		msgCompFields.otherRandomHeaders += head;
		// END SENDLATER3 ADDED

		var subject = GetMsgSubjectElement().value;
		msgCompFields.subject = subject;
		Attachments2CompFields(msgCompFields);

		if (msgType == nsIMsgCompDeliverMode.Now ||
		    msgType == nsIMsgCompDeliverMode.Later ||
		    msgType == nsIMsgCompDeliverMode.Background
		    // BEGIN SENDLATER3 ADDED
		    // Note that when this function is called, msgType will
		    // always be SaveAsDraft, but I'm just adding this condition
		    // here rather than getting rid of the conditional to keep
		    // the number of changes to the copied code as small as
		    // possible, to make it easier to merge new versions of that
		    // code in later.
		    || msgType == nsIMsgCompDeliverMode.SaveAsDraft
		    // END SENDLATER3 ADDED
		   )
		{
		    //Do we need to check the spelling?
		    // SENDLATER3 CHANGED: use MyDoSpellCheckBeforeSend
		    // NOTE: Eventually, when my DoSpellCheckBeforeSend patch to the
		    // standard GenericSendMessage function is shipped with Postbox,
		    // we'll be able to just call DoSpellCheckBeforeSend here like in
		    // the standard function.
		    if (Sendlater3Composing.MyDoSpellCheckBeforeSend())
		    {
			// We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
			// therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
			SetMsgBodyFrameFocus();
			window.cancelSendMessage = false;
			try {
			    window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank",
					      "chrome,close,titlebar,modal", true, true);
			}
			catch(ex){}
			// SENDLATER3 CHANGED: Added braces and Returning invocation
			if(window.cancelSendMessage) {
			    SL3U.Returning("Sendlater3Composing.GenericSendMessage", "");
			    return;
			}
		    }

		    // Strip trailing spaces and long consecutive WSP sequences from the
		    // subject line to prevent getting only WSP chars on a folded line.
		    var fixedSubject = subject.replace(/\s{74,}/g, "    ")
			.replace(/\s*$/, "");
		    if (fixedSubject != subject)
		    {
			subject = fixedSubject;
			msgCompFields.subject = fixedSubject;
			GetMsgSubjectElement().value = fixedSubject;
		    }

		    // Remind the person if there isn't a subject
		    if (subject == "")
		    {
			var bundle = document.getElementById("bundle_composeMsgs");
			if (gPromptService.confirmEx(
			    window,
			    bundle.getString("subjectEmptyTitle"),
			    bundle.getString("subjectEmptyMessage"),
			    (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_0) +
				(gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_1),
			    bundle.getString("sendWithEmptySubjectButton"),
			    bundle.getString("cancelSendingButton"),
			    null, null, {value:0}) == 1)
			{
			    GetMsgSubjectElement().focus();
			    // SENDLATER3 CHANGED: Added Returning invocation
			    SL3U.Returning("Sendlater3Composing.GenericSendMessage", "");
			    return;
			}
		    }

		    // Alert the user if
		    //  - the button to remind about attachments was clicked, or
		    //  - the aggressive pref is set and the notification was not dismissed
		    // and the message (still) contains attachment keywords.
		    if ((gRemindLater || (getPref("mail.compose.attachment_reminder_aggressive") &&
					  document.getElementById("attachmentNotificationBox").currentNotification)) &&
			ShouldShowAttachmentNotification(false)) {
			var bundle = document.getElementById("bundle_composeMsgs");
			var flags = gPromptService.BUTTON_POS_0 * gPromptService.BUTTON_TITLE_IS_STRING +
			    gPromptService.BUTTON_POS_1 * gPromptService.BUTTON_TITLE_IS_STRING;
			var hadForgotten = gPromptService.confirmEx(window,
								    bundle.getString("attachmentReminderTitle"),
								    bundle.getString("attachmentReminderMsg"),
								    flags,
								    bundle.getString("attachmentReminderFalseAlarm"),
								    bundle.getString("attachmentReminderYesIForgot"),
								    null, null, {value:0});
			// SENDLATER3 CHANGED: Added braces and Returning invocation
			if (hadForgotten) {
			    SL3U.Returning("Sendlater3Composing.GenericSendMessage", "");
			    return;
			}
		    }

		    // check if the user tries to send a message to a newsgroup through a mail account
		    var currentAccountKey = getCurrentAccountKey();
		    var account = gAccountManager.getAccount(currentAccountKey);
		    if (!account)
		    {
			throw "UNEXPECTED: currentAccountKey '" + currentAccountKey +
			    "' has no matching account!";
		    }
		    var servertype = account.incomingServer.type;

		    if (servertype != "nntp" && msgCompFields.newsgroups != "")
		    {
			// SENDLATER3 CHANGED: "let" -> "var"
			var kDontAskAgainPref = "mail.compose.dontWarnMail2Newsgroup";
			// default to ask user if the pref is not set
			var dontAskAgain = getPref(kDontAskAgainPref);
			if (!dontAskAgain)
			{
			    var checkbox = {value:false};
			    var bundle = document.getElementById("bundle_composeMsgs");
			    var okToProceed = gPromptService.confirmCheck(
				window,
				bundle.getString("noNewsgroupSupportTitle"),
				bundle.getString("recipientDlogMessage"),
				bundle.getString("CheckMsg"),
				checkbox);

			    // SENDLATER3 CHANGED: Added braces and Returning invocation
			    if (!okToProceed) {
				SL3U.Returning("Sendlater3Composing.GenericSendMessage", "");
				return;
			    }

			    if (checkbox.value) {
				var branch = Components.classes["@mozilla.org/preferences-service;1"]
				    .getService(Components.interfaces.nsIPrefBranch);

				branch.setBoolPref(kDontAskAgainPref, true);
			    }
			}

			// remove newsgroups to prevent news_p to be set
			// in nsMsgComposeAndSend::DeliverMessage()
			msgCompFields.newsgroups = "";
		    }

		    // Before sending the message, check what to do with HTML message, eventually abort.
		    var convert = DetermineConvertibility();
		    var action = DetermineHTMLAction(convert);
		    // check if e-mail addresses are complete, in case user
		    // has turned off autocomplete to local domain.
		    // SENDLATER3 CHANGED: Added braces and Returning invocation
		    if (!CheckValidEmailAddress(msgCompFields.to, msgCompFields.cc, msgCompFields.bcc)) {
			SL3U.Returning("Sendlater3Composing.GenericSendMessage", "");
			return;
		    }

		    if (action == nsIMsgCompSendFormat.AskUser)
		    {
			var recommAction = (convert == nsIMsgCompConvertible.No)
			    ? nsIMsgCompSendFormat.AskUser
			    : nsIMsgCompSendFormat.PlainText;
			var result2 = {action:recommAction,
				       convertible:convert,
				       abort:false};
			window.openDialog("chrome://messenger/content/messengercompose/askSendFormat.xul",
					  "askSendFormatDialog", "chrome,modal,titlebar,centerscreen",
					  result2);
			// SENDLATER3 CHANGED: Added braces and Returning invocation
			if (result2.abort) {
			    SL3U.Returning("Sendlater3Composing.GenericSendMessage", "");
			    return;
			}
			action = result2.action;
		    }

		    // we will remember the users "send format" decision
		    // in the address collector code (see nsAbAddressCollector::CollectAddress())
		    // by using msgCompFields.forcePlainText and msgCompFields.useMultipartAlternative
		    // to determine the nsIAbPreferMailFormat (unknown, plaintext, or html)
		    // if the user sends both, we remember html.
		    switch (action)
		    {
		    case nsIMsgCompSendFormat.PlainText:
			msgCompFields.forcePlainText = true;
			msgCompFields.useMultipartAlternative = false;
			break;
		    case nsIMsgCompSendFormat.HTML:
			msgCompFields.forcePlainText = false;
			msgCompFields.useMultipartAlternative = false;
			break;
		    case nsIMsgCompSendFormat.Both:
			msgCompFields.forcePlainText = false;
			msgCompFields.useMultipartAlternative = true;
			break;
		    default: dump("\###SendMessage Error: invalid action value\n");
			// SENDLATER3 CHANGED: Added line break before "return;" and Returning invocation
			SL3U.Returning("Sendlater3Composing.GenericSendMessage", "");
			return;
		    }
		}

		// hook for extra compose pre-processing
		var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
		observerService.notifyObservers(window, "mail:composeOnSend", null);

		var originalCharset = gMsgCompose.compFields.characterSet;
		// Check if the headers of composing mail can be converted to a mail charset.
		if (msgType == nsIMsgCompDeliverMode.Now ||
		    msgType == nsIMsgCompDeliverMode.Later ||
		    msgType == nsIMsgCompDeliverMode.Background ||
		    msgType == nsIMsgCompDeliverMode.Save ||
		    msgType == nsIMsgCompDeliverMode.SaveAsDraft ||
		    msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft ||
		    msgType == nsIMsgCompDeliverMode.SaveAsTemplate)
		{
		    var fallbackCharset = new Object;
		    // Check encoding, switch to UTF-8 if the default encoding doesn't fit
		    // and disable_fallback_to_utf8 isn't set for this encoding.
		    if (!gMsgCompose.checkCharsetConversion(getCurrentIdentity(), fallbackCharset))
		    {
			var disableFallback = false;
			try
			{
			    disableFallback = getPref("mailnews.disable_fallback_to_utf8." + originalCharset);
			}
			catch (e) {}
			if (disableFallback)
			    msgCompFields.needToCheckCharset = false;
			else
			    fallbackCharset.value = "UTF-8";
		    }

		    if (fallbackCharset &&
			fallbackCharset.value && fallbackCharset.value != "")
			gMsgCompose.SetDocumentCharset(fallbackCharset.value);
		}
		try {

		    // just before we try to send the message, fire off the compose-send-message event for listeners
		    // such as smime so they can do any pre-security work such as fetching certificates before sending
		    var event = document.createEvent('UIEvents');
		    event.initEvent('compose-send-message', false, true);
		    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
		    // SENDLATER3 ADDED
		    msgcomposeWindow.setAttribute("sending_later", true);
		    // END SENDLATER3 ADDED
		    msgcomposeWindow.setAttribute("msgtype", msgType);
		    msgcomposeWindow.dispatchEvent(event);
		    if (event.getPreventDefault())
			throw Components.results.NS_ERROR_ABORT;

		    gAutoSaving = (msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft);
		    // disable the ui if we're not auto-saving
		    if (!gAutoSaving)
		    {
			gWindowLocked = true;
			disableEditableFields();
			updateComposeItems();
		    }
		    // if we're auto saving, mark the body as not changed here, and not
		    // when the save is done, because the user might change it between now
		    // and when the save is done.
		    else
			SetContentAndBodyAsUnmodified();

		    var progress = Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);
		    if (progress)
		    {
			progress.registerListener(progressListener);
			gSendOrSaveOperationInProgress = true;
		    }
		    msgWindow.domWindow = window;
		    msgWindow.rootDocShell.allowAuth = true;
		    // SENDLATER3 ADDED
		    var type = gMsgCompose.type;
		    var originalURI = gMsgCompose.originalMsgURI;
		    // END SENDLATER3 ADDED
		    gMsgCompose.SendMsg(msgType, getCurrentIdentity(), currentAccountKey, msgWindow, progress);
		    // SENDLATER3 ADDED
		    Sendlater3Composing.SetReplyForwardedFlag(type,
							      originalURI);
		    // END SENDLATER3 ADDED
		}
		catch (ex) {
		    dump("failed to SendMsg: " + ex + "\n");
		    gWindowLocked = false;
		    enableEditableFields();
		    updateComposeItems();
		}
		if (gMsgCompose && originalCharset != gMsgCompose.compFields.characterSet)
		    SetDocumentCharacterSet(gMsgCompose.compFields.characterSet);
	    }
	}
	else
	    dump("###SendMessage Error: composeAppCore is null!\n");
	// SENDLATER3 CHANGED: Added Leaving invocation
	SL3U.Leaving("Sendlater3Composing.GenericSendMessage");
    },

    SetReplyForwardedFlag: function(type, originalURI) {
	var state;
	if (! originalURI) {
	    return;
	}
	try {
	    var messenger = Components
		.classes["@mozilla.org/messenger;1"]
		.getService(Components.interfaces.nsIMessenger);
	    var hdr = messenger.msgHdrFromURI(originalURI);
	    switch (type) {
	    case nsIMsgCompType.Reply:
	    case nsIMsgCompType.ReplyAll:
	    case nsIMsgCompType.ReplyToSender:
	    case nsIMsgCompType.ReplyToGroup:
	    case nsIMsgCompType.ReplyToSenderAndGroup:
	    case nsIMsgCompType.ReplyWithTemplate:
	    case nsIMsgCompType.ReplyToList:
		hdr.folder.addMessageDispositionState(hdr, hdr.folder.nsMsgDispositionState_Replied);
		break;
	    case nsIMsgCompType.ForwardAsAttachment:
	    case nsIMsgCompType.ForwardInline:
		hdr.folder.addMessageDispositionState(hdr, hdr.folder.nsMsgDispositionState_Forwarded);
		break;
	    }
	}
	catch (ex) {
	    SL3U.debug("Failed to set flag for reply / forward");
	}
    },

    uninit: function() {
	SL3U.PrefService.RemoveObserver(SL3U.pref("alt_binding"),
					Sendlater3Composing.setBindings);
	SL3U.uninitUtil();
    }
}

window.addEventListener("load", Sendlater3Composing.main, false);
window.addEventListener("unload", Sendlater3Composing.uninit, false);
