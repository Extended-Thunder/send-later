# Send Later release notes

Welcome! We've been hard at work enhancing Send Later's functionality
and making it more robust and reliable, and we're excited to share our
progress with you.

This page focuses on user-visible changes to Send Later. Pre-release
(beta) versions aren't listed separately here; their changes are
listed as part of the next public release. To see pre-releases, visit
our [GitHub release page][ghreleases].

The full Send Later user guide is available [here](index.html).

Maintenance and enhancement of Send Later is made possible by Extended
Thunder Inc., a non-profit dedicated to supporting free, open-source
Thunderbird add-on development. We put a lot of time and effort into
Send Later, so we hope that if you find it useful you will consider
supporting it. You can make a recurring donation to Extended Thunder
through [LiberaPay][liberapay] or a one-time donation through
[PayPal][paypal]. Donations to Extended Thunder are tax-deductible in
the United States as permitted by law.

## Release 10.1.x

This is an exciting release with many new features and improvements!

### New features

#### Bulk scheduling messages from the message list

You can now select one or more drafts from the message list,
right-click or ctrl-click to bring up the menu, and elect "Send
Later > Schedule message(s)" to bring up scheduling window and
schedule all of these messages at once. When you specify the desired
schedule and click the "Send at" button, Send Later opens the selected
messages one by one and schedules them as requested.

If one of the selected drafts was previously scheduled, the old
schedule is overwritten. If it was previously scheduled in a different
Thunderbird profile, it is switched over to being associated with
profile in which you just rescheduled it.

Note that you can also use the "Send Now" or "Put in Outbox" button
here, which means you can use this to send a bunch of drafts or put
them all in your Outbox all at once, rather than editing them one by
one to do it.

There are two important caveats for users of end-to-end encryption:

1. This does not work for messages in accounts or identities which
   have encryption or signing enabled by default, even if you
   previously disabled encryption and signing when saving the draft.
   This is due to a functionality gap in the Thunderbird add-on APIs.
2. Similarly, if you previously saved a draft with encryption or
   signing enabled and then schedule it like this, the draft is
   scheduled without encryption or signing.

#### Skipping the next occurrence of recurring messages

You can now select one or more scheduled messages in your drafts
folder, right-click or ctrl-click to bring up the menu, and select
"Send Later > Skip next occurrence" to skip the next occurrence of the
selected message(s). For example, if you have a message next scheduled
to be sent today at 10:00, and at 9:30 you skip its next occurrence,
it is rescheduled to tomorrow at 10:00.

This fails (and logs the failure in the error console, though there is
curently no pop-up notification) in these circumstances:

* Thunderbird is currently offline (unless the "sendWhileOffline"
  preference is enabled).
* The message was originally scheduled in a different Thunderbird
  profile.
* The message has an "until" date/time that has passed.
   
### Improvements

