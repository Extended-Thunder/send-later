# Translating Send Later

If you're reading this, then either you've offered to help translate Send Later, or you've stumbled across this file in the Send Later source tree and started reading it out of curiosity. Either way, welcome!

Below, I explain how to be a Send Later translator and try to answer the questions you are likely to have about it. If you have any questions that aren't answered here, please don't hesitate to [ask me](mailto:jik+sendlater3@kamens.us)!

I know that for many of my translators, English is not your first language, so I feel a bit rude writing to you in English, but of course my need to do that is why I need translators. :-/ Please bear with me.

## How much work is this going to be, really?

I typically don't do more than one or two Send Later releases a year. Not all of those releases require new strings to be translated, and when they do, there usually aren't that many. So while you may need to put in several hours of effort to do a new translation from scratch, after that the work will be rather intermittent and not particularly time-consuming.

## Signing up

I use [Crowdin](https://crowdin.com/) to manage translations of Send Later. Your first step in becoming a translator is to [register for a Crowdin account](https://crowdin.com/join) if you don't already have one. Once you've registered, you can either jump right in or review the [Interface overview](https://support.crowdin.com/for-translators/getting-started-translators/interface-overview/) for more information about how to use Crowdin.

Once you are registered, visit the [Send Later extension page](https://crowdin.com/project/send-later) and click the "Join" button in the upper right corner of the page to join the project. Then you can drill down into individual translations and start working on them. If you are interested in creating a new translation that is not listed, please contact me and I'll add it.

If you are updating a translation originally done by someone else, _please respect the approach of the previous translator,_ and make changes to existing translations only if they are actually wrong, not just because you would prefer to have worded a particular message a different way. It is not helpful to me if my translators engage in battles with each other. :-/ If the old translator is gone and no longer active and you believe strongly that a significant change in approach is needed, then please [send me the details](mailto:jik+sendlater3@kamens.us) and we can talk about it.

## Determining how strings are used

There's no really great way to determine the context of a particular string your translating, except perhaps to try to guess where you think the string is probably used, and then try to use that bit of functionality in the add-on itself within Thunderbird, to see if you're right. Having said that, the files in which strings appear does tell you something about their purpose:

* ask.dtd is strings for the donation request window;
* backgrounding.properties is for the Send Later status messages at the bottom of the main Thunderbird window;
* headerView.dtd just has the column header for the Send Later column in the Drafts message list;
* prefwindow.dtd is strings for the preferences window;
* prompt.dtd is strings for the main Send Later prompt dialog;
* editor.dtd is strings for the dynamic function editor;
* sendlater3.properties contains the description of the app that is displayed in the add-ons list and on [addons.mozilla.org](https://addons.mozilla.org/);
* project_strings.csv is for other informational text about the add-on displayed on [addons.mozilla.org](https://addons.mozilla.org/); and
* prompt.properties has everything else. ;-)

You can also search the [source code](https://github.com/jikamens/send-later) for the string's identifier to see where it is used in the code. Or, if all else fails, ask me for an explanation of any string context you can't figure out.

## Notes about how to translate things

### The add-on's name

One of the questions you will need to answer as a translator is whether to translate the name of the add-on itself, i.e., "Send Later", to your local language, or to leave it in English. I leave this to the discretion of the translators for each translation.

The add-on's name should actually appear only once in all of the "*.properties" and "*.dtd" files: in the string called "MessageTag" in backgrounding.properties. _This string represents the canonical name of the add-on for any translation._

While you are working on a translation, you will see the string "{NAME}" scattered throughout it. This token is automatically replaced with the canonical name of the add-on when the add-on is compiled and shipped. If you see the "{NAME}" string one or more times in an English string, _you must also use it, the same number of times, in translations of that string,_ so you should be especially careful to translate these strings faithfully. If you make a mistake on this, I'll let you know, because I can't ship the add-on if there is an inconsistency.

It is important to distinguish between strings where the add-on is being referred to by name, and strings where the words that make up the add-on's name are used in context but are not actually intended to represent the add-on's name. For example, here are some strings in the English translation that use the string "Send Later" where it is _not_ intended to be the add-on's name:

* In several instances, the phrase "Send Later" is used in reference to Thunderbird's Send Later command, and therefore in any language that text should be translated to match whatever the Thunderbird command is called in that language. For example:
  * In prefwindow.dtd, "&ldquo;Send&rdquo; does &ldquo;Send Later&rdquo;" and "With this option enabled, the &ldquo;Send&rdquo; command (either the button or typing Ctrl-Enter) acts the same as &ldquo;Send Later&rdquo;."
  * In prompt.dtd, the button label "Send Later"
  * In sendlater3.properties, "True &ldquo;Send Later&rdquo; functionality to schedule the time for sending an email."
* In prompt.dtd, "Send later at time(s) specified above" is a button label describing what behavior results when the button is clicked.

Note: You should _not_ use the name of the add-on in a way that is intended to represent the name of the add-on in any string where it isn't used that way in English. If you feel like you need the leeway to do this in a particular string in your translation, please [contact me](mailto:jik+sendlater3@kamens.us) so we can discuss it.

### Other substitution variables in strings

In addition to {NAME}, there are some other magic sequences in translated strings that get substituted. Whenever you see "%S" or "%#$S" (where "#" is actually a number, not the pound sign), that indicates a slot where a value is inserted dynamically by the add-on. I've tried to explain all of these on Crowdin in the "Context" for the relevant strings. _You must preserve these sequences in your translated strings._ If you don't see an explanation or have questions about it, [please let me know](mailto:jik+sendlater3@kamens.us).

### "accesskey" strings

You will see a number of strings in the various "dtd" files whose identifiers end with ".accesskey", with corresponding strings whose identifiers end with ".label". The ".label" strings are button labels, and the ".accesskey" strings encode the characters that users can type with "Alt" to activate those buttons from the keyboard.

For example, in this button:

![Cancel button](src/sample_cancel_button.jpg)

The label is "Cancel" and the accesskey is "C".

There are some rules you need to follow when translating accesskey strings:

* The accesskey for a label needs to be a character that is actually in the label.
* The case of the accesskey should match the case of the character in the label. For example, the accesskey for the label above should be "C", not "c".
* The accesskey should be a character that can be typed directly on the keyboard, not a character that requires multiple keystrokes to create (for languages / keyboards that support such characters). _(Note: I'm not really sure how this works for Asian languages and other languages that require multi-key input for individual characters; if someone familiar with such a language can enlighten me, I'd appreciate it.)_
* Most importantly, all of the accesskeys in a particular file need to be case-insensitively different. That means, e.g., that you can't have both "C" and "c" as accesskeys in the same file.
* It's preferable to use the first letter of a word as an accesskey, and it's also preferable to use the first significant word in the label as an accesskey (e.g., for "Put in Outbox", "O" would arguably be a better accesskey than "P"). Sometimes, depending on the labels of the various buttons in a file, these two goals conflict with each other. ;-) Use your best judgment.

If you get one of the accesskeys wrong, don't worry, I'll fix it; I have a script which checks accesskeys for validity before shipping the add-on.

### Template functions for dynamic function editor

In prompts.properties, you will see three long strings that are blocks of source code, labeled as EditorReadMeCode, \_BusinessHoursCode, and DaysInARowCode. These three blocks of text are used to create the three sample functions that get created automatically the first time the user opens the dynamic function editor.

You should translate the comments in these strings but not the variable names.

Oh, and contrary to what is written below, for these three specific strings you should use dumb, ugly, ASCII quotes, not pretty Unicode quotes!

### Quotation marks

Please try to use the "pretty" quotation marks that are appropriate for your language whenever possible, rather than plaintext " or ' characters. For example, &ldquo;this&rdquo; looks nice in English. If you aren't working on Mac OS so your keyboard isn't kind enough to type these for you automatically ;-), then you can cut and paste them from elsewhere or launch a smart text editor like Microsoft Office or LibreOffice that has its own smart quotes implementation, type the phrase you want so that the editor substitutes the smart quotes, and then paste it into Crowdin.

Rumor has it (I have not verified this) that on Mac OS you can type Opt+] to get a left single quote, Opt+Shift+] to get a right single quote (which is also a pretty apostrophe), Opt+\[ to get a left double quote, and Opt+Shift+[ to get a right double quote.

Similarly, rumor has it that you can type Alt+0145, Alt+0146, Alt+0147, and Alt+0148 to get these same four characters on Windows.

Finally, on GNOME, you can type Ctrl-Shift-u 2018 Enter to get a left single quote, or replace the 2018 with 2019, 201C, or 201D for the other three.

## Final notes

Once you are done translating all of the missing strings for a particular translation, let me know that it's awaiting my approval. I assume that there's a way to do that through the Crowdin user interface, but I don't know what it is, since I don't do translations and I've just started using Crowdin. If you figure it out, please let me know. ;-) If you can't find any way to mark a translation pending approval on the Crowdin web site, just email me.

If you would like to be credited for your translation, please let me know how you would like to be credited -- name, company, email address, BabelZilla nickname, etc.

Please [let me know](mailto:jik+sendlater3@kamens.us) if you have any questions.

Thanks,

Jonathan Kamens
