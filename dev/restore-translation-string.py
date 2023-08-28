#!/usr/bin/env python3

import argparse
from contextlib import contextmanager
import glob
import json
import os
import pickle
import pprint
import subprocess
import sys
import tempfile


# 1. Build a database of all strings in all previous commits.
# 2. Read in all locales.
# 3. Find the most recent version of the requested string in all locales.
# 4. Insert the string into the locales that have it, in the right place.
# 5. Output the result.


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--after', metavar='KEY', action='store')
    parser.add_argument('--rename', metavar='KEY', action='store')
    parser.add_argument('--save-database', action='store_true')
    parser.add_argument('--database', metavar='FILENAME', action='store')
    parser.add_argument('--print-strings', action='store_true')
    parser.add_argument('--print-deleted', action='store_true')
    parser.add_argument('string', nargs='?')
    args = parser.parse_args()
    if args.print_deleted:
        args.print_strings = True
    if (args.after or args.rename or args.string) and args.print_strings:
        parser.error(
            '--print-strings and --print-deleted are incompatible with most '
            'other arguments')
    if not args.string and not args.print_strings:
        parser.error('string must be specified unless --print-strings is')
    return args


@contextmanager
def save_directory():
    cwd = os.getcwd()
    try:
        yield
    finally:
        os.chdir(cwd)


def get_current_strings():
    strings = {}
    with save_directory():
        try:
            os.chdir('_locales')
        except FileNotFoundError:
            return {}
        locale_files = glob.glob('*/messages.json')
        for locale_file in locale_files:
            locale = locale_file.split('/')[0]
            try:
                locale_data = json.load(open(locale_file, 'r'))
            except Exception:
                continue
            strings[locale] = locale_data
    return strings


def get_old_strings(args):
    if args.database and not args.save_database:
        return pickle.load(open(args.database, 'rb'))
    repodir = os.getcwd()
    strings = {}
    with save_directory(), tempfile.TemporaryDirectory() as clonedir:
        os.chdir(clonedir)
        subprocess.check_call(('git', 'clone', '-q', repodir, 'send-later'))
        os.chdir('send-later')
        res = subprocess.run(('git', 'log', '--oneline', '.'),
                             capture_output=True, check=True, encoding='utf8')
        commits = res.stdout.strip().split("\n")
        commits = [line.split(' ')[0] for line in commits]
        for commit in commits:
            subprocess.run(('git', 'checkout', '-q', commit), check=True)
            commit_strings = get_current_strings()
            for locale, locale_data in commit_strings.items():
                if locale not in strings:
                    strings[locale] = locale_data
                else:
                    for key, value in locale_data.items():
                        if key not in strings[locale]:
                            strings[locale][key] = value
    if args.save_database and args.database:
        pickle.dump(strings, open(args.database, 'wb'))
    return strings


def insert_string(args, after_keys, locale, value):
    new_name = args.rename or args.string
    target_file = f'_locales/{locale}/messages.json'
    try:
        strings = json.load(open(target_file, 'r'))
    except FileNotFoundError:
        print(f'{locale} does not currently exist', file=sys.stderr)
        return
    if new_name in strings:
        print(f'{locale} already has {new_name}', file=sys.stderr)
        return
    print(f'Adding {new_name} to {locale}', file=sys.stderr)
    new_strings = {}
    locale_keys = list(strings.keys())
    added = False
    while locale_keys:
        key = locale_keys.pop(0)
        if key == args.after:
            new_strings[key] = strings[key]
            new_strings[new_name] = value
            added = True
            break
        elif key in after_keys:
            new_strings[new_name] = value
            new_strings[key] = strings[key]
            added = True
            break
        else:
            new_strings[key] = strings[key]
    while locale_keys:
        key = locale_keys.pop(0)
        new_strings[key] = strings[key]
    if not added:
        new_strings[new_name] = value
    print(json.dumps(new_strings, indent=2, ensure_ascii=False),
          file=open(target_file, 'w'))


def main():
    args = parse_args()

    if args.print_strings:
        old_strings = get_old_strings(args)
        if args.print_deleted:
            current_strings = get_current_strings()
            deleted_strings = {}
            for locale, locale_data in old_strings.items():
                if locale not in current_strings:
                    continue
                deleted_strings[locale] = {
                    key: value
                    for key, value in locale_data.items()
                    if key not in current_strings[locale]
                }
            pprint.pprint(deleted_strings)
        else:
            pprint.pprint(old_strings)
        sys.exit()

    if args.after:
        en_strings = json.load(open('_locales/en/messages.json', 'r'))
        en_keys = list(en_strings.keys())
        try:
            after_index = en_keys.index(args.after)
        except ValueError:
            sys.exit(f'{args.after} not in _locales/en/messages.json')
        after_keys = en_keys[after_index+1:]
    else:
        after_keys = []

    old_strings = get_old_strings(args)

    for locale, strings in old_strings.items():
        try:
            old_string = strings[args.string]
        except KeyError:
            print(f'{args.string} is not in {locale}', file=sys.stderr)
            continue
        insert_string(args, after_keys, locale, old_string)


if __name__ == '__main__':
    main()
