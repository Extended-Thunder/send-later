# Translating Send Later

If you're reading this, then either you've offered to help translate Send Later, or you've stumbled across this file in the Send Later source tree and started reading it out of curiosity. Either way, welcome!

Below, I explain how to be a Send Later translator and try to answer the questions you are likely to have about it. If you have any questions that aren't answered here, please don't hesitate to [post in the discussion forum](https://github.com/Extended-Thunder/send-later/discussions)!

I know that for many of my translators, English is not your first language, so I feel a bit rude writing to you in English, but of course my need to do that is why I need translators. :-/ Please bear with me.

## How much work is this going to be, really?

Things are changing pretty rapidly in Send Later recently, but I've tried to reuse locale strings as much as possible. The Send Later UI is generally pretty stable, and has been for quite a while. I intend to keep it that way unless there are pressing needs to update the text. So while you may need to put in several hours of effort to do a new translation from scratch, after that the work will be rather intermittent and not particularly time-consuming. Crowdin offers suggested string translations which can save you a lot of time.

## Signing up

I use [Crowdin](https://crwd.in/sendlater) to manage translations of Send Later. Your first step in becoming a translator is to [register for a Crowdin account](https://crowdin.com/join) if you don't already have one. Once you've registered, you can either jump right in or review the [Interface overview](https://support.crowdin.com/for-translators/getting-started-translators/interface-overview/) for more information about how to use Crowdin.

Once you are registered, visit the [Send Later extension page](https://crwd.in/sendlater) and click the "Join" button in the upper right corner of the page to join the project. Then you can drill down into individual translations and start working on them. If you are interested in creating a new translation that is not listed, please contact me and I'll add it.

If you are updating a translation originally done by someone else, _please respect the approach of the previous translator,_ and make changes to existing translations only if they are actually wrong, not just because you would prefer to have worded a particular message a different way. It is not helpful to me if my translators engage in battles with each other. :-/ If the old translator is gone and no longer active and you believe strongly that a significant change in approach is needed, then please [bring it up in the "Ideas" discussion section](https://github.com/Extended-Thunder/send-later/discussions/categories/ideas) and we can talk about it.

## Determining how strings are used

There's no really great way to determine the context of a particular string your translating, except perhaps to try to guess where you think the string is probably used, and then try to use that bit of functionality in the add-on itself within Thunderbird, to see if you're right. I also encourage you to [search the source code](https://github.com/Extended-Thunder/send-later) for the string's identifier to see where it is used in the code. Or, if all else fails, ask me for an explanation of any string context you can't figure out.

## Notes about how to translate things

### Substitution variables in strings

Whenever you see "$1" or "$2" or "$N" (where "N" is actually a number), that indicates a slot where a value is inserted dynamically by the add-on. _You must preserve these sequences in your translated strings_ -- Even if you need to switch their order. It is okay to write strings with "$2" before "$1" if for example an adjective and noun need to change order. I don't think there is anywhere in the code that requires this, but it's worth pointing out as an implementation detail nnonetheless.

### "accesskey" strings

You will see a number of strings whose identifiers end with "accesskey", with corresponding strings whose identifiers end with "label". The "label" strings are button labels, and the "accesskey" strings encode the characters that users can type with "Alt" (or Alt+Shift or whatever) to activate those buttons from the keyboard.

There are some rules you need to follow when translating accesskey strings:

* All of the accesskeys in a particular window need to be case-insensitively different. That means, e.g., that you can't have both "C" and "c" as accesskeys in the same file.
* It's preferable to use the first letter of a word as an accesskey, and it's also preferable to use the first significant word in the label as an accesskey (e.g., for "Put in Outbox", "O" would arguably be a better accesskey than "P"). Sometimes, depending on the labels of the various buttons in a file, these two goals conflict with each other. Use your best judgment.

### Template functions for dynamic function editor

You will see three long strings that are blocks of source code, labeled as EditorReadMeCode, _BusinessHoursCode, and DaysInARowCode. These three blocks of text are used to create the three sample functions that get created automatically the first time the user opens the dynamic function editor. **You should translate the comments in these strings but not the variable names.**

Oh, and contrary to what is written below, for these three specific strings you should use dumb, ugly, ASCII quotes, not pretty Unicode quotes!

### Quotation marks

Please try to use the "pretty" quotation marks that are appropriate for your language whenever possible, rather than plaintext " or ' characters. For example, &ldquo;this&rdquo; looks nice in English. If you aren't working on Mac OS so your keyboard isn't kind enough to type these for you automatically, then you can cut and paste them from elsewhere or launch a smart text editor like Microsoft Office or LibreOffice that has its own smart quotes implementation, type the phrase you want so that the editor substitutes the smart quotes, and then paste it into Crowdin.

Rumor has it (I have not verified this) that on Mac OS you can type Opt+] to get a left single quote, Opt+Shift+] to get a right single quote (which is also a pretty apostrophe), Opt+\[ to get a left double quote, and Opt+Shift+[ to get a right double quote.

Similarly, rumor has it that you can type Alt+0145, Alt+0146, Alt+0147, and Alt+0148 to get these same four characters on Windows.

Finally, on GNOME, you can type Ctrl-Shift-u 2018 Enter to get a left single quote, or replace the 2018 with 2019, 201C, or 201D for the other three.

## Final notes

Once you are done translating all of the missing strings for a particular translation, let me know that it's awaiting my approval. I assume that there's a way to do that through the Crowdin user interface, but I don't know what it is, since I don't do translations and I've just started using Crowdin. If you figure it out, please let me know. If you can't find any way to mark a translation pending approval on the Crowdin web site, just [email us](send-later-support@extended-thunder.org).

If you would like to be credited for your translation, please let me know how you would like to be credited -- name, company, email address, BabelZilla nickname, etc.

Please [post in the discussion forum](https://github.com/Extended-Thunder/send-later/discussions) if you have any questions.
