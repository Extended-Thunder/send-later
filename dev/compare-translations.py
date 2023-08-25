#!/usr/bin/env python3

# Compares two locale directories and lists the differences between them, with
# some smarts to eliminate unnecessary output.

import glob
import itertools
import json
import sys

default_locale = 'en'
obsolete_keys = (
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',

    'close.accesskey',
    'close.cmdkey',
    'CompactionFailureNoError',
    'CompactionFailureWithError',
    'delete.accesskey',
    'everymonthly_short',
    'export.accesskey',
    'export.label',
    'exporttip',
    'ExportTitle',
    'import.accesskey',
    'import.label',
    'ImportError',
    'importtip',
    'ImportTitle',
    'RenameFunctionBody',
    'RenameFunctionNewButton',
    'RenameFunctionRenameButton',
    'RenameFunctionTitle',
    'reset.accesskey',
    'SanityCheckConfirmOptionMessage',
    'SanityCheckCorruptFolderWarning',
    'SanityCheckDrafts',
    'SanityCheckOutbox',
    'save.accesskey',
    'sendlater.ask.donate.accesskey',
    'sendlater.ask.donate.label',
)


def main():
    dir1 = sys.argv[1]
    dir2 = sys.argv[2]

    old = read_tree(dir1)
    new = read_tree(dir2)
    compare_trees(old, new)


def read_tree(dir):
    file_paths = glob.glob(f'{dir}/*/messages.json')
    strings = {}
    for file_path in file_paths:
        locale = file_path.split('/')[-2]
        data = json.load(open(file_path))
        strings[locale] = {key: value['message']
                           for key, value in data.items()}
    return strings


def compare_trees(old, new):
    locales = sorted(set(itertools.chain(old.keys(), new.keys())))
    for locale in locales:
        try:
            before = old[locale]
        except KeyError:
            print(f'{locale}: New locale')
            continue
        try:
            after = new[locale]
        except KeyError:
            print(f'{locale}: Deleted locale')
            continue
        keys = sorted(set(itertools.chain(before.keys(), after.keys())))
        for key in keys:
            try:
                before_value = before[key]
            except KeyError:
                print(f'{locale}: {key} added (translated from '
                      f'{old[default_locale][key]}): {after[key]}')
                continue
            try:
                after_value = after[key]
            except KeyError:
                try:
                    if old[default_locale][key] == old[locale][key]:
                        continue
                except KeyError:
                    pass

                if key not in obsolete_keys:
                    print(f'{locale}: {key} deleted (was {before[key]})')
                continue
            if key in obsolete_keys:
                print(f'{locale}: {key} should be deleted')
                continue
            if before_value != after_value:
                print(f'{locale}: {key}: {before_value} -> {after_value}')


if __name__ == '__main__':
    main()
