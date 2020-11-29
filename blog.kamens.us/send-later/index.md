::: {#page .site}
::: {.io-title-description}
[Something better to do](/ "Something better to do")\
[Musings of an indignant mind]{.site-description}
:::

[Skip to content](#main "Skip to content"){.assistive-text}

-   [[Home](/)]{#menu-item-3836}
-   [[Send Later Thunderbird Add-on](/send-later/)]{#menu-item-3841}

::: {.clear}
:::

::: {#main .wrapper}
::: {#primary .site-content}
::: {#content role="main"}
Send Later Thunderbird Add-on {#send-later-thunderbird-add-on .entry-title}
=============================

::: {.entry-content}
::: {#fb-root}
:::

::: {.pf-content}
[![logo-big](/wp-content/uploads/2010/07/logo-big1.png){.size-full .wp-image-4286 .alignright .jetpack-lazy-image width="200" height="200" srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}![logo-big](/wp-content/uploads/2010/07/logo-big1.png){.size-full .wp-image-4286 .alignright width="200" height="200"}](#toc){#toc}
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

THUNDERBIRD 78 AND SEND LATER
-----------------------------

***SEND LATER HAS NOW BEEN RELEASED FOR THUNDERBIRD 78!***

You can now get Send Later for Thunderbird 78 on addons.thunderbird.net
just like any other add-on. The easiest way to install it is to open the
add-ons page in Thunderbird, search for Send Later, and install it
("Send Later," *not* "Send Later Button"!) from the search results.

Send Later has been almost completely rewritten for Thunderbird 78,
thanks to the yeoman efforts of Jonathan Perry-Houts. Because of this, a
new user guide will need to be written for the new version of the
add-on. Because the new version has a lot of functionality in common
with the old one, much of the information below regarding the
Thunderbird 68 version is still accurate for Thunderbird 78, but not all
of it is. This user guide will remain targeted for Thunderbird 68; when
there is a new user guide available for Thunderbird 78, we will link to
it here.

Here is some additional information about my other add-ons and
Thunderbird 78:

::: {.moz-text-html lang="x-unicode"}
Efforts are underway to port most of my add-ons to Thunderbird 78. My
original plan was to fund this work with a Kickstarter campaign, after
which the add-ons were going to be switching from a free model to a paid
license model. However, even during the campaign my hope was that I
would be able to find a way to use the proceeds of the campaign to allow
the add-ons to continue to be available for free. At this point that
does appear to be what has happened. In short: *my current plan is that
once the add-ons are ported to Thunderbird 78, they will remain free for
all to use.*

The current status of my other add-ons is as follows:

-   Folder Pane View Switcher is now available for Thunderbird 78 [on
    addons.thunderbird.net](https://addons.thunderbird.net/thunderbird/addon/folder-pane-view-switcher/).
    There are some outstanding issues, which are documented (with
    workarounds)
    [here](https://github.com/Extended-Thunder/folder-pane-view-switcher/issues).
-   Remove Content By Folder is now available for Thunderbird 78 [on
    addons.thunderbird.net](https://addons.thunderbird.net/thunderbird/addon/remote-content-by-folder/).
    There are some outstanding issues, which are documented
    [here](https://github.com/Extended-Thunder/remote-content-by-folder/issues).
-   userChromeJS: The current version of userChromeJS [available on
    addons.thunderbird.net](https://addons.thunderbird.net/thunderbird/addon/userchromejs-2/)
    is compatible with Thunderbird 78.
-   Show All Body Parts: Although this add-on is not yet available for
    Thunderbird 78, there is a workaround:
    -   Open the Thunderbird Preferences.
    -   Click on "Config Editor..." in the Advanced section of the
        General preferences.
    -   In the search box, enter
        "mailnews.display.show\_all\_body\_parts\_menu".
    -   If the status of the
        "mailnews.display.show\_all\_body\_parts\_menu" doesn't say
        "modified" there, then double-click on it to change the status
        to "modified", which will set its value to True.
    -   You should now see the "All Body Parts" View mode in the
        Thunderbird menus. Changing this hidden preference is literally
        all the add-on does, so if you set the preference this way, then
        you don't need the add-on at all.
-   IMAP Received Date: Although this add-on is not yet available for
    Thunderbird 78, there is a workaround:
    -   Open the Thunderbird Preferences.
    -   Click on "Config Editor..." in the Advanced section of the
        General preferences.
    -   Enter "mailnews.customDBHeaders" (without the quotes) into the
        search box.
    -   If it's not there, right-click in the search results area,
        select New \> String, enter "mailnews.customDBHeaders" (without
        the quotes) as the preference name to create and click OK, and
        enter "Received" (without the quotes) as the value and click OK
        again.
    -   If, on the other hand, "mailnews.customDBHeaders" shows up in
        the search results, then double-click on it to edit the value,
        enter a space and then "Received" (without the quotes) at the
        end of the value, and click OK.
-   My other add-ons, Enhanced Priority Display, Reply to Multiple
    Messages, Toggle Replied, and Undigestify, are not yet available for
    Thunderbird 78, but we're working on them. We're hoping to have more
    progress to report some time in October, though that date may slip.

People have asked if they can contribute to the Kickstarter campaign or
contribute to these add-ons in general. The Kickstarter campaign has
closed and can no longer accept contributions, and in any case there is
no need to contribute to it since as noted above our current plan is for
all of the add-ons to continue to be free. As for contributing to me
personally to acknowledge my work on these add-ons, there are
unfortunately a lot of people nowadays who need financial help more than
I do, so I am asking people who are inspired to contribute to these
add-ons to instead pick a worthy charity and donate there instead.

Please [email the
maintainers](/cdn-cgi/l/email-protection#ea998f848ec7868b9e8f98c7999f9a9a85989eaa8f929e8f848e8f8ec79e829f848e8f98c485988d)
(**don't** post comments below) if you have any further questions.
:::

[Table of contents](#toc){#toc}
-------------------------------

(Clicking on section headers in the text will return you to the table of
contents.)

-   [Introduction](#intro)
-   [Installation](#install)
-   [Basic usage](#usage)
    -   [Date formats](#date-formats)
-   [Preferences](#prefs)
    -   [Preset buttons](#presets)
-   [Toolbar](#toolbar)
    -   ["I want a 'Send Later' button!"](#send-later-button)
-   [Caveats and known issues](#caveats)
    -   [Send Later doesn't work with mail servers that discard its
        "X-Send-Later" headers](#bad-mail-servers)
    -   [Thunderbird must be running for scheduled messages to be
        sent](#running)
    -   [Return receipts don't work](#receipt)
    -   [Thunderbird hangs frequently on Windows](#windows-hangs)
    -   [Errors you might encounter](#errors)
        -   [Missing drafts folder](#missing-drafts-folder)
-   [Advanced usage](#advanced)
    -   [Hot keys](#hotkeys)
    -   [Recurring messages](#recurring)
    -   [Mail Merge add-on](#mailmerge)
    -   [Owl for Exchange add-on](#owl)
    -   [Dynamic functions for complex scheduling rules](#dynamic)
        -   [Dynamic recurrence](#dynamic-recurrence)
    -   [Suppressing scheduled message delivery](#senddrafts)
    -   [Server-side Send Later](#server-side)
    -   [Making "Send" do "Send Later" only some of the
        time](#dynamic_sendbutton)
    -   [Checking for scheduled messages more than once per
        minute](#milliseconds)
-   [Troubleshooting](#troubleshooting)
    -   [Messages don't send or send multiple times](#outbox)
        -   [Send errors with Gmail when Thunderbird is configured to
            save copies](#gmail)
    -   [Debug logging](#debug)
-   [Helping to improve the add-on](#improve)
    -   [Translations](#translate)
    -   [Hacking](#hacking)
-   [Getting help](#help)
    -   [The "Send Later users" mailing list](#mailing-list)
    -   [Contacting the developer](#contact-me)
    -   [Remote support](#remote-support)
    -   [Other resources](#resources)
-   [Support Send Later!](#donate)
-   [Check out my other add-ons](#other-addons)
-   [Credits](#credits)
    -   [Supporters](#supporters)
-   [Release Notes](#notes)
-   [Comments on this page](#comments)

[Introduction](#toc){#intro}
----------------------------

The Send Later Thunderbird add-on allows you you to write an email
message and then tell Thunderbird when you want it to be sent. The
message is then saved back into your Drafts folder, and delivered at
approximately the specified time. The add-on is available for download
from
[addons.thunderbird.net](https://addons.thunderbird.net/thunderbird/addon/send-later-3/).
Release notes for each new release of Send Later are published there and
[below](#notes). What follows is a user manual for the add-on.
Everything below (except for the installation section) assumes that
you've already installed the add-on from
[addons.thunderbird.net](https://addons.thunderbird.net/thunderbird/addon/send-later-3/)
and restarted your mail app. If you have any comments, questions or
feedback about the add-on, please feel free to [email the
maintainers](/cdn-cgi/l/email-protection#394a5c575d1455584d5c4b144a4c4949564b4d795c414d5c575d5c5d144d514c575d5c4b17564b5e).

This user manual is written for Thunderbird 68 or newer. Things might be
slightly different for older versions.

[Installation](#toc){#install}
------------------------------

### Method 1

1.  In Thunderbird, open the add-ons dialog with the "Tools \> Add-ons"
    menu-bar command or "Add-ons" from the three-lines menu in the upper
    right corner of the main Thunderbird window.
2.  Enter "Send Later" in the search box and hit Enter.
3.  Find the "Send Later" add-on (***not*** "Send Later Button") in the
    search results and click the "Add to Thunderbird" button.
4.  When it's done installing, restart Thunderbird.

### Method 2 (use only if Method 1 doesn't work)

1.  Download the add-on as an ".xpi" file from
    [addons.thunderbird.net](https://addons.thunderbird.net/thunderbird/addon/send-later-3/),
    saving it to your Desktop or another obvious location.
2.  In Thunderbird, select the "Tools \> Add-ons" menu-bar command or
    "Add-ons" from the three-lines menu.
3.  Click the gear icon to the left of the search box and select
    "Install Add-on From File...".
4.  Browse to the downloaded Send Later ".xpi" file and open it.
5.  Make sure your mouse is over the install dialog and it has focus.
    When the "Install" button becomes active, click on it.
6.  Restart Thunderbird when it tells you to after the add-on is
    installed.

[Basic usage](#toc){#usage}
---------------------------

When you want to schedule a message for later delivery, either select
the File \> Send Later menu command in the message composition window,
or hit Ctrl-Shift-Enter. This will pop up the following dialog:

[![Send Later prompt
window](/wp-content/uploads/2019/09/dialog.png){.aligncenter
.wp-image-5671 .size-medium .jetpack-lazy-image width="300" height="239"
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}![Send
Later prompt
window](/wp-content/uploads/2019/09/dialog.png){.aligncenter
.wp-image-5671 .size-medium width="300" height="239"
sizes="(max-width: 300px) 100vw, 300px"
srcset="/wp-content/uploads/2019/09/dialog.png 300w, /wp-content/uploads/2019/09/dialog.png 606w"}](/wp-content/uploads/2019/09/dialog.png)

Here is what you can do from this dialog:

-   **Specify a specific time at which to send the message.** Tell Send
    Later in the text box when you would like the message to be sent, or
    use the date and time pickers below the text box if you prefer. The
    text box understands [lots of different formats](#date-formats), so
    give it a try! When you've entered a date/time that the add-on
    understands, the button below it will become active and "Enter a
    valid date above" will be replaced with what you entered. Click the
    button or type Ctrl-Enter, or just Enter if your cursor is in the
    text box, to schedule the message.\
    **IMPORTANT NOTE:** You will only see the date and time pickers if
    you have the Lightning add-on installed and enabled. Otherwise, you
    need to use the text box.
-   **Schedule a recurring message on a fixed schedule.** See
    [below](#recurring).
-   **Schedule a one-shot or recurring message using one of the built-in
    scheduling functions or a function you've written or imported
    yourself.** See [below](#dynamic).
-   **Send the message using one of the preset buttons.** Click "15 mins
    later", "30 mins later", or "2 hours later" to send the message the
    indicated amount of time into the future.
-   **Deposit the message into your Outbox for later delivery by
    Thunderbird.** If you click "Put in Outbox" (see [below](#buttons)
    for why you won't always see this button), the message will be
    copied immediately into your Outbox. This is the behavior of the
    standard Thunderbird "Send Later" command before you installed the
    add-on. The message will then be sent if you execute File \> Send
    Unsent Messages, or if you go into and out of offline mode, or if
    you exit and restart Thunderbird. In the latter two cases,
    Thunderbird may or may not prompt for confirmation before sending
    unsent messages, depending on how you have configured it.
-   **Send the message immediately.** If you click "Send Now" (see
    [below](#buttons) for why you won't always see this button), the
    message will be delivered immediately, as if you had executed the
    "Send" command instead of "Send Later". Note that you can activate
    this button by hitting Alt-N or the equivalent on your platform or
    in your language.
-   **Go back to editing the message.** Click the "Cancel" button to go
    back to editing the message.

### Time-of-day and day-of-week restrictions

You can also specify time-of-day and day-of-week restrictions for when
your message will be delivered. **IMPORTANT NOTE:** You will only see
the option to set a time-of-day restriction if you have the Lightning
add-on installed and enabled.

These restrictions have different (but, I hope, somewhat intuitive)
effects based on what kind of scheduling you are doing:

-   If you enter restrictions with an explicit, one-shot (i.e., not
    recurring) send time, then Send Later will adjust the send time you
    specify to fall within those restrictions. Furthermore, if
    Thunderbird can't send the message at the scheduled time, the
    restrictions you specify will be enforced when it *can* send the
    message, if the "Enforce time and day restrictions at delivery time"
    preference (see [below](#prefs)) is enabled.
-   If you enter restrictions with a [recurring send
    time](#recurring) or [dynamic scheduling function](#dynamic), then
    they will be applied as above and also each time the message is
    rescheduled.

### Saving defaults

You can save whatever settings you enter here as the default settings
for when you bring up this dialog in the future, or clear previously
saved defaults, by making the appropriate selection above the big
scheduled send button, before you click it. You can do some pretty fancy
things with this. For example, if you enter "now" in the text box and
check that you only want the message to be delivered between 9:00am and
5:00pm Monday through Friday, and then save those as your defaults, then
whenever you pop up the dialog, the default behavior will be to send the
message now or reschedule it for when it is during business hours.
Nifty, eh?

### []{#buttons}The "Put in Outbox" and "Send Now" buttons

As noted above, the "Send Now" button in the Send Later dialog causes
the message to be sent immediately, i.e., it bypasses the scheduled send
process, and the "Put in Outbox" button causes the message to be put
directly into the Thunderbird Outbox, also bypassing the scheduled send
process, but in a different way.

Unfortunately, both of these buttons can't be displayed at the same time
without "cheating" and integrating Send Later into Thunderbird in a way
that isn't really supposed to be done and isn't maintainable or
sustainable. Therefore, when the Send Later dialog pops up, you will
only see one of these buttons or the other, as follows:

-   If the Send Later dialog is opened by typing Ctrl-Shift-Enter, or
    the "File \| Send Later" menu command, or the button provided by the
    ["Send Later Button" add-on](#magicslr), then the "Put in Outbox"
    button is displayed but the "Send Now" button is not.
-   Conversely, if the Send Later dialog is opened by typing Ctrl-Enter
    or "File \| Send Now" or the "Send" button when the "'Send' does
    'Send Later\'" preference described [below](#prefs) is enabled, then
    the "Send Now" button is displayed but the "Put in Outbox" button is
    not.

If you *don't* have the "'Send' does 'Send Later\'" preference enabled,
and you open the dialog with Ctrl-Shift-Enter etc. and then realize that
you actually want to send the message right away, you can simply close
the dialog or click the Cancel button and then send the message
normally.

### What happens when you schedule a message?

When you schedule a message for delivery, it is saved in your Drafts
folder with the necessary scheduling information embedded in it. If you
wish to reschedule a message later, just edit the saved draft and do
"Send Later" again and specify the new send time. If you wish to cancel
a scheduled message delivery, edit the draft and save it normally
without "Send Later" (or just send it immediately, if that's what you
want to do), and the scheduling information will be removed.

### [Date formats](#toc){#date-formats}

The part of Send Later that interprets the send times you type into the
text box is pretty smart. You're welcome to type a full date and time,
e.g., "10/4/2012 3:00pm", if you *want* to, but it isn't actually
necessary. In addition to making intelligent guesses about the parts you
leave out, the interpreter also understands quite a few neat shortcuts.
Here are some examples, but they don't include everything, so when in
doubt, try it out, and see if it works!

-   Don't type the year if the date you're entering is in the coming
    year. It'll default to that automatically!
-   Don't type the date at all if you're just entering a time in the
    next 24 hours.
-   You can type a day of the week for the next instance of that day, or
    "next *day-of-week*" for the one after.
-   You can type "tomorrow" or "the day after tomorrow".
-   You can type "in 3 minutes" or "3 minutes from now".

See [this page](https://sugarjs.com/dates/#/Parsing) for more examples.
These apply in all of the languages that Send Later supports, not just
in English. If you encounter something you think the add-on should
understand but doesn't, [let us
know](/cdn-cgi/l/email-protection#a9daccc7cd84c5c8ddccdb84dadcd9d9c6dbdde9ccd1ddccc7cdcccd84ddc1dcc7cdccdb87c6dbce).

[Preferences](#toc){#prefs}
---------------------------

You can get to the add-on's Preferences window in three ways:

1.  Click on "Send Later" in the status bar at the bottom of your main
    window and select "Send Later preferences" from the pop-up menu
    (there are also several other useful things in this menu). The
    preferences will open in a new window.
2.  Select the Tools \> Add-on Preferences \> Send Later menu command.
    The preferences will open in a new tab.
3.  Select Add-ons \> Send Later from the three-lines menu. The
    preferences will open in a new tab.

Here is the main preferences screen, followed by explanations of the
various settings:

[![](/wp-content/uploads/2019/09/2019-09-23_11-43.png){.aligncenter
.size-medium .wp-image-5684 .jetpack-lazy-image width="300" height="258"
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}![](/wp-content/uploads/2019/09/2019-09-23_11-43.png){.aligncenter
.size-medium .wp-image-5684 width="300" height="258"
sizes="(max-width: 300px) 100vw, 300px"
srcset="/wp-content/uploads/2019/09/2019-09-23_11-43.png 300w, /wp-content/uploads/2019/09/2019-09-23_11-43.png 660w, /wp-content/uploads/2019/09/2019-09-23_11-43.png 710w"}](/wp-content/uploads/2019/09/2019-09-23_11-43.png)

### Check every \# minutes

This preference controls how often the add-on checks for messages whose
delivery time has arrived. The default, once per minute, is adequate for
most people. In rare cases, you may need to use a higher value (lower
frequency) if you have a very large number of messages in your Drafts
folder and the Send Later progress bar at the bottom of your Thunderbird
window never goes away.

### "Send" does "Send Later"

If it is enabled, this preference causes the scheduling dialog to pop up
not only when you run the "Send Later" command, but also, when you run
"Send", whether it's by clicking the "Send" button, selecting File \|
Send Now, or typing Ctrl-Enter. It'll therefore prevent you from
accidentally sending a message now that you meant to schedule for later.
This feature is *not* enabled by default.

Note that this preference and the following one are mutually exclusive.

### []{#send-delay}"Send" delays messages by: \# minutes

If enabled, this preference causes all messages you send by clicking
Send or typing Ctrl-Enter to be automatically scheduled to be sent by
Send Later the specified number of minutes into the future.

This essentially replicates the functionality provided by some email
providers to allow you to cancel sending a message for a short period of
time after it is sent. If you sent a message and then change your mind
before the delay time has elapsed, you can simply find the message in
your Drafts folder and either delete it (if you don't want it to be sent
at all) or open it for editing, which automatically cancels the
scheduled send.

Note that this preference and the previous one are mutually exclusive.

### Mark scheduled drafts as read

By default when Send Later saves a scheduled messages into your Drafts
folder, it marks the message as "read" so that your Drafts folder
doesn't show up in the folder list as having unread messages in it. If
you prefer for scheduled Drafts to show up as "unread" to remind you
that they're there, uncheck this preference.

### Bind Alt-Shift-Enter instead of Ctrl-Shift-Enter

This preference causes the pop-up Send Later dialog to be bound to the
key sequence Alt-Shift-Enter instead of Ctrl-Shift-Enter. When this
feature is activated, Ctrl-Shift-Enter remains the original Thunderbird
functionality, i.e., depositing the message into the Outbox for sending
later.

### Enable compose window key bindings for presets

When you're composing a message, you can type Ctrl-Alt-1, Ctrl-Alt-2, or
Ctrl-Alt-3 to activate the corresponding preset button without popping
up the Send Later prompt window. If you don't want these key bindings to
be active, uncheck this preference to disable them.

### Show Send Later Column

This preference controls whether a column showing the scheduled delivery
times of messages that have them is displayed when viewing a Drafts
folder.

### Show Send Later Header

This preference controls whether the "x-send-later-at" message header,
which is where the add-on stores information about when a draft should
be delivered, is displayed when viewing drafts that have them. *(Note
that this setting does not work when the Mnenhy add-on is installed.)*

### Show Send Later In Status Bar

This preference controls whether the add-on shows its current status in
the Status Bar at the bottom of the Thunderbird window. The number of
pending scheduled messages, or "IDLE" if there are none, is displayed.
If this preference is unset, then the next one is ignored.

### Show Background Progress In Status Bar

This preference controls whether an animated progress bar is shown in
your Thunderbird status bar when the add-on is working, i.e., when it
wakes up periodically to check for messages whose delivery time has
arrived. If the previous preference is unset, then this preference is
ignored.

### Trigger unsent message delivery from Outbox

This preference controls whether the add-on actually sends messages when
their delivery time arrives, or rather should just deposit them into
your Outbox and leave them there until the next time you send unsent
messages as described above. You might want to disable this setting if
you use some other add-on, e.g., BlunderDelay, to manage your message
delivery. See the [Caveats section below](#caveats) for more information
about this.

### Don't deliver messages more than \# minutes late

This preference controls what happens when Send Later that's late
because Thunderbird wasn't running or your computer was asleep at the
time it was supposed to be sent. By default, Send Later will deliver
such a message at the earliest opportunity to do so after its scheduled
send time. If you would rather not have messages delivered late, you can
enable this preference, and then instead of delivering a late message,
Send Later will pop up a warning about it and leave it for you to edit
to either reschedule its send time or send it immediately by hand.

### Enforce time and day restrictions at delivery time

As described [below](#recurring), Send Later supports restrictions on
the time of day and day of the week when recurring scheduled messages
are delivered. These restrictions are enforced when a message is
scheduled, i.e., the scheduled send time of a message will never violate
the time and weekday restrictions specified for that message.

Having said that, this preference controls what happens when a message
isn't delivered at its scheduled time because Thunderbird isn't running
or your computer is asleep, and then when Thunderbird wakes up, the
current time violates the time and/or weekday restrictions on the
message. By default, when this preference is disabled, Send
Later delivers late messages immediately even in violation of their
time/weekday restrictions. In contrast, when the preference is enabled,
the add-on waits until the time/weekday restrictions are satisfied
before delivery.

### Links

Following these settings are links you can click on to send me email,
view the user guide (i.e., this page), or make a donation to support
continued development of the add-on.

### [Preset buttons](#toc){#presets}

In addition to these main settings, you can change the behavior of the
preset buttons by editing the settings of the "Shortcut" tabs of the
preferences dialog:

[![Send Later shortcut
preferences](/wp-content/uploads/2019/09/prefs3.png){.aligncenter
.wp-image-5675 .size-medium .jetpack-lazy-image width="300" height="243"
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}![Send
Later shortcut
preferences](/wp-content/uploads/2019/09/prefs3.png){.aligncenter
.wp-image-5675 .size-medium width="300" height="243"
sizes="(max-width: 300px) 100vw, 300px"
srcset="/wp-content/uploads/2019/09/prefs3.png 300w, /wp-content/uploads/2019/09/prefs3.png 660w, /wp-content/uploads/2019/09/prefs3.png 700w"}](/wp-content/uploads/2019/09/prefs3.png)

-   **Button label** specifies the string that is displayed in the
    button. You need to change the label yourself if you change the
    number of minutes; it won't update automatically.
-   **Minutes** specifies how many minutes into the future the message
    should be sent if you click this button. The defaults, obviously,
    are 15, 30 and 120.

[Toolbar](#toc){#toolbar}
-------------------------

If you would like, you can add Send Later to your compose window toolbar
to give you direct access to the add-on's functionality without needing
to go through the pop-up. Here is how to do that:

1.  Right-click on the toolbar in a message compose window.
2.  Select "Customize...".
3.  Drag and drop the Send Later pieces you want (see the following
    diagram) from the "Customize Toolbar" window to where you want them
    on the toolbar.
4.  Click "Done" to close the "Customize Toolbar" window.

[![Send Later toolbar
buttons](/wp-content/uploads/2019/09/toolbar.png){.aligncenter
.wp-image-5676 .size-medium .jetpack-lazy-image width="300" height="190"
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}![Send
Later toolbar
buttons](/wp-content/uploads/2019/09/toolbar.png){.aligncenter
.wp-image-5676 .size-medium width="300" height="190"
sizes="(max-width: 300px) 100vw, 300px"
srcset="/wp-content/uploads/2019/09/toolbar.png 300w, /wp-content/uploads/2019/09/toolbar.png 578w"}](/wp-content/uploads/2019/09/toolbar.png)

The toolbar items you see here are as follows:

### Send Later button

Schedules the message to be sent at the time specified in the "send
time" text field (the second toolbar item shown above and described
below). Just to be clear: the purpose of the send later button in the
toolbar is to finish scheduling a message after you've already entered a
send time in the text box. This button does not pop up the scheduling
dialog. See [below](#magicslr) if you want a button that does that.

### "Send time" text box

You can enter a scheduled delivery time in this box just like in the
text box in the Send Later dialog, then click the "Send Later" toolbar
button or just hit enter in the text box to schedule the message for
delivery.

### Shortcut buttons

The same shortcut buttons that appear in the Send Later dialog can also
be added to your toolbar.

Please note that the Send Later toolbar controls are disabled when you
are editing a [recurring message](#recurring); you need to use the
pop-up window to reschedule such a message.

### []{#magicslr}["I want a 'Send Later' button!"](#toc){#send-later-button}

If you want there to be a button on your toolbar to pop up the Send
Later prompt window, i.e., a button that does the same thing as File \>
Send Later or Ctrl-Shift-Enter, you can get one by installing the "[Send
Later
Button](https://addons.thunderbird.net/thunderbird/addon/send-later-button/)"
add-on and adding its button to your toolbar. Note that the toolbar Send
Later button provided by the Send Later add-on, i.e., the one shown in
the "Customize Toolbar" palette above, doesn't pop up the Send Later
prompt window. Rather, it is used to finish scheduling a message after
you have entered the send time for it in the text box you've added to
the toolbar along with the button. If you don't add the text box to the
toolbar, then that button isn't useful.

[Caveats and known issues](#toc){#caveats}
------------------------------------------

Some things to keep in mind:

1.  Whenever Send Later delivers a scheduled message, any other messages
    pending delivery in your Outbox will also be delivered.
2.  Scheduled drafts are locked to a particular Thunderbird profile and
    will only be delivered by a Thunderbird running against the same
    profile that originally scheduled them. This means that if you use
    Thunderbird on multiple computers to schedule messages, you need to
    keep it running on all of those computers for the messages to be
    delivered. You can "transfer" a draft from one profile to another if
    need be by editing and rescheduling it.
3.  Send Later is not yet compatible with
    [UseBccInstead](https://addons.thunderbird.net/en-US/thunderbird/addon/use-bcc-instead/).
4.  If you use distribution lists within Thunderbird and you add a
    distribution list to a message and then Send Later, the list will be
    expanded when you schedule it, *not* when it is sent. Any changes
    you make to the list between when you schedule the message and when
    it is sent will not be reflected in the sent message.
5.  Send Later is partially incompatible with the ["Defer"
    feature](http://mailtweak.mozdev.org/tweaks.html#defer) of the [Mail
    Tweak](http://mailtweak.mozdev.org/) thunderbird add-on. In
    particular, if you have "Defer" enabled with Mail Tweak, then the
    Send Later dialog will pop up every time you click the "Send" button
    in a compose window or type Ctrl-Enter. You can click "Send Now" at
    that point to send the message immediately, but the extra click is
    annoying. Note that Mail Tweak is not compatible with recent
    versions of Thunderbird, so there are no plans to fix this issue.
6.  Attachments are frozen when messages are scheduled to be sent. In
    other words, if you attach a file to a message, then schedule the
    message with Send Later, then modify the file on disk before the
    scheduled message is sent, *your modifications will not be included
    in the sent message.* This is also true with recurring messages ---
    when a recurring message is sent and automatically rescheduled, Send
    Later does *not* capture a new version of the attached files.
7.  Outgoing message format preferences (Preferences \| Composition \|
    General \| Send Options...) do not work with Send Later.
8.  []{#icloud}I have been told by multiple people that messages sent
    from or to iCloud or me.com accounts never appear in the recipient's
    inbox even though Thunderbird says they were sent successfully.
    Please note that this is *not* a bug in Send Later or Thunderbird,
    it's a problem with iCloud. Apparently, Apple thinks it's OK to run
    a mail server which arbitrarily and completely silently discards
    valid email messages with no notification to either the sender or
    recipient that this has occurred (this is discussed by others on the
    internet, e.g.,
    [here](https://www.macworld.com/article/2029570/silent-email-filtering-makes-icloud-an-unreliable-option.html),
    [here](https://discussions.apple.com/thread/3153039),
    [here](https://www.cultofmac.com/103703/apple-may-be-invisibly-filtering-your-outgoing-mobileme-email-exclusive/103703/),
    [here](https://www.imore.com/apple-slipping-lately#comment-610145)).
    I have tried, unfortunately without success, to find a fix or
    workaround for this problem. The only possible fix I've been able to
    find --- and I'm not actually sure it works --- is to check your
    account settings and confirm that the outbound SMTP configuration in
    Thunderbird for your iCloud account matches the [settings Apple says
    you should be using](https://support.apple.com/en-us/HT202304).
9.  []{#exquilla}Send Later does not work with ExQuilla, because Send
    Later depends on being able to put messages into your local Outbox
    and then send them with the "Send Unsent Messages" command, but
    ["Send Unsent Messages" is not implemented in
    ExQuilla](https://exquilla.zendesk.com/entries/25723967-Messages-stuck-in-Outbox).
    If you would like to see Send Later work with ExQuilla, I suggest
    you contact the maintainers of ExQuilla and ask them to make sending
    messages to ExQuilla from the local Outbox work properly; the more
    people ask, the more likely it is that they will fix this problem.
    Send Later *does* work with [Owl for
    Exchange](https://addons.thunderbird.net/thunderbird/addon/owl-for-exchange/),
    the add-on which is intended to replace ExQuilla, when configured as
    described [below](#owl).

### [Send Later doesn't work with mail servers that discard its "X-Send-Later" headers](#toc){#bad-mail-servers}

Some mail servers (most notably, but not exclusively, Microsoft Exchange
used through its IMAP gateway) prevent Send Later from working by
discarding the "X-Send-Later" headers that it uses to keep track of
message scheduled delivery times. You can tell that this is happening if
you schedule a message for delivery, but then when you look at the
message header of the scheduled draft with View \> Message Source, there
are no "X-Send-Later" headers.

To work around this problem, you need to store your drafts for the
affected account in some other Drafts folder, e.g., the one underneath
Local Folders. You can set this preference by going to Tools \> Account
Settings... or Edit \> Account Settings... and viewing the "Copies &
Folders" page for the affected account.

Please note: for Microsoft Exchange in particular, this workaround is
only valid when you are accessing Exchange as a generic IMAP server,
*not* when you are using ExQuilla, which as noted [just
above](#exquilla) is incompatible with Send Later.

### [Thunderbird must be running for scheduled messages to be sent](#toc){#running}

You need to keep Thunderbird running (and your computer turned on!) for
Send Later to be able to send scheduled messages (note that on Mac OS,
"running" means there must be at least one main Thunderbird window open;
Send Later will not work if the Thunderbird app is running but doesn't
have any open windows). It runs within Thunderbird, which means that
when you exit from Thunderbird, it's not around to check for messages to
be sent. If you fail to leave Thunderbird running over the delivery time
of one or more messages, then those messages will be delivered shortly
after the next time you start Thunderbird. Note that there are various
methods and tools for waking up your computer automatically at a
pre-specified time, in case you don't want to keep it running constantly
until it's time to send the messages. For Windows, for example, see:
[\[1\]](http://www.lifsoft.com/),
[\[2\]](http://www.vistax64.com/tutorials/166809-task-scheduler-wake-up-computer.html),
[\[3\]](https://www.pcworld.com/article/158142/Schedule_your_PCs_Startup_and_Program_Launch.html).
For Linux, see
[\[1\]](http://www.osnews.com/story/24111/Wake_Your_Linux_Up_From_Sleep_for_a_Cron_Job).
You can schedule your Mac to wake up automatically by opening System
Preferences and clicking on "Energy Saver" and then "Schedule".
Alternatively, see [below](#server-side) for a description of how to run
Thunderbird on a server to deliver your messages for you.

Or you can consider using a third-party service that holds and delivers
scheduled messages for you, instead of Send Later. See, for example:

-   <http://www.timecave.com/timecave/about.jsp>
-   <http://www.etn.nl/poptools/sendmail.htm#sendmail>
-   <http://www.lettermelater.com/>
-   <http://www.rightinbox.com/>
-   <http://www.boomeranggmail.com/> (for Gmail)

The list of sites above is provided for informational purposes only; it
should not be construed as an endorsement of any of these services. I
don't use them and don't know how well they work or how trustworthy they
are.

### [Return receipts don't work](#toc){#receipt}

If you enable the Return Receipt option on a message you are composing,
and then you schedule the message to be sent later, when it is sent, no
return receipt will be requested. Unfortunately, fixing this requires
significant changes to the internal architecture for how scheduled
messages are sent, and the changes are difficult since the core
Thunderbird components involved are completely undocumented, so I don't
know when I'll be able to find the time to fix the problem. In the
meantime, here's a workaround (thanks to
[about.com](http://email.about.com/od/mozillathunderbirdtips/qt/Add_an_Arbitrary_Custom_Header_to_Mozilla_Thunderbird.htm)):

1.  Open the Thunderbird options dialog with Tools \> Options... or
    Edit \> Preferences...
2.  []{#config-editor}Click "Advanced" and then "Config Editor..." and
    click the "I'll be careful, I promise!" button if it asks you to.
3.  Enter "mail.compose.other.header" in the filter box.
4.  Double-click on the mail.compose.other.header setting and set it to
    "Disposition-Notification-To". If it already has a non-empty value,
    add a comma and then "Disposition-Notification-To" to the end of it.
5.  Quit from and restart Thunderbird.
6.  When you are composing a message for which you want a return receipt
    and which you want to schedule to be sent later, then click on an
    empty line in the message header in the compose window, select
    "Disposition-Notification-To" in the drop-down, and then enter your
    email address as the value of the header.

If you want to automatically request a return receipt for *every*
message you send, so that you don't have to do it manually each time you
schedule a message to be sent later, do the following (thanks to
[MozillaZine](http://kb.mozillazine.org/Custom_headers)):

1.  Open the advanced configuration editor as described
    [above](#config-editor).
2.  Enter "useremail" in the filter box and scan through the matches to
    find the email address of the account which you want to generate
    return receipts. Remember the "id*\#*" for that account, where
    "id*\#*" here and below means the characters "id" followed by a
    number which is different for each of your configured accounts.
3.  Enter "mail.identity.id*\#*.headers" to find out if there are
    already custom headers configured for the account. If not, then
    right-click in the settings area to create a new string setting with
    that name.
4.  Put "receipt" as the value of the setting if it's empty, or append
    ",receipt" to the end of the existing value.
5.  Create a new string setting called
    "mail.identity.id*\#*.header.receipt", and set its value to
    "Disposition-Notification-To: *address*", where *address* is the
    email address to which you would like return receipts sent.

### [Thunderbird hangs frequently on Windows](#toc){#windows-hangs}

A number of Send Later users on Windows have reported that when they
have Send Later installed, Thunderbird periodically hangs for annoyingly
long periods of time during normal use of the application.

This is not actually a bug in Send Later --- there is nothing Send Later
does that should cause Thunderbird to hang, and some Thunderbird users
on Windows have reported this issue even without Send Later installed
--- but whatever the problem is, Send Later does seem to exacerbate it
for some people.

I heard two different potential explanations for this behavior, one
anecdotal (i.e., I have been unable to confirm it) and one definitive.

First, the definitive one: If you have "Allow Windows Search to search
messages" enabled in the General tab of your Thunderbird options, try
turning it off and see if that solves the problem. It appears that the
Windows Search indexer sometimes holds extended locks on files that
Thunderbird uses, and Thunderbird hangs while waiting for the files to
become available.

The other possibility is that your real-time antivirus scanner is doing
the same thing as the Windows Search indexer, i.e., holding a lock on a
file that Thunderbird uses while scanning it for viruses. You can check
if this is the case by temporarily disabling real-time protection and
seeing if the Thunderbird hangs go away. The "temporarily" is important
--- you don't want to permanently disable real-time protection, since
it's important to protect your computer from viruses!

If this does turn out to be the problem, then the people who develop and
support Thunderbird recommend excluding Thunderbird mailbox files from
antivirus scanning, if your antivirus software has real-time protection
(i.e., scans files when they are created, opened, or executed), as most
modern antivirus software does. Their reasoning behind this
recommendation is that mailbox files are never executed directly, so
viruses lurking in mailbox files are not a threat. They only become a
threat when they are saved separately by Thunderbird when you ask it to
open or save an attachment. As long as your antivirus software scans
those saved attachments in real-time, it is not dangerous to disable
scanning of mailbox files. If you do decide to do this, then you need to
identify the location of your Thunderbird profile folder, and tell your
antivirus software to exclude the "ImapMail" and "Mail" subdirectories
of that folder from scanning. You may also wish to exclude
"global-messages-db.sqlite\*" in that folder.

Two notes about this:

1.  If your antivirus software does not have real-time protection, or if
    it has it but you have it turned off, then I personally do *not*
    recommend excluding Thunderbird mailbox files from your scheduled
    antivirus scans.
2.  The recommendation above for excluding Thunderbird mailbox files
    from scans comes from the Thunderbird team, not from me. See [their
    wiki](https://wiki.mozilla.org/Thunderbird:Testing:Antivirus_Related_Performance_Issues)
    for more information. I am not endorsing this recommendation; I'm
    just passing it on.

Something to keep in mind is that the *size* of your Thunderbird files
is contributing to the problem. Larger files take longer for antivirus
products to scan. You may have large files in your Thunderbird profile
for several reasons, including: you have folders containing many
messages that you have configured to store local copies; you have many
messages across your entire account and you have the global search
feature enabled, since that means the global search index file will
itself be very large; you have folders that haven't been compacted in a
very long time so they have a lot of wasted space in them their local
storage files; you have an old Thunderbird profile which as a result has
index files that have a lot of wasted space in them. Given these
possibilities, here are some ideas that might help reduce the size of
the files in your profile and thereby reduce the duration of hangs:

-   don't store local copies of messages in folders whose messages you
    don't access that often and don't need to be able to full-text
    search;
-   split up very large folders into multiple folders containing fewer
    messages (as I rule, I personally try not to let folders grow above
    200MB; I find the [ShowFolderSize
    extension](https://freeshell.de/~kaosmos/index-en.html#foldersize)
    particularly useful for this);
-   disable the global search index if you don't use it;
-   limit which folders are included in your global search results;
-   [rebuild your global search
    index](https://support.mozilla.org/en-US/kb/rebuilding-global-database)
    periodically (follow the instructions in that link for locating the
    search index file, and check how large it is before and after you
    rebuild it, to see if rebuilding it actually reduces its size
    significantly and therefore makes this work continuing to do in the
    future);
-   compact all your folders (File \| Compact Folders); or
-   worst-case scenario, [rebuild your Thunderbird
    profile](https://support.mozilla.org/en-US/kb/using-multiple-profiles)
    to see if that helps.

Another option, which we list separately from the bulleted list above
because it is still in the experimental phase (at least as of when this
paragraph was written in September 2016), is to [switch to Maildir
storage](https://wiki.mozilla.org/Thunderbird/Maildir), which stores
each incoming messages in a separate file. Be careful about this,
however, because although it mostly works, as I just noted it isn't yet
fully supported.

If you encounter this issue and come up with a solution that works and
is different from the solutions outlined above, please [let us
know](/cdn-cgi/l/email-protection#2152444f450c4d405544530c525451514e535561445955444f4544450c5549544f4544530f4e53461e5254434b4442551c7549544f4544534348534504131149404f4652)!

### [Errors you might encounter](#toc){#errors}

#### [Missing drafts folder](#toc){#missing-drafts-folder}

If Thunderbird warns you repeatedly when Send Later is installed that
you are missing a Drafts folder, you need to go through your accounts
and make sure that the Drafts folder required by Thunderbird exists for
all of them. Here's the most reliable way to do that:

1.  Open a new message window.
2.  Type something random (doesn't matter what) in the To and Subject
    fields of the message to ensure that it is a "valid" draft.
3.  Click the "Save" button to save the draft.
4.  If you have multiple accounts, then change the "From" field of the
    draft one by one to each of the other accounts and click "Save" for
    each of them.
5.  When are done, close the window and delete the draft from the Drafts
    folder of the last account into which you saved it.

#### ["Error sending unsent messages"](#toc){#outbox-copy-failure}

If you're reading this section, it's probably because you got a pop-up
alert that said this (or the equivalent in another language):

Send Later: Error copying scheduled message to Outbox for delivery (code
%x). Send Later has been disabled! See
/send-later-3/\#outbox-copy-failure.

This means that Send Later encountered an error when attempting to copy
a scheduled message from your Drafts folder to your Outbox for delivery.
Because of this error, it's possible that things are in an inconsistent
state, such that the message in question is in your Outbox *and* your
Drafts folder at the same time. If this is the case, then there is a
risk that Send Later will keep trying to send it over and over again
every minute, and as a result many copies of the message could end up
being sent. To prevent this from happening, Send Later disables itself
temporarily. You should:

1.  Check your Outbox (under Local Folders) to see if there is a
    scheduled message stuck there waiting to be sent. If so, and the
    message looks complete, run run File \> Send Unsent Messages to send
    it. If the message looks incomplete, delete it.
2.  If there was no message in your Outbox, or if it was incomplete and
    you deleted it, then you're probably fine. Restart Thunderbird to
    turn Send Later back on.
3.  Otherwise, check your Drafts folder to see if there's another copy
    there of the message that you just sent from your Outbox, and if so,
    delete it from Drafts (unless it's a recurring message, in which
    case you should open and reschedule it for the next time you want it
    to be sent). After doing this, restart Thunderbird to turn Send
    Later back on.
4.  If the problem persists, follow [these
    instructions](#corrupt-outbox) for repairing a corrupt Outbox.
5.  If the problem persists after that, [contact
    us](/cdn-cgi/l/email-protection#bbc8ded5df96d7dacfdec996c8cecbcbd4c9cffbdec3cfded5dfdedf96cfd3ced5dfdec995d4c9dc)
    and we'll try to help you figure out what's wrong and how to fix it.

#### ["Error copying recurring message"](#toc){#drafts-copy-failure}

If you're reading this section, it's probably because you got a pop-up
alert that said this (or the equivalent in another language):

Send Later: Error copying recurring message into Drafts folder (code
%x). Send Later has been disabled! See
/send-later-3/\#drafts-copy-failure.

This means that Send Later sent a recurring message and then tried to
save a new copy of it in your Drafts folder with the next scheduled date
for it to be sent, but an error occurred while saving the new draft.
It's possible that the error is specious and the draft was saved
successfully, and it's possible that the draft was lost because of the
error. There's no way for the add-on to tell, so it disables itself just
to be save. You should:

1.  Check your Sent Items folder to find out which scheduled message was
    just sent.
2.  Check your Drafts folder to check if the message is there with the
    correct next scheduled delivery date. If so, you're fine, and you
    can restart Thunderbird to turn Send Later back on.
3.  If the message was lost from your Drafts folder, then copy it from
    your Sent Items folder into your Drafts folder, double-click on it
    to edit the draft, and then reschedule it for the next time you want
    it to be delivered with the correct recurrence. Then restart
    Thunderbird to turn Send Later back on.
4.  If the problem happens again, [contact
    us](/cdn-cgi/l/email-protection#97e4f2f9f3bafbf6e3f2e5bae4e2e7e7f8e5e3d7f2efe3f2f9f3f2f3bae3ffe2f9f3f2e5b9f8e5f0)
    and we'll try to help you figure out what's wrong and how to fix it.

#### [Corrupt drafts folder](#toc){#corrupt-drafts-error}

If you're reading this section, it's probably because you got a pop-up
alert that said something like this (or the equivalent in another
language):

Send Later: Folder *URL-of-Drafts-folder* may be corrupt. Please open
its properties and repair it. See /send-later-3/\#corrupt-drafts-error/.

The root cause of this issue is actually an intermittent Thunderbird bug
which sometimes causes folders to become corrupted; it is *not* due to a
bug in Send Later, but the add-on is warning you about it so you can fix
the underlying issue and keep the add-on working properly for you. If
you are able to determine from the error message which Drafts folder is
corrupt, and you can see that folder in the Thunderbird folder list,
then do just what the error pop-up says: right-click on the folder,
select "Properties", and click on the "Repair" button. If that doesn't
fix the problem, or if it isn't obvious which folder is causing the
problem, then do the following:

1.  Open a compose window.
2.  Add an email address and some text to the draft, just so that it's
    not totally empty.
3.  Iterate through all of the identities, i.e., the email address /
    account combinations you are able to select in the drop-down next to
    "From:".
4.  For each identity, click "Save" to save the draft in the drafts
    folder for that identity. This will force Thunderbird to create the
    Drafts folder if it doesn't already exist.
5.  When you're done, close the compose window and delete the draft from
    the last Drafts folder. Thunderbird should have already been smart
    enough to remove it from the others as you iterated through them.
6.  When all that is done, repair all of the drafts folders as described
    [below](#drafts-cleanup).

If this doesn't fix the problem for you, then [email
us](/cdn-cgi/l/email-protection#cdbea8a3a9e0a1acb9a8bfe0beb8bdbda2bfb98da8b5b9a8a3a9a8a9e0b9a5b8a3a9a8bfe3a2bfaaf2beb8afa7a8aeb9f08ea2bfbfb8bdb9e8fffd89bfacabb9bee8fffd8ba2a1a9a8bf)
and we'll try to help.

[Advanced usage](#toc){#advanced}
---------------------------------

### [Hot keys](#toc){#hotkeys}

You can hit Ctrl-1, Ctrl-2, or Ctrl-3 in the pop-up to activate the
first, second or third preset key, respectively. You can hit the "Esc"
key in the pop-up to cancel and go back to editing the message. You can
hit Ctrl-Enter in the pop-up to send the message at the specified time,
i.e., hitting Ctrl-Enter is equivalent to clicking the "Send Later at
specified time" button. You can hit Alt-N in the pop-up (or the
equivalent in other languages) to send the message right now, i.e., it
is equivalent to clicking the "Send Now" button.

In the composition window itself (i.e., not in the Send Later pop-up),
you can hit Ctrl-Alt-1, Ctrl-Alt-2, or Ctrl-Alt-3 to activate the
corresponding preset key.

### [Recurring messages](#toc){#recurring}

You can schedule a message to be sent repeatedly by selecting
"minutely", "daily", "weekly", "monthly" or "yearly" in the Send Later
pop-up. Immediately after Send Later delivers the message, it calculates
a new delivery time for it based on the frequency you specified and
saves a new draft back into your Drafts folder with the new delivery
time. This will continue for as long as you leave the message in your
Drafts folder with recurrence enabled. To stop the message from being
delivered anymore, remove it from your Drafts folder, or edit the draft
and save it without scheduling.

When you select one of the recurrence options, the Send Later dialog
changes slightly to look like this:

![](/wp-content/uploads/2010/07/Send-this-email-later_007.png){.size-full
.wp-image-4612 .aligncenter .jetpack-lazy-image width="579" height="475"
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}![](/wp-content/uploads/2010/07/Send-this-email-later_007.png){.size-full
.wp-image-4612 .aligncenter width="579" height="475"
sizes="(max-width: 579px) 100vw, 579px"
srcset="/wp-content/uploads/2010/07/Send-this-email-later_007.png 579w, /wp-content/uploads/2010/07/Send-this-email-later_007.png 300w"}

The new controls that appear in the dialog, shown circled in red above,
are as follows:

-   Check the "Every" checkbox to specify a multiplier other than 1, the
    default, to indicate how many time periods should be skipped between
    deliveries. For example, every 2 days, every 4 weeks, etc.
-   When you are using "monthly" recurrence only, you can check the
    "week of the month" checkbox to be sent the same weekday of the week
    of every month, e.g., "4th Tuesday of the month." To do this, first
    enter the first scheduled date/time in the text box, then select
    "monthly", then check the box next to "4th Tuesday of the month" (or
    whatever --- the text is updated automatically based on the first
    scheduled date/time).
-   If you check "Cancel recurrence upon reply", then Send Later watches
    for incoming messages that are replies to recurring messages you've
    scheduled, and if a reply is received, then Send Later automatically
    deletes the recurring message from your Drafts folder.

Here are some things to keep in mind about recurring messages:

-   You can't use the preset buttons to schedule recurring messages,
    i.e., you have to explicitly specify the first delivery time for the
    message in the controls at the top of the pop-up window. To make
    this clear, when you select recurrence in the pop-up, the preset
    buttons are automatically disabled.
-   You can't use the toolbar to schedule recurring messages. Also, if
    you edit a draft that was previously scheduled with recurrence, the
    toolbar buttons are disabled and you need to use the pop-up to
    reschedule it.
-   If you schedule a monthly message for the 29th, 30th or 31st of the
    month, then there will be months in which it will actually be sent
    on the 1st, 2nd or 3rd of the *next* month. For example, if you
    schedule a message for the 30th, then on February in a leap year it
    will be sent on March 1 and again on March 30, and on February in a
    non-leap year it will be sent on March 2 and again on March 30. The
    day of the month on which you originally scheduled it will be
    preserved, so it'll always be sent on that day in months which
    actually have it.
-   Similarly, if you schedule a yearly message on February 29, then
    it'll be delivered on March 1 in non-leap years.
-   If several scheduled send times for a message pass without
    Thunderbird being running, then the next time you run Thunderbird,
    it'll only send the messages once for that interval. For example, if
    you have a daily message scheduled, and you leave Thunderbird shut
    down for a week, then when you start it up, it'll only send one copy
    of that message instead of seven, and then reschedule it for
    delivery again tomorrow.

#### Time/date restrictions on recurring messages

When you schedule a recurring message, you can optionally enable
restrictions on the time of day and day of week when the message is
delivered. By default, these restrictions are enforced when each
recurring instance of the message is scheduled but *not* when it is
delivered, so if a message is delivered late because Thunderbird wasn't
running or your computer was asleep at the messages scheduled time, then
the message will be sent immediately when Thunderbird wakes up even if
the current time falls outside the time or weekday restrictions. If you
would like these restrictions to be enforced at delivery time as well,
[there's a preference for that](#prefs).

### [Mail Merge add-on](#toc){#mailmerge}

The [Mail Merge
add-on](https://addons.thunderbird.net/thunderbird/addon/mail-merge/)
supports Send Later starting with its version 3.4.0. The following
documentation for using Send Later with Mail Merge is courtesy of Mail
Merge's author, Alexander Bergmann. Thanks very much to Alexander for
adding this feature, which has been requested by many users, to his
add-on! Mail Merge has a "Date" field in the Mail Merge Dialog as part
of the "Mail" section, which is visible if the user selects "Save As
Draft" as "Deliver Mode" and Send Later is installed and activated. If
you put a valid date in the "Date" field, then Mail Merge will tell Send
Later to deliver the message at the specified date, just as if you
scheduled it with Send Later directly. The "Date" field also supports
variables! So it is possible to use a column "Date" (or "Time" or
whatever you like to name it) with different dates for each recipient in
the CSV. (Or if you want to use the Address Book, you probably will want
to use Custom1 to Custom4 for this purpose.) In the "Date" field of the
Mail Merge Dialog, you usually want to use something like this:

{{Date}} {{Time}} (There are probably other use cases with different
variables as well.)

### [Owl for Exchange add-on](#toc){#owl}

The [Owl for
Exchange](https://addons.thunderbird.net/thunderbird/addon/owl-for-exchange/)
add-on allows Thunderbird to send and receive email through a Microsoft
Exchange Server account. Send Later can be made to work with Owl for
Exchange, but only if you configure an SMTP server for outbound
messages. Please read on for an explanation and additional details.

When you configure a "normal" (i.e., not Exchange) internet email
account in Thunderbird you specify two servers for the account: the
inbound server, an IMAP or POP3 server, where your email should be
fetched from, and the outbound server, an SMTP server, through which the
messages you compose are delivered.

Microsoft Exchange does support IMAP and SMTP, so if the administrator
or your Exchange server has enabled them, you could configure
Thunderbird to treat your Exchange server as a normal internet email
account and not use Owl. However, you may need to use if your
administrator has not enabled IMAP and SMTP, or you want to take
advantage of additional Owl features such as its Exchange address book
integration.

The code for the Thunderbird message compose window knows how to send
messages via Owl, so when you compose a message interactively and click
the Send button it is sent successfully. However, the code that delivers
message via the Thunderbird Outbox code does *not* know how to send
messages via Owl, so when an Owl message is put into your Outbox and
then Thunderbird tries to deliver it, it doesn't work. Unfortunately,
Send Later uses the Outbox to deliver messages.

However, there is a workaround. SMTP servers can be configured in
Thunderbird independent of email accounts, so if you have access to an
SMTP server --- either because your Exchange administrator has enabled
SMTP on the server, or because there is some other SMTP server you use
--- then Thunderbird can use that SMTP server to deliver Owl messages,
and all is well. Well, sort of. There are some caveats you need to be
aware of.

**IMPORTANT:** Because email messages sent interactively through Owl go
directly through Exchange while messages sent through Send Later go
through SMTP, the headers of the two messages will be different an an
astute observer will be able to figure out through deductive reasoning
and a careful examination of the headers that the message was sent by
Send Later, i.e., that it was not written at the time it was sent.
Depending on why you are using Send Later to delay messages, this may or
may not be something you care about.

If you have multiple email accounts configured in Thunderbird, some of
which are Owl accounts and some of which are IMAP/SMTP accounts, and you
don't do anything special to configure your Owl account for SMTP, then
when you send a message via Send Later Thunderbird will deliver it
through your default SMTP server, which is usually the first SMTP server
that was added to your Thunderbird profile. For example:

-   Create a new Thunderbird profile.
-   Add account A, an Owl account, to the profile.
-   Add account B, an IMAP/SMTP account.
-   Add account C, an IMAP/SMTP account.
-   Schedule a message from your Owl account via Send Later.
-   At the scheduled delivery time, the message will be sent via the
    SMTP server for account B.

The SMTP server may not allow the message to be sent through it if the
sender address doesn't match the domain the SMTP server is intended to
be used for. In that case the SMTP server will reject the message and
the send will fail. Obviously, for Owl and Send Later to work you need
to use an SMTP server that will allow you to send messages from your Owl
email address through it.

To add an SMTP server to your Thunderbird profile independent of adding
a full email account:

1.  Open Account Settings.
2.  Click on "Outgoing Server (SMTP)" on the left.
3.  Click "Add".
4.  Fill out the server details and click "OK".

If this is the only SMTP server in your profile, it will become the
default and will be used for Owl messages sent via Send Later. The first
time a message is sent that way you will be prompted for the server
password, and you should tell Thunderbird to save it if you want
Thunderbird to be able to send scheduled messages in the future without
prompting you for a password.

To change which SMTP server your Owl account uses for Send Later
messages:

1.  Open Account Settings.
2.  Click on "Manage Identities..."
3.  Select the identity for your Owl account and click "Edit..."
4.  Near the bottom of the window where it says "Outgoing Server
    (SMTP)", click on the pop-up menu and select the SMTP server you
    want to use.
5.  Click "OK".

### [Dynamic functions for complex scheduling rules](#toc){#dynamic}

The scheduling functionality built into Send Later is quite flexible,
but sometimes you may want to implement more complex scheduling rules.

For example, the most common request I've received is for Send Later to
have a button which tells it, "Send this message at the start of the
next work day," so that people can do work during off hours without
their clients / customers / colleagues knowing that they're doing so.

To satisfy this need, Send Later allows you to write your own code ---
or import code written by others --- that implements arbitrarily complex
scheduling rules. These scheduling rules are called dynamic functions,
and you manage them in the dynamic function editor, which you can open
either from the "Advanced" tab of the Send Later preferences window, or
from the context menu that pops up when you click on "Send Later" in the
status bar of the main Thunderbird window.

The first time you open the editor, it will create and display a sample
scheduling function called "ReadMeFirst" which has a big comment in it
explaining more about what your code needs to do. It will also create
two other sample functions, "BusinessHours" and "DaysInARow", which you
can play with to learn about how dynamic functions work.

In fact, the "BusinessHours" function is an implementation of the "Send
this message at the start of the next work day" logic I've been asked
for so many times!

Don't worry... If you accidentally delete or mess up one of these files,
you can restore it by downloading and saving it from here, importing the
downloaded file into the editor, and
saving: [ReadMeFirst](/wp-content/uploads/2010/07/ReadMeFirst.slj), [BusinessHours](/wp-content/uploads/2010/07/BusinessHours.slj), [DaysInARow](/wp-content/uploads/2010/07/DaysInARow.slj).

There are two ways to use a dynamic function once it's ready to go.

First, you can pick the function you want to use from the "function"
pop-up menu in the Send Later dialog "[(1)]{style="color: #ff0000;"}" in
the picture below). As you hover over the function names in the menu,
the help text for each function is displayed to assist you in picking
the right function. Furthermore, when you select a specific function, a
help icon [(2)]{style="color: #ff0000;"} appears next to the menu with
the help text for the function you selected bound to it for easy
reference.

You can apply time-of-day and day-of-week restrictions to functions in
the dialog [(3)]{style="color: #ff0000;"}. Furthermore, some functions
(including "BusinessHours") accept arguments to customize their
behavior, and you can specify those arguments in the text field provided
[(4)]{style="color: #ff0000;"}, which is hidden until you select the
"function" option.

To see what the function's calculations will yield before actually
sending the message, click the "Calculate" button
[(5)]{style="color: #ff0000;"}, and the function, restrictions, and
arguments you specified are executed and the result appears in the "Send
at" box. *You don't ****need*** *to push the "Calculate" button before
sending your message, *you can just click the big "Send according to
function" button [(6)]{style="color: #ff0000;"} and the right thing will
happen. In fact, Send Later *does the calculations again* when you click
the big button, even if you previously clicked "Calculate."

As noted above, if you need to use the same settings repeatedly, you can
select "Save these values as the defaults"
[(7)]{style="color: #ff0000;"} so you don't have to enter them over and
over; this works for scheduling with functions just like it does for
entering a single send time explicitly or using one of the recurrence
options.

Of course, a picture is worth a thousand words:

![Send this email
later\_010](/wp-content/uploads/2010/07/Send-this-email-later_010.jpg){.aligncenter
.size-medium .wp-image-4384 .jetpack-lazy-image width="300" height="229"
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}![Send
this email
later\_010](/wp-content/uploads/2010/07/Send-this-email-later_010.jpg){.aligncenter
.size-medium .wp-image-4384 width="300" height="229"}

The other way you can use dynamic functions is by binding them to one or
more of the shortcut buttons. In the Preferences tab for one of the
shortcut buttons, enter "ufunc:*name*" where *name* is the name of the
function you want to bind to that shortcut. Don't forget to change the
button label too!

You can even specify arguments to be passed to the function. For example
if you specify "ufunc:BusinessHours(\[0, 1, 2, 3, 4\], \[9, 0\], \[17,
0\])", then that shortcut button will schedule messages to be sent
between 9:00am and 5:00pm Sunday through Thursday (see the help text for
the BusinessHours function for an explanation of how to interpret those
arguments).

You may not need to reinvent the wheel. Take a look at the [library of
dynamic
functions](https://github.com/jikamens/send-later/tree/master/contrib/scheduling-functions)
contributed by other Send Later users. Also, consider sharing the
functions you create! That page has instructions there for adding to the
library.

#### [Dynamic recurrence](#toc){#dynamic-recurrence}

In addition to supporting arbitrary logic for scheduling a message once,
dynamic functions can also support arbitrary logic for sending messages
multiple times, i.e., for recurring messages. This is very powerful
functionality, but it's also a bit complicated, so bear with me while I
walk you through it.

A dynamic function implements recurrence by putting a *recurrence
specification string *in the "nextspec" variable before the function
returns. The recurrence specification does one of two things: either it
specifies a recurrence type that Send Later knows how to handle
internally, after which the dynamic function is "out of the loop" for
subsequent deliveries of the message and doesn't get called again; or it
tells Send Later to continue calling it each time the message needs to
be rescheduled.

The internal recurrence types, which correspond to the options in the
Send Later dialog, are as follows:

-   **minutely --** Send the message every minute.
-   **daily** -- Send the message once per day.
-   **weekly** -- Send the message once per week.
-   **monthly *day-of-month*** -- Send the message on the specified day
    of every month.
-   **monthly *day-of-week* *week-of-month*** -- Send the message on the
    specified day (0 = Sunday -- 6 = Saturday) of the specified week of
    the month. For example, "monthly 1 3" means to send the message on
    the third Monday of every month.
-   **yearly *month day***-- Send the message on the specified day of
    every month (0 = January -- 11 = December). For example, "yearly 10
    5" means November 5 of every year.

In addition, after one of the primary recurrence specifications shown
above, the function can include any of the following modifiers in the
specification string:

-   " / *number*" (that's a space, then a slash, then another space,
    then a number --- the syntax is important!) to
    indicate every *number* minutes, e.g., "**minutely / 20**" means
    every 20 minutes;
-   " between *YYMM YYMM*" to indicate a time restriction; and
-   " on *d1 d2 ...*" to indicate a day-of-week restriction, where "*d1
    d2 ...*" is a list of space-separated day numbers, .with the
    numbering starting with 0 for Sunday.

If, on the other hand, your function wants Send Later to call it
repeatedly to do the scheduling, then it should set "nextspec" to
**"function " + specname**. This specification string can also use the
"between" and "on" modifiers shown above, but not the "/" modifier.

If your function takes arguments that control its behavior and/or keeps
state between invocations, then those need to be assigned as an array to
the "nextargs" variable before your function returns.

There are two ways for a recurring dynamic function to stop sending a
recurring message:

-   if the function knows that the message it was just asked to schedule
    is the last one, then it should simply not set "nextspec" to
    anything (i.e., leave it null), and Send Later will use the final
    send time it provided and then not schedule the message any further;
    or
-   if the function determines that the current invocation is too late
    to send the message any more, i.e., it wants to stop the
    message immediately rather than after the next time it is sent, then
    it should set "next" to -1 and not set "nextspec" to anything, and
    Send Later will stop the message immediately.

### [Suppressing scheduled message delivery](#toc){#senddrafts}

If you set the preference "extensions.sendlater3.senddrafts" to false in
the advanced config editor (described [above](#config-editor)), then
Send Later won't deliver scheduled drafts when their time comes; it'll
just leave them in your Drafts folder as if their delivery time has not
yet arrived. In case you are wondering what use this might have... One
clever Send Later user decided to eliminate the requirement for
Thunderbird to be running all the time to deliver scheduled messages, by
writing an independent service to scan for and deliver scheduled
messages from his IMAP Drafts folder. Unfortunately, if he happened to
be running Thunderbird when a draft was scheduled to be sent, his
Thunderbird and his service might have tried to deliver the same draft
at the same time, thus causing unpredictable behavior and/or duplicate
messages. He can avoid this issue by setting the "senddrafts" preference
to false.

### [Server-side Send Later](#toc){#server-side}

*(This is very advanced usage. It can be complicated to set up, and
things could go embarrassingly wrong if you mess it up. Proceed at your
own risk.)*

If you want scheduled drafts to be sent even when your computer is shut
down or Thunderbird isn't running, and you have access to a server
somewhere on which you can keep Thunderbird running all the time, here's
how you can set things up to have scheduled messages sent via that
server.

1.  Use IMAP, not POP3, to access the email account in question.
    Otherwise, Thunderbird can't store your scheduled drafts on the mail
    server and the server-side Thunderbird won't be able to read and
    send them.
2.  Install Thunderbird on the server.
3.  If you can, set up the server to log you in automatically when it
    reboots, to start Thunderbird automatically when you log in, etc.
    I.e., do as much as you can to ensure that Thunderbird will stay
    running all the time.
4.  Configure your email account into Thunderbird on the
    server. **Important:** see [below](#matching-accounts) for a very
    important note about configuring accounts and identities on
    different computers.
5.  On the client, set extensions.sendlater3.senddrafts to false as
    described [above](#senddrafts).
6.  On the client, use the advanced config editor to find the value of
    the preference extensions.sendlater3.instance.uuid. Copy the value
    into a text file or save it in some other way.
7.  On the server, use the advanced config editor to set
    extensions.sendlater3.instance.uuid to the value you copied from the
    client.

After you follow these steps, the client will stop sending out scheduled
messages, and the server will start sending them out instead, since
you've tricked it into thinking it is the same "instance" of Send Later
as the client.

<div>

If you use Send Later on multiple clients, e.g., on a desktop and a
laptop, then you can make the value of
extensions.sendlater3.instance.uuid the same on all of them, as long as
extensions.sendlater3.senddrafts is only set to true in one Thunderbird,
i.e., the one that you keep running all the time.

</div>

Remember that this only works if Thunderbird stays running on the
server. Don't forget to keep an eye on it and restart it if it shuts
down. If you want to be especially careful, you can schedule a
[recurring message](#recurring) to yourself as a simple monitor --- if
you don't receive the recurring message at the scheduled time, you know
that Thunderbird on the server has stopped running and you can log in
and restart it.

#### []{#matching-accounts}Accounts and identities on different computers

When you compose a draft message, Thunderbird inserts special, hidden
settings into the message indicating the account and identity used to
compose the draft. Although you don't see them in the user interface,
Thunderbird assigns numerical identifiers to accounts and identities;
these numerical identifiers are what gets put into the hidden settings
in the draft message. You can see these identifiers by looking in your
prefs.js file (Help \| Troubleshooting Information, click on the button
to open your profile directory, and load the file "prefs.js" in that
directory into a text editor) for lines containing "mail.identity.id"
and "mail.account.account".

When you only use Thunderbird on one machine, you never have to worry
about what those hidden identifiers are. However, when you try to share
accounts between multiple Thunderbird installations, and you have more
than one account and/or identity configured, then you will run into
problems if the identifiers for the accounts and identifiers are
different. In particular, if you configure things as described above to
schedule messages from one computer and send them from another, and the
account or identity numbers don't match on the two computers, *then the
scheduled messages will be sent from the wrong identity and/or account.*

There are several ways to avoid this problem:

1.  Back up your Thunderbird profile from one computer and restore it on
    the other, thus guaranteeing that the account and identity
    configuration on the two computers will match. This is harder than
    it sounds because there are file paths hard-coded in various
    locations in your profile, mostly in prefs.js, that will ned to be
    updated if your profile is in a different directory on the second
    computer. A tool like [MozBackup](http://mozbackup.jasnapaka.com/)
    may help with this, but it only runs on Windows and it may not fix
    everything it needs to when the profile is restored.
2.  Create a new Thunderbird profile on the second computer, then quit
    out of Thunderbird there without configuring any accounts, load the
    new profile's prefs.js into a text editor, and copy all the
    mail.account\*, mail.identity.\*, mail.server.\*, and mail.smtp\*,
    lines from your old prefs.js file to the new one, omitting any lines
    that have hard-coded file paths in them. Then restart Thunderbird on
    the new computer and log into all the accounts and send test
    messages from all your identities so that Thunderbird's password
    manager can save all the necessary passwords.
3.  Edit prefs.js by hand (with Thunderbird not running!) on one of the
    computers to swap around the numbers for all the accounts,
    identities, servers, and SMTP servers so they match the numbers on
    the other computers. *Editing prefs.js is dangerous, and this is not
    for the faint of heart, and make sure you save a backup copy you can
    restore if you screw things up!*

### [Making "Send" do "Send Later" only some of the time](#toc){#dynamic_sendbutton}

You may be in a situation where some of the time, you want to make sure
to schedule every message you send, while other times, you want to send
messages right away. For example, you might catch up on work late at
night, but letting your clients know that might give them the incorrect
impression that you don't mind if they call you at god-awful hours :-).
With Send Later and userChromeJS, we can make that happen.

The userChromeJS add-on allows you to add arbitrary JavaScript code and
functions to your Thunderbird installation. Here's how you do that:

1.  Install the [userChromeJS add-on](http://userchromejs.mozdev.org/).
2.  Find the userChrome.js file created by userChromeJS. It will be in
    the "chrome" subfolder of your [Thunderbird profile
    folder](http://kb.mozillazine.org/Profile_folder_-_Thunderbird).
3.  Using your favorite text editor, add the code you want to
    userChrome.js, then exit from and restart Thunderbird.

Here's an example of code you can put in userChrome.js to solve the
problem above, i.e., you want the "Send" button to do "Send Later" after
hours:

``` {style="font-size: 125%;"}
// Set up a timer to call a function every five minutes to check
// whether we want the "Send" button to actually do "Send Later".

// This is the function that the timer will call.
var SendButtonPrefCallback = {
    notify: function(timer) {
    var now = new Date();
    // Sunday or Saturday
    var weekend = now.getDay() == 0 || now.getDay() == 6;
    // Before 9am
    var early = now.getHours() < 9;
    // After 5pm
    var late = now.getHours() > 4;
    // Put it all togther
    var do_popup = weekend || early || late;
    // Set the appropriate Send Later preference
    var prefService = Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);
    prefService.setBoolPref("extensions.sendlater3.sendbutton", do_popup);
    }
}

// This is the variable that the timer will be stored in.
var SendButtonPrefTimer = null;

// Now set up the timer.
if (! SendButtonPrefTimer) {
    SendButtonPrefTimer = Components.classes["@mozilla.org/timer;1"]
    .createInstance(Components.interfaces.nsITimer);
    SendButtonPrefTimer.initWithCallback(
    SendButtonPrefCallback,
    300000,
    Components.interfaces.nsITimer.TYPE_REPEATING_SLACK
    );
}

// Note: This timer's going to run in every open Thunderbird window,
// but there really isn't any harm in that, so it's easier to just let
// that happen then to try to figure out how to make it run in only
// one window.
```

### [Checking for scheduled messages more than once per minute](#toc){#milliseconds}

If you need to control when messages are sent with smaller granularity
than one minute, you can tweak the Send Later configuration options to
specify more exactly how often to check for scheduled messages:

1.  Open the Config Editor (open the Preferences window, click
    "Advanced", click the "General" tab, and click the "Config
    Editor..." button.
2.  Enter "extensions.sendlater3.checktimepref" in the Search box.
3.  Double click on the first displayed preference and change it to the
    frequency you want Send Later to check with, times 1000. For
    example, if you want it to check every 15 seconds, change it
    to 15000.
4.  Double click on the second displayed preference, the
    "is\_milliseconds" preference, to change it from false to true.
5.  Restart Thunderbird.

Important notes:

-   Setting the delay between scans too low could cause the add-on to
    become confused. Fifteen seconds is probably pretty safe. Five
    seconds may even be safe, though it's pushing it. Less than five
    seconds is probably a bad idea.
-   Whatever check frequency you configure, a scheduled message could be
    sent up to that many seconds later than it was actually scheduled.
    For example, if you're checking every 15 seconds, messages could end
    up being sent up to 15 seconds after their scheduled send times.
-   Remember that once Send Later decides to put the message into your
    Outbox and tell Thunderbird to send it, the actual transmitting of
    the message takes a bit of time as well, especially if it's large.

[Troubleshooting](#toc){#troubleshooting}
-----------------------------------------

### [Messages don't send or send multiple times](#toc){#outbox}

#### Are you using the add-on correctly?

If scheduled messages get moved into your Outbox (underneath Local
Folders) at the scheduled send time but don't get delivered from there,
then the first thing to do is confirm that you haven't *told* Send Later
not to deliver messages. Open Send Later's preferences (click "Send
Later" at the bottom of the main window and select "Send Later
preferences" from the menu) and make sure the box next to "Trigger
unsent message delivery from Outbox" is checked. It is checked by
default, so if it isn't, then you unchecked it for some reason, and you
should check it and click "OK" to save the change. Then, to cause past
messages that were previously put into the Outbox to be delivered,
select the "File \| Send Unsent Messages" menu command. If that's not
the problem, then read on.

Another common mistake when using the add-on is clicking on the "Put in
Outbox" button rather than the "Send by" button. As documented above,
the button that actually causes a message to be scheduled for later
delivery is this one:

[![](/wp-content/uploads/2020/01/send_button.png){.aligncenter
.wp-image-5763 .size-medium .jetpack-lazy-image width="300" height="230"
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}![](/wp-content/uploads/2020/01/send_button.png){.aligncenter
.wp-image-5763 .size-medium width="300" height="230"
sizes="(max-width: 300px) 100vw, 300px"
srcset="/wp-content/uploads/2020/01/send_button.png 300w, /wp-content/uploads/2020/01/send_button.png 660w, /wp-content/uploads/2020/01/send_button.png 664w"}](/wp-content/uploads/2020/01/send_button.png)

If you instead click the 'Put in Outbox" button below it, then you're
not scheduling the message for later delivery, you're putting it
directly into the Outbox to be sent the next time you do "File \| Send
Unsent Messages" or the next time Send Later delivers a separate
scheduled message, since every time Send Later delivers a message, *all*
pending messages in the Outbox are delivered.

Make sure you are using the add-on properly and its preferences are set
correctly before proceeding with the following troubleshooting steps.

If scheduled messages are going into your Drafts folder but not moving
into your Outbox at the scheduled time, then check if your mail server
is discarding the Send Later headers, as described
[above](#bad-mail-servers). If not, then proceed with the following
troubleshooting steps.

#### Messages not being sent: isolating the problem

If Send Later fails to deliver messages at the scheduled time, or if
scheduled messages are delivered repeatedly, the two most likely causes
are corrupt Drafts folders and a corrupted Outbox folder. A corrupted
Outbox may even cause Thunderbird to crash when it tries to deliver
scheduled messages. Note that corrupted folders are *not* Send Later's
fault... There are bugs in other parts of Thunderbird, which can cause
folders to become corrupted.

If your messages aren't being delivered properly, then please perform
the following two diagnostic tests to isolate exactly where the problem
lies:

##### Test \#1

1.  Disable the Send Later add-on.
2.  Restart Thunderbird.
3.  Compose a new message with a valid recipient, Subject, and message
    body.
4.  Select the "Send Later" command on the "File" menu of the
    composition window.

If you get an error at this point, then *Send Later is not the problem.*
Rather, one of the following is wrong:

-   corrupt Outbox folder --- see [below](#corrupt-outbox) for how to
    repair it;
-   full Windows temporary directory --- see [below](#wintemp) for how
    to repair it;
-   your hard disk is full; or
-   something is broken in your Thunderbird profile --- unfortunately
    the only way I've been able to find to resolve this is to [migrate
    to a new Thunderbird
    profile](https://support.mozilla.org/en-US/kb/using-multiple-profiles) and
    get rid of the old one.

##### Test \#2

1.  Start with a successful Test \#1, above.
2.  Check the "Outbox" folder underneath "Local Folders" and confirm
    that the message you composed is there.
3.  Select the "Send Unsent Messages" command under the "File" menu in
    the main Thunderbird window and confirm that the message in your
    Outbox folder is sent successfully.

If the "Send Unsent Messages" command is grayed out in the menu, i.e.,
you cannot execute it even though there is a message in the Outbox, or
if the message does not send successfully when you execute this command,
,then *Send Later is not the problem.* Rather, one of the problems and
solutions listed above in "Test \#1" applies.

##### Test \#3

1.  Start with successful Tests \#1 and \#2 above.
2.  Re-enable the Send Later add-on and restart Thunderbird.
3.  Compose a new message with a valid recipient, Subject, and message
    body.
4.  Schedule the message with Send Later to be sent five minutes in the
    future.
5.  Confirm that the message is saved to your Drafts folder.

If, instead of the message being saved into the Drafts folder, you get
an error, then try repairing your Drafts folder and then repeat this
test. If that doesn't fix the problem, then the error you're getting
probably isn't a Send Later issue, it's a generic Thunderbird issue, but
if you can't figure out what the problem is, feel free to [send us the
error message you're
getting](/cdn-cgi/l/email-protection#cbb8aea5afe6a7aabfaeb9e6b8bebbbba4b9bf8baeb3bfaea5afaeafe6bfa3bea5afaeb9e5a4b9ac)
and we'll try to help.

##### Test \#4

1.  Start with a successful Test \#3, above.
2.  Enable the "Send Later" column in the message list in your Drafts
    folder, if it isn't already displayed.
3.  Make sure that the Draft you scheduled shows the correct scheduled
    send time in the Send Later column. If it doesn't, then you are
    probably running into [this issue](#bad-mail-servers), and you need
    to use the workaround documented there --- configure Thunderbird to
    save Drafts locally rather than on the mail server --- to be able to
    use Send Later.

##### Test \#5

1.  Start with a successful Test \#4, above.
2.  Wait for the scheduled send time of the message and confirm that it
    is sent correctly by Send Later.
3.  If it isn't, and all the other tests above were successful, then
    [contact us for further
    assistance](/cdn-cgi/l/email-protection#36455358521b5a574253441b4543464659444276534e4253585253521b425e435852534418594451).

#### []{#corrupt-outbox}Corrupt Outbox folder

If your messages aren't being delivered or are being delivered multiple
times, then the first thing you should try is clearing your Outbox.
Here's how to do that:

1.  Make sure the "Outbox" folder under "Local Folders" doesn't have any
    messages in it (because we're about to delete the folder). If it
    does, and you want to save them, move them into your Drafts folder
    to be resent later.
2.  Right-click (on Mac, perhaps ctrl-click) on "Local Folders" and
    select "Settings...".
3.  Note the directory in which your local folders are stored.
4.  Browse to that directory.
5.  Exit completely from Thunderbird.
6.  Delete Outbox and Outbox.msf in the Local Folders directory if they
    exist. Also delete "Unsent Messages" and "Unsent Messages.msf" if
    they exist. If neither of them exists, then you'll have to use the
    advanced configuration editor (described [above](#config-editor)) in
    Thunderbird and look at the setting mail.default\_sendlater\_uri to
    find out the name of your Outbox folder on disk and then delete it
    (after exiting again from Thunderbird).
7.  Try scheduling a message with Send Later again and see if the
    problem is gone.

#### []{#drafts-cleanup}Corrupt Drafts folders

A good sign that one of your Drafts folders is corrupted is if Send
Later isn't noticing that there are scheduled messages, i.e., the
message at the bottom of your Thunderbird window says "IDLE" instead of
"PEND 1", "PEND 2", etc. However, if messages aren't getting sent at the
scheduled time, then you may still have a corrupted Drafts folder even
if the message says "PEND". You need to repair them all:

1.  Locate the Drafts folders for all of your accounts. The easiest way
    to do that, if you have multiple accounts, is to switch to the
    unified folder view (View \| Folders \| Unified) and expand
    "Drafts".
2.  Right click on each one and select "Properties...".
3.  Click the "Repair Folder" button in each Properties window, then
    click "OK".

**NOTE:** Repairing a folder resets its visible columns, column layout,
and sorting, so if you've customized the columns and/or sorting, you'll
have to put the customizations back after repairing the folders.

#### []{#wintemp}Full temporary directory on Windows

If your Windows temporary directory ends up with too many files in it,
which is partially Thunderbird's fault since it has a habit of creating
temporary files and not deleting them, then both Send Later and
Thunderbird may start malfunctioning. The two surefire signs of this
are, (a) Send Later is able to copy messages into your Outbox for
delivery, but once they're there, Thunderbird fails to deliver them, and
(b) when there are messages in your Outbox, the File \| Send Unsent
Messages command doesn't work, or is greyed out and can't even be
selected. If you this you may be running into this problem, you should
run the Windows Disk Cleanup utility and tell it to clean up temporary
files.

#### []{#gmail}Send errors with Gmail when Thunderbird is configured to save copies

Many users of Send Later report errors when the add-on attempts to send
scheduled messages through a Gmail account. These errors happen more
often, but not only, when Send Later attempts to deliver multiple
messages at the same time. This is usually caused by an error in the
Thunderbird configuration for the Gmail account. In particular, it is
not necessary to configure Thunderbird to save copies of sent messages
in Gmail's Sent Mail folder, since Gmail saves copies there
automatically (this is documented in [Google's configuration
instructions](https://support.google.com/mail/answer/78892) for
Thunderbird). When Thunderbird *is* incorrectly configured to save
copies, it can cause message delivery errors. When this occurs, the
delivery error happens after the message is sent to its recipients, when
the copy is being saved in Sent Mail. This could potentially cause the
recipients to receive multiple copies of the message, since if the user
then tells Thunderbird to try sending it again, it might re-attempt the
entire delivery, not just the saving in Sent Mail. Therefore, if you are
experiencing errors with Send Later through a Gmail account, check your
account settings to see if you have "Place a copy in" checked in the
"Copies & Folders" settings, and if so, turn it off.

### [Debug logging](#toc){#debug}

If you ask us for help with a problem you are having with the add-on
that we can't reproduce ourselves, then we may ask you to enable debug
logging on the add-on, perform some task with debug logging enabled, and
then send us the resulting debug log. Here are the instructions for how
to do that.

1.  Click on "Send Later" at the bottom of the main Thunderbird window
    and select "Send Later Preferences", or select "Add-ons\> Send
    Later" from the main menu button, or select Go to "Tools \> Add-on
    Preferences \> Send Later" from the toolbar.
2.  Click on the "Advanced" tab.
3.  Change "Console log level" to "All" (or whatever other value I tell
    you to change it to).
4.  Click on "OK".
5.  In the main Thunderbird window, type Ctrl-Shift-J to open the error
    console.
6.  Click the little trash can icon in the upper corner to clear the
    window.
7.  Do whatever task I told you to do with debug logging enabled.
8.  Repeat steps 1-4 above, but this time change the setting to "Fatal"
    instead of "All".
9.  Right click on one of the messages in the error console window and
    select "Select All".
10. Copy and paste the selected messages into an email message to us.

#### Alternative instructions

If the instructions above don't work, we might ask you to do the
following instead.

1.  Open the Thunderbird Options (Windows) or Preferences (other
    platforms).
2.  Click on "Config Editor..." in the General preferences (if there's
    an "Advanced" section under "General", that's where it will be).
3.  Search for "browser.dom.window.dump.enabled".
4.  If it's set to false, then double-click on it to change it to true.
5.  Exit from Thunderbird.
6.  On Windows:
    1.  Open a command window.
    2.  Run "cd %ProgramFiles%\\Mozilla Thunderbird" (if that doesn't
        work, try "cd %ProgramFiles(x86)%\\Mozilla Thunderbird").
    3.  Run "thunderbird -console".
7.  On Linux:
    1.  Open a terminal window.
    2.  Run "thunderbird \>\| /tmp/thunderbird.log 2\>&1".
8.  On Mac OS:
    1.  Open a terminal window.
    2.  Run
        "/Applications/Thunderbird.app/Contents/MacOS/thunderbird-bin \>\|
        /tmp/thunderbird.log 2\>&1".
9.  Click on "Send Later" at the bottom of the main Thunderbird window
    and select "Send Later Preferences", or select "Add-ons\> Send
    Later" from the main menu button, or select Go to "Tools \> Add-on
    Preferences \> Send Later" from the toolbar.
10. Click on the "Advanced" tab.
11. Change "Dump log level" to "All" (or whatever other value we tell
    you to change it to).
12. Click on "OK".
13. Do whatever task we told you to do with debug logging enabled.
14. Repeat steps 9-12 above, but this time change the setting to "Fatal"
    instead of "All".
15. On Windows:
    1.  Find the console window that Thunderbird opened with all the
        debug logging in it.
    2.  Right-click on the title bar of the console window and do
        "Edit \> Select All".
    3.  Hit Enter to copy the selected text.
    4.  Paste the copied text into an [email message to
        us](/cdn-cgi/l/email-protection#56253338327b3a372233247b2523262639242216332e2233383233327b223e233832332478392431).
16. On Linux or Mac OS:
    1.  Exit from Thunderbird.
    2.  Email us the file /tmp/thunderbird.log as an attachment or paste
        its contents into an [email message to
        us](/cdn-cgi/l/email-protection#691a0c070d4405081d0c1b441a1c1919061b1d290c111d0c070d0c0d441d011c070d0c1b47061b0e).

[Helping to improve the add-on](#toc){#improve}
-----------------------------------------------

### [Translations](#toc){#translate}

**NOTE:** This information about translating is currently out-of-date
because we are not yet set up to manage translations for the new version
of Send Later for Thunderbird 78. It's left here for reference purposes,
but contrary to what's written below, you shouldn't "just jump right in"
to translating on Crowdin, until we've updated things.

If the add-on's messages display in a different language than the rest
of Thunderbird, then that means that it hasn't been translated for your
language. Translating the add-on is done through
[Crowdin](https://crowdin.com/) and is quite easy. Everything you need
to know is
[here](https://github.com/jikamens/send-later/blob/master/TRANSLATING.md). I
am happy to help you out if you encounter any problems with Crowdin or
have any questions, and my wonderful team of current translators are
available to help as well. If you are interested in translating the add
on into your language, feel free to either [email us about
it](/cdn-cgi/l/email-protection#dba8beb5bff6b7baafbea9f6a8aeababb4a9af9bbea3afbeb5bfbebff6afb3aeb5bfbea9f5b4a9bc)
or just jump right in on Crowdin. Thanks!

### [Hacking](#toc){#hacking}

The complete source code for the add-on is [available on
Github](https://github.com/jikamens/send-later).

[Getting help](#toc){#help}
---------------------------

### [The "Send Later users" mailing list](#toc){#mailing-list}

The [Send Later users mailing
list](https://groups.google.com/group/send-later-users) is a great place
to ask questions about the add-on, chat with other users about how to
use it, or discuss future enhancements with the developer.

### [Contacting the developer](#toc){#contact-me}

Please do not post bug reports or requests for support as comments below
(feature requests are fine, though!). If you need help using the add-on,
please [e-mail
us](/cdn-cgi/l/email-protection#6211070c064f0e031607104f111712120d101622071a16070c0607064f160a170c0607104c0d1005)
instead and we will respond as soon as we can (which is usually very
quickly). Thanks!

### [Remote support](#toc){#remote-support}

In rare cases, when you are having a problem with Send Later that we
cannot reproduce, we may need to connect to your computer remotely to
see it in action. We may even need to ask you to let one of us "steer"
your keyboard and mouse briefly while troubleshooting. When this is
necessary, we use [TeamViewer](https://teamviewer.com/). [Click
here](https://www.teamviewer.com/en/download/) to download the
TeamViewer client which will give me access to your desktop, then [email
us](/cdn-cgi/l/email-protection#6e1d0b000a43020f1a0b1c431d1b1e1e011c1a2e0b161a0b000a0b0a431a061b000a0b1c40011c09)
your TeamViewer ID and password (please **do not** email them to us
unless we've asked you for them!). Thanks to TeamViewer for providing
its software for free for non-commercial use!

### [Other resources](#toc){#resources}

The kind folks at [TCH-Support](http://www.tch-support.com/) have
published a [video
tutorial](https://www.youtube.com/watch?v=XaWLWWFy9r8) in German of how
to use Send Later. They've also produced an [English
version](https://www.youtube.com/watch?v=5bhLO9GQIsA). Enjoy!

[Support Send Later!](#toc){#donate}
------------------------------------

I have dedicated countless hours to developing and supporting Send
Later. I believe in free software, and the add-on will be completely
free for as long as I continue to maintain it, which will be, I hope,
for a good long time. Having said that, I am extremely grateful for the
donations made by users like you,and the amount of time I devote to
improving Send Later is strongly influenced by them. Please [click
here](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jik%40kamens%2eus&lc=US&item_name=Send%20Later%20add%2don%20%28%245%2e00%20recommended%20donation%2c%20but%20give%20what%20you%27d%20like%21%29&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donat)
to donate via Paypal; if that link doesn't work, try [this
one](https://paypal.me/JonathanKamens); if that doesn't work either, you
can send a Paypal payment to
"[\[email protected\]](/cdn-cgi/l/email-protection){.__cf_email__}". A
donation of \$10 or more makes you eligible for listing, including a
link, banner or button if you'd like, on the [supporters
list](#supporters)! If you don't like Paypal or can't use it for some
reason, there are other ways you can make a monetary contribution to
support Send Later:

-   You can Venmo me at "Jonathan-Kamens".
-   You can send Bitcoin to 16kWgAVVUSCz1j1oevBFhCGmZQsvi92fmy (if you
    do this, please email [[\[email protected\]]{.__cf_email__
    data-cfemail="cda7a4a6e6bea8a3a9a1acb9a8bffe8da6aca0a8a3bee3b8be"}](/cdn-cgi/l/email-protection#0c666567277f696268606d78697e3f4c676d6169627f22797f)
    if possible and let me know, since I don't check my Bitcoin wallet
    that often).

A non-monetary way you can help is by [writing a
review](https://addons.thunderbird.net/thunderbird/addon/send-later-3/reviews/add "Review Send Later").
Even if you've written a review before, please do it again! Here's why:
reviews are linked to specific versions of the add-on, so when we
release new versions and expire old ones, the reviews linked to them are
removed from the site. Also, if there is a specific feature you would
like us to add, and you're willing to fund its development, please
[email
us](/cdn-cgi/l/email-protection#6516000b0148090411001748161015150a171125001d11000b01000148110d100b0100174b0a1702)
and we can discuss it. Of course, you should feel free to send us
feature requests at any time, even ones you do not wish to fund; We'll
put them into out queue and get to them as soon as we can.

[Check out my other add-ons](#toc){#other-addons}
-------------------------------------------------

I've written or maintained several [other
add-ons](https://addons.thunderbird.net/thunderbird/user/jikamens/)
which you may find useful:

-   "[Folder Pane View
    Switcher](https://addons.thunderbird.net/thunderbird/addon/folder-pane-view-switcher/)"
    puts two little arrows above the folder tree which you can click to
    scroll back and forth through the available folder tree views.
    Furthermore, it causes the folder tree to switch to the "All
    Folders" view automatically if you are in the middle of dragging and
    dropping messages and you hover your mouse over the title bar at the
    top of the folder tree, so that you can drop the messages into a
    folder that isn't displayed in your current view.
-   "[Reply to Multiple
    Messages](https://addons.thunderbird.net/thunderbird/addon/reply-to-multiple-messages/)"
    lets you select multiple messages in the message list and compose a
    single reply to the senders of all of the selected messages.
-   "[Enhanced Priority
    Display](https://addons.thunderbird.net/thunderbird/addon/enhanced-priority-display/)"
    makes message priorities display better by replacing the words in
    the "Priority" column with icons, highlighting the rows in the
    message list for high-priority messages, and fading the rows in the
    message list for low-priority messages.
-   "[IMAP Received
    Date](https://addons.thunderbird.net/thunderbird/addon/imap-received-date/)"
    makes the "Received" column in IMAP folders show when messages were
    actually received.
-   "[Undigestify](https://addons.thunderbird.net/thunderbird/addon/undigestify/)"
    unpacks RFC 1153, ListStar, and Yahoo digest messages into separate
    messages.
-   "[Show All Body
    Parts](https://addons.thunderbird.net/thunderbird/addon/show-all-body-parts/)"
    enables the View \| Message Body As \| All Body Parts message
    display mode, so that you can access all of the parts of a message,
    including for example both the text and HTML version of the message
    and all its inline images, as attachments.
-   "[ToggleReplied](https://addons.thunderbird.net/thunderbird/addon/togglereplied-2/)"
    lets you to toggle on and off the "Forwarded", "Replied", and
    "Redirected" flags on existing email messages. This add-on was
    originally written by Christian Eyrich. He is no longer maintaining
    it, so I've released an updated version of it which is compatible
    with the newest Thunderbird versions.
-   "[Remote Content By
    Folder](https://addons.thunderbird.net/thunderbird/addon/remote-content-by-folder/)"
    lets you decide which messages to show images in automatically based
    on what folder they are in (e.g., you might want to automatically
    show images for messages in your inbox, but not your Spam folder).
-   "[userChromeJS](https://addons.thunderbird.net/thunderbird/addon/userchromejs-2)"
    is a rebuild from the ground up for Thunderbird 68+ of the earlier
    add-on of the same name. It allows you to configure Thunderbird to
    execute arbitrary JavaScript code in every Thunderbird window when
    it opens. See also its [home on
    Github](https://github.com/jikamens/userChromeJS).

[Credits](#toc){#credits}
-------------------------

A number of people deserve credit for helping to make this add-on what
it is today. A huge thank you to Karthik Sivaram, the author and
maintainer of the add-on prior to Thunderbird 3! I would never have been
able to create and maintain the current version if not for its
predecessor that he wrote. Thanks, also, to the people who have
translated the add-on into non-English languages (at present, Dutch,
Finnish, French, German, Italian, Japanese, Polish, Spanish, Swedish,
and Simplified Chinese). These translations were created by Dtrieb from
BabelZilla and Erwin D. Glockner (German), urko from BabelZilla
(Spanish),
[Samtron-Translations](https://plus.google.com/114276880405600229762)
(Finnish), Bigpapa from BabelZilla (French), Cesare from BabelZilla
(Italian), Amigomr from BabelZilla (Japanese), markh from BabelZilla
(Dutch), Maciej Kobuszewski (Polish), Mikael Hiort af Ornäs (Swedish),
and Wang.H.K from BabelZilla (Simplified Chinese). Please [see
below](#translate) if you would like to help add another translation.
It's not hard!

### [Supporters](#toc){#supporters}

I am grateful to the hundreds of people who have [made monetary
contributions](#donate) to support the ongoing development of Send
Later. Too many have contributed to be able to list you all here, but
special recognition is due to those who have contributed significantly
more than the suggested donation.

#### Gold supporters (\>\$50)

-   ![](/wp-content/uploads/2010/07/LEADSExplorer1.jpg "LEADSExplorer"){.alignnone
    .size-full .wp-image-2734 .jetpack-lazy-image width="212"
    height="35"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/LEADSExplorer1.jpg "LEADSExplorer"){.alignnone
    .size-full .wp-image-2734 width="212" height="35"}
    --- Converting more visitors into leads by knowing who visits your
    website
-   ![CONIN Werbeagentur in
    Köln](/wp-content/uploads/2010/07/conin-werbeagentur-in-koeln1.jpg "CONIN Werbeagentur"){.alignnone
    .jetpack-lazy-image width="200" height="35"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![CONIN Werbeagentur in
    Köln](/wp-content/uploads/2010/07/conin-werbeagentur-in-koeln1.jpg "CONIN Werbeagentur"){.alignnone
    width="200" height="35"}
-   Erowid Center
-   ![](/wp-content/uploads/2010/07/ats-logo-s1.png "a-team systems"){.alignnone
    .wp-image-4167 .jetpack-lazy-image
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/ats-logo-s1.png "a-team systems"){.alignnone
    .wp-image-4167}
     --- Professional FreeBSD and Linux server administration,
    clustering, monitoring and scaling
-   ![David Berman
    Communications](/wp-content/uploads/2010/07/davidberman.com-wordmark-cmyk1.png){.jetpack-lazy-image
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![David Berman
    Communications](/wp-content/uploads/2010/07/davidberman.com-wordmark-cmyk1.png)
    [WCAG compliance without tradeoffs for the mainstream
    user](https://www.davidberman.com/accessibility/web-accessibility-videos/)
-   [The Ripples Guy](http://theripplesguy.com/)
-   ![](/wp-content/uploads/2018/10/isgroup_600.png){.jetpack-lazy-image
    width="100"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2018/10/isgroup_600.png){width="100"}
     ISGroup Information Security Group: Ethical Hacking and Penetration
    Testing
-   [Ripcord Engineering](https://www.ripcordengineering.com/)
-   Anonymous

#### Silver supporters (\>\$25)

-   ![](https://i1.wp.com/multicraft.org/images/banner_half.png?resize=234%2C60&ssl=1 "Multicraft"){.alignnone
    .jetpack-lazy-image width="234" height="60"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](https://i1.wp.com/multicraft.org/images/banner_half.png?resize=234%2C60&ssl=1 "Multicraft"){.alignnone
    width="234" height="60"}
-   Trace Media Marketing --- a New York SEO company
-   ![](/wp-content/uploads/2010/07/CCRlogo1.png "CCRlogo"){.jetpack-lazy-image
    width="40" height="40"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/CCRlogo1.png "CCRlogo"){width="40"
    height="40"}
    Creative Conflict Resolutions, LLC, Boulder, CO ---
    Mediation/Arbitration --- Satisfying Settlements that Last™
-   ![](/wp-content/uploads/2010/07/peter_square1.jpg){.jetpack-lazy-image
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/peter_square1.jpg)
    PSDT: Perl training, mentoring, & code review by author Peter Scott.
-   Thanks for a valuable piece of software from [Scalable
    Finance](http://www.scalablefinance.com/) --- Advising Business
    Angels, Sourcing investments, Venture Capital and Private Lending.
-   [McCormick & Murphy, P.C.](https://www.mccormickmurphy.com/), a
    Denver area personal injury lawyer
-   [michael-held.com](http://michael-held.com/) --- Munich-based
    Graphic Designer
-   ![elliptic\_marketing](/wp-content/uploads/2010/07/elliptic_marketing1.jpg){.alignnone
    .wp-image-3938 .jetpack-lazy-image
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![elliptic\_marketing](/wp-content/uploads/2010/07/elliptic_marketing1.jpg){.alignnone
    .wp-image-3938}
    Online Marketing Agency in Miami -- Experts in email marketing,
    digital advertising, and Hispanic marketing campaigns.
-   Dr. Ken Rich
-   ![](/wp-content/uploads/2010/07/metasepia-button1.jpg){.jetpack-lazy-image
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/metasepia-button1.jpg)
    Metasepia Games --- a women's game studio creating interactive
    fiction games
-   Steve Wozenski
-   Tilman Berger
-   Anonymous (multiple)

#### Bronze supporters (\>\$10)

-   [MagicLamp Networks ― Dallas Web Design &
    eCommerce](http://magiclamp.net/)
-   Ingo from Germany
-   Håkon from Norway
-   [Ricky from California](http://www.rickyshah.com/)
-   ![](/wp-content/uploads/2010/07/HubAustinLogo1.png "HubAustin"){.alignnone
    .wp-image-2769 .jetpack-lazy-image width="186" height="45"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/HubAustinLogo1.png "HubAustin"){.alignnone
    .wp-image-2769 width="186" height="45"}
    --- South Austin's only coworking space
-   The EML Group of companies in New Zealand and Australia
-   Erowid
-   [konehead design™](http://www.koneheaddesign.com/) --- Communication
    Ideas that work. Discover the affordability of quality design.
-   [Exports International LLC](http://www.exportsinternational.com) ---
    Happy to support a fine product that answered an email need of ours.
-   ![](/wp-content/uploads/2010/07/elite_adventure_tours1.gif "elite_adventure_tours"){.alignnone
    .wp-image-3031 .jetpack-lazy-image width="60" height="61"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/elite_adventure_tours1.gif "elite_adventure_tours"){.alignnone
    .wp-image-3031 width="60" height="61"}
    of Los Angeles -- Custom Private Luxury Tours in California
-   Christoph from Germany --- "Interesting: Don't pay for software, but
    support the idea behind it ..."
-   "Keep up the terrific work and don't stop developing Send Later!"
    --- Mike C.
-   kathi and the vom Viersen Rottweilers, Chicago, IL
-   [Telapost](http://telapost.com/) -- Thank you for the excellent
    add-on!
-   [Tdotwire.com](http://www.tdotwire.com/) --- Free Dating in Toronto
-   ![purple\_heart](/wp-content/uploads/2010/07/purple_heart1.png){.alignnone
    .size-full .wp-image-3292 .jetpack-lazy-image width="111"
    height="107"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![purple\_heart](/wp-content/uploads/2010/07/purple_heart1.png){.alignnone
    .size-full .wp-image-3292 width="111" height="107"}
    "Excellent add-on for both Thunderbird and Posbox! Support is second
    to none!" --- Jerry (Pop) Fairfield
-   [Bome Software](http://www.bome.com/)
-   [www.radiocity.ch](http://www.radiocity.ch/) --- internet code &
    design, Zurich, Switzerland
-   Conrad from New Jersey
-   Naoaki Ichihara
-   [Fensons -- web design and development](http://www.fensons.com/)
-   Charles Manske and [Optimage Health](http://www.optimagehealth.com)
    support good software like 'Send Later' because if it's valuable,
    you should pay something for it!
-   [Call the Ninja](http://www.calltheninja.com/ "Call the Ninja")
    \$200 Flat-rate Data Recovery. No recovery, no fee. Serving clients
    across LA and the United States.
-   David Terrell
-   Paul Wright
-   Michael Sachs, M.D.
-   [Marco Cirspini](https://about.me/marco.crispini)
-   Patrick Murphy, James Valley Hutterian Brethren
-   [Cafe Astrology](https://cafeastrology.com/) --- "The add-on is
    extremely useful and works well."
-   Thierry Viéville, [Inria](https://www.inria.fr) --- "so smart, so
    useful : i saved so much time and avoid also many mistakes 🙂 for
    years by sending later with Send Later, thanks also for the help
    when i did need it"
-   ![](/wp-content/uploads/2010/07/Obee-App-Table-Booking-System1.png){.jetpack-lazy-image
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/Obee-App-Table-Booking-System1.png)
       <https://obeeapp.com/>
-   ![](/wp-content/uploads/2010/07/Logo_Contidos.png){.alignnone
    .size-full .wp-image-4584 .jetpack-lazy-image
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2010/07/Logo_Contidos.png){.alignnone
    .size-full .wp-image-4584}
     [Contidos Dixitais](http://www.contidosdixitais.com/)
-   Felix Salmones from Spain --- "Don't send now, what you can Send
    later... 🙂 "
-   bwithage --- "Canada --- Hockey Stars and Nanaimo Bars"
-   Thanks for a great extension! Jim Roper, in Brazil
-   Dan Kloke (x2)
-   Ondra Zlamal
-   Angelo V. -- SanGio.de -- Thank you for the excellent add-on!
-   Patrick Bell
-   ![](/wp-content/uploads/2018/10/igmcpibggnclpian.ico){.alignnone
    .size-full .wp-image-5381 .jetpack-lazy-image
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![](/wp-content/uploads/2018/10/igmcpibggnclpian.ico){.alignnone
    .size-full .wp-image-5381}
     Brian S. Wilson: Great plugin and something Thunderbird has needed
    for a long time.
-   Tomas Flaska
-   [ender informatics gmbh](https://www.ender-informatics.ch/)
-   Jörg-Ingo from Germany
-   [Faunt](https://www.faunt.de/): Find sustainable products easily
-   [www.bcdb.info](http://www.bcdb.info/) --- ISDS Working Border
    Collie pedigrees
-   ![Valley Justice
    Coalition](/wp-content/uploads/2019/07/VJC-logo-large-right-hands-140x50.png){.jetpack-lazy-image
    width="140 px" height="50 px"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
    ![Valley Justice
    Coalition](/wp-content/uploads/2019/07/VJC-logo-large-right-hands-140x50.png){width="140 px"
    height="50 px"}
    --- Criminal Justice Advocacy in Harrisonburg, Virginia
-   Anonymous (multiple)

There's room on this list for you too! 🙂

[Send Later Release notes](#toc){#notes}
----------------------------------------

### []{#notes-7.4.4}Release 7.4.4 (May 28, 2020)

If you've just upgraded from Thunderbird 60 to Thunderbird 68, then
please see [below](#notes-7.1.0) for information about the Send Later
upgrade for Thunderbird 68, in addition to the notes following this
paragraph for subsequent releases.

Changes in 7.4.4:

Somehow some Dutch strings ended up in the Danish translation. I
honestly have no idea how this happened, but in any case, it is now
fixed.

Please help make Send Later better!

-   **I need translators.** Send Later's Armenian, Bulgarian, Danish,
    Japanese, Polish, Slovenian, and Turkish translations are
    incomplete. Please [email
    me](%20mailto:jik+sendlater3@kamens.us?subject=) if you speak one or
    more of these languages and are able to help translate.
-   Please [write a
    review](https://addons.thunderbird.net/thunderbird/addon/send-later-3/reviews/add "Review Send Later") for
    the current version of the add-on, even if you've written one before
    for an earlier version. I have to periodically remove old versions
    of the add-on from addons.thunderbird.net, and when I do that, the
    reviews written for those versions disappear, so even if you've
    written a review before, please update it for the current version.
-   Don't forget to join [the Send Later mailing
    list](https://groups.google.com/group/send-later-users)!
-   Finally, if you like Send Later, please consider
    [contributing](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jik%40kamens%2eus&lc=US&item_name=Send%20Later%20add%2don%20%28%245%2e00%20recommended%20donation%2c%20but%20give%20what%20you%27d%20like%21%29&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donat) to
    support its continued development. A donation of \$10 or more makes
    you eligible for listing, including a link, banner or button if
    you'd like, on the [supporters list](#supporters)!

Check out my [other add-ons](#other-addons)!

### []{#notes-7.4.3}Release 7.4.3 (March 17, 2020)

If you've just upgraded from Thunderbird 60 to Thunderbird 68, then
please see [below](#notes-7.1.0) for information about the Send Later
upgrade for Thunderbird 68, in addition to the notes following this
paragraph for subsequent releases.

Changes in 7.4.3:

Remove the Kickstarter campaign pop-up, since the campaign has succeeded
and is almost over.

### []{#notes-7.4.2}Release 7.4.2 (March 1, 2020)

If you've just upgraded from Thunderbird 60 to Thunderbird 68, then
please see [below](#notes-7.1.0) for information about the Send Later
upgrade for Thunderbird 68, in addition to the notes following this
paragraph for subsequent releases.

Changes in 7.4.2:

**Fix bug in putting previous scheduled send time in compose toolbar**

If the user adds the send time text box to the compose toolbar and then
edits a previously scheduled message, the previous send time is supposed
to show up in the text box automatically, but instead the word "long"
was showing up because I forgot a couple of curly braces in a date
formatting string. I'm amazed that this has been broken for almost six
months and no one has mentioned it to me before now.

**Translation updates**

Complete Catalan, Chinese (both simplified and traditional), Finnish,
Galician, Portuguese (both European and Brazilian), and Russian
translations.

Add to (not yet finished) Danish, Polish, and Slovenian translations.

As always, thank you to my translators!

Please help make Send Later better!

-   **I need translators.** Send Later's Armenian, Bulgarian, Danish,
    Japanese, Polish, Slovenian, and Turkish translations are
    incomplete. Please [email
    me](%20mailto:jik+sendlater3@kamens.us?subject=) if you speak one or
    more of these languages and are able to help translate.
-   Please [write a
    review](https://addons.thunderbird.net/thunderbird/addon/send-later-3/reviews/add "Review Send Later") for
    the current version of the add-on, even if you've written one before
    for an earlier version. I have to periodically remove old versions
    of the add-on from addons.thunderbird.net, and when I do that, the
    reviews written for those versions disappear, so even if you've
    written a review before, please update it for the current version.
-   Don't forget to join [the Send Later mailing
    list](https://groups.google.com/group/send-later-users)!
-   Finally, if you like Send Later, please consider
    [contributing](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jik%40kamens%2eus&lc=US&item_name=Send%20Later%20add%2don%20%28%245%2e00%20recommended%20donation%2c%20but%20give%20what%20you%27d%20like%21%29&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donat) to
    support its continued development. A donation of \$10 or more makes
    you eligible for listing, including a link, banner or button if
    you'd like, on the [supporters list](#supporters)!

Check out my [other add-ons](#other-addons)!

### []{#notes-7.4.0}Release 7.4.0 (February 3, 2020)

If you've just upgraded from Thunderbird 60 to Thunderbird 68, then
please see [below](#notes-7.1.0) for information about the Send Later
upgrade for Thunderbird 68, in addition to the notes following this
paragraph for subsequent releases.

Changes in 7.4.0:

Translation updates.

Please help make Send Later better!

-   **I need translators.** Send Later's Armenian, Bulgarian, Danish,
    Japanese, Polish, Slovenian, and Turkish translations are
    incomplete. Please [email
    me](%20mailto:jik+sendlater3@kamens.us?subject=) if you speak one or
    more of these languages and are able to help translate.
-   Please [write a
    review](https://addons.thunderbird.net/thunderbird/addon/send-later-3/reviews/add "Review Send Later") for
    the current version of the add-on, even if you've written one before
    for an earlier version. I have to periodically remove old versions
    of the add-on from addons.thunderbird.net, and when I do that, the
    reviews written for those versions disappear, so even if you've
    written a review before, please update it for the current version.
-   Don't forget to join [the Send Later mailing
    list](https://groups.google.com/group/send-later-users)!
-   Finally, if you like Send Later, please consider
    [contributing](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jik%40kamens%2eus&lc=US&item_name=Send%20Later%20add%2don%20%28%245%2e00%20recommended%20donation%2c%20but%20give%20what%20you%27d%20like%21%29&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donat) to
    support its continued development. A donation of \$10 or more makes
    you eligible for listing, including a link, banner or button if
    you'd like, on the [supporters list](#supporters)!

Check out my [other add-ons](#other-addons)!

### []{#notes-7.3.9}Release 7.3.9 (January 25, 2020)

Translation updates.

### []{#notes-7.3.8}Release 7.3.8 (January 23, 2020)

Changes in 7.3.8:

This add-on will no longer be supported when Thunderbird 78 is released
in a few months, unless enough people commit to supporting continued
maintenance of the add-on to make it feasible. To show your commitment,
please visit [the Kickstarter
campaign](https://www.kickstarter.com/projects/jik/rewritten-add-ons-for-mozilla-thunderbirds-next-release)
and make a pledge. As a bonus, Kickstarter supporters of this and my
other add-ons will receive significant discounts on add-on licenses.

This release of the add-on adds a pop-up message warning users about the
potential end of support and encouraging people to visit the Kickstarter
campaign and support it.

### []{#notes-7.3.6}Release 7.3.6 (January 22, 2020)

Changes since 7.3.5:

Fix errors for users of Thunderbird in Danish.

### []{#notes-7.3.5}Release 7.3.5 (January 17, 2020)

Changes in 7.3.5:

Fix Send Later for compatibility with Owl for Exchange.

### []{#notes-7.3.4}Release 7.3.4 (December 8, 2019)

Changes in 7.3.4:

**FIX: Update the menu properly in the dynamic function editor**

When creating or deleting functions in the dynamic function editor,
update the list of available functions in the menu properly. Previously,
updates were failing, so you had to close and re-open the editor window
to refresh the list of available functions.

**ENH: Accept CRLF line breaks in dynamic function export files**

Now that dynamic function export files, i.e. ".slj" files, have line
breaks in them, it's possible for them to be transmitted and copied in
such a way that their LF line terminators get turned into CRLF, e.g., if
someone views a .slj file in a browser and then copies and pastes it
into a text file on Windows. There's no reason why we can't support
this, so let's do it.

**I18N: Several updates to the Chinese translations**

### []{#notes-7.3.3}Release 7.3.3 (November 27, 2019)

If you've just upgraded from Thunderbird 60 to Thunderbird 68, then
please see [below](#notes-7.1.0) for information about the Send Later
upgrade for Thunderbird 68, in addition to the notes following this
paragraph for subsequent releases 7.3.3, 7.3.2, 7.3.1, 7.3.0, 7.2.1,
7.2.0, 7.1.3, and 7.1.2.

Changes in 7.3.3:

**Finish up the last few strings in the Polish translation.**

Thanks to Wojciech Kazimierczak for getting the Polish translation
across the finish line!

### []{#notes-7.3.2}Release 7.3.2 (November 27, 2019)

Changes in 7.3.2:

**Fix potential message corruption in non-English locales**

In some foreign languages it was possible for scheduled messages to be
corrupted when they were sent, because a date being inserted at the top
of the message contained a textual description of the sender's time
zone, which could include foreign-language characters which confused
Thunderbird into thinking there was a line break in the message where
there shouldn't be one.

This has been fixed by no longer inserting the textual time zone
description into the message.

### []{#notes-7.3.1}Release 7.3.1 (November 21, 2019)

Changes in 7.3.1:

Fix date parsing in the Polish locale

Prior to release 7.3.0, we weren't actually parsing dates in Polish for
people using Thunderbird in Polish, so we didn't notice that there was a
bug for Polish in the third-party date-parsing library Send Later users.
Starting in 7.3.0 we were doing a better job of selecting the language
for parsing dates, so we started actually trying to parse dates in
Polish, which caused the hidden bug to show up.

In this release we patch that bug, so now Polish users of the add-on
should be able to type dates into the prompt window.

### []{#notes-7.3.0}Release 7.3.0 (November 20, 2019)

Fix date-parsing for non-English locales (again)

The previous fix for Thunderbird 68 to make Send Later determine the
correct locale to parse dates in apparently broke before Thunderbird 68
actually shipped, so an additional fix is called for.

People using Thunderbird in a foreign language that Send Later knows how
to parse should be able to type dates in that language again.

This release also contains a small update to the Italian translation.

### []{#notes-7.2.1}Release 7.2.1 (November 5, 2019)

Changes in 7.2.1:

Extra logging and error handling to work around an issue that seems to
be cropping up for the first time in Thunderbird 68, preventing
scheduled messages in some Drafts folders from being sent.

Compatibility changes for Thunderbird 71+.

Translation updates.

### []{#notes-7.2.0}Release 7.2.0 (September 23, 2019)

Changes in 7.2.0:

**New feature: Support a simple n-minute delay for all sent messages**

You can now configure Send Later (via its preferences) to schedule all
messages which you send with the Send button or Ctrl-Enter to be delayed
by a specified number of minutes.

Note that this feature and the "'Send' does 'Send Later\'" feature are
incompatible so only one of them can be enabled at a time.

This is the long-awaited replacement for the functionality of the old
"BlunderDelay" Thunderbird extension.

**Bug fixes:**

The preferences window works in Thunderbird 71+ now.

Some (but perhaps not all) instances of the "Send Later" column showing
in folders where it shouldn't have been fixed.

### []{#notes-7.1.3}Release 7.1.3 (September 18, 2019)

Fix a bug which has been preventing saving or removing dynamic
scheduling functions from working since Thunderbird 68.

Update translations.

### []{#notes-7.1.2}Release 7.1.2 (September 9, 2019)

Changes since 7.1.0 (7.1.1 was never released):

Fix the OK, Cancel, and Reset buttons in the preferences window, which
were broken in Thunderbird 68.

Add a preference to allow the user to disable the Ctrl-Alt-1, -2, and -3
key bindings in the message composition window.

Spread out the links at the bottom of the preferences window so they
aren't all scrunched together.

Implement a compatibility fix for Thunderbird 70+ to make the toolbar
buttons in the message composition window work properly again.

Update some translations.

### []{#notes-7.1.0}Release 7.1.0 (September 6, 2019)

**Welcome to the Send Later release notes!**

Typically, these release notes only include changes since the most
recent release. However, since some of you may have just upgraded from
Thunderbird 60 to Thunderbird 68 and therefore made a big jump from Send
Later 6.4.6 to 7.1.0, and since by default Send Later doesn't display
release notes for patch releases, it has been a while since Send Later
has shown release notes to most of you. Therefore, these notes summarize
what has changed between versions 6.4.6 and 7.1.0 of Send Later.

First and foremost, significant modifications to Send Later were
required to make it compatible with Thunderbird 68. These changes have
been tested pretty extensively, but there may still be rough edges, so
please make sure to let me know about any issues you encounter. You can
either [email
me](/cdn-cgi/l/email-protection#046e6d6f2f77616a60686570617637446f6569616a772a7177)
or [post an issue on
Github](https://github.com/jikamens/send-later/issues).

As you know, the Send Later window that pops up when you type
Ctrl-Shift-Enter or select the "File \| Send Later" menu command allows
the date and time to send a message to be entered either by typing it
out or by pointing and clicking at "datepicker" and "timepicker"
widgets. However, due to changes in the version 68 of the Thunderbird
application, the datepicker and timepicker are now only displayed if you
have the "Lightning" add-on installed and enabled. This also means that
you can't set delivery time ranges in a message unless "Lightning" is
there.

Speaking of that, when you do change the delivery time range in the
prompt window, Send Later is now smart enough to adjust the other end of
the range when it makes sense to do so. For example, if the start time
is set to 11:00 AM and then you change the end time to 10:00 AM, the
start time will adjust automatically to 10:00 AM, since it doesn't make
sense for the start time to be later than the end time.

Unfortunately, the datepicker and timepicker that Send Later is now
using don't work when inserted into the composition window toolbar, so
they are no longer among Send Later's custom toolbar widgets.

The Send Later progress bar which used to appear at the bottom of the
main Thunderbird window every minute, and which was never particularly
accurate or useful, is gone. In its place, when send Later is checking
for scheduled messages to send its status at the bottom of the window
changes to "CHECKING".

SeaMonkey and Postbox are no longer supported. Support for them may
return at some point, but it's not clear when or if that will happen.

There have been lots of updates to the translations, including a new
Hungarian translation. Thanks very much to all of my translators!

Speaking of translations, previously the add-on was displaying "Send
Later" as the name of the add-on even for translations which had opted
to translate the name into a foreign language. This has now been fixed.

Previously, when you went to edit the preset buttons in the preferences,
the label preference for each button showed "" instead of the actual
label for the button. This was confusing and has been fixed, so now the
actual label for the button is displayed in the preferences.

A tooltip has been added for the "Send Later" composition window toolbar
button.

The library that Send Later uses for parsing dates and times, SugarJS,
has been updated to a newer version which should be at least slightly
better at parsing.

### []{#notes-7.0.9}Release 7.0.9 (September 5, 2019)

Translation updates.

BUGFIX: Previously, the English version of Send Later was displaying the
scheduled message count twice at the bottom of the main Thunderbird
window, e.g., if there were two scheduled messages it would display
"PEND 2 2" instead of "PEND 2". This has been fixed.

### []{#notes-7.0.8}Release 7.0.8 (August 10, 2019)

Changes since 7.0.7:

Thunderbird 68 compatibility changes.

### []{#notes-7.0.7}Release 7.0.7 (August 6, 2019)

Upgrade the SugarJS library for some minor improvements in date-parsing.

Non-functional changes to future-proof the add-on against upcoming
breaking changes in Thunderbird.

### []{#notes-7.0.6}Release 7.0.6 (July 25, 2019)

Some code hygiene changes which don't actually have any user-visible
impact, at least not currently, but might in the future, so I made the
changes to future-proof the code.

### []{#notes-7.0.5}Release 7.0.5 (July 15, 2019)

Make the add-on icon show up in the Tools \| Add-On Preferences menu.

Make some additional minor Thunderbird 68+ compatibility changes.

### []{#notes-7.0.4}Release 7.0.4 (July 14, 2019)

**TRANSLATIONS:** Various improvements to translations:

-   -   -   Complete Hungarian translation, thanks to Óvári!
        -   Additions to the Dutch and Greek translations.
        -   The correct, translated add-on name now appears throughout
            the add-on, for translations that choose to localize it,
            rather than the add-on name sometimes appearing as "Send
            Later" in English.
        -   Allow the log level settings in the preferences to be
            translated.
        -   Reorganize bits and pieces of the translation framework to
            accommodate language structure differences between English
            and some other languages, most notably Hungarian.
        -   Remove some English strings that somehow crept into the
            Armenian translation.

Thanks, as always, to all of my awesome translators!

**FIX:** Eliminate "double down arrows" in compose window.

Send Later was causing there two be an extra downward-pointing arrow on
the right end of pop-up menu buttons. Not anymore!

**FIX:** Fix broken numeric input boxes.

A couple of text-entry boxes for entering numbers weren't functioning
properly due to changes in Thunderbird 68. This has now been fixed.

**ENHANCEMENT:** Get rid of confusing "\<from locale\>" in preferences
window.

Previously, when the user went to edit the label and value for one of
the shortcut buttons, the label text that appeared in the preferences
tag by default was "\<from locale\>". This was confusing and people
didn't really know what to make of it. Now, the actual label text in the
current language will appear instead, unless the user changes the label
text, in which case the user's specified text will appear.

**ENHANCEMENT:** Add a tooltip for the "Send Later" button in the
compose window toolbar.

### []{#notes-7.0.3}Release 7.0.3 (June 17, 2019)

Changes since 7.0.2:

**Restore date-picker and time-pickers**

For Thunderbird 68+, restore the date-picker and time-pickers to the
Send Later prompt window, which means that it is once again possible to
schedule a message exclusively using the mouse, and it is once again
possible to put time-of-day restrictions on the delivery of scheduled
messages.

Two caveats:

-   -   1.  The date-picker and time-pickers are only available in Send
            Later when the Lightning add-on is installed and enabled.
            This is because there is still no working date-picker or
            time-picker functionality in the core Thunderbird
            application, so Send Later is for the time being using the
            date-picker and time-picker included with Lightning.
        2.  The Send later date/time-picker that could previously be
            added to the message composition toolbar is still
            unavailable, because the date-picker and time-picker in
            Lightning doesn't work in toolbar buttons.

This change adds one additional new bit of functionality that wasn't
there before: when you change either the start or end time in the
"Between" range in the prompt window, the other time bracketing the
range is adjusted to preserve the validity of the range. So, for
example, if the start time is set to 11:00 AM and then you change the
end time to 10:00 AM, the start time will change to 10:00 AM
automatically.

**Translation updates**

Add an incomplete Hungarian translation.

Add the bare-bones of a Danish translation (you won't actually see any
translated strings in the UI yet).

Thanks as always to my translators! Be in touch if you want to help
translate.

### []{#notes-7.0.2}Release 7.0.2 (June 16, 2019)

Changes since 7.0.1:

Fix a bug which was preventing messages from being marked replied or
forwarded when a reply or forward was scheduled with Send Later.

Fix a Thunderbird 69 compatibility issue which was preventing the Send
Later prompt window from going away after a message was scheduled.

### []{#notes-7.0.1}Release 7.0.1 (March 30, 2019)

Changes since version 6.4.6:

**This release of Send Later only works with Thunderbird 68 and newer.**
For older versions of Thunderbird, you need to download [version
6.4.6](/thunderbird/addon/send-later-3/versions/?page=1#version-6.4.6).

This is the first release of Send Later which attempts to be compatible
with Thunderbird 68, so there may be some rough edges I haven't stumbled
across yet. Please [let me
know](/cdn-cgi/l/email-protection#38525153134b5d565c54594c5d4a0b785359555d564b164d4b)
if you run into any problems that aren't mentioned below!

Here are the known, user-visible changes in this release:

The datepicker and timepickers in the Send Later dialog are currently
disabled, and the datepicker / timepicker combo that goes in the compose
window toolbar doesn't work. This is because there are currently
problems with the datepicker and timepicker widgets, so I can't get them
to work in Send Later. This has two functional impacts until I am able
to fix it:

-   -   1.  You have to enter the send time by typing it rather than
            being able to click.
        2.  You can't set time-of-day restrictions on scheduled
            messages.

The preferences window (tab, actually) now has "Reset", "Cancel", and
"OK" buttons, and any changes you make to preferences aren't actually
saved untli you close the window or click the "OK" button.

At some point prior to Thunderbird 68 the functionality for validating
preferences before saving them was lost. This has now been fixed.

The progress bar, which was has not been particularly useful for a long
time, is gone. Instead of a progress bar, Send Later now displays a
status of "CHECKING" while it is doing its periodic check for scheduled
messages. Note that this message has not yet been translated so at least
for this release it will appear as "CHECKING" in all languages.

References to addons.mozilla.org have been replaced with
addons.thunderbird.net throughout.

### []{#notes-6.5.0}Release 6.5.0 (March 1, 2020)

**Fix bug in putting previous scheduled send time in compose toolbar**

If the user adds the send time text box to the compose toolbar and then
edits a previously scheduled message, the previous send time is supposed
to show up in the text box automatically, but instead the word "long"
was showing up because I forgot a couple of curly braces in a date
formatting string. I'm amazed that this has been broken for almost six
months and no one has mentioned it to me before now.

### []{#notes-6.4.8}Release 6.4.8 (February 3, 2020)

Compatibility changes for Thunderbird 45 through 52. You shouldn't still
be using them! But if you are, Send Later should work with them.

### []{#notes-6.4.7}Release 6.4.7 (January 29, 2020)

Add the pop-up about the Kickstarter campaign to save Send Later and my
other add-ons to the Thunderbird 60 version of Send Later because many
people are still using Thunderbird 60.

### []{#notes-6.4.6}Release 6.4.6 (January 7, 2019)

Changes since 6.4.5:

Fix a bug which was preventing arguments to dynamic scheduling functions
from working in some contexts.

### []{#notes-6.4.5}Release 6.4.5 (January 7, 2019)

Changes since 6.4.4:

There are no user-visible changes in this release. It modifies the
format of dynamic scheduling function export files slightly to make them
easier to read and edit in text editors outside of Thunderbird. This
change was made to facilitate the creation of a library of shared
scheduling functions.

### []{#notes-6.4.4}Release 6.4.4 (January 6, 2019)

Changes since 6.4.3:

Make the dynamic function editor window resizable.

Fix the "Import..." and "Export..." buttons in the dynamic function
editor, which it turns out were broken by a change in Thunderbird 57.

### []{#notes-6.4.3}Release 6.4.3 (November 13, 2018)

Changes since 6.4.2:

Some versions of Thunderbird being used in a locale that uses UTF-8
(i.e., non-ASCII) characters were garbling the display of dates in the
send button in the prompt window. This has been fixed.

The Turkish and Armenian translations have been updated, but are still
incomplete.

### []{#notes-6.4.2}Release 6.4.2 (November 12, 2018)

Fix how the scheduled date of messages in the Drafts folder is displayed
so that the formatting obeys the current locale. For example, in the
United States, the date should be displayed in MM/DD/YYYY format, while
in the United Kingdom it should be DD/MM/YYYY.

Fix bug in date-picker for some older Thunderbird versions. The API in
Thunderbird for formatting dates has been in a great deal of flux for
the past several Thunderbird releases. Release 6.4.1 of Send Later was
an attempt to make the date code in Send Later compatible up to
Thunderbird 60.3.0. Unfortunately, although the changes did achieve
compatibility with newer Thunderbird releases, they broke compatibility
with older ones. This release attempts to address that.

Add some improvements to the Bulgarian translation.

### []{#notes-6.4.1}Release 6.4.1 (November 8, 2018)

Fix two problems with the date-picker widgets, i.e., the user interface
elements in the compose window toolbar and Send Later pop-up dialog
which allow you to choose the date for which to schedule the message:

-   -   1.  Send Later should now correctly obey the user's locale
            settings when determining the order in which to put the
            year, month, and day in the date-picker.
        2.  The date-picker will now (I hope) work correctly in some
            locales where previously it didn't work at all.

The minimum compatible Thunderbird version for Send Later is now 32.
Note that this was actually true before this release as well, but
before, the minimum compatible version was incorrectly being specified
as 25.

Translation updates:

-   -   -   Add a Bulgarian translation.
        -   Finish the Czech translation.
        -   Finish the Finnish translation.
        -   Finish the Greek translation.
        -   Finish the Norwegian translation.
        -   Finish the Romanian translation.

I want to give a big shout-out to my translators!

-   -   -   Krasimir Stoychev (bg)
        -   Vlasta Konvičná (cs)
        -   Dtrieb from BabelZilla (de)
        -   Erwin D. Glockner (de)
        -   Dimitrios Patikas (el-GR)
        -   urko from BabelZilla (es)
        -   strel (es)
        -   Samtron-Translations (http://translations.samipupu.com/)
            (fi)
        -   Kari Eveli (fi)
        -   Bigpapa from BabelZilla (fr)
        -   Shai65 from BabelZilla (he)
        -   HrantOhanyan from BabelZilla (hy-AM)
        -   Cesare from BabelZilla (it-IT)
        -   Amigomr from BabelZilla (ja)
        -   Michael Murer (nb-NO)
        -   markh from BabelZilla (nl)
        -   Maciej Kobuszewski (pl)
        -   Piotr Przybylski (Gabry\$) (pl)
        -   João Martins (Jonypokas) (pt-PR)
        -   wetabax from BabelZilla (pt-PR)
        -   Mikael Hiort af Ornäs (sv-SE)
        -   Wang.H.K from BabelZilla (zh-CN)
        -   Mike (zh-TW)

### []{#notes-6.4.0}Release 6.4.0 (October 20, 2018)

Changes since 6.3.9:

Bump compatibility in the XPI file to make installation more reliable.
This should fix the trouble some people were having trying to install
Send Later in Thunderbird 60.2.

Update the first day of the calendar week for some translations.

Add some Romanian translation strings.

### []{#notes-6.3.9}Release 6.3.9 (October 3, 2018)

Changes since release 6.3.8: The simplified Chinese translation has been
completed. Thanks, as always, to my translators!

### []{#notes-6.3.8}Release 6.3.8 (April 5, 2018)

**BUGFIX:** Fix date-parsing for non-English locales

Release 6.3.6 broke date-parsing in languages other than English. This
release fixes it.

### []{#notes-6.3.7}Release 6.3.7 (March 28, 2018)

Changes since release 6.3.6:

There was a bug in release 6.3.6 which broke the send later dialog and
dynamic scheduling functions on some versions of Thunderbird. This has
been fixed.

I've learned that versions of Send Later newer than 6.2.1 are
incompatible with Thunderbird 24.\* and older. Those versions of
Thunderbird are nearly five years old and are no longer maintained,
which means that they have numerous unpatched security holes on them. As
such, users are strongly urged to upgrade to the current version of
Thunderbird. If that is not possible for whatever reason, you may
continue to use Send Later by downloading and installing [version
6.2.1](https://addons.thunderbird.net/thunderbird/addon/send-later-3/versions/6.2.1),
but you will not get any new Send Later features or bug fixes.

### []{#notes-6.3.6}Release 6.3.6 (March 22, 2018)

This release contains only changes that no one should notice:

Compatibility changes for recent versions of Thunderbird.

Upgrade to the current version of SugarJS.

### []{#notes-6.3.5}Release 6.3.5 (February 24, 2018)

BUGFIX: If a user set the hidden extension
\`extensions.sendlater3.first\_day\_of\_of\_week\` to change how
calendars display in date-pickers in Send Later, then the dates weren't
lined up properly under the day headers in the calendars. This has been
fixed.

### []{#notes-6.3.4}Release 6.3.4 (February 12, 2018)

**BUG FIX: Fully remove Send Later headers that are wrapped by IMAP
servers**

Send Later inserts several headers into scheduled messages and removes
them when before delivery. When Send Later inserts these headers, they
are on a single line in the message header, and the code for removing
them later previously assumed that they would *remain* on a single line.
However, some IMAP servers wrap headers when messages are saved into an
IMAP server. As a result, some headers were being wrapped, and then Send
Later removed those headers incompletely at delivery time because it
left behind the wrapped text. The code has now been fixed to remove the
wrapped text as well.

**BUG FIX: Strip "Openpgp" header from scheduled messages during
delivery**

There's a constant arms race between Send Later and other Thunderbird
functionality... Send Later needs to figure out what temporary, internal
headers are saved by other Thunderbird functionality and remove those
headers from scheduled drafts when sending them. The newest header I've
discovered in this category is the "Openpgp" header, which Send Later
now removes.

### []{#notes-6.3.3}Release 6.3.3 (December 26, 2017)

Changes since 6.3.2:

Fix preferences button in add-ons manager in Thunderbird 59+.

### []{#notes-6.3.2}Release 6.3.2 (December 14, 2017)

Changes for compatibility with the newest Thunderbird and SeaMonkey
versions.

### []{#notes-6.3.1}Release 6.3.1 (September 26, 2017)

Changes since release 6.3:

Update the Dutch, Galician, Japanese, Portuguese from Portugal,
Brazilian Portuguese, and Turkish translations. Thank you to my
translators!

Add a new hidden preference,
"extensions.sendlater3.first\_day\_of\_week", which the user can modify
to control the first day of the week in Send Later's pop-up calendar
grids.

Fix a bug which prevented changes the user had just made to the hour or
minute values in the time picker in the compose window toolbar to be
accepted if the user clicked on the "Send Later" button in the toolbar
immediately after making the time picker changes.

Make another attempt to more fully fix the problem of the "cancel on
reply" option being set on a scheduled message when the user didn't
intend for it to be.

Fix a bug which in rare cases caused some scheduled messages to get
stuck in the Drafts folder and not send at their scheduled delivery
times.

Fix a minor bug in the Send Later code that runs when Thunderbird is
shutting down, so that Send Later will start up more quickly the next
time Thunderbird is launched.

Make some non-functional code changes necessary to support Thunderbird
58+ and SeaMonkey 2.55+.

### []{#notes-6.3}Release 6.3 (August 20, 2017)

Changes since release 6.2.1:

**COMPATIBILITY: Postbox is no longer supported**

Unfortunately, Postbox does not support the newer JavaScript constructs
I've had to start using to maintain compatibility with upcoming
Thunderbird and SeaMonkey releases. Therefore, I can't continue to
support Postbox in new Send Later releases until the maintainers of
Postbox upgrade their JavaScript interpreter. In the meantime, Postbox
users can continue to use [version 6.2.1 of Send
Later](https://addons.thunderbird.net/thunderbird/addon/send-later-3/versions/6.2.1),
the final release which is compatible with Postbox.

**BUGFIX: Embedded images corrupted when editing scheduled drafts**

A recently introduced [Thunderbird
bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1389242) was causing
embedded images to become corrupted when the user opened a previously
scheduled draft with embedded images to edit it. The real fix for this
bug will require changes in Thunderbird, but in the meantime, I've
implemented [a
workaround](https://github.com/jikamens/send-later/commit/95010466da7f389419631e69894ea85d8a6c07fb).

**BUGFIX: AM/PM in 12-hour timepicker flips to AM when it shouldn't**

If the time-picker widget in the Send Later prompt window was in 12-hour
mode, and it was displaying a PM time, and you entered a new hour in the
hour part of the widget and hit tab, the "PM" would switch to "AM". It
shouldn't have been doing that. It should be fixed now.

**BUGFIX: "Cancel recurrence on reply" getting set incorrectly
sometimes**

The "Cancel recurrence on reply" option was being set incorrectly
sometimes, definitely when using a preset button in the toolbar
configured to call a user-defined function, and possibly in other
contexts as well. This has been fixed.

**ENHANCEMENT: Display release notes in SeaMonkey**

The add-on will now display the Send Later release notes in SeaMonkey
when they documented significant changes. Previously, this only worked
in Thunderbird.

**COMPATIBILITY: Some old Thunderbird and SeaMonkey releases are no
longer supported**

Several old, obsolete JavaScript constructs and interfaces used by Send
Later are being desupported in impending Thunderbird and SeaMonkey
releases. I've therefore had to update Send Later's code to use newer,
supported constructs and interfaces. These are not compatible with
Thunderbird releases prior to 20 or SeaMonkey releases prior to 2.17, so
those older releases can no longer be supported.

### []{#notes-6.2.1}Release 6.2.1 (June 29, 2017)

Changes since release 6.2:

Add a new preference controlling whether scheduled drafts are marked as
read in the drafts folder or remain marked unread. This preference is
enabled by default, i.e., drafts are marked read by default, because I
believe this is the behavior the majority of users want.

Translation updates, including part of a new Czech translation.

### []{#notes-6.2}Release 6.2 (June 15, 2017)

Changes since release 6.1.3:

New feature: **Automatically cancelling recurring messages upon reply**

When scheduling a recurring message via the Send Later pop-up window,
you may now indicate that the recurring message should be canceled and
deleted from your Drafts folder if you receive a reply to it. This is
useful, e.g., if you want to keep periodically reminding someone about
something until they reply to indicate that the reminder is no longer
needed.

Thanks, as always, to my translation volunteers, for assisting in
translating this new feature to many languages!

New feature: **Draft messages saved by Send Later are now more reliably
marked as "read" so they don't make your Drafts folder have an unread
count unnecessarily.**

Bug fixes:

Send Later now uses separate, unique message IDs for scheduled drafts
vs. the messages it actually sends, as well as for different copies of
recurring messages. Previously, the message ID which Send Later used
when sending a scheduled message was identical to the message ID that
was used while the message was being stored in your Drafts folder.
Furthermore, Send Later previously used that same message ID for all
sent copies of recurring messages. Using the same message ID for drafts
and recurring messages was incorrect both because message IDs of
different copies of messages are supposed to be unique, and because some
mail servers might get confused when a draft and a sent message have the
same message ID.

Previously, when a recurring message was sent, Send Later briefly failed
to include it in the count of pending messages. Now, Send Later
consistently counts recurring messages in the pending message count.

### []{#notes-6.1.3}Release 6.1.3 (May 24, 2017)

Changes since release 6.1.2:

New Russian translation.

Minor updates to some other translations.

### []{#notes-6.1.2}Release 6.1.2 (March 1, 2017)

Changes since release 6.1:

**Guard against a corrupted Outbox causing messages to be resent**

Thunderbird's local folder storage format keeps deleted messages on
disk, but invisible to the user, until their folder is compacted.
Usually this causes no trouble, but occasionally Thunderbird corrupts a
local folder and loses track of messages which messages were deleted,
causing them to "magically" appear in the folder again. In most cases,
this causes no further harm than deleted messages being resurrected, an
annoying nuisance but not a huge problem.

However, when Send Later is being used, and when the folder this happens
to is the user's Outbox folder, it can cause a big problem: messages
that were previously sent with Send Later can be resurrected and resent.
If it has been a long time since the Outbox was last compacted, a lot of
messages can be resent. This is bad.

Send Later now guards against this by by automatically compacting the
Outbox folder whenever Thunderbird finishes sending its messages and it
is visibly empty, i.e., the only messages remaining in it are invisible,
deleted messages.

**Make locale-based first-day-of-week work in calendar pop-ups**

There is a bug in Thunderbird which was preventing the calendar pop-ups
displayed by Send Later from starting the week on the correct day, in
locales where that day isn't Sunday. See
https://bugzilla.mozilla.org/show\_bug.cgi?id=516796. Fortunately,
there's a workaround for this bug, which has now been implemented in
Send Later. Therefore, if your computer starts weeks with the correct
day elsewhere, it should now do so in the Send Later calendar pop-ups as
well.

**Miscellaneous minor changes**

The command key for the "Close" button in the dynamic function editor is
now Ctrl-W in every language, as it should be.

A bunch of button access keys (i.e., the letters you an type with Alt to
activate the buttons) have been fixed.

Use the Unicode ellipsis character instead of three periods. Also, use
Unicode quotes instead of ASCII double quotes.

Be more consistent about the add-on name in translations, i.e., decide
for each translation whether the add-on name is going to be "Send Later"
in English or a translated version, and carry that decision throughout
the entire translation.

Translation updates.

Update the URL of the user guide because it's got SSL (https) now.

### []{#notes-6.1}Release 6.1 (August 20, 2016)

Changes since release 6.0.3:

**Enhancements to day/time restrictions and scheduling functions**

Previously, the day-of-week and time-of-day restrictions in the Send
Later prompt window could only be used with recurring messages or
scheduling functions. Now they can be used when specifying only a single
send time explicitly as well. You can do some clever things when
combining this with saving defaults in the prompt window. For example,
if you always want messages to be sent within a particular time window,
you could put "now" in the prompt window's text box and specify the
desired time window in the "Between" settings, then save those defaults,
and from then on, whenever you bring up the prompt window and click the
"Send at" button, it'll either send the message immediately --- if it's
within the correct time window --- or move it to be within the time
window.

Previously, when you used a non-recurring dynamic scheduling function
such as the "BusinessHours" function that is created by default when you
open the dynamic function editor, the fact that the message was
scheduled with a function is not saved, so if you go to edit the
function later and then try to re-schedule it, rather than defaulting to
using the same dynamic function again, it defaulted to the time that the
message was previously scheduled to be sent. Now, the function name is
saved, and if you edit and re-schedule the message the prompt window
will be pre-configured to use it again.

Furthermore, when you specify day-of-week or time-of-day restrictions
when scheduling a message with either an explicit send time or a
non-recurring dynamic function, the restrictions you specify will now be
saved, so that if you edit and re-schedule the message, they will be set
up in the prompt window automatically.

**Other enhancements**

When you click the "Calculate" button in the prompt window, the text-box
the date and time pickers are now updated with the results along with
the text box.

If you accidentally click "Save defaults" or "Clear defaults" in the
prompt window, you can now click it again to undo the first click
(prevously, once you clicked either of them, you then had to leave one
or the other selected).

In Postbox, the Send Later status message and progress bar in the main
window has been moved to the system tray, which is deprecated in
Postbox, to below the folder list.

The Catalan, Dutch, and German translations have been updated.

**Bug fixes**

A bug which prevented a scheduled message with a day-of-week restriction
from being sent unless it also had a time-of-day restriction has been
fixed.

Automatically displaying the release notes for new major or minor
releases was broken in release 6.0 and is now fixed.

The logic for displaying the release notes for new major or minor
releases had a bug which was causing it to sometimes display them for
patch releases as well. This has been fixed, and now the release notes
will be displayed only for major, minor, and beta releases (the latter
obviously only for users who are subscribed to the beta release
channel).

Send Later's translations use parameterized substitutions in some
translated strings, i.e., the string is used as a template into which
values are substituted to customize it for the particular message being
displayed. A few of the rarely used strings had missing or incorrect
substitution patterns in them in some languages. In addition to fixing
these, the build process for the add-on has been modified to prevent
similar bugs from being introduced in the future.

**Non-functional changes**

Fix an undefined variable reference in some code that should never
actually be executed since it indicates an internal error in the add-on.

Fix some incorrect invocations of Array.splice which were treating the
second argument as the end index of the splice, rather than as the
number of elemented to replace in the array. These incorrect invocations
weren't actually having a functional impact because of the way the code
was otherwise constructed, but they could at some point in the future
and they were clearly wrong, so they've been fixed.

The code that was supposed to display an error pop-up when there was an
unexpected error invoking a dynamic scheduling function was broken, and
that code would itself cause an uncaught error and cause the add-on to
malfunction. Users are unlikely to have run into this issue, but in any
case it has been fixed.

### []{#notes-6.0.3}Release 6.0.3 (August 6, 2016)

Changes since release 6.0.2:

BUG: Scheduling messages with monthly recurrence was broken and has been
fixed.

BUG: Fix incompatibility with Thunderbird versions before 17.

BUG: Fix incompatibility with Seamonkey versions newer than 2.41a1.

BUG: Fix the pop-up menu in the main Thunderbird window so it only pops
up when you click on the Thunderbird part of the status bar, rather than
when you click anywhere in the status bar.

ENHANCEMENT: When there are no dynamic scheduling functions defined,
i.e., before the first time the user has opened the dynamic function
editor, desensitize the dynamic function selector in the Send Later
prompt window, since there are no dynamic functions to select.

ENHANCEMENT: Fix the height of the dynamic function pop-up menu in
theSend Later prompt window so that it is correctly full height, rather
than being very short until the user selects a function.

I18N: Translation updates.

### []{#notes-6.0.2}Release 6.0.2 (July 7, 2016)

This release of Send Later includes several exciting new features!

#### Dynamic scheduling function support

Send Later 6.0 includes a totally new dynamic scheduling function editor
and makes [dynamic scheduling functions](#dynamic) fully accessible
through the Send Later dialog and shortcut buttons. This means that you
can easily write JavaScript function to implement arbitrarily complex
message scheduling logic (for example, the most common request I get:
"Can I click a button to make the message send during business hours,
rather than in the middle of the night when I'm composing it?").

Read more in the [updated user guide](#dynamic) or click on "Send Later"
in your status bar and select "Dynamic function editor" to open the
editor and read the built-in documentation.

While it was possible to use dynamic scheduling functions in previous
Send Later releases, it required significant "back-end" configuration
and a reliance on other add-ons; this is no longer the case.

#### Save default settings in the Send Later dialog

You can now save default settings in the Send Later dialog when
scheduling a message, and subsequent invocations of the dialog (until
you clear the defaults) will start with the settings you saved.

#### Pop-up menu on main Thunderbird window

There is now a pop-up menu accessible by clicking on "Send Later" in the
status bar, giving you easy access to Send Later's preferences, dynamic
function editor, user guide, release notes, emailing the author, and
making a donation.

#### SpamFighter compatibility

Send Later is now compatible with
[SpamFighter](http://www.spamfighter.com/).

#### Improved Send Later icons

The Send Later icons have been improved a bit.

#### Internationalization

This release includes a new Catalan translation, and an incomplete Greek
translation.

This release also includes various other translation updates. Thanks, as
always, to my translators, in particular my new Polish translator, Piotr
Przybylski (Gabry\$).

#### Bug fixes

A bug in the interpretation of day-of-week restrictions, which could
sometimes cause recurring messages subject to such restrictions to be
sent on the wrong day, has been fixed.

### []{#notes-5.2.1}Release 5.2.1 (June 16, 2016)

Summary: If you need the "Put in Outbox" button in the Send Later
dialog, then you need to launch the dialog using Ctrl-Shift-Enter, the
"File \| Send Later" menu command, or the button provided by the "Send
Later Button" add-on. If, on the other hand, you need the "Send Now"
button in the Send Later dialog, then you need to have the "'Send' does
'Send Later\'" preference enabled, and you need to launch the dialog
using the "Send" button, Ctrl-Enter, or the "File \| Send Now" menu
command. Please read on for the details surrounding this change.

There has been a lot of flip-flopping in this area of the add-on's
functionality, caused in part by the fact that there are so many moving
parts that I've had trouble keeping them all straight in my mind, so I'm
going to try to explain clearly here exactly what's going on and why I'm
reverting this change, so that all the necessary information is known
going forward.

There are two buttons in the Send Later prompt window: "Put in Outbox"
and "Send Now". These two buttons bypass the Send Later message
scheduling mechanism in two different ways:

-   -   -   "Put in Outbox" puts the message being edited directly into
            the Thunderbird Outbox folder, such that it will be
            delivered the next time the user (or Send Later, or
            BlunderDelay) executes the "File \| Send Unsent Messages"
            menu command.
        -   "Send Now" delivers the message to its intended recipients
            immediately rather than scheduling the message for later
            delivery with Send Later.

Unfortunately, the only way that both of these buttons can always work
is if Send Later "cheats" and does things it's not supposed to during
the message scheduling and delivery process. This cheating causes all
sorts of other issues, such as incompatibilities with other add-ons,
Thunderbird popping up warnings and spell-checking windows multiple
times, etc., so it's a rather bad idea, and we don't want Send Later to
be doing that.

Therefore, in a recent release of Send Later, the cheating was removed,
and that meant it was no longer possible for both of these buttons to
work properly every time the Send Later dialog is displayed. In
particular:

-   -   -   If the Send Later dialog is opened with Thunderbird's own
            Send Later command, i.e., typing Ctrl-Shift Enter, selecting
            the "File \| Send Later" menu command, or using the button
            provided by the "Send Later Button" add-on, then it is
            possible to make the "Put in Outbox" button work properly in
            the dialog, but it is *not* possible to make the "Send
            Later" button work.
        -   Conversely, if the user has the "'Send' does 'Send Later\'"
            preference enabled, such that Thunderbird's own "Send Now"
            command (i.e., typing Ctrl-Enter, selecting the "File \|
            Send Now" menu command, or clicking the "Send" button) is
            used to launch the Send Later dialog, then in that
            particular instance of the dialog, it is possible to make
            the "Send Now" button work properly, but it is *not*
            possible to make the "Put in Outbox" button work.

Because the removal of the cheating code meant it was no longer possible
to make both of these buttons work every time the dialog was opened,
Send Later's code was modified to display only the button that will
actually work properly.

After the release with this change was shipped, I started to get
feedback from users complaining --- in some cases rather vociferously
--- about this change. Some people complained about the disappearance of
the "Send Now" button, others complained about the missing "Put in
Outbox" button.

At this point, I should have explained as above why it was no longer
possible for both of these buttons to be present, and further explained
that if the user needs the "Send Now" button, the dialog needs to be
launched with the "Send" button or Ctrl-Enter or "File \| Send Now",
whereas if the "Put in Outbox" button is needed, the dialog needs to be
launched with the "Send Later" button or Ctrl-Shift-Enter or "File \|
Send Later".

Unfortunately, with all of the complaints coming in, I got confused, and
I somehow convinced myself that the buttons were removed not because it
was not possible to make them work all the time without cheating, but
rather because users were sometimes getting confused and clicking one of
these buttons when it wasn't actually needed. Actually, reducing the
likelihood of user confusion wasn't the reason why the buttons were
removed; it was merely a beneficial side-effect.

I need to apologize to those users whom I told that the buttons were
removed to reduce user confusion. I was wrong. I'm sorry for giving you
incorrect information.

I also need to apologize to everyone for the "churn" of putting out
release 5.2 which added a preference which puts both buttons back, when
in fact with that preference enabled, *one of the buttons in the dialog
is always going to function incorrectly*. So rather than solving the
problem I hoped to solve in release 5.2, I introduced a new problem, an
actual bug, which could cause messages to be put into the user's Outbox
when the user intended to send them, or sent directly when the user
intended to put them in the Outbox. I'm sorry.

Release 5.2, which introduced potentially incorrect behavior as
described above, has been removed from addons.mozilla.org and is no
longer available for downloads or automatic upgrades.

This new release undoes the change introduced in release 5.2. There is
no longer a preference to cause both of the buttons to be displayed all
the time, because it is simply not possible to make that work properly
without Send Later interacting with Thunderbird in a way that it's not
supposed to and that isn't sustainable or maintainable.

Just to reiterate, if you need the "Put in Outbox" button in the Send
Later dialog, then you need to launch the dialog using Ctrl-Shift-Enter,
the "File \| Send Later" menu command, or the button provided by the
"Send Later Button" add-on. If, on the other hand, you need the "Send
Now" button in the Send Later dialog, then you need to have the "'Send'
does 'Send Later\'" preference enabled, and you need to launch the
dialog using the "Send" button, Ctrl-Enter, or the "File \| Send Now"
menu command.

If you *don't* have the "'Send' does 'Send Later\'" preference enabled,
and you launch the Send Later dialog the normal way (with
Ctrl-Shift-Enter, "File \| Send Later", or the "Send Later Button"
button), and then you decide that actually you want to send the message
right away, all you need to do is close the Send Later dialog or click
the Cancel button and then send the message normally.

I am sorry to those of you whose workflows are disrupted by this change.
If you are unable to figure out a new workflow which accommodates this
change, *please* [email
me](/cdn-cgi/l/email-protection#87edeeecc7ece6eae2e9f4a9f2f4) and
describe to me in detail how you're using the add-on and how this change
is impacting you, and I will try to help you find a way to make it work.

Additional information about this release.

This release includes a few translation updates. Thanks, as always, to
my translators!

### []{#notes-5.2}Release 5.2 (June 15, 2016)

**Release 5.2 has been withdrawn from addons.mozilla.org and is no
longer available there, due to a bug described above in the release
notes for 5.2.1.**

Changes since release 5.1:

This release adds a preference which, if enabled, causes both the "Send
Now" and "Put in Outbox" buttons to always be displayed in the Send
Later dialog, rather than displaying one or the other based on how the
dialog was opened.

The only-display-one-or-the-other functionality was added in Send Later
release 5.1 in an effort to minimize the incidents of people using these
buttons incorrectly. However, since the 5.1 release, I've heard from a
number of people whose workflows depended on both buttons being present
all the time. I had not anticipated these workflows when making the
change. Since they are reasonable workflows, I am adding this preference
to enable them.

### []{#notes-5.1}Release 5.1 (June 13, 2016)

Changes since release 5.0.1:

Send Later is now fully compatible with Enigmail! Many thanks to Patrick
Brunschwig from the Enigmail development team for working with me to
make this possible.

Thunderbird now pops up the spell-check-before-send window (if it is
enabled) and checks messages for empty Subject lines when they are
scheduled using buttons or input fields on the compose window toolbar.
Previously, neither spell-checking nor the empty-subject check would
happen in this context (i.e., this was a bug, and it is now fixed).

The "Send Now" button in the Send Later dialog now pops up a dialog when
it is used, to ensure that users don't click it when they actually meant
to click the scheduled send button. There is a checkbox in this dialog
to allow it to be suppressed in the future.

In a further effort to reduce confusion about the "Put In Outbox" and
"Send Now" buttons in the Send Later dialog, the "Put In Outbox" button
is now only visible when the dialog is popped up using "File \| Send
Later" or Ctrl-Shift-Enter, and the "Send Now" button is now only
visible when the "'Send' Does 'Send Later\'" preference is enabled and
the dialog is popped up using "File \| Send Now" or Ctrl-Enter.

This release includes many translation updates. Thanks, as always, to my
wonderful team of translators!

This release increases compatibility settings for newer Thunderbird and
Seamonkey releases.

As a side benefit of the other work enumerated above, a good chunk of
the add-on's code has been cleaned up and refactored.

### []{#notes-5.0.1}Release 5.0.1 (June 6, 2016)

Fixed a couple of bugs in the time-of-day restriction functionality
introduced in release 5.0.

### []{#notes-5.0}Release 5.0 (May 31, 2016)

Changes since release 4.4.5:

There are some exciting changes in this release of Send Later!

New features:

-   -   -   Messages can now be scheduled to send on a minutely basis,
            i.e., every minute, or every 2 minutes, or every 3 minutes,
            etc.
        -   Delivery of recurring messages can now be restricted by time
            of day and day of week. This restriction is enforced on the
            message's initial scheduled delivery time and in each
            subsequently scheduled recurring delivery. Furthermore,
            there is a preference you can enable to enforce it on late
            message delivery as well. In other words, if Thunderbird
            isn't running when at the scheduled delivery time, and when
            you launch Thunderbird the current time conflicts with the
            delivery restrictions, then by default the message will be
            delivered despite the conflict, but if you enable the
            preference, then delivery will be delayed until the delivery
            restrictions are satisfied.
        -   There is a new preference you can enable to prevent Send
            Later from delivering messages late, e.g., because
            Thunderbird wasn't running at the scheduled delivery time.
            When this preference is enabled, Send Later will pop up a
            warning about the late message instead of delivering it.

Bug fixes:

-   -   -   The shortcut buttons in the compose window toolbar are now
            disabled when a previously scheduled message with recurrence
            is edited. In this context, the user should open the Send
            Later dialog to reschedule the message, rather than using
            shortcut buttons.
        -   The "week of the month" checkbox (e.g., "1st Saturday of the
            month", "3rd Tuesday of the month") in the scheduling dialog
            is now disabled correctly when the user clears the scheduled
            send time or switches to a recurrence frequency other than
            monthly.

### []{#notes-4.4.5}Release 4.4.5 (April 11, 2016)

Changes since release 4.4.4:

**Disable scheduling messages when Enigmail is active**

Unfortunately, limitations in the Thunderbird add-on framework make it
somewhere between difficult and impossible to make scheduled messages
with Send Later work safely and properly when the Enigmail add-on is
installed and enabled.

However, Send Mail can successfully deliver previously scheduled
messages even when Enigmail is active.

Therefore, Send Later now displays an alert pop-up and disables the
scheduling of messages when Enigmail is enabled. If/when Enigmail is
disabled or uninstalled and Thunderbird is restarted, Send Later
automatically re-enables itself.

### []{#notes-4.4.4}Release 4.4.4 (August 26, 2015)

Changes since release 4.4.3:

**Bug: Fix Send Later column after using quick filter**

Previously, if you used the quick filter bar to search messages in the
Drafts folder, then the Send Later column would stop working. This is
fixed.

**Bug: Fix incompatibility with the Mnenhy add-on**

Recent necessary changes made Send Later incompatible with the Mnenhy
add-on, because Mnenhy replaces certain core Thunderbird components.
Send Later now has a workaround for this problem.

### []{#notes-4.4.3}Release 4.4.3 (July 18, 2015)

Changes since 4.4.1:

Bug fix: If the user runs Thunderbird when the system clock is
incorrectly set in the future, and then subsequently the system clock is
fixed, Send Later would stop delivering scheduled messages.

Bug fix: Don't display the "Every" checkbox in the Send Later prompt
window when it's not relevant.

Bug fix: Before this fix, Send Later was sometimes causing displayed
message headers to be aligned incorrectly.

Bug fix: Replace a reference to "Send Later 3" in the user interface
with "Send Later".

New Brazilian Portuguese translation, thanks to wetabax from BabelZilla.

Non-functional (invisible to users) changes to make the
addons.mozilla.org add-on validator happy.

Upgrade SugarJS date-parsing library; this change should be invisible to
users.

### []{#notes-4.4.1}Release 4.4.1 (March 19, 2015)

Compatibility change for Thunderbird 37+.

### []{#notes-4.4}Release 4.4 (January 22, 2015)

Changes since release 4.3.1:

All the shortcut keys in the Send Later prompt window mentioned in the
user guide now work in Mac OS, using the Mac OS command key as for other
standard Mac OS shortcut keys.

On other platforms (e.g., Windows, Linux), ***the key for activating
shortcuts has changed from Alt to Ctrl***.

The Ctrl key is what we should have been using all along, but we were
using Alt instead for historical reasons. In order to make shortcuts
work on Mac OS, we need to standardize on the "correct" shortcut key on
all platforms, hence the change on the other platforms.

### []{#notes-4.3.1}Release 4.3.1 (December 9, 2014)

Changes since release 4.3:

Fix the accelerator keys for the shortcut buttons, i.e., you can now
type Alt-1, Alt-2, or Alt-3 in the Send Later dialog to activate the
first, second, or third shortcut button. This has been broken for over
two years, but no one reported the problem until recently!

Update the Japanese translation. Thanks, as always, to my awesome
translators!

Eliminate some unnecessary error log messages showing up in the error
console. If you never look in the Thunderbird error console, this has no
impact on you. 😉

### []{#notes-4.3}Release 4.3 (November 21, 2014)

Changes since release 4.2.4:

-   -   -   Send Later now warns you on exit if you have pending
            messages scheduled to be sent, to help you avoid
            accidentally quitting when you meant to leave the
            application running so it could send the messages. There is
            a checkbox in the message you can uncheck if you don't want
            to be warned again.
        -   It is once again possible to use local mailing lists in
            scheduled messages. This functionality was broken by a
            recent Thunderbird release but is now fixed.
        -   Translation updates. Thank you as always to my translators,
            including new translator Kari Eveli!
        -   More robust performance in foreign languages.

Changes since release 4.2:

-   -   -   Scheduled messages are no longer sent repeatedly when the
            Drafts folder is corrupted. Instead, when Send Later
            encounters a message in the Drafts folder that it has
            already sent, it displays an error notifying the user that
            the Drafts folder needs to be repaired.
        -   The X-Enigmail-Draft-Status header is now removed from
            scheduled messages before they are sent by Send Later.
        -   Compatibility with Thunderbird 26+ and Seamonkey 2.23+.
        -   Some debug log messages generated by Send Later have been
            downgraded in priority to make them easier for folks who
            care about such things to ignore them.

### []{#notes-4.2.4}Release 4.2.4 (June 10, 2014)

Remove the "X-Enigmail-Draft-Status" header before sending a scheduled
message.

French and Dutch translation updates. Thanks, as always, to my
translators!

### []{#notes-4.2.3}Release 4.2.3 (April 10, 2014)

Add a workaround for a Thunderbird / Postbox bug which occasionally
causes Send Later to send messages multiple times.

### []{#notes-4.2.2}Release 4.2.2 (September 28, 2013)

Changes since release 4.2.1: Fix compatibility with Thunderbird 17.
Sorry about that!

### []{#notes-4.2.1}Release 4.2.1 (September 21, 2013)

Changes since release 4.2.0:

-   -   -   Compatibility with Thunderbird 26+, SeaMonkey 2.23+.
        -   Dutch and Finnish translation updates (thank you to my
            translators!). **NOTE:** I need a new translator for
            Traditional Chinese (zh-TW). If you're interested in helping
            out, please let me know (email
            [\[email protected\]](/cdn-cgi/l/email-protection){.__cf_email__})!
            Thanks!
        -   Fix home page URL.

### []{#notes-4.2.0}Release 4.2.0 (July 1, 2013)

Changes since 4.1.7:

When the user clicks on the "Put in Outbox" button, a warning now pops
up explaining what that button does and why the user might actually want
to click on the "Send around" button instead. There is a check-box in
this pop-up to prevent it from being displayed in the future. The
purpose of this new warning is to help alleviate the confusion from
which some users suffer about which button to click to schedule a
message.

New Armenian translation. Thanks to HrantOhanyan from BabelZilla!

### []{#notes-4.1.7}Release 4.1.7 (March 13, 2013)

Changes since 4.1.6:

-   -   -   Traditional Chinese (zh-TW) translation from Mike. Thanks to
            Mike and all my other translators!
        -   Updated date-parsing code (version 1.3.8 of SugarJS),
            including some improvements to French date parsing.
        -   Postbox compatibility updates; Send Later now requires
            Postbox 3.0.6 or newer.
        -   Update compatibility range for SeaMonkey and Thunderbird.

### []{#notes-4.1.6}Release 4.1.6 (January 2, 2013)

Changes since 4.1.5: Compatibility with Thunderbird 20+.

### []{#notes-4.1.5}Release 4.1.5 (December 3, 2012)

Changes since 4.1.4: Hebrew translation from Shai65 at BabelZilla.
Thanks, Shai! Note: Hebrew date-parsing doesn't work yet, so all you
Hebrew users will still need to type your dates in English. New version
of SugarJS with updates to date-parsing.

### []{#notes-4.1.4}Release 4.1.4 (November 1, 2012)

**Important notes about this release:**

-   -   -   **If you use recurring messages, check to see if any of them
            have disappeared from your Drafts folder, and if so, put
            them back by copying them from Sent Items and rescheduling
            them!**
        -   **If you had Send Later in your compose window toolbar prior
            to this release, you may need to add it back.** The toolbar
            customization mechanism was recently changed. It's better
            now, but it's incompatible with the old mechanism. See
            [above](#toolbar) for details.

Bug fix: Fix the Dutch, Finnish and Swedish translations to reflect the
fact that the check interval preference is now minutes rather than
milliseconds. I'm not sure how updating these particular translations
got overlooked when this functionality change was made. Sorry!
Enhancement: When Thunderbird encounters an error sending unsent
messages (i.e., delivering messages from the Outbox after Send Later has
put them there), log the error in the error console, to assist in
debugging what is causing it (which, to be clear, is a Thunderbird
problem, not a Send Later problem). Enhancement: Update the Swedish
translation. Enhancement: Update the URL of the user guide in error
messages (the old URL works but is deprecated). Also, add the user guide
URL to a Finnish error message that was missing it. Non-functional: In
the source code for the add-on, comment out a function that is only used
during testing so that the add-on validator on addons.mozilla.org
doesn't complain about it.

### []{#notes-4.1.3}Release 4.1.3 (October 19, 2012)

Changes since 4.1.2: Bug fix: A bug was introduced in version 4.1.2
which caused recurring messages to fail to be rescheduled after being
sent. Enhancement: Add access keys for the "Put in Outbox" button in the
prompt window. You can now type Alt-O (or the equivalent in other
languages) to activate the button. Bug fix: Dynamic recurrence functions
should be able to return Date objects, not just numbers of minutes.

### []{#notes-4.1.2}Release 4.1.2 (October 13, 2012)

**NOTE: If you had Send Later in your compose window toolbar prior to
this release, you may need to add it back.** The toolbar customization
mechanism was recently changed. It's better now, but it's incompatible
with the old mechanism. See [above](#toolbar) for details. Changes since
release 4.0.6: Fix bug introduced in version 4.0.7: Don't send scheduled
messages twice! Bug fix: The scheduled send time was not being
calculated properly when it was entered using the date and time pickers,
and the keyboard rather than the mouse was used to change their values.
Enhancement: Dynamic shortcuts can now implement recurrence! See
[above](#dynamic-recurrence). Enhancement: Make explanatory text appear
inside the text box in the "Customize Toolbar" window so that it's
clearer that the text box is for Send Later. Bug fix: In rare cases Send
Later was failing to notice scheduled drafts. Bug fix: Various date
parsing improvements from Andrew Plummer, the author of
[SugarJS](http://sugarjs.com/), the date parsing library used by Send
Later. Bug fix: Don't cause "Error Copying Message to Drafts Folder"
when hitting Ctrl-Enter in the text box in the pop-up window, or when
clicking on the shortcut buttons in the toolbar. Bug fix: Do not allow
Enter or Ctrl-Enter to work when valid time has not been entered.
Enhancement: Dynamic shortcut buttons can now return a Date object
rather than the number of minutes into the future. Bug fix (internal, no
change in functionality): Use closures instead of script fragments for
event listeners, as suggested by AMO editors. See
<https://developer.mozilla.org/en/XUL_School/DOM_Building_and_HTML_Insertion#listeners>.

### []{#notes-4.1.1}Release 4.1.1 (October 13, 2012)

Release 4.1.1 was withdrawn before it was fully released due to a bug
discovered during beta testing.

### []{#notes-4.1.0}Release 4.1.0 (October 10, 2012)

Release 4.1.0 was withdrawn before it was fully released due to a bug
discovered during beta testing.

### []{#notes-4.0.9}Release 4.0.9 (October 9, 2012)

Release 4.0.9 was withdrawn before it was fully released due to a bug
discovered during beta testing.

### []{#notes-4.0.8}Release 4.0.8 (October 9, 2012)

Release 4.0.8 was withdrawn before it was fully released because it did
not contain the fix to the double-send bug discovered in release 4.0.7.

### []{#notes-4.0.7}Release 4.0.7 (October 5, 2012)

Release 4.0.7 was withdrawn because of a serious bug --- scheduled
messages were being sent twice.

### []{#notes-4.0.6}Release 4.0.6 (September 26, 2012)

Changes since release 4.0.4: Enhancement: Change the add-on's name from
"Send Later 3" to "Send Later", translated for every supported language.
The add-on was previously named "Send Later 3" because there was an old
"Send Later" add-on with similar functionality for old Thunderbird
versions, but that add-on has not been maintained for years and is no
longer even available on addons.mozilla.org, so it is time to take its
place. Enhancement: Add back the ability to choose the date and time
using the mouse using date and time pickers, instead of or in addition
to use free-form text input. Enhancement: Each of the add-on's compose
window toolbar items can now be added and positioned separately, giving
the user complete control over the items appearing in the toolbar.
Furthermore, the user can choose whether to put free-form text input,
date/time pickers, or both in the toolbar. Enhancement: Since the
shortcut buttons are now added or removed by customizing the compose
window toolbar directly, there are no longer checkboxes in the add-on's
preferences controlling whether the buttons appear in the toolbar.
Enhancement: Change the "SENDLATER3" status tag at the bottom of the
main Thunderbird window to match the add-on's name in every language.
Enhancement: Add a Chinese description to the install manifest, so that
the description that shows up in Tools \| Add-ons for Chinese users will
be in their native language. Bug fix: The Send Later button in the
pop-up prompt window is now activated, as it should be, when the window
first comes up when re-scheduling a previously scheduled draft. Bug fix:
Prepopulating the scheduled send time when editing a previously
scheduled message was not working in some circumstances. Bug fix: The
schedule button in the toolbar was not always being updated properly
with the scheduled send time. Enhancement: Improvements to Dutch date
parsing. Bug fix: If user has OS configured with custom date format,
then sometimes the prepopulated scheduled send time inserted when
editing a previously scheduled message is not understood by Send Later
3! Bug fix: Add missing space after typo in error message.

### []{#notes-4.0.5}Release 4.0.5 (September 25, 2012)

Release 4.0.5 was replaced by release 4.0.6.

### []{#notes-4.0.4}Release 4.0.4 (September 19, 2012)

Enhancement: Add Dutch date parsing. Bug fix: Some users have been
seeing "Drafts folder may be corrupt" errors repeatedly, even after
repairing all of their Drafts folders. Bug fix: In recent (not yet
released to the general public) versions of Thunderbird and SeaMonkey,
displaying the release notes after updating the add-on was not working
properly. Bug fix: When editing a previously scheduled recurring
message, the text box and button in the toolbar are supposed to be
disabled because recurring messages can only be scheduled from the
pop-up dialog. However, they were not being disabled as they should have
been. This is now fixed. Bug fix: In recent (probably not yet released
to the general public) versions of Thuderbird and SeaMonkey, when the
user edited a previously scheduled draft and then immediately tried to
close the message compose window without actually making any changes to
the draft, Thunderbird was asking the user whether to save the draft,
even though it was unmodified and didn't need saving.

### []{#notes-4.0.3}Release 4.0.3 (September 8, 2012)

I am **very excited** to announce release 4.0.3 of Send Later 3! This
release includes four major enhancements which have been requested by
users more than any others. If you like Send Later 3, please consider
[contributing](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=jik%40kamens%2eus&lc=US&item_name=Send%20Later%20add%2don%20%28%245%2e00%20recommended%20donation%2c%20but%20give%20what%20you%27d%20like%21%29&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donat) to
support its continued development (A donation of \$10 or more makes you
eligible for listing, including a link, banner or button if you'd like,
on the [supporters list](#supporters)!) or [writing a
review](https://addons.thunderbird.net/thunderbird/addon/send-later-3/reviews/add "Review Send Later")
(even if you've written one before). Thanks! You can also be very
helpful with minimal effort by beta-testing new versions of the add-on.
I do my best to test new versions thoroughly, but I can miss things, so
the more people I have testing new versions with me, the more likely it
is that they will work for everyone. I fix problems discovered by beta
testers very quickly, and if you do encounter a problem, you can always
revert to the previous non-beta version until I am able to fix it. So
please, help make Send Later 3 better for everyone by signing up as a
beta tester! See the user guide for more information if you're
interested. Thank you. Don't forget to join [the mailing
list](https://groups.google.com/group/send-later-users)! Before
describing the changes in this release, I want to give a huge shout-out
to Andrew Plummer, the maintainer of the [SugarJS
library](http://sugarjs.com/) upon which much of the functionality in
the new release depends. I also want to give a huge round of applause to
my translators who have helped to make this release great. They are:

-   -   -   Dtrieb from BabelZilla (de)
        -   Erwin D. Glockner (de)
        -   urko from BabelZilla (es-ES)
        -   [Samtron-Translations](https://plus.google.com/114276880405600229762)
            (fi-FI)
        -   Bigpapa from BabelZilla (fr)
        -   Cesare from BabelZilla (it-IT)
        -   Amigomr from BabelZilla (ja-JP)
        -   markh from BabelZilla (nl)
        -   Maciej Kobuszewski (pl)
        -   Mikael Hiort af Ornäs (sv-SE)
        -   Wang.H.K from BabelZilla (zh-CN)

**Free-form date/time entry**

The date and time for scheduling a message are no longer entered using
clunky drop-downs. Instead, you just type in the date and time you want,
and Send Later 3 parses what you typed and figures out what you meant.
Date parsing is currently supported in the following languages: English,
French, German, Italian, Spanish, Portuguese, Swedish, Russian, Polish,
Japanese, Korean, Simplified Chinese, and Traditional Chinese ([contact
me](/cdn-cgi/l/email-protection#81ebe8eaaaf2e4efe5ede0f5e4f3b2c1eae0ece4eff2aff4f2)
about adding support for additional languages). The add-on first
attempts to parse dates using the language indicated by your locale, and
if that fails, it falls back on English. Date parsing understands all
sorts of interesting syntaxes in addition to conventional date/time
entry. For example, "the day after tomorrow", "next Thursday at 15:00",
"the beginning of next week", etc. Date parsing in Send Later 3 is
provided by the most excellent [SugarJS library](http://sugarjs.com/),
created and maintained by Andrew Plummer. Because such interesting date
syntaxes can be ambiguous, Send Later 3 tells you what it thinks you
meant by parsing your text in real-time and showing in the send button
when the message will be sent. This new functionality also makes it
easier to schedule multiple messages at the same time, something which
has been frequently requested. Rather than being forced to painstakingly
selected the same values in the drop-downs over and over, you can simply
copy the desired date/time into your clipboard and paste it into the
date/time entry field of each message. Add the field to your toolbar to
make it even faster!

**Enhanced recurring messages**

When scheduling a recurring message, you can now indicate a count in
addition to a unit. In other words, whereas before you could specify
only daily, weekly, monthly or yearly, now you can specify every 3 days,
every 5 weeks, etc. Furthermore, you can schedule monthly messages on
the same week and day of every month, e.g., "the third Tuesday of the
month."

**SeaMonkey support**

Send Later 3 now supports SeaMonkey!

**Support for the Mail Merge add-on**

Starting with its version 3.4.0, the [Mail Merge
add-on](https://addons.thunderbird.net/thunderbird/addon/mail-merge/)
supports Send Later 3! Instructions for using Mail Merge with Send Later
3 can be found [here](#mailmerge). (Note: Just to be clear, support for
Send Later 3 in Mail Merge required changes to Mail Merge, not changes
in Send Later 3. I'm not trying to take credit for the most excellent
work of the author of the Mail merge add-on; I'm just letting people
know that you can now use Mail Merge with Send Later 3.)

**Other changes**

In addition to the major enhancements described above, there are also a
number of other changes in this release:

-   -   -   There is a bug in Thunderbird 15 that breaks Send Later 3.
            This release includes a workaround for the bug.
        -   The "Send Later" column now displays properly in the unified
            Drafts folder.
        -   The color changes to the Send Later 3 pop-up window, which a
            number of people described as "garish" and did not care for,
            have been removed. These are no longer necessary now that
            the UI has been simplified and made clearer in other ways.
        -   The preference for controlling how often to check for
            messages whose scheduled send time has arrived has been
            changed from milliseconds to minutes, which makes a heck of
            a lot more sense.
        -   The pop-up window that requests donations for Send Later 3
            has been changed so that it no longer has the potential to
            cause Thunderbird to hang on some platforms. This hang is
            due to a Thunderbird bug, not a bug in Send Later 3, but
            since the Thunderbird bug has not yet been fixed, it is
            important to work around it in the add-on.
        -   A bug which was causing recurring messages to be marked
            unread in the Drafts folder has been fixed.
        -   A workaround has been introduced in the code which should
            reduce the frequency of Send Later 3 complaining about a
            corrupt Drafts folder, specially when using POP3 or local
            folders.
        -   Send Later 3 now replaces the message ID in outgoing
            messages so that it does not inadvertently send multiple,
            different messages with the same message ID (relevant for
            both recurring messages and messages scheduled from
            templates).

### []{#notes-3.3.10}Release 3.3.10 (May 28, 2012)

There are no functional changes in this release. See below for
functional changes in previous releases. The only purpose of this
particular release is to get the word out about this: ***THIS IS THE
LAST VERSION OF THE ADD-ON WHICH WILL SUPPORT THUNDERBIRD 7 AND OLDER
AND POSTBOX 2.*** The next version to be released after this one will
include significant new functionality which cannot be implemented within
Thunderbird 2 or Postbox 2. Users who do not wish to upgrade to a newer
version of Thunderbird or Postbox may continue to use this version
as-is, but there will be no further bug-fix or feature releases
compatible with Thunderbird 2 or Postbox 2.

### []{#notes-3.3.9}Release 3.3.9 (May 25, 2012)

Changes since 3.3.8:

-   -   -   Fix sorting of Drafts folders by the Send later column.
        -   Another attempt to fix display of drop-down menus in compose
            toolbar on Thunderbird 2 on non-Linux platforms. I'm can't
            be certain the fix in version 3.3.8 was correct, because I
            can't reproduce the issue and haven't gotten feedback from
            anyone in the field one way or the other, but this new
            version of the fix should be more robust.

### []{#notes-3.3.8}Release 3.3.8 (May 10, 2012)

Changes since 3.3.7:

-   -   -   Change the label on the "Passthrough to Send Later" button
            to "Put in Outbox" and change its tooltip to be clearer as
            well. This is an attempt to fix the most common usage error
            people experience with this add-on, which is clicking this
            button when they should be clicking "Send Later at time(s)
            specified above". Thank you very much to the Send Later 3
            translators who assisted with this change!
        -   Change the font sizes and colors in the Send Later 3 dialog
            to make the primary functionality group clearer and attract
            the eye better, primarily to help people avoid clicking the
            "Put in Outbox" button when they should be clicking "Send
            Later at time(s) specified above".
        -   Fix the display of the drop-down menus in the compose
            toolbar on Thunderbird 2 on platforms other than Linux.
        -   Add a missing tooltip for the Send Later button in the
            compose toolbar on Thunderbird 2.
        -   When displaying the release notes, scroll directly to the
            release notes for the version of the add-on that the user
            has installed.
        -   When asking the user to make a donation, make the request
            before sending the message rather than afterward, because
            otherwise on some platforms, e.g., Mac OS X, the donation
            request window disappears when the compose window is
            dismissed.
        -   New Simplified Chinese translation from yfdyh000 at
            BabelZilla.
        -   The French and Dutch translations have been updated slightly
            as well as moved to a different location within the innards
            of the add-on. If you use one of these translations, you
            might notice that some of the strings have changed, but
            otherwise they should continue to work just fine. *If they
            don't,* please let me know.Compatible up to Thunderbird
            15.0a1.
        -   (non-functional change) Remove unnecessary, empty
            translation string "separator.label".
        -   (non-functional change) Hard-code emacs coding-system into
            ambiguous files to avoid inadvertently saving them with the
            wrong coding system.

### []{#notes-3.3.7}Release 3.3.7 (March 27, 2012)

Changes since 3.3.5:

-   -   -   In the error pop-up that appears when there is a corrupt
            Drafts folder that the add-on is unable to read, display a
            link to the section of the user guide which explains in
            detail what to do about this problem.
        -   Restructure how the add-on's code is loaded to fix negative
            interactions with other add-ons. Specifically, this add-on
            was previously preventing the icons for the Enigmail and
            Dictionary Switcher add-ons from appearing at the bottom of
            message compose windows.
        -   Fix a bug introduced in version 3.3.6 when I updated the
            internal identifiers used in various components of the
            add-on as requested by the addons.mozilla.org editors. This
            bug was causing the scheduling pop-up to sometimes fail to
            schedule messages properly, as well as causing the scheduled
            send time to sometimes fail to display for scheduled
            messages.
        -   Fix a couple of coding errors introduced in 3.3.6 when the
            add-on's code was restructured to fix negative interactions
            with other add-ons. These coding errors don't affect recent
            versions of Thunderbird but do affect Thunderbird 2 and
            perhaps some intervening versions as well.
        -   Add a new hidden preference,
            extensions.sendlater3.send\_while\_offline. This preference
            is currently set to true by default. It can be changed using
            the advanced configuration editor.When this preference is
            true and the scheduled delivery time of a message arrives
            while Thunderbird is in offline mode, the message is moved
            into the Outbox and timestamped as of that time. When it is
            eventually delivered after you go online, the Date in the
            sent message will therefore correspond to its scheduled send
            time. As already noted, this is the default behavior and
            consistent with previous versions of the add-on.On the other
            hand, when this preference is false, messages whose
            scheduled delivery times have passed will not be moved into
            Outbox and timestamped until you go back online, which means
            the Date in the sent message will be when you went back
            online, not when the message was scheduled to be sent.I am
            interested in hearing from users which of these two
            behaviors you think is more correct, so that I can determine
            which should be the default and whether the setting should
            be visible in the preferences dialog. Please email me
            ([\[email protected\]](/cdn-cgi/l/email-protection){.__cf_email__})
            and let me know what you think.
        -   Add a Finnish translation. Than you to Samtron-Translations!
        -   Add the Japanese translation to the install manifest so the
            add-on's description is displayed in Japanese (for Japanese
            users) in the add-on manager.
        -   Fix broken donation links. Addons.mozilla.org's layout
            changed, and the old links stopped working.
        -   Compatible up to Thunderbird 14.0a1.
        -   Add some debugging code to help me figure out why one user
            is seeing the scheduling pop-up when he clicks the "Send"
            button when he shouldn't be.
        -   (non-functional change) Remove the inclusion of a JavaScript
            script that the add-on wasn't actually using, to prevent the
            unnecessary creation of extra global symbols. Change
            requested by the addons.mozilla.org editors.
        -   (non-functional change) Change the identifiers used within
            the code for various components of the add-on, to reduce the
            likelihood of namespace conflicts with other add-ons. Change
            requested by the addons.mozilla.org editors.

### Release 3.3.6 (March 20, 2012)

Version 3.3.6 was removed after release because of a serious bug in it.
Its release notes have been merged into the release notes for version
3.3.7, above.

### []{#notes-3.3.5}Release 3.3.5 (February 29, 2012)

Changes since version 3.3.4:

-   -   -   The "Send Later" button that shows up when you compose a
            message while working offline should pop up the Send Later 3
            dialog.
        -   Fix a slow memory leak caused by a typographical error in a
            module uninitialization function.

### []{#notes-3.3.4}Release 3.3.4 (February 15, 2012)

Changes since 3.3.3:

-   -   -   Make sorting by the "Send Later" column in Drafts folders
            work properly.
        -   Add error checking for a rarely encountered error when one
            of the user's Drafts folders is corrupt.
        -   Remove the version number of the add-on from the message
            that displays at the bottom of the screen briefly when
            Thunderbird starts up. It doesn't serve any useful purpose
            there and was forcing me to update two different files in
            the add-on every time I released a new version.
        -   Translation updates. Thanks as always to my translators!
        -   Compatible up to Thunderbird 13.0a1.

### []{#notes-3.3.3}Release 3.3.3 (January 18, 2012)

Changes since version 3.3.2:

-   -   -   Add an accelerator key for the Send Now button in the pop-up
            dialog.
        -   Add a preference to allow the Send Later pop-up to be bound
            to Alt-Shift-Enter instead of Ctrl-Shift-Enter, preserving
            the default behavior for Ctrl-Shift-Enter.
        -   Compatible up to Thunderbird 12.0a1.

### []{#notes-3.3.2}Release 3.3.2 (November 16, 2011)

Changes since version 3.3.1:

-   -   -   Support Postbox 3.
        -   Fix bug: If you edited a previously scheduled draft, and
            then later composed a new message, it was possible for the
            default scheduled delivery time in the compose window to be
            initialized to the scheduled time for the previously edited
            draft, rather than to the current time.
        -   Fix bug: The add-on is supposed to remove the scheduled send
            time from any draft you edit, when you start editing it, to
            avoid it accidentally being sent out while you were editing
            it. This functionality was not working properly for drafts
            that were followups or replies.
        -   Fix release notes display to account for recent changes to
            Thunderbird internals.
        -   Compatible up to Thunderbird 11.0a1.
        -   Change some internal identifiers (not user-visible) to
            confirm to new coding standards for addons.mozilla.org.

### []{#notes-3.3.1}Release 3.3.1 (October 25, 2011)

-   -   -   Compatible up to Thunderbird 10.0a1.
        -   Fix a bug (I hope) which could cause recurring messages to
            be sent from the wrong identity and/or saved in the wrong
            Sent folder.
        -   Add tooltip text to the Send Later button in the compose
            pane toolbar, so that if the user displays only icons in the
            toolbar, there'll be a hint about what the button does if
            the user hovers over it. This change was suggested by
            "Bigpapa".
        -   Italian translation from "Cesare".
        -   Japanese translation from Ryo Matsui.
        -   French translation updates from "Bigpapa", who is now
            assisting with the French translation.
        -   Minor updates to some other translations.
        -   Change some debug logging messages to be more useful.

### []{#notes-3.3}Release 3.3 (July 18, 2011)

Changes since release 3.2.9:

-   -   -   Scanning Drafts folders for scheduled messages is now
            several orders of magnitude faster and uses very little
            network traffic. You can now safely use Send Later 3 with
            Drafts folders with hundreds or even thousands of messages
            in them.
        -   Messages are no longer spell-checked multiple times when
            "'Send' does 'Send Later\'" is enabled.
        -   The scheduled send time of a draft is now canceled when you
            start editing it, and a warning pop-up informs you of this.
            This is to prevent the draft from being sent out from under
            you while you are in the process of editing it. If you don't
            want to see the pop-up every time you edit a scheduled
            draft, you can set the preference
            extensions.sendlater3.show\_edit\_alert to false in
            Thunderbird's advanced config editor.
        -   The layout and button labels of the prompt window have been
            adjusted slightly to make them clearer. Thanks to Jasir
            Alavi for the great UI improvement suggestions.
        -   The add-on no longer attempts to deliver messages from your
            Outbox to the mail server when "Work Offline" is enabled in
            Thunderbird. Before this fix, if the scheduled send time of
            a message arrived when "Work Offline" was enabled, Send
            Later 3 would attempt to deliver it and Thunderbird would
            get confused.
        -   New translated strings to go with the new functionality.
            Thanks as always to my translators!

### []{#notes-3.2.9}Release 3.2.9 (June 19, 2011)

Changes since 3.2.7:

-   -   -   Compatible with Thunderbird 5.
        -   Swedish translation from Mikael Hiort af Ornäs. Thanks,
            Mikael!
        -   Fix a bug first introduced in version 3.2.6: The drop-down
            values in the compose toolbar are supposed to be updated to
            the current time whenever a new draft is opened and are
            supposed to track the current time until / unless they are
            modified by the user. This has been broken since 3.2.6 but
            is now fixed.
        -   Do a better job of handling the unusual case of the default
            drafts folder being something other than Drafts within Local
            Folders.

### []{#notes-3.2.8}Release 3.2.8 (June 15, 2011)

Release 3.2.8 was pulled shortly after release due to a regression which
is fixed in release 3.2.9.

### []{#notes-3.2.7}Release 3.2.7 (March 30, 2011)

-   -   -   Add "'Send' does 'Send Later'" functionality.
        -   Prompt the user periodically to ask if s/he wants to make a
            donation to support further development of the add-on. Allow
            these prompts to be stopped by clicking the "Stop asking"
            button.
        -   Fix the bug which was sometimes preventing the "Send Later"
            column from being displayed in the Drafts folder.
        -   Add links to the preferences page for emailing the author,
            viewing the user manual, or making a donation. (Note: In
            Thunderbird 2, the donation link is not available, and the
            user manual link is text rather than a clickable link)
        -   In Thunderbird 3, display release notes when the add-on is
            updated.
        -   Update a number of foreign-language translation strings that
            were previously defaulting to English.

If you like the new features in this release, please consider [making a
donation](#donate).

### []{#notes-3.2.6}Release 3.2.6 (January 28, 2011)

-   -   -   Support recurring scheduled messages!
        -   Temporarily disable delivery of scheduled messages if a
            serious error occurs, and tell the user where to go on the
            Web to get help resolving the problem.
        -   Change the translations so that when the name of the add-on
            is referred to, it's always referred to as "Send Later 3" in
            English.
        -   Some translation updates.

### []{#notes-3.2.5}Release 3.2.5 (January 17, 2011)

-   -   -   Support Thunderbird 2.
        -   Support [Postbox 2](https://postbox-inc.com/).
        -   When scheduling a reply or forward, mark the original
            message replied or forwarded.
        -   Allow Send Later 3 to removed completely from the Status Bar
            by unsetting a new preference (which defaults to being set).
        -   Display an alert if an error is encountered when attempting
            to deliver messages. this is usually caused by a corrupt
            Outbox folder, so point the user at the instructions
            [above](#outbox) for fixing the corrupt folder.

### []{#notes-3.2.4}Release 3.2.4 (January 13, 2011)

-   -   -   Polish translation from Maciej Kobuszewski.
        -   Fix a couple of typos in the French translation.
        -   Attempt to work around a problem with Thunderbird's core
            "updateFolder" function sometimes throwing an error and
            causing Send Later 3 to fail to detect a scheduled draft.
            The workaround is to ignore the error rather than letting it
            abort the Send Later 3 code, since there's nothing we can do
            about the error anyway.

### []{#notes-3.2.3}Release 3.2.3 (November 25, 2010)

-   -   -   Change the progress meter from a "spinning" meter which
            moves constantly while the add-on is working, into an actual
            progress meter which advances to 100% as the add-on finishes
            its work. This provides more information to the user than
            before and also reduces the amount of CPU consumed by the
            add-on.
        -   When a scheduled message is saved into a Drafts folder which
            is not being checked periodically by the add-on because its
            "Check for new messages every..." checkbox is disabled,
            force a single check of the Drafts folder to ensure that the
            add-on knows about the newly scheduled message.
        -   When popping up the scheduling dialog in a compose window,
            make focus start on the "hours" drop-down rather than the
            "Cancel" button so it is easier to schedule a message
            entirely with the keyboard, i.e., without using the mouse.
        -   Make Ctrl-Enter anywhere in the compose window pop-up
            equivalent to clicking the "Send Later at specified time"
            button so it is easier to schedule a message entirely with
            the keyboard.
        -   Work around a bug in Thunderbird which prevents the Send
            Later 3 drop-downs in the compose window toolbar from being
            updated when they are first added to the toolbar.

### []{#notes-3.2.1}Release 3.2.1 (October 27, 2010)

-   -   -   Bug fix: Strip the "X-Send-Later-Uuid" header from the
            header of scheduled messages before sending them.
        -   Send Later 3 no longer attempts to periodically contact IMAP
            servers whose "Check for new message every ... minutes"
            checkboxes are unchecked in their Server Settings. This
            means that you can now have a configured IMAP account which
            is currently inaccessible without Send Later 3 causing
            "Connection to server ... timed out" messages or the like to
            pop up every minute.
        -   A new setting has been added to the preferences dialog to
            allow the date & time dropdowns and "Send Later" button to
            be omitted from the compose window toolbar, thus leaving
            only the preset buttons in the toolbar.
        -   Bug fix: Allow the three preset buttons' display in the
            compose window toolbar to be configured independently
            (previously, the toolbar display setting for the first
            button controlled all three of them).
        -   Bug fix: Work around a Thunderbird bug so that when Send
            Later 3 is being used in one of its translated, non-English
            locales, the name of the add-on will still show up correctly
            in the add-ons list.
        -   Improve the performance of [dynamic preset
            buttons](#dynamic).

### []{#notes-3.2}Release 3.2 (September 16, 2010)

-   -   Drafts saved with Send Later 3 are now "locked" to a particular
        Thunderbird profile. This means that a draft will only be
        delivered (at the scheduled time) by a Thunderbird running
        against the profile from which it was originally written.
        Therefore, you can now run Send Later 3 in Thunderbirds which
        talk to the same accounts from multiple computers without
        worrying about them conflicting with each other.
    -   Fix a big memory leak by fixing a bug which was causing many
        superfluous entries to be inserted into some of the drop-down
        menus in the compose toolbar.
    -   Fix a significant bug: When the user was using an IMAP Drafts
        folder and had configured the account so that deleted messages
        were marked deleted rather than moved to a different folder,
        scheduled messages were getting sent repeatedly.
    -   Fix a bug discovered and reported by Fabian Möller: the delivery
        time of a message might have been scheduled incorrectly (wrong
        month) when the user attempted to schedule a message during some
        months on the 29th, 30th, or 31st of the month.
    -   Mark compatible with Thunderbird 3.0, since there have been
        multiple reports from users who have tried it that it works
        fine.
    -   Add translations:
        -   Spanish from Milcom.es
        -   German from Suzanne Iseli and Daniel S.
        -   French from Didier Journois
    -   Add translations for the add-on description which appears in the
        extensions manager.
    -   Claim compatibility with 3.2a1pre and 3.3a1pre until proven
        otherwise.
    -   Add a new hidden preference (i.e., you can get to it from the
        advanced config editor, but not from the Send Later 3
        preferences window), "extensions.sendlater3.senddrafts", which
        will cause Send Later 3 not to actually send any scheduled
        drafts if it is set to false. This is useful, e.g., if you want
        to use Send Later 3 for scheduling drafts but use some other
        tool for actually sending them.

::: {.printfriendly .pf-alignleft}
![Print Friendly, PDF &
Email](https://i0.wp.com/cdn.printfriendly.com/buttons/printfriendly-button.png?w=1040&ssl=1){.jetpack-lazy-image
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}

![Print Friendly, PDF &
Email](https://i0.wp.com/cdn.printfriendly.com/buttons/printfriendly-button.png?w=1040&ssl=1)
:::
:::

::: {.addtoany_share_save_container .addtoany_content .addtoany_content_bottom}
::: {.a2a_kit .a2a_kit_size_16 .addtoany_list data-a2a-url="/send-later/" data-a2a-title="Send Later Thunderbird Add-on"}
[](https://www.addtoany.com/add_to/facebook?linkurl=https%3A%2F%2Fblog.kamens.us%2Fsend-later%2F&linkname=Send%20Later%20Thunderbird%20Add-on "Facebook"){.a2a_button_facebook}[](https://www.addtoany.com/add_to/twitter?linkurl=https%3A%2F%2Fblog.kamens.us%2Fsend-later%2F&linkname=Send%20Later%20Thunderbird%20Add-on "Twitter"){.a2a_button_twitter}![Share](https://i2.wp.com/static.addtoany.com/buttons/favicon.png?w=1040&ssl=1){.jetpack-lazy-image
srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}

![Share](https://i2.wp.com/static.addtoany.com/buttons/favicon.png?w=1040&ssl=1)
:::
:::
:::

::: {#comments .comments-area}
423 thoughts on "Send Later Thunderbird Add-on" {#thoughts-on-send-later-thunderbird-add-on .comments-title}
-----------------------------------------------

1.  [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default .jetpack-lazy-image width="30"
    height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1812100}
    ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
    mader [November 14,
    2020](/send-later/comment-page-4/#comment-1812100)
    ::: {.section .comment-content .comment}
    Genius!
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

2.  [![](https://secure.gravatar.com/avatar/1d83283217ce55f5d6befe08eed82ab6?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1811752}
    ![](https://secure.gravatar.com/avatar/1d83283217ce55f5d6befe08eed82ab6?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/1d83283217ce55f5d6befe08eed82ab6?s=60&d=mm&r=pg 2x"}
    Seth [November 5, 2020](/send-later/comment-page-4/#comment-1811752)
    ::: {.section .comment-content .comment}
    Hi Jonathan,

    Thank you for all that you do to create an excellent toolset that
    helps people send less vitriolic email!

    For my own self, I find that using Send Later stops me from sending
    the wrong message as much as I am able to discern.

    Wishing you an auspicious Armistice Day!

    Cheers\
    Seth
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

3.  [![](https://secure.gravatar.com/avatar/6fea5e835fa60774307a0a02751e670a?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1810856}
    ![](https://secure.gravatar.com/avatar/6fea5e835fa60774307a0a02751e670a?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/6fea5e835fa60774307a0a02751e670a?s=60&d=mm&r=pg 2x"}
    Gib Henry [October 3,
    2020](/send-later/comment-page-4/#comment-1810856)
    ::: {.section .comment-content .comment}
    Send Later is incompatible with Thunderbird 78.3.1. May we look
    forward to an update?
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1810858}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[October 3,
        2020](/send-later/comment-page-4/#comment-1810858)
        ::: {.section .comment-content .comment}
        Please see the statement I've just added at the top of this
        page.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

4.  [![](https://secure.gravatar.com/avatar/53afa546c2fa6cb313a43cc4c05b4b60?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1810808}
    ![](https://secure.gravatar.com/avatar/53afa546c2fa6cb313a43cc4c05b4b60?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/53afa546c2fa6cb313a43cc4c05b4b60?s=60&d=mm&r=pg 2x"}
    barel [September 30,
    2020](/send-later/comment-page-4/#comment-1810808)
    ::: {.section .comment-content .comment}
    Do you have in view to upgrade SendLater to work with the Tbird ver
    78 and later ? Thank you for helping us appreciating your work.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1810825}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[October 1,
        2020](/send-later/comment-page-4/#comment-1810825)
        ::: {.section .comment-content .comment}
        Please see the most recent update about this at
        <https://www.kickstarter.com/projects/jik/rewritten-add-ons-for-mozilla-thunderbirds-next-release/posts/2962176>.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

5.  [![](https://secure.gravatar.com/avatar/7bc03028e9711ce726e46cacae40e667?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1810744}
    ![](https://secure.gravatar.com/avatar/7bc03028e9711ce726e46cacae40e667?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/7bc03028e9711ce726e46cacae40e667?s=60&d=mm&r=pg 2x"}
    nietseb [September 26,
    2020](/send-later/comment-page-4/#comment-1810744)
    ::: {.section .comment-content .comment}
    Thanks you for the work actually in progress to make this addon
    compatible with Thunderbird 78!
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

6.  [![](https://secure.gravatar.com/avatar/beef9bd6eeab15fe4b0095fe0e73bb03?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1808716}
    ![](https://secure.gravatar.com/avatar/beef9bd6eeab15fe4b0095fe0e73bb03?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/beef9bd6eeab15fe4b0095fe0e73bb03?s=60&d=mm&r=pg 2x"}
    [asis](http://www.ntdhoy.com){.url} [July 22,
    2020](/send-later/comment-page-4/#comment-1808716)
    ::: {.section .comment-content .comment}
    Please, help, in today's update is not working, verios Firefox 78.0
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1808721}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[July 22,
        2020](/send-later/comment-page-4/#comment-1808721)
        ::: {.section .comment-content .comment}
        There is a beta release of Send Later for Thunderbird 78 as
        described at
        <https://groups.google.com/d/msg/send-later-users/y4WBzYo260E/D6RwuSyBDgAJ>
        .
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

        1.  [![](https://secure.gravatar.com/avatar/77b47422f90e6bac66bbeab396f7d166?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1810528}
            ![](https://secure.gravatar.com/avatar/77b47422f90e6bac66bbeab396f7d166?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo width="30" height="30"
            srcset="https://secure.gravatar.com/avatar/77b47422f90e6bac66bbeab396f7d166?s=60&d=mm&r=pg 2x"}
            [Nathan Veenstra](https://optimusonline.nl){.url} [September
            17, 2020](/send-later/comment-page-4/#comment-1810528)
            ::: {.section .comment-content .comment}
            Any ETA on an official release for Firefox 78.\*? I have
            just updated Firefox, not realising some addons might not be
            compatible.
            :::

            ::: {.reply}
            [Reply](/send-later/){.comment-reply-link} ↓
            :::

            1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo .jetpack-lazy-image width="30"
                height="30"
                srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1810677}
                ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo width="30" height="30"
                srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
                [jik](https://stuff.mit.edu/~jik/){.url} Post
                author[September 22,
                2020](/send-later/comment-page-4/#comment-1810677)
                ::: {.section .comment-content .comment}
                Please see
                <https://www.kickstarter.com/projects/jik/rewritten-add-ons-for-mozilla-thunderbirds-next-release/posts/2962176>
                for the most recent update.
                :::

                ::: {.reply}
                [Reply](/send-later/){.comment-reply-link} ↓
                :::

                1.  [![](https://secure.gravatar.com/avatar/77b47422f90e6bac66bbeab396f7d166?s=30&d=mm&r=pg){.avatar
                    .avatar-30 .photo .jetpack-lazy-image width="30"
                    height="30"
                    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1810723}
                    ![](https://secure.gravatar.com/avatar/77b47422f90e6bac66bbeab396f7d166?s=30&d=mm&r=pg){.avatar
                    .avatar-30 .photo width="30" height="30"
                    srcset="https://secure.gravatar.com/avatar/77b47422f90e6bac66bbeab396f7d166?s=60&d=mm&r=pg 2x"}
                    Nathan Veenstra [September 25,
                    2020](/send-later/comment-page-4/#comment-1810723)
                    ::: {.section .comment-content .comment}
                    Wow. Although I subscribed to replies, I did not get
                    a notification of your reply. Thanks, I have just
                    emailed you.
                    :::

                    ::: {.reply}
                    [Reply](/send-later/){.comment-reply-link} ↓
                    :::

7.  [![](https://secure.gravatar.com/avatar/91156bd6afa499d2a8aa8d4d5d11f910?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1808174}
    ![](https://secure.gravatar.com/avatar/91156bd6afa499d2a8aa8d4d5d11f910?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/91156bd6afa499d2a8aa8d4d5d11f910?s=60&d=mm&r=pg 2x"}
    David White [July 6,
    2020](/send-later/comment-page-4/#comment-1808174)
    ::: {.section .comment-content .comment}
    I am getting this message when Send Later sends an email.\
    There are non-ASCII characters in the local part of the recipient
    address . This is not yet supported. Please change this address and
    try again.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

8.  [![](https://secure.gravatar.com/avatar/92a3cb3970b9a14d642d5692a0fcca0b?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1807515}
    ![](https://secure.gravatar.com/avatar/92a3cb3970b9a14d642d5692a0fcca0b?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/92a3cb3970b9a14d642d5692a0fcca0b?s=60&d=mm&r=pg 2x"}
    Camilla Niklasson [June 11,
    2020](/send-later/comment-page-4/#comment-1807515)
    ::: {.section .comment-content .comment}
    Am I a complete idiot or is there problems with the add-on? I still
    have Thunderbird 68 (swedish) but the Send Later add-on is
    completely different and the button "send around ...." doesn't show
    up. I have tried almost everything.\
    I have also signed for the Kickstarter project but I don't know
    what's happening there.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1807526}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[June 11,
        2020](/send-later/comment-page-4/#comment-1807526)
        ::: {.section .comment-content .comment}
        Please email me at [[\[email protected\]]{.__cf_email__
        data-cfemail="ff959694d48c9a919b939e8b9a8dccbf949e929a918cd18a8c"}](/cdn-cgi/l/email-protection#513b383a7a22343f353d3025342362113a303c343f227f2422)
        for support.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

9.  ::: {#comment-1806821}
    Pingback: [Send Later for Mac - Apps for My
    PC](http://www.appsformypc.com/2019/11/send-later-for-mac/){.url}
    :::

10. [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default .jetpack-lazy-image width="30"
    height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805816}
    ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
    Anonymous [March 12,
    2020](/send-later/comment-page-4/#comment-1805816)
    ::: {.section .comment-content .comment}
    Hi, jik,\
    I am glad to have this ad-on. However, there is an error message
    saying: "There are non-ASCII characters in the local part of the
    recipient address . This is not yet supported. Please change this
    address and try again." when thunderbird sends the scheduled email.
    How could I solve it?
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805820}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[March 13,
        2020](/send-later/comment-page-4/#comment-1805820)
        ::: {.section .comment-content .comment}
        I can't support people here. Please [email
        me](/cdn-cgi/l/email-protection#e3898a88a388828e868d90cd9690).
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

11. [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default .jetpack-lazy-image width="30"
    height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805142}
    ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
    Jerry [January 31,
    2020](/send-later/comment-page-4/#comment-1805142)
    ::: {.section .comment-content .comment}
    What happened to my comment.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805143}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[January 31,
        2020](/send-later/comment-page-4/#comment-1805143)
        ::: {.section .comment-content .comment}
        It's still there.

        It may have disappeared from your view temporarily because this
        page is cached by CloudFlare because otherwise my server is
        overwhelmed every time I release a new major version of Send
        Later and thousands of Thunderbird clients all try to load the
        release notes at the same time.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

12. [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default .jetpack-lazy-image width="30"
    height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805141}
    ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
    Jerry [January 31,
    2020](/send-later/comment-page-4/#comment-1805141)
    ::: {.section .comment-content .comment}
    Will you charge for the addon even if the Kickstarter campaign meets
    its goal?
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805145}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[January 31,
        2020](/send-later/comment-page-4/#comment-1805145)
        ::: {.section .comment-content .comment}
        Yes. The [Kickstarter campaign
        page](https://www.kickstarter.com/projects/jik/rewritten-add-ons-for-mozilla-thunderbirds-next-release)
        explains why in detail.

        My goal is to make maintenance of my add-ons sustainable in the
        long term. A one-time infusion of money will not do that. In
        fact, the total amount of money being raised by the Kickstarter
        isn't even enough to set up the infrastructure necessary for
        long-term sustainability. It's enough for me to get started, and
        I am expecting to recoup the rest of the money from additional
        sales of subscriptions after the Kickstarter campaign ends.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

        1.  [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .avatar-default .jetpack-lazy-image
            width="30" height="30"
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805154}
            ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .avatar-default width="30" height="30"
            srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
            Jerry [February 1,
            2020](/send-later/comment-page-4/#comment-1805154)
            ::: {.section .comment-content .comment}
            Thank you for making this more clear.\
            I appreciate your contributions you've made over the years,
            so this will sound harsh.\
            But if you no longer enjoy working on this addon / don't
            have the time / no personal use, I'd much rather see this
            addon getting abandoned than turning commercial.

            Truth be told, I think the addon will be moving to a
            subscription model even if the kickstarter campaign fails.

            Jerry
            :::

            ::: {.reply}
            [Reply](/send-later/){.comment-reply-link} ↓
            :::

            1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo .jetpack-lazy-image width="30"
                height="30"
                srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805157}
                ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo width="30" height="30"
                srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
                [jik](https://stuff.mit.edu/~jik/){.url} Post
                author[February 1,
                2020](/send-later/comment-page-4/#comment-1805157)
                ::: {.section .comment-content .comment}
                > But if you no longer enjoy working on this addon /
                > don't have the time / no personal use, I'd much rather
                > see this addon getting abandoned than turning
                > commercial.

                Why?

                > Truth be told, I think the addon will be moving to a
                > subscription model even if the kickstarter campaign
                > fails.

                If I get nothing else out of the experience of trying to
                prevent the 100,000 users of my add-ons from losing them
                when Thunderbird 78 comes out, at least I will have
                gotten to experience firsthand that even thirty years of
                maintaining open-source software for free isn't enough
                to prevent some people from maligning you for trying to
                do the right thing.

                You are welcome to think what you want, everything I've
                said about my intentions regarding my add-ons is true.
                :::

                ::: {.reply}
                [Reply](/send-later/){.comment-reply-link} ↓
                :::

13. [![](https://secure.gravatar.com/avatar/6547a147fca6f34b5ac63e6a220614c5?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805110}
    ![](https://secure.gravatar.com/avatar/6547a147fca6f34b5ac63e6a220614c5?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/6547a147fca6f34b5ac63e6a220614c5?s=60&d=mm&r=pg 2x"}
    Jeremy [January 30,
    2020](/send-later/comment-page-4/#comment-1805110)
    ::: {.section .comment-content .comment}
    Hi,\
    You have put out a campaign to for us to contribute to your work. I
    applaud that and would not hesitate to get a license. I have used
    this add-on for years tho not all the time but its a nice to have
    useful add-on.\
    Rather than paying kickstarter where they take a commission, I'd
    rather pay you directly on paypal as a friend send. That way you get
    all the my contribution. Send me your paypal address and I'd gladly
    send over.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805111}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[January 30,
        2020](/send-later/comment-page-4/#comment-1805111)
        ::: {.section .comment-content .comment}
        I would really rather you and others pledged via Kickstarter.

        The purpose of the Kickstarter campaign is to gauge whether
        there is in fact enough willingness to pay for these add-ons to
        make it viable to keep supporting them.

        If the Kickstarter campaign does not reach its goal, then *I
        will not get one cent of the money pledged by people to the
        campaign, and I will not be able to upgrade my add-ons for
        Thunderbird 78.* If you want the add-ons to continue to be
        available, pledging to the Kickstarter campaign is a better
        choice.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

14. [![](https://secure.gravatar.com/avatar/2aecb76d653de6c89f71d2123c429ffb?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805103}
    ![](https://secure.gravatar.com/avatar/2aecb76d653de6c89f71d2123c429ffb?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/2aecb76d653de6c89f71d2123c429ffb?s=60&d=mm&r=pg 2x"}
    Ankit [January 30,
    2020](/send-later/comment-page-4/#comment-1805103)
    ::: {.section .comment-content .comment}
    I am not able to send later via mail merge. What I want to do is
    send a batch of 40 emails using a CSV at an interval of 20 seconds
    starting let's in 5 hrs which will be 5 pm EST. I've tried adding
    {{date}} and {{time}} variable in email body. The process I follow
    is-\>\
    -- Compose email -- {{Name}} {{Email}} variables added in first line
    of email\
    -- I don't add any {{date}} {{time}} variables in a column in CSV
    file with all email addresses\
    -- Click Mail Merge\
    -- Select Save Draft\
    -- Go to Send later section\
    -- At: 5:00 pm\
    -- Recur: none\
    -- Every: 20

    I don't mention any number under batch section

    All 40 emails will merge immediately and will store in Draft\
    But in Draft section, I don't see any time stamp in front of emails
    like I see when I use send later option for 1 email\
    And the emails keep sitting in the drafts folder. How do I go about
    it?
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805159}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[February 2,
        2020](/send-later/comment-page-4/#comment-1805159)
        ::: {.section .comment-content .comment}
        The "Every" field in the mail merge dialog is for if you want to
        send a single message repeatedly, not for if you want to send
        messages 20 seconds apart.

        To do the latter, you really do need to either put a date and
        time column in your CSV and then put {{date}} {{time}} the "At:"
        field underneath "Send Later" in the mail merge dialog, or if
        you're sending them all on the same day then you can just have a
        "time" column in your CSV and use a hard-coded date in the "At:"
        field, e.g., "2020-02-03 {{time}}".

        Note that you can populate the time fields in the spreadsheet
        by, e.g., setting the time in the first row and then using a
        formula for that column in subsequent rows to add 20 seconds for
        each row using `TIMEVALUE()`.

        Note that Send Later only checks for new messages to send every
        minute by default, so if you schedule message for every 20
        seconds what will happen instead is about three of them will
        send each minute all at once when Send Later checks. If you need
        more granular sending than that, then see
        [above](#milliseconds).
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

15. [![](https://secure.gravatar.com/avatar/4a0489ba29b7712110cf2546fe505594?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805016}
    ![](https://secure.gravatar.com/avatar/4a0489ba29b7712110cf2546fe505594?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/4a0489ba29b7712110cf2546fe505594?s=60&d=mm&r=pg 2x"}
    Whitney Boe [January 24,
    2020](/send-later/comment-page-4/#comment-1805016)
    ::: {.section .comment-content .comment}
    Thank you so much for such a thorough "how to" for your add-on! BTW
    you mention that it is not currently compatible with "Use BCC
    instead" but I have that add-on in my TB and it and yours are
    working just fine. Currently using TB 68.4.2 with an iMac running
    High Sierra 10.13.6.\
    Thanks again!
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1805017}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[January 24,
        2020](/send-later/comment-page-4/#comment-1805017)
        ::: {.section .comment-content .comment}
        It might work intermittently, but I would not count on it
        working reliably.

        I will look into improving compatibility if the Kickstarter
        campaign succeeds and the new maintainer of Use BCC Instead
        commits to making it compatible with Thunderbird 78 and beyond,
        but I'm not going to invest effort on it before that.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

16. [![](https://secure.gravatar.com/avatar/7259fd1add3a1067f6200b0f1e2ce147?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1804794}
    ![](https://secure.gravatar.com/avatar/7259fd1add3a1067f6200b0f1e2ce147?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/7259fd1add3a1067f6200b0f1e2ce147?s=60&d=mm&r=pg 2x"}
    Ryk van Donselaar [January 7,
    2020](/send-later/comment-page-4/#comment-1804794)
    ::: {.section .comment-content .comment}
    So I've had repeated crashes with TB when closing it. After shutting
    down addons one at a time I found that this particular addon was the
    cause. When I disabled this app the crashes stopped.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1804795}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[January 7,
        2020](/send-later/comment-page-4/#comment-1804795)
        ::: {.section .comment-content .comment}
        If TB is crashing, then that's a TB problem, not a Send Later
        problem. It maybe that Send Later just happens to be doing
        something to trigger the TB bug, bug it's a TB bug, not a Send
        Later bug.

        I suggest [creating a new TB
        profile](https://support.mozilla.org/kb/using-multiple-profiles)
        and seeing if that solves the problem. If not, I suggest
        uninstalling and reinstalling Thunderbird.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

17. [![](https://secure.gravatar.com/avatar/d82210f4622ec15def03964a484ada27?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1804779}
    ![](https://secure.gravatar.com/avatar/d82210f4622ec15def03964a484ada27?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/d82210f4622ec15def03964a484ada27?s=60&d=mm&r=pg 2x"}
    Petr Malovaný - SINTAKA [January 6,
    2020](/send-later/comment-page-4/#comment-1804779)
    ::: {.section .comment-content .comment}
    Hello, Thunderbird version 68.3.1 does not work Send Later, more
    accurately displays in the bar only 30, 60 ... minutes not the date
    and time of my choice. How to proceed?
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1804780}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[January 6,
        2020](/send-later/comment-page-4/#comment-1804780)
        ::: {.section .comment-content .comment}
        This is addressed [above](#notes-7.1.0) in the release notes for
        the upgrade to TB68:

        > Unfortunately, the datepicker and timepicker that Send Later
        > is now using don't work when inserted into the composition
        > window toolbar, so they are no longer among Send Later's
        > custom toolbar widgets.

        You can still put the text box in the compose window toolbar or
        use the dialog with Ctrl-Shift-Enter; you just can't put the
        datepicker and timepicker widgets in the toolbar.

        I hope to be able to fix this in a future Thunderbird release,
        but for now I can't.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

18. [![](https://secure.gravatar.com/avatar/d82210f4622ec15def03964a484ada27?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1804778}
    ![](https://secure.gravatar.com/avatar/d82210f4622ec15def03964a484ada27?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/d82210f4622ec15def03964a484ada27?s=60&d=mm&r=pg 2x"}
    Send later not work [January 6,
    2020](/send-later/comment-page-4/#comment-1804778)
    ::: {.section .comment-content .comment}
    Hello, Thunderbird version does not work Send Later, more accurately
    displays in the bar only 30, 60 ... minutes not the date and time of
    my choice. How to proceed?
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

19. [![](https://secure.gravatar.com/avatar/1cfee6505a824e27bf31fb1d9e95c639?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1804501}
    ![](https://secure.gravatar.com/avatar/1cfee6505a824e27bf31fb1d9e95c639?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/1cfee6505a824e27bf31fb1d9e95c639?s=60&d=mm&r=pg 2x"}
    [Dave](http://www.davenevins.com){.url} [December 18,
    2019](/send-later/comment-page-4/#comment-1804501)
    ::: {.section .comment-content .comment}
    awesome. thx
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

20. [![](https://secure.gravatar.com/avatar/5ef5d2046ffb9a000803235b831af47a?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1803993}
    ![](https://secure.gravatar.com/avatar/5ef5d2046ffb9a000803235b831af47a?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/5ef5d2046ffb9a000803235b831af47a?s=60&d=mm&r=pg 2x"}
    JN [December 3, 2019](/send-later/comment-page-4/#comment-1803993)
    ::: {.section .comment-content .comment}
    Hello! Here is some feedback on the use of English within your
    program.

    'Recur: once' means: send, and then send again'. That is not what is
    meant. 'Recurrence: none' is better.

    'Recur: minutely' is bad English. 'Recurrence: every minute' is
    better.

    Thank you for your useful program.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1804010}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[December 3,
        2019](/send-later/comment-page-4/#comment-1804010)
        ::: {.section .comment-content .comment}
        I shall give your feedback all of the time and consideration it
        deserves.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

21. [![](https://secure.gravatar.com/avatar/171b7027fcbb53306e350741bad447ef?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1802908}
    ![](https://secure.gravatar.com/avatar/171b7027fcbb53306e350741bad447ef?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/171b7027fcbb53306e350741bad447ef?s=60&d=mm&r=pg 2x"}
    kevin [November 16,
    2019](/send-later/comment-page-4/#comment-1802908)
    ::: {.section .comment-content .comment}
    Apologies if you've addressed this issue, like, 1000 times 😉 :\
    Can you add a 'wake up my computer' function so that if my computer
    is asleep when the scheduled Send Later time arrives, my computer
    wakes up and sends the email?\
    --\
    I imagine that if this was easy you would have done it already, but
    it's the functionality I need, and one that might be expected in a
    tool called 'send later'...\
    thanks for your efforts!\
    -k
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1802942}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[November
        16, 2019](/send-later/comment-page-4/#comment-1802942)
        ::: {.section .comment-content .comment}
        [/send-later/\#running](/send-later/#running)
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

22. [![](https://secure.gravatar.com/avatar/149788f240d50e169f6b81f3124e759c?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1802562}
    ![](https://secure.gravatar.com/avatar/149788f240d50e169f6b81f3124e759c?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/149788f240d50e169f6b81f3124e759c?s=60&d=mm&r=pg 2x"}
    [Lawrence](https://sanstudio.com/){.url} [November 10,
    2019](/send-later/comment-page-4/#comment-1802562)
    ::: {.section .comment-content .comment}
    I just downgraded Thunderbird from 68.2.2 to 60.9.1, which fixed
    some of my extensions but broke others. One that broke was Send
    Later (and Send Later Button). So I tried to figure out which
    version might work with 60.9.1. I downloaded Send Later version
    6.4.6, but when I tried to install it, an error message said that
    it's "corrupt" and couldn't be installed.

    Is there a version of Send Later that will work with Thunderbird
    60.9.1? If so, which one? Thank you.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1802570}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[November
        10, 2019](/send-later/comment-page-4/#comment-1802570)
        ::: {.section .comment-content .comment}
        Send Later 6.4.6 is indeed the correct version to use with
        Thunderbird 60.9.1, and it is not corrupt. I just successfully
        downloaded and installed it in a new Thunderbird profile in
        60.9.1. I'm not sure why you're seeing different behavior, but
        whatever the problem is, I'm pretty sure it's not Send Later's
        fault.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

23. [![](https://secure.gravatar.com/avatar/2da5d1054567b43c09ec1c3fa6c88041?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1801725}
    ![](https://secure.gravatar.com/avatar/2da5d1054567b43c09ec1c3fa6c88041?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/2da5d1054567b43c09ec1c3fa6c88041?s=60&d=mm&r=pg 2x"}
    Jason Robinson [October 22,
    2019](/send-later/comment-page-4/#comment-1801725)
    ::: {.section .comment-content .comment}
    Thunderbird 69 is complaining that Send Later isn't compatible, I
    forced extension.CheckCompat and got the xpi to install, but
    File-\>Send Later doesn't evoke your dialog, it just puts the
    message in the outbox. I donated many years ago, but willing to
    re-up to help get this fixed! Thank you for such an awesome plugin!
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1801726}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[October 22,
        2019](/send-later/comment-page-4/#comment-1801726)
        ::: {.section .comment-content .comment}
        Use [version
        6.4.6](https://addons.thunderbird.net/en-US/thunderbird/addon/send-later-3/versions/6.4.6).
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

24. [![](https://secure.gravatar.com/avatar/572f468b565dd60c836ca88a0b497ea9?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1801483}
    ![](https://secure.gravatar.com/avatar/572f468b565dd60c836ca88a0b497ea9?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/572f468b565dd60c836ca88a0b497ea9?s=60&d=mm&r=pg 2x"}
    Börje [October 14,
    2019](/send-later/comment-page-4/#comment-1801483)
    ::: {.section .comment-content .comment}
    Hey,\
    we used to use this add-on for years. We have updated Thunderbird to
    the version 68.1.2.\
    With the current add-on version 7.2 unfortunately the add-on doesn't
    work any more. I can see the send later button, but without any
    possibilities to tell when to send the mail. And the "button"
    doesn't work either.\
    I'm working with the loalized German version of Thunderbird. I'm not
    sure if this could cause problem.

    Regards
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1801484}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[October 14,
        2019](/send-later/comment-page-4/#comment-1801484)
        ::: {.section .comment-content .comment}
        I suspect that in Thunderbird 60 you had customized your compose
        window toolbar to include both the date/time widget and the Send
        Later button.

        Unfortunately, the date/time widget is no longer available in
        the toolbar in Thunderbird 68 because of changes in Thunderbird
        68 which prevent me from being able to embed a date/time widget
        in the toolbar. This may change at some point in the future, but
        I'm not certain if/when that will happen.

        The Send Later button does not do anything by itself, it
        requires either the date/time widget or the text entry field to
        also be in the toolbar, as described above.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

        1.  [![](https://secure.gravatar.com/avatar/572f468b565dd60c836ca88a0b497ea9?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1801516}
            ![](https://secure.gravatar.com/avatar/572f468b565dd60c836ca88a0b497ea9?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo width="30" height="30"
            srcset="https://secure.gravatar.com/avatar/572f468b565dd60c836ca88a0b497ea9?s=60&d=mm&r=pg 2x"}
            Börje [October 15,
            2019](/send-later/comment-page-4/#comment-1801516)
            ::: {.section .comment-content .comment}
            OK. Thanks for the quick reply.\
            We will help ourselves using the CMD+SHIFT-RETURN command
            when sending an email!

            Regards

            Bö.
            :::

            ::: {.reply}
            [Reply](/send-later/){.comment-reply-link} ↓
            :::

25. [![](https://secure.gravatar.com/avatar/08da58e6317e27e5da82d16d00dd073b?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800513}
    ![](https://secure.gravatar.com/avatar/08da58e6317e27e5da82d16d00dd073b?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/08da58e6317e27e5da82d16d00dd073b?s=60&d=mm&r=pg 2x"}
    T0rben [September 23,
    2019](/send-later/comment-page-4/#comment-1800513)
    ::: {.section .comment-content .comment}
    Great addon, thank you for your work!

    I've been using keyconfig to send all my messages later using the
    way you described in this post.

    With TB68, keyconfig doesn't work anymore and likely won't for a
    long time. Could you imagine to implement a feature that will not
    only replace the send function of TB (like the option we already
    have) but also not use the popup but instead send later
    automatically after x (configurable?) minutes?

    Best wishes!
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800569}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[September
        23, 2019](/send-later/comment-page-4/#comment-1800569)
        ::: {.section .comment-content .comment}
        You're right, it's about time I implemented this. I've added it
        in Send Later release 7.2.0, which will be released to the
        public as soon as the moderators of addons.thunderbird.net get
        around to approving it.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

        1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800577}
            ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo width="30" height="30"
            srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
            [jik](https://stuff.mit.edu/~jik/){.url} Post
            author[September 23,
            2019](/send-later/comment-page-4/#comment-1800577)
            ::: {.section .comment-content .comment}
            Update: Release 7.2.0 is now publicly available for download
            or update.
            :::

            ::: {.reply}
            [Reply](/send-later/){.comment-reply-link} ↓
            :::

            1.  [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo .avatar-default .jetpack-lazy-image
                width="30" height="30"
                srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800618}
                ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo .avatar-default width="30" height="30"
                srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
                T0rben [September 24,
                2019](/send-later/comment-page-4/#comment-1800618)
                ::: {.section .comment-content .comment}
                Wow, didn't expect that when returning to check for
                replies. Awesome mate!!
                :::

                ::: {.reply}
                [Reply](/send-later/){.comment-reply-link} ↓
                :::

26. [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default .jetpack-lazy-image width="30"
    height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800377}
    ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .avatar-default width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
    David [September 20,
    2019](/send-later/comment-page-4/#comment-1800377)
    ::: {.section .comment-content .comment}
    Love it.\
    The send later column is always shown in the inbox view when
    starting up Thunderbird. I did not select to have the column show.
    When navigating to a different tab and back it will hide again.\
    Thunderbird 68.1 and Send Later 7.1.2
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800418}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[September
        21, 2019](/send-later/comment-page-4/#comment-1800418)
        ::: {.section .comment-content .comment}
        That's... weird. I have not seen that before.

        Try this:

        1.  Quit Thunderbird.
        2.  Start it up and confirm that the "Send Later" column is
            (incorrectly) displayed in the Inbox.
        3.  Type Ctrl-Shift-J to open the error console.
        4.  Right-click on a message in the console and select "Select
            All".
        5.  Ctrl-C to copy the error console contents.
        6.  Paste that into an email [to
            me](/cdn-cgi/l/email-protection#dcb6b5b7f7afb9b2b8b0bda8b9aeef9cb7bdb1b9b2aff2a9af)
            and it might help me figure out what's going on.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

        1.  [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .avatar-default .jetpack-lazy-image
            width="30" height="30"
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800429}
            ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .avatar-default width="30" height="30"
            srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
            David [September 21,
            2019](/send-later/comment-page-4/#comment-1800429)
            ::: {.section .comment-content .comment}
            There aren't any error message or meaningful information in
            the log.

            Here is how to reproduce it:\
            1) Start Thunderbird\
            2) Open a second tab.\
            3) Make sure the first tab (on the very left) is pointed to
            your sent items.\
            4) Have the second tab point to the inbox.\
            5) Activate the send later column in the inbox tab.\
            6) Click on the first tab on the very left (sent folder).\
            7) Click on the second tab (inbox).\
            8) Send later column has disappeared.
            :::

            ::: {.reply}
            [Reply](/send-later/){.comment-reply-link} ↓
            :::

            1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo .jetpack-lazy-image width="30"
                height="30"
                srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800443}
                ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo width="30" height="30"
                srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
                [jik](https://stuff.mit.edu/~jik/){.url} Post
                author[September 22,
                2019](/send-later/comment-page-4/#comment-1800443)
                ::: {.section .comment-content .comment}
                I am confused. The steps you provide for "reproducing"
                this issue do not match the issue you reported in your
                first comment. You said:

                > The send later column is always shown in the inbox
                > view when starting up Thunderbird. I did not select to
                > have the column show.

                But in the steps above, you *do* "select to have the
                column show," and the problem doesn't manifest at
                startup in those steps, it manifests after you
                explicitly trigger it.

                The behavior described in your steps above is correct.
                The "Send Later" column is removed from the Inbox
                display when you leave the tab and come back to it
                because the column is never supposed to display in any
                folder that isn't a Drafts folder. If you activate it in
                such a folder, it's disabled automatically when you
                switch away from that folder and back to it, because
                it's not useful to display it in folders that aren't
                Drafts folders.
                :::

                ::: {.reply}
                [Reply](/send-later/){.comment-reply-link} ↓
                :::

                1.  [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
                    .avatar-30 .photo .avatar-default
                    .jetpack-lazy-image width="30" height="30"
                    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800466}
                    ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
                    .avatar-30 .photo .avatar-default width="30"
                    height="30"
                    srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
                    David [September 22,
                    2019](/send-later/comment-page-4/#comment-1800466)
                    ::: {.section .comment-content .comment}
                    Yes, you make a good point. I figured these issues
                    are related.\
                    Instead of displaying the column you can also hide
                    it, close Thunderbird, restart and the column will
                    be in the inbox view until you navigate back and
                    forth between the tabs. The bug only happens if more
                    than 1 tab is open and inbox is on the second (or
                    any other tab other than the first) tab.\
                    I've tested this on a fresh Thunderbird profile and
                    using only your extension.\
                    I've since downgraded back to Thunderbird 60.9 as
                    68.1 still has too many issues. Will try again in 6
                    months.
                    :::

                    ::: {.reply}
                    [Reply](/send-later/){.comment-reply-link} ↓
                    :::

                    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
                        .avatar-30 .photo .jetpack-lazy-image width="30"
                        height="30"
                        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800472}
                        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
                        .avatar-30 .photo width="30" height="30"
                        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
                        [jik](https://stuff.mit.edu/~jik/){.url} Post
                        author[September 22,
                        2019](/send-later/comment-page-4/#comment-1800472)
                        ::: {.section .comment-content .comment}
                        This appears to be a bug in Thunderbird 68 that
                        I didn't notice because it's fixed in the newer
                        Thunderbird daily builds that I run on a daily
                        basis. I have a workaround for Thunderbird 68.
                        If you [email
                        me](/cdn-cgi/l/email-protection#49232022623a2c272d25283d2c3b7a092228242c273a673c3a)
                        I can send it to you for you to try.
                        :::

                        ::: {.reply}
                        :::

27. [![](https://secure.gravatar.com/avatar/ef4d71d35adcc9da81d464c38df3ab01?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1794022}
    ![](https://secure.gravatar.com/avatar/ef4d71d35adcc9da81d464c38df3ab01?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/ef4d71d35adcc9da81d464c38df3ab01?s=60&d=mm&r=pg 2x"}
    Thomas Heckel [April 18,
    2019](/send-later/comment-page-4/#comment-1794022)
    ::: {.section .comment-content .comment}
    I have recently noticed that send later does not remember when I
    activate acknowledgment of receipt.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1794073}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[April 19,
        2019](/send-later/comment-page-4/#comment-1794073)
        ::: {.section .comment-content .comment}
        Please see [above](#receipt).
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

        1.  [![](https://secure.gravatar.com/avatar/ef4d71d35adcc9da81d464c38df3ab01?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1794304}
            ![](https://secure.gravatar.com/avatar/ef4d71d35adcc9da81d464c38df3ab01?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo width="30" height="30"
            srcset="https://secure.gravatar.com/avatar/ef4d71d35adcc9da81d464c38df3ab01?s=60&d=mm&r=pg 2x"}
            Thomas [April 25,
            2019](/send-later/comment-page-4/#comment-1794304)
            ::: {.section .comment-content .comment}
            Thanks
            :::

            ::: {.reply}
            [Reply](/send-later/){.comment-reply-link} ↓
            :::

28. [![](https://secure.gravatar.com/avatar/d1a88fec31f1ec2c28db976dd3dfc093?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1791563}
    ![](https://secure.gravatar.com/avatar/d1a88fec31f1ec2c28db976dd3dfc093?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/d1a88fec31f1ec2c28db976dd3dfc093?s=60&d=mm&r=pg 2x"}
    [Joseph](http://wlcpromotions.com){.url} [April 3,
    2019](/send-later/comment-page-4/#comment-1791563)
    ::: {.section .comment-content .comment}
    the program is not working it does not put the send times i reloaded
    no use\
    this happens when i add other addins\
    so i delted all add ons\
    restarted\
    but stiill does not work
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

29. [![](https://secure.gravatar.com/avatar/4b19c5968f08ce9259929288a523e51b?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1786388}
    ![](https://secure.gravatar.com/avatar/4b19c5968f08ce9259929288a523e51b?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/4b19c5968f08ce9259929288a523e51b?s=60&d=mm&r=pg 2x"}
    [Joseph Taylor](http://wlcpromotions.com){.url} [March 5,
    2019](/send-later/comment-page-4/#comment-1786388)
    ::: {.section .comment-content .comment}
    i have a question\
    is it possible to send a email with a period of time like for
    example\
    once a month\
    from January 1st thru June 1st 2019 and then it stops\
    can you do this\
    really need this option
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1786685}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[March 7,
        2019](/send-later/comment-page-4/#comment-1786685)
        ::: {.section .comment-content .comment}
        You can use a dynamic scheduling function to implement this
        behavior. This is documented [above](#dynamic-recurrence).
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

30. [![](https://secure.gravatar.com/avatar/1046f9581e915310e54fdaef2d9fd3bc?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1785812}
    ![](https://secure.gravatar.com/avatar/1046f9581e915310e54fdaef2d9fd3bc?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/1046f9581e915310e54fdaef2d9fd3bc?s=60&d=mm&r=pg 2x"}
    Thomas [March 1, 2019](/send-later/comment-page-4/#comment-1785812)
    ::: {.section .comment-content .comment}
    Hi Jik,\
    Send later with large E-Mails does not work as expected.\
    E.g. a mail which is large (25MB) will not be send at the scheduled
    time because Thunderbird asks if it should send a large mail. The
    Mail can be large because of attachments or large/many embedded
    in-line images.\
    Expected behaviour: Send Later should ask the user within its
    sheduling dialog and suppress the question later.

    Many thanks for the great Add-On!!
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1785815}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[March 1,
        2019](/send-later/comment-page-4/#comment-1785815)
        ::: {.section .comment-content .comment}
        This is not currently possible to fix as you proposed, due to
        the architecture of how Send Later works.

        Also, sending large email messages is rude. Just saying.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

        1.  [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .avatar-default .jetpack-lazy-image
            width="30" height="30"
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1786233}
            ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .avatar-default width="30" height="30"
            srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
            Thomas [March 4,
            2019](/send-later/comment-page-4/#comment-1786233)
            ::: {.section .comment-content .comment}
            Hi Jik,\
            I understand. Is it possible to warn the user with an own
            dialog which calculates the message size?

            Regarding the message size. No it's not rude at business
            use. Maybe if the reciever is a free-mail provider account
            and you utilize to much of the free space. But thats the
            only reason I can think of.

            I've set up a 150MB Limit for recieving messages and set up
            attachment deduplication. There is no protocol limit for the
            size besides usage of resources.\
            The relevant RFC is RFC 2821 (SMTP). Find it at
            <https://www.ietf.org/rfc/rfc2821.txt> .\
            See section "4.5.3.1 Size limits and minimums"\
            it says there (with targeted audience the implementers of
            the SMTP protocol):

            \>\>\>\> message size restrictions should be avoided if at
            all possible \<\<\<
            :::

            ::: {.reply}
            [Reply](/send-later/){.comment-reply-link} ↓
            :::

            1.  [![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo .avatar-default .jetpack-lazy-image
                width="30" height="30"
                srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1800757}
                ![](https://secure.gravatar.com/avatar/?s=30&d=mm&r=pg){.avatar
                .avatar-30 .photo .avatar-default width="30" height="30"
                srcset="https://secure.gravatar.com/avatar/?s=60&d=mm&r=pg 2x"}
                U [September 26,
                2019](/send-later/comment-page-4/#comment-1800757)
                ::: {.section .comment-content .comment}
                You can use the following setting in the config editor
                to change the size limit for the warning:
                mailnews.message\_warning\_size. This is completely
                independent from Send Later, but will solve your
                problem.
                :::

                ::: {.reply}
                [Reply](/send-later/){.comment-reply-link} ↓
                :::

31. [![](https://secure.gravatar.com/avatar/f896ca4141b307e8493b29ef56d72a58?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1781682}
    ![](https://secure.gravatar.com/avatar/f896ca4141b307e8493b29ef56d72a58?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/f896ca4141b307e8493b29ef56d72a58?s=60&d=mm&r=pg 2x"}
    [Joseph](http://wlcpormotions.com){.url} [February 8,
    2019](/send-later/comment-page-4/#comment-1781682)
    ::: {.section .comment-content .comment}
    HI

    reinstall on differennt computer\
    but now it keeps putting emails in to the outbox

    i dont know why\
    i dont have any other addons\
    using aol.com\
    thunderbird program\
    imap

    it does not send them out but puts them in outbox only

    any soutions ?

    Joseph
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

32. [![](https://secure.gravatar.com/avatar/ff657d9a5294a4402b25bbd8d5358b95?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1781362}
    ![](https://secure.gravatar.com/avatar/ff657d9a5294a4402b25bbd8d5358b95?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/ff657d9a5294a4402b25bbd8d5358b95?s=60&d=mm&r=pg 2x"}
    Timothy Gonsalves [February 6,
    2019](/send-later/comment-page-4/#comment-1781362)
    ::: {.section .comment-content .comment}
    I recently upgraded from MacOS X 10.13 to 10.14. I did a fresh
    install of Thunderbird v. 60.4.0 with Send Later v 6.4.3.
    Previously, entering a date such as 6/2 would result in 6th Feb.
    Now, it results in 2nd June. 6/2/19 results in 6th June 2119! Locale
    in Tbird is "English (India)" where the date is in dd/mm/yy format.\
    How do I get back the old behaviour?\
    --- TAG
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1781387}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[February 6,
        2019](/send-later/comment-page-4/#comment-1781387)
        ::: {.section .comment-content .comment}
        SugarJS, the third-party library that handles date parsing,
        doesn't know about the Indian English locale, a.k.a., en\_IN or
        en-IN. It only knows about four locale variants: en-US, en-GB,
        en-AU, and en-CA.

        I suspect if it was parsing things as you expect before, then
        you were using en-GB rather than en-IN. Now that you're using
        en-IN, SugarJS doesn't recognize it so it's falling back on
        en-US.

        I will file a bug report with the maintainer of SugarJS asking
        him to add support for en-IN.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

        1.  [![](https://secure.gravatar.com/avatar/ff657d9a5294a4402b25bbd8d5358b95?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
            srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1781526}
            ![](https://secure.gravatar.com/avatar/ff657d9a5294a4402b25bbd8d5358b95?s=30&d=mm&r=pg){.avatar
            .avatar-30 .photo width="30" height="30"
            srcset="https://secure.gravatar.com/avatar/ff657d9a5294a4402b25bbd8d5358b95?s=60&d=mm&r=pg 2x"}
            Timothy Gonsalves [February 7,
            2019](/send-later/comment-page-4/#comment-1781526)
            ::: {.section .comment-content .comment}
            Thanks for the quick solution!
            :::

            ::: {.reply}
            [Reply](/send-later/){.comment-reply-link} ↓
            :::

33. [![](https://secure.gravatar.com/avatar/34ebff2fa1d0b166c1adb41a7246b477?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1781068}
    ![](https://secure.gravatar.com/avatar/34ebff2fa1d0b166c1adb41a7246b477?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/34ebff2fa1d0b166c1adb41a7246b477?s=60&d=mm&r=pg 2x"}
    joseph [February 4,
    2019](/send-later/comment-page-4/#comment-1781068)
    ::: {.section .comment-content .comment}
    i unload and reload but it stop working i try everything any ideas

    but i put on different computer and it works ok
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1781069}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[February 4,
        2019](/send-later/comment-page-4/#comment-1781069)
        ::: {.section .comment-content .comment}
        As I said in response to your previous comment several days ago,
        I can't support people here. Please email me.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

34. [![](https://secure.gravatar.com/avatar/423523ddf1558cad824c36c12c87ccc9?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1780470}
    ![](https://secure.gravatar.com/avatar/423523ddf1558cad824c36c12c87ccc9?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/423523ddf1558cad824c36c12c87ccc9?s=60&d=mm&r=pg 2x"}
    [joseph taylor](http://wlcpromotions.com){.url} [February 1,
    2019](/send-later/comment-page-4/#comment-1780470)
    ::: {.section .comment-content .comment}
    I have been noticing that its not emailing out i set it every 5
    minutes but it is only resetting
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1780477}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[February 1,
        2019](/send-later/comment-page-4/#comment-1780477)
        ::: {.section .comment-content .comment}
        I can't support people here in comments on my blog. Please email
        me.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

35. [![](https://secure.gravatar.com/avatar/fdd615f3e80b51311339e6314bb4025d?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1772486}
    ![](https://secure.gravatar.com/avatar/fdd615f3e80b51311339e6314bb4025d?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/fdd615f3e80b51311339e6314bb4025d?s=60&d=mm&r=pg 2x"}
    Darren [November 28,
    2018](/send-later/comment-page-4/#comment-1772486)
    ::: {.section .comment-content .comment}
    I have intermittent hangs in TB that went away when I disabled Send
    Later add-on. The hangs would happen immediately after I sent a
    mail. Note that the sending was always an immediate send, not a mail
    that was to be sent later. This hang was intermittent -- most emails
    sent just find (perhaps more than 90%?). I was not able to distill
    the failing conditions down further. My version of TB is 60.3.1 and
    my version of Send Later is 6.4.3. I am running on a Mac.

    I do find Send Later useful, though, so I intend to re-enable it
    only when I need it, and then disable it again for normal use.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1772544}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[November
        29, 2018](/send-later/comment-page-4/#comment-1772544)
        ::: {.section .comment-content .comment}
        Try repairing all of your Drafts folders and see if that helps.

        If you have antivirus software installed, try excluding your
        Thunderbird mail folders from its scanner (see the
        [above](#windows-hangs) solution about Windows, which is
        applicable in this regard to Mac as well).

        If neither of those solves the problem, try recreating a new
        Thunderbird problem and see if that improves things. If it does,
        then there's corruption somewhere in your old profile.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

36. [![](https://secure.gravatar.com/avatar/cc9567007081b7e214548e1153fba999?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1771746}
    ![](https://secure.gravatar.com/avatar/cc9567007081b7e214548e1153fba999?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/cc9567007081b7e214548e1153fba999?s=60&d=mm&r=pg 2x"}
    Robert Baust [November 14,
    2018](/send-later/comment-page-4/#comment-1771746)
    ::: {.section .comment-content .comment}
    I would like to use Send Later as a replacement for BlunderDelay,
    which just broke with my upgrade to TB 60.3.0. I have no need for
    the other Send Later functions; I just want to do away with the
    annoying way TB sends email in the foreground.

    But the Mozilla page for keyconfig
    (<https://addons.mozilla.org/en-US/firefox/addon/dorando-keyconfig/>)
    shows that keyconfig is incompatible with my Firefox (63.0.1) and
    the download button ("add to Firefox") is disabled. I don't see a
    "add to Thunderbird" link either.

    Can I still install keyconfig for TB only, or will it break FF? I'm
    running Win7-64.

    Also, I noticed you indicate you will in the future add a "native"
    feature to replace the BlunderDelay function. That would be great,
    and I would make a contribution if that feature was available. Using
    Send Later right now now I still have to do extra steps to get the
    email sent in the background.
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1771833}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[November
        15, 2018](/send-later/comment-page-4/#comment-1771833)
        ::: {.section .comment-content .comment}
        If you're looking for Thunderbird add-ons, you need to go to
        addons.thunderbird.net, not addons.mozilla.org. See
        <https://addons.thunderbird.net/thunderbird/addon/dorando-keyconfig/>
        for the Thunderbird version of the add-on. You can also install
        it directly from the add-ons page inside Thunderbird by
        searching on that page for "Keyconfig".

        The version currently available for download from
        addons.mozilla.org will work for Thunderbird if you download the
        XPI file and save it to disk and tell Thunderbird to install
        from the downloaded file, but that won't always be true ---
        moving forward, when the maintainers of Keyconfig need to update
        it for Thunderbird compatibility, they will only update the
        version on addons.thunderbird.net.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

37. [![](https://secure.gravatar.com/avatar/76ec2f4c1f3ce548955d6eef9d8d1e20?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
    srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1771644}
    ![](https://secure.gravatar.com/avatar/76ec2f4c1f3ce548955d6eef9d8d1e20?s=30&d=mm&r=pg){.avatar
    .avatar-30 .photo width="30" height="30"
    srcset="https://secure.gravatar.com/avatar/76ec2f4c1f3ce548955d6eef9d8d1e20?s=60&d=mm&r=pg 2x"}
    Pierre [November 13,
    2018](/send-later/comment-page-4/#comment-1771644)
    ::: {.section .comment-content .comment}
    Since version 6.4.1. (updated Nov 13, 2018), suggested date is
    absent, and Send button remains greyed out, whatever is input.\
    Using FR-be locale, that is, date string is expressed as DD-MM-YYYY
    HH:MM\
    Is now unusable, since button stays grayed out, whatever is typed
    in!\
    Can anybody help?
    :::

    ::: {.reply}
    [Reply](/send-later/){.comment-reply-link} ↓
    :::

    1.  [![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo .jetpack-lazy-image width="30" height="30"
        srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}]{#li-comment-1771647}
        ![](https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=30&d=mm&r=pg){.avatar
        .avatar-30 .photo width="30" height="30"
        srcset="https://secure.gravatar.com/avatar/02ee400c45c070d8044f80af6838729f?s=60&d=mm&r=pg 2x"}
        [jik](https://stuff.mit.edu/~jik/){.url} Post author[November
        13, 2018](/send-later/comment-page-4/#comment-1771647)
        ::: {.section .comment-content .comment}
        Sorry about the trouble. Please try downloading and installing
        this [new version of Send
        Later](https://addons.thunderbird.net/thunderbird/downloads/file/1012061/send_later-6.4.2-sm+tb.xpi),
        which should fix the problem.
        :::

        ::: {.reply}
        [Reply](/send-later/){.comment-reply-link} ↓
        :::

Comment navigation {#comment-navigation .assistive-text .section-heading}
==================

::: {.nav-previous}
[← Older Comments](/send-later/comment-page-3/#comments)
:::

::: {.nav-next}
:::

::: {#respond .comment-respond}
### Leave a Reply [[Cancel reply](/send-later/#respond){#cancel-comment-reply-link}]{.small} {#reply-title .comment-reply-title}

***\*\*\* DO NOT ASK FOR ADD-ON SUPPORT HERE. \*\*\**** [Email
us](/cdn-cgi/l/email-protection#3a495f545e17565b4e5f4817494f4a4a55484e7a5f424e5f545e5f5e174e524f545e5f481455485d)
instead.

Comment

Name

Email

Website

Notify me of new posts by email.

[ Authenticate this comment using [OpenID]{.openid_link}.
]{#openid_comment}
:::
:::
:::
:::
:::

::: {.site-info}
::: {.footercopy}
Copyright 2005-2019 Jonathan Kamens
:::

::: {.footercredit}
:::

::: {.clear}
:::
:::

::: {.site-wordpress}
[Iconic One](https://themonic.com/iconic-one/) Theme \| Powered by
[Wordpress](https://wordpress.org)
:::

::: {.clear}
:::
:::

::: {style="display:none"}
::: {.grofile-hash-map-1d83283217ce55f5d6befe08eed82ab6}
:::

::: {.grofile-hash-map-6fea5e835fa60774307a0a02751e670a}
:::

::: {.grofile-hash-map-02ee400c45c070d8044f80af6838729f}
:::

::: {.grofile-hash-map-53afa546c2fa6cb313a43cc4c05b4b60}
:::

::: {.grofile-hash-map-7bc03028e9711ce726e46cacae40e667}
:::

::: {.grofile-hash-map-beef9bd6eeab15fe4b0095fe0e73bb03}
:::

::: {.grofile-hash-map-77b47422f90e6bac66bbeab396f7d166}
:::

::: {.grofile-hash-map-91156bd6afa499d2a8aa8d4d5d11f910}
:::

::: {.grofile-hash-map-92a3cb3970b9a14d642d5692a0fcca0b}
:::

::: {.grofile-hash-map-6547a147fca6f34b5ac63e6a220614c5}
:::

::: {.grofile-hash-map-2aecb76d653de6c89f71d2123c429ffb}
:::

::: {.grofile-hash-map-4a0489ba29b7712110cf2546fe505594}
:::

::: {.grofile-hash-map-7259fd1add3a1067f6200b0f1e2ce147}
:::

::: {.grofile-hash-map-d82210f4622ec15def03964a484ada27}
:::

::: {.grofile-hash-map-1cfee6505a824e27bf31fb1d9e95c639}
:::

::: {.grofile-hash-map-5ef5d2046ffb9a000803235b831af47a}
:::

::: {.grofile-hash-map-171b7027fcbb53306e350741bad447ef}
:::

::: {.grofile-hash-map-149788f240d50e169f6b81f3124e759c}
:::

::: {.grofile-hash-map-2da5d1054567b43c09ec1c3fa6c88041}
:::

::: {.grofile-hash-map-572f468b565dd60c836ca88a0b497ea9}
:::

::: {.grofile-hash-map-08da58e6317e27e5da82d16d00dd073b}
:::

::: {.grofile-hash-map-ef4d71d35adcc9da81d464c38df3ab01}
:::

::: {.grofile-hash-map-d1a88fec31f1ec2c28db976dd3dfc093}
:::

::: {.grofile-hash-map-4b19c5968f08ce9259929288a523e51b}
:::

::: {.grofile-hash-map-1046f9581e915310e54fdaef2d9fd3bc}
:::

::: {.grofile-hash-map-f896ca4141b307e8493b29ef56d72a58}
:::

::: {.grofile-hash-map-ff657d9a5294a4402b25bbd8d5358b95}
:::

::: {.grofile-hash-map-34ebff2fa1d0b166c1adb41a7246b477}
:::

::: {.grofile-hash-map-423523ddf1558cad824c36c12c87ccc9}
:::

::: {.grofile-hash-map-fdd615f3e80b51311339e6314bb4025d}
:::

::: {.grofile-hash-map-cc9567007081b7e214548e1153fba999}
:::

::: {.grofile-hash-map-76ec2f4c1f3ce548955d6eef9d8d1e20}
:::
:::
