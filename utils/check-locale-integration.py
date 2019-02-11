#!/usr/bin/env python

# Confirms that every locale in chrome/locale is properly listed in
# chrome.manifest, and that there are no extra locales listed there.

import glob
import json
import lxml.etree
import os
import sys
from utils.locale_file import LocaleFile

LOCALE_DIR = 'chrome/locale'

###
### Read locales from chrome.manifest
###

def read_chrome_manifest():
    manifest = {}
    with open('chrome.manifest') as f:
        for line in f:
            fields = line.split()
            if fields[0] != 'locale':
                continue
            if fields[1] != 'sendlater3':
                raise Exception('Bad second field in chrome.manifest: {}'.
                                format(line))
            if not fields[3].endswith('/'):
                raise Exception('Bad fourth field (no trailing slash) in '
                                'chrome.manifest: {}'.format(line))
            manifest[fields[3][0:-1]] = fields[2]
    return manifest


def check_locale(manifest, locale_dir):
    name_file = os.path.join(locale_dir, 'prompt.properties')
    description_file = os.path.join(locale_dir, 'sendlater3.properties')

    try:
        name = LocaleFile(name_file)['MessageTag']
    except:
        name = None
        print('Warning: {}: No add-on name'.format(locale_dir))

    try:
        description = LocaleFile(description_file)[
            'extensions.sendlater3@kamens.us.description']
    except KeyError:
        description = None
        print('Warning: {}: No add-on description'.format(
            locale_dir))

    try:
        locale_code = manifest.pop(locale_dir)
    except:
        print('ERROR: {}: not in chrome.manifest'.format(locale_dir))
        return False

    ok = True

    return ok


def main():
    manifest = read_chrome_manifest()
    ok = True

    locale_dirs = glob.glob(os.path.join(LOCALE_DIR, '*'))
    locale_dirs.sort()

    for dir in locale_dirs:
        ok = check_locale(manifest, dir) and ok

    for dir in manifest:
        print('ERROR: {}: Extra directory in manifest'.format(dir))
        ok = False

    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