Since we had to remove support for the Send Later column in the
message list in drafts folder in Thunderbird 115 (we're hoping to
bring it back once Thunderbird's add-on APIs support it), it has
become harder to find scheduled messages and see when they are
scheduled for. To mitigate this, Send Later now puts the send time in
the "Date" field, so it's visible in the "Date" column of the message
list. If you've got messages in a drafts folder with dates in the
future, they're probably scheduled messages! If you don't like this
behavior, you can turn it off by setting the "scheduledDateField'
preference to "false" in the advanced configuration editor.

Send Later no longer forces the toolbar button to be visible in
compose windows by default. Although it is visible by default when
Send Later is installed, you can now customize the toolbar and remove
it if you wish. In the absence of the toolbar button, you can still
activate Send Later by typing ctrl-shift-enter (ctrl-shift-Command on
macOS), or using the "File > Send Later" menu command, or by clicking
the Send button if you have the "Send does Send Later" preference
enabled, etc. The only thing you can't do without the toolbar button
is activate the shift-click and control-click shortcuts (if any)
configured in Send Later's preferences.

Send Later now displays the release notes automatically when it is
installed or upgraded to a new major or minor release. This can be
disabled by setting the releaseNotesShow preference to false in the
advanced configuration editor. Also, the release notes page has been
changed from the GitHub releases to the page you're reading right now,
and instead of opening it in a browser it is now opened in a
Thunderbird tab.

Previously, if you opened Send Later's preferences, made changes in
the advanced configuration editor at the bottom but did not save them,
made different changes in the top section of the preferences page, and
then saved the advanced configuration editor, the changes you'd made
in the top section of the page would be overridden. Now when you make
changes at the top, they're automatically copied into the advanced
configuration editor so they won't be overwritten if you then save its
contents.

Speaking of the advanced configuration editor, the settings there are
now sorted alphabetically to make it easier to find the ones you're
looking for.

Send Later no longer saves bad or incomplete [custom date
formats][customdates] in your preferences. Instead it warns you that
the format is invalid and won't save it until you fix it.

Many updates have been made to Send Later's translations. Thank you,
as always, to our many dedicated translators who make Send Later
accessible to users all over the world!

### Bug fixes

When some users edited and went to reschedule a scheduled message, the
previously scheduled date that Send Later put into the text field in
the scheduling pop-up had the month and day reversed. This is now
fixed for users for whom it _can_ be fixed automatically. If you're
still seeing this issue, see [the user guide][baddates] for how to
address it.

Previously, if you had end-to-end encryption or signing enabled on a
message and then scheduled it it with Send Later, it would be sent
without encryption or sending. Although it is not yet possible to send
encrypted or signed messages with Send Later, now when you try to
schedule a message when encryption or signing is enabled, Send Later
warns you about this and prevents you from scheduling the message.

Thunderbird added a new internal "Autocrypt" header to drafts when
end-to-end encryption is enabled for an account. Send Later didn't
know about this header and therefore wasn't stripping it out before
sending scheduled drafts. Now it does.

To minimize confusion the "Show Send later column" preference is
hidden in the preferences tab in Thunderbird 115 since the column is
not currently supported.

The title bars of some pop-up windows opened by Send Later now have a
separator between the title and the words "Mozilla Thunderbird",
rather than those being glommed right onto the end of Send Later's
specified title with no space separating them.

### Known issues

Please check [the user guide][caveats] for persistent caveats and known
issues. See also our [GitHub issues page][issues] for new issues that
may not have been triaged or made it into the user guide yet, or for
which a fix is pending.

### Under the hood

Users are unlikely to notice this, but it is worth mentioning that the
code for migrating preferences from the legacy add-on preferences
system into modern preferences storage has been removed. This can only
impact you if you've been using Send Later on a version of Thunderbird
so old that it doesn't support modern preferences storage and then you
upgrade, in which case you'll have to reconfigure any non-default Send
Later preferences. Versions of Thunderbird without modern preferences
support have been obsolete, unsupported, and not receiving security
updates for several years, so it was time for this old code to say
good-bye.

## Release 10.0.x

### New features

Thunderbird 115 support!

### Improvements

The Send Later button is the main Thunderbird window is no longer
disabled when the sendDrafts preference is false, so you can access
the pop-up with the list of scheduled messages preferences link, etc.

The warning about quitting Thunderbird when scheduled messages are
pending no longer displays when the sendDrafts preference is default,
since in that case the Thunderbird instance that the user is quitting
is not actually responsible for sending those scheduled drafts.

The explanatory strings inserted into the text fields of the
function editor when the user goes to create a new function are now
inserted as placeholder strings, rather than as actual text that the
user needs to delete.

### Bug fixes

Scheduled message delivery is now reliable while the Thunderbird
window is minimized in Thunderbird 115. Prior to this fix,
messages sometimes were not delivered in a timely fashion when the
window was minimized due to internal Thunderbird changes.

Scheduled message delivery is now reliable for users of Owl for
Exchange, thanks to a workaround introduced to address a mysterious
internal issue with Thunderbird or Owl (it's not clear which).

The ctrl-alt-1, -2, and -3 shortcuts in the message compose window
work again.

The ctrl-click and shift-click actions on the Send Later button in the
compose window works again.

Send Later key bindings now work properly even when the user has
remapped the relevant keys on their keyboard.

Send Later now treats the Enter key on the numeric keypad the same as
the one on the users main keyboard.

Send Later is now more reliable about warning the user when they quit
Thunderbird while scheduled messages are pending.

Send Later no longer puts duplicate copies of scheduling function
names in the pop-up menus on the preferences page when the user edits
and saves an existing function.

The user guide link on the preferences page was wrong and is now
fixed.

Send Later no longer calls the user's scheduling function repeatedly
when the scheduling pop-up opens. This makes Thunderbird more
responsive and eliminates multiple unnecessary calls to any web APIs
invoked from the scheduling function.

### Known issues

### Under the hood

The [contributed library of dynamic scheduling functions][funclib] has
been cleaned up and made compatible with the current version of Send
later.

[ghreleases]: https://github.com/Extended-Thunder/send-later/releases
[LiberaPay]: https://liberapay.com/ExtendedThunder
[paypal]: https://paypal.me/ExtendedThunder
[customdates]: https://extended-thunder.github.io/send-later/#custom-dates
[baddates]: https://extended-thunder.github.io/send-later/#date-format-problems
[caveats]: https://extended-thunder.github.io/send-later/#caveats
[issues]: https://github.com/Extended-Thunder/send-later/issues
[funclib]: https://github.com/Extended-Thunder/send-later/tree/main/contrib/scheduling-functions
