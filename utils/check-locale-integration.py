#!/usr/bin/env python

# Confirms that every locale in chrome/locale is properly listed in install.rdf
# and chrome.manifest, and that there are no extra locales listed in either of
# those two files.

import glob
import lxml.etree
import os
import sys
from utils.locale_file import LocaleFile

LOCALE_DIR = 'chrome/locale'

###
### Get localization stanzas from install.rdf
###

def read_install_rdf():
    root = lxml.etree.parse(open('install.rdf')).getroot()
    RDF = next(root.iter('{*}RDF'))
    Description = next(RDF.iter('{*}Description'))
    localized = {}

    def get_elt_string(elt, tag):
        try:
            sub_elt = next(elt.iter('{*}' + tag))
        except StopIteration:
            return ''
        return sub_elt.text

    localized['en-US'] = {
        'name': get_elt_string(Description, 'name'),
        'description': get_elt_string(Description, 'description')
    }
        
    for localized_elt in Description.iter('{*}localized'):
        sub_elt = localized_elt[0]
        locale_string = get_elt_string(sub_elt, 'locale')
        if not locale_string:
            raise Exception('Missing locale in install.rdf stanza:\n' +
                            lxml.etree.tostring(localized_elt))
        if locale_string in localized:
            raise Exception('Locale {} is in install.rdf twice'.format(
                locale_string))
        localized[locale_string] = {
            'name': get_elt_string(sub_elt, 'name'),
            'description': get_elt_string(sub_elt, 'description')
        }

    return localized


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


def check_locale(install_rdf, manifest, locale_dir):
    name_file = os.path.join(locale_dir, 'background.properties')
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

    try:
        localized = install_rdf.pop(locale_code)
    except:
        print('ERROR: {}: not in install.rdf'.format(locale_code))
        return False

    ok = True

    if name is not None and name != localized['name']:
        print(u'ERROR: {}: add-on name is "{}" in install.rdf, "{}" in locale'.
              format(locale_code, localized['name'], name))
        ok = False

    if description is not None and description != localized['description']:
        print(u'ERROR: {}: description is "{}" in install.rdf, "{}" in locale'.
              format(locale_code, localized['description'], description))
        ok = False

    return ok


def main():
    install_rdf = read_install_rdf()
    manifest = read_chrome_manifest()
    ok = True

    locale_dirs = glob.glob(os.path.join(LOCALE_DIR, '*'))
    locale_dirs.sort()

    for dir in locale_dirs:
        ok = check_locale(install_rdf, manifest, dir) and ok

    for dir in manifest:
        print('ERROR: {}: Extra directory in manifest'.format(dir))
        ok = False

    for code in install_rdf:
        print('ERROR: {}: Extra locale in install.rdf'.format(code))
        ok = False

    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
