#!/usr/bin/env python3

'''
Sketchy one-off migration of old translations into i18n format.

Note: This is the wrong way to do this, but using it as a temporary workaround
until I get around to setting up Crowdin integration.
'''

import sys, os, glob, re, html, json

if len(sys.argv) == 1 or '-h' in sys.argv:
    print('Usage: %s [path-to-send-later-legacy/chrome/locale]'%sys.argv[0])
    sys.exit(1)

dtdregex = re.compile(r'^<!ENTITY\s\s*(\S\S*)\s\s*"(.*)">$')
propregex = re.compile(r'(\S\S*)\s*=\s*(.*)\s*')

# newKey: (oldKey, defaultVal, <description [optional]>, <filter [optional]>)
migrations = {
    "appName": ("MessageTag", "Send Later",
                "The name of the add-on, displayed in various places."),
    "appDesc": ("extensions.sendlater3@kamens.us.description",
                "True &quot;Send Later&quot functionality to schedule the time for sending an email.",
                "A short description of the add-on."),
    "advancedOptionsTitle": ("advanced.caption", "Advanced"),
    "altBindingPrefLabel": ("altbinding.caption", "Bind Alt-Shift-Enter instead of Ctrl-Shift-Enter"),
    "blockLateMessagesPrefLabel1":("blocklatemessages.label1", "Don't deliver messages more than"),
    "blockLateMessagesPrefLabel2":("blocklatemessages.label2", "minutes late"),
    "cancelLabel":("sendlater.prompt.close.label", "Cancel"),
    "checkTimePrefLabel1":("checktimepref.label", "Check every"),
    "checkTimePrefLabel2":("checktimepref2.label", "minutes"),
    "clearDefaultsLabel":("sendlater.prompt.cleardefaults", "Clear Defaults"),
    "contactAuthorLabel":("contactauthor.value", "Contact Maintainer"),
    "delay15Label":("sendlater.button1.label", "15 minutes from now"),
    "delay30Label":("sendlater.button2.label", "15 minutes from now"),
    "delay120Label":("sendlater.button3.label", "2 hours from now"),
    "enforceRestrictionsPrefLabel":("enforcerestrictions.caption",
                                    "Enforce time and day restrictions at delivery time"),
    "generalOptionsTitle":("general.caption", "General Options"),
    "logConsoleLevelLabel":("consolelevel.caption", "Console log level"),
    "logDumpLevelLabel":("dumplevel.caption", "File log level"),
    "logLevelAll":("loglevel.all", "All"),
    "logLevelDebug":("loglevel.debug", "Debug"),
    "logLevelError":("loglevel.error", "Error"),
    "logLevelFatal":("loglevel.fatal", "Fatal"),
    "logLevelInfo":("loglevel.info", "Info"),
    "logLevelTrace":("loglevel.trace", "Trace"),
    "logLevelWarn":("loglevel.warn", "Warn"),
    "markReadPrefLabel":("markread.caption", "Mark scheduled drafts as read"),
    "quickOptionsLabel1Label":("quickoption1.caption", "Shortcut 1 label"),
    "quickOptionsLabel2Label":("quickoption2.caption", "Shortcut 2 label"),
    "quickOptionsLabel3Label":("quickoption3.caption", "Shortcut 3 label"),
    "quickOptionsValueLabel":("quickoptionvalue.label", "quickOptionsValueLabel"),
    "recurAnnuallyLabel":("sendlater.prompt.yearly.label", "Annually"),
    "recurDailyLabel":("sendlater.prompt.daily.label", "Daily"),
    "recurFunctionLabel":("sendlater.prompt.function.label", "Function"),
    "recurLabel":("sendlater.prompt.recur.label", "Recur"),
    "recurMinutelyLabel":("sendlater.prompt.minutely.label", "Minutely"),
    "recurMonthlyLabel":("sendlater.prompt.monthly.label", "Monthly"),
    "recurOnceLabel":("sendlater.prompt.none.label", "Once"),
    "recurWeeklyLabel":("sendlater.prompt.weekly.label", "Weekly"),
    "resetPrefsButton":(None, "Reset Preferences"),
    "saveDefaultsLabel":("sendlater.prompt.savedefaults", "Save these values as defaults"),
    "sendAtDefaultLabel": ("sendlater.prompt.textbox.tooltip",
                           "Enter a date above",
                           "Displayed in place of send at time before user makes selections",
                           (lambda s: s.split('.')[0])),
    "sendAtLabel":("sendlater.prompt.textbox.label", "Send at"),
    "sendBtwnLabel":("sendlater.prompt.between.label", "Between"),
    "sendButtonPrefLabel": ("sendlatersendbutton.caption",
                            "&quot;Send&quot; does &quot;Send later&quot;"),
    "sendDelayPrefLabel1":("senddelay.label", "&quot;Send&quot; delays messages by"),
    "sendDelayPrefLabel2":("senddelay2.label", "minutes"),
    "sendSundayLabel":("sendlater.prompt.day0", "Sunday"),
    "sendMondayLabel":("sendlater.prompt.day1", "Monday"),
    "sendTuesdayLabel":("sendlater.prompt.day2", "Tuesday"),
    "sendWednesdayLabel":("sendlater.prompt.day3", "Wednesday"),
    "sendThursdayLabel":("sendlater.prompt.day4", "Thursday"),
    "sendFridayLabel":("sendlater.prompt.day5", "Friday"),
    "sendSaturdayLabel":("sendlater.prompt.day6", "Saturday"),
    "sendNowLabel":("sendlater.prompt.sendnow.label", "Send now"),
    "sendOnlyOnLabel":("sendlater.prompt.on.label", "Only on"),
    "sendUnsentMessagesPrefLabel": ("showsendlaterunsentmessages.caption",
                                    "Trigger unsent message delivery from outbox"),
    "showColumnPrefLabel":("showsendlatercolumn.caption", "Show Send Later column"),
    "showHeaderPrefLabel":("showsendlaterheader.caption", "Show Send Later header"),
    "showStatusPrefLabel":("showsendlaterstatus.caption", "Show Send Later in status bar"),
    "userGuideLabel":("helplink.value", "Website")
}

