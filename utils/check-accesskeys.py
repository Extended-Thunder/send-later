#!/usr/bin/env python3

import codecs
from collections import OrderedDict
import glob
import os
import re
import sys
import unicodedata


symbolic_languages = ('ja', 'ja-JP', 'zh-CN', 'zh-TW')


def remove_accents(input_str):
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return u"".join([c for c in nfkd_form if not unicodedata.combining(c)])


def check_file(file_name):
    locale = os.path.basename(os.path.dirname(file_name))
    ok = True
    labels = {}
    access_keys = OrderedDict()
    seen_keys = {}
    with codecs.open(file_name, encoding='utf-8') as f:
        for line in f:
            match = re.match(r'<!ENTITY\s+(.*)\.label\s+"(.*)">', line)
            if match:
                labels[match.group(1)] = match.group(2)
                continue
            match = re.match(r'<!ENTITY\s+(.*)\.accesskey\s+"(.*)">', line)
            if match:
                access_keys[match.group(1)] = match.group(2)
                continue
    for name, access_key in access_keys.items():
        unaccented_key = remove_accents(access_key)
        lower_key = unaccented_key.lower()
        if lower_key not in seen_keys:
            seen_keys[lower_key] = name
        try:
            label = labels[name]
        except KeyError:
            ok = False
            print(u"{0}: No {1}.label corresponding to {1}.accesskey".format(
                file_name, name))
            continue
        unaccented_label = remove_accents(label)
        if len(access_key) != 1:
            ok = False
            print(u"{0}: {1}.accesskey \"{2}\" isn't one character".format(
                file_name, name, access_key))
            continue
        if access_key not in label and unaccented_key not in unaccented_label \
           and locale not in symbolic_languages:
            ok = False
            print(u"{0}: {1}: access key \"{2}\" not in label \"{3}\"".format(
                file_name, name, access_key, label))
        if seen_keys[lower_key] != name:
            ok = False
            print(u"{0}: access key \"{1}\" for {2} conflicts with {3}".
                  format(file_name, access_key, name, seen_keys[lower_key]))
    return ok


ok = True

for file_name in sorted(glob.glob("chrome/locale/*/*.dtd")):
    ok = check_file(file_name) and ok

sys.exit(0 if ok else 1)
