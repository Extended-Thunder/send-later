#!/usr/bin/env python3

'''pontoon.mozilla.org translation scraper

Script to pull a particular translation string from Thunderbird (or any other
app translated on pontoon.mozilla.org) for all available languages and add it
to Send Later's messages.json files.

To use it, you first need to browse around on pontoon.thunderbird.org to find
the specific string you want. When you find it, it will have a `string=#` query
parameter in the URL. That query parameter is the ID you need to give to this
script.
'''

import argparse
import json
import os
import re
import requests
import sys

fix_locales = {
    'es-ES': 'es',
    'hy-AM': 'hy',
    'nb-NO': 'nb',
    'pt-BR': 'pt_BR',
    'pt-PT': 'pt',
    'sv-SE': 'sv',
    'zh-CN': 'zh',
    'zh-TW': 'zh_TW',
}


def parse_args():
    parser = argparse.ArgumentParser(description='Pull translation from '
                                     'Pontoon and add to messages.json files')
    parser.add_argument('string_id', metavar='STRING-ID', help='"string" '
                        'query parameter from URL of desired string')
    parser.add_argument('name', metavar='NAME', help='Name to assign to the '
                        'string in messages.json')
    return parser.parse_args()


def main():
    args = parse_args()
    locales = [dir for dir in os.listdir('_locales') if dir != "en"]
    translations = {}
    for translate in get_translations(args.string_id):
        locale = fix_locale(translate['locale']['code'])
        if locale not in locales:
            continue
        translation_string = fix_translation(
            translate.get('translation', None))
        if not translation_string:
            continue
        translations[locale] = translation_string
    for missing in sorted(set(locales) - set(translations.keys())):
        print(f'Warning: no translation for {missing}')
    description = get_description(args.name)
    for locale, translation in translations.items():
        add_translation(locale, translation, args.name, description)


def fix_locale(locale):
    return fix_locales.get(locale, locale)


def fix_translation(translate):
    if not translate:
        return None
    match = re.search(r' = (.*)', translate)
    if not match:
        return None
    return match[1].strip()


def get_translations(string_id):
    # Arbitrary choice, but we double-check that it's valid.
    unwanted_locale = 'af'
    locales = os.listdir('_locales')
    if any(locale for locale in locales if locale.startswith(unwanted_locale)):
        sys.exit('You need to update unwanted_locale in get_translations!')
    url = f'https://pontoon.mozilla.org/other-locales/?entity={string_id}' \
        f'&locale={unwanted_locale}'
    response = requests.get(
        url, headers={'x-requested-with': 'XMLHttpRequest'})
    return response.json()


def get_description(name):
    current = json.load(open('_locales/en/messages.json'))
    return current[name]['description']


def add_translation(locale, translation, name, description):
    target = f'_locales/{locale}/messages.json'
    current = json.load(open(target, 'r', encoding='utf-8'))
    if name in current:
        if current[name]['message'] == translation:
            print(f'Locale {locale} already has {name}')
        else:
            print(f'Locale {locale} already has {name} with value '
                  f'{current[name]["message"]} instead of fetched value '
                  f'{translation}')
        return
    current[name] = {
        'message': translation,
        'description': description
    }
    tmpfile = f'{target}.new'
    with open(tmpfile, 'w', encoding='utf-8') as f:
        print(json.dumps(current, sort_keys=False,
                         ensure_ascii=False, indent=2), file=f)
        # Ensure final newline
        print('', file=f)
    os.rename(tmpfile, target)
    print(f'Added {name}={translation} to {locale}')


if __name__ == '__main__':
    main()