for locale in map(os.path.basename, glob.glob(sys.argv[1]+'/*')):
    translations = dict()
    for fname in glob.glob(os.path.join(sys.argv[1], locale, '*.dtd')):
        with open(fname,'r') as dtdfile:
            for line in dtdfile.readlines():
                res = dtdregex.search(line)
                if res:
                    translations[res.group(1)] = html.escape(res.group(2))
    for fname in glob.glob(os.path.join(sys.argv[1], locale, '*.properties')):
        with open(fname,'r') as dtdfile:
            for line in dtdfile.readlines():
                res = propregex.search(line)
                if res:
                    translations[res.group(1)] = html.escape(res.group(2))

    appkey = "MessageTag"
    appName = translations[appkey] if appkey in translations else "Send Later"

    i18n = dict()
    for newkey in migrations.keys():
        defaults = migrations[newkey]
        oldkey = defaults[0]

        message = translations[oldkey] if (oldkey in translations) else defaults[1]

        if (len(defaults) > 3) and (defaults[3] is not None):
            message = defaults[3](message)
        message = re.sub(r"[“”]", "&quot;", message)
        message = re.sub("{NAME}", appName, message)
        message = re.sub(r":\s*$", "", message)
        message = message.strip()
        i18n[newkey] = dict(message=message, description="")

        if (len(defaults)>2) and (defaults[2] is not None):
            i18n[newkey]["description"] = defaults[2]

    os.makedirs(os.path.join("_locales",locale), exist_ok=True)

    with open(os.path.join("_locales", locale, "messages.json"),'w') as msgs:
        msgs.write(json.dumps(i18n, indent=2, ensure_ascii=False))
