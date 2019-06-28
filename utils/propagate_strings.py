#!/usr/bin/env python

# Copies the program name -- whose canonical location is the "MessageTag"
# property in prompt.properties -- into other locations that want it.

import argparse
import glob
import os
import sys
from utils.locale_file import LocaleFile, LocaleFileMeta

SUBSTITUTIONS = {
    'ask.dtd': ['sendlater.ask.title.label'],
    'editor.dtd': ['windowtitle', 'inputtimetip'],
    'headerView.dtd': ['sendlater3header.label'],
    'prefwindow.dtd': ['prefwindow.title', 'pane1.title',
                       'showsendlatercolumn.caption',
                       'showsendlatercolumn.tooltip',
                       'showsendlaterheader.caption',
                       'showsendlaterstatus.caption',
                       'showsendlaterunsentmessages.tooltip',
                       'contactauthor.tooltip',
                       'helplink.tooltip'],
    'prompt.dtd': ['sendlater.prompt.sendnow.tooltip',
                   'sendlater.toolbar.sendlater.button.tooltip'],
    'prompt.properties': ['SendingUnsentError', 'CopyUnsentError',
                          'CopyRecurError', 'CorruptFolderError',
                          'MessageResendError', 'draftSaveWarning',
                          'ScheduledMessagesWarningQuitRequested',
                          'ScheduledMessagesWarningQuit',
                          'EnigmailIncompatTitle', 'EnigmailIncompatText',
                          'EditorReadMeCode', 'SLJFilterLabel'],
}

NAME_TOKEN = '{NAME}'


def substitute_string_in_locale_file(locale_file, key, string, replacement):
    try:
        value = locale_file[key]
    except KeyError:
        print('Warning: {}: {}: not found'.format(locale_file.file_name, key))
        return True
    if string not in value:
        print(u'ERROR: {}: {}: "{}" does not contain "{}"'.format(
            locale_file.file_name, key, value, string))
        return False
    locale_file[key] = value.replace(string, replacement)
    return True


def substitute_strings_in_locale_file(locale_file, keys, string, replacement,
                                      dryrun=False):
    ok = True
    if not isinstance(locale_file, LocaleFileMeta):
        locale_file = LocaleFile(locale_file)
    for key in keys:
        ok = substitute_string_in_locale_file(
            locale_file, key, string, replacement) and ok
    if ok and not dryrun:
        locale_file.save()
    return ok


def substitute_addon_name(args):
    ok = True
    default_addon_name = LocaleFile('chrome/locale/en-US/prompt.properties')[
        'MessageTag']

    for locale_dir in glob.glob('chrome/locale/*'):
        prompt_properties = LocaleFile(os.path.join(locale_dir,
                                                    'prompt.properties'))
        try:
            addon_name = prompt_properties['MessageTag']
        except KeyError:
            addon_name = default_addon_name
        for fn, keys in SUBSTITUTIONS.items():
            locale_file = LocaleFile(os.path.join(locale_dir, fn))
            ok = substitute_strings_in_locale_file(
                locale_file, keys, NAME_TOKEN, addon_name,
                dryrun=args.dryrun) and ok
            for key, value in locale_file.items():
                if NAME_TOKEN in value:
                    print(u'ERROR: {}: {}: "{}" contains {}'.format(
                          locale_file.file_name, key, value, NAME_TOKEN))
                    ok = False
    return ok


def parse_args():
    parser = argparse.ArgumentParser(description='Propagate add-on name in '
                                     'localization strings')
    parser.add_argument('--dryrun', action='store_true', default=False,
                        help="Don't actually modify files")

    return parser.parse_args()


def main():
    args = parse_args()
    ok = True
    ok = substitute_addon_name(args) and ok
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
