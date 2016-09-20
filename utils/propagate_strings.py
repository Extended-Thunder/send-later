#!/usr/bin/env python

# Copies the program name -- whose canonical location is the "MessageTag"
# property in background.properties -- into other locations that want it.

from abc import ABCMeta, abstractmethod
from errno import ENOENT
import glob
import os
import re
import sys

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
    'prompt.dtd': ['sendlater.prompt.sendnow.tooltip'],
    'prompt.properties': ['SendingUnsentError', 'CopyUnsentError',
                          'CopyRecurError', 'CorruptFolderError',
                          'MessageResendError', 'draftSaveWarning',
                          'ScheduledMessagesWarningQuitRequested',
                          'ScheduledMessagesWarningQuit',
                          'EnigmailIncompatTitle', 'EnigmailIncompatText',
                          'EditorReadMeCode', 'SLJFilterLabel'],
}

NAME_TOKEN = '{NAME}'


class LocaleFileMeta:
    __metaclass__ = ABCMeta

    def __init__(self, file_name):
        self.file_name = file_name
        self.dirty = False
        try:
            self.content = open(file_name).read()
        except IOError as e:
            if e.errno != ENOENT:
                raise
            self.content = ''

    def save(self):
        if not (self.dirty and self.content):
            return
        tmp_file = self.file_name + '.tmp'
        open(tmp_file, 'w').write(self.content)
        os.rename(tmp_file, self.file_name)
        self.dirty = False

    @abstractmethod
    def __getitem__(self, item):
        pass

    @abstractmethod
    def __setitem__(self, item):
        pass

    @abstractmethod
    def items(self):
        pass

    def __contains__(self, key):
        try:
            self[key]
            return True
        except KeyError:
            return False

    def __iter__(self):
        for item, value in self.items():
            yield item

    def keys(self):
        return self.__iter__()

    def values(self):
        for item, value in self.items():
            yield value


class DTDLocaleFile(LocaleFileMeta):
    def __getitem__(self, item):
        match = re.search(r'^<!ENTITY\s+' + re.escape(item) + r'\s+"(.*)"',
                          self.content, re.MULTILINE)
        if not match:
            raise KeyError('Could not find {} in {}'.format(
                item, self.file_name))
        return match.group(1)

    def __setitem__(self, item, value):
        try:
            old = self[item]
            if old == value:
                return
        except KeyError:
            if self.content and not self.content.endswith('\n'):
                self.content += '\n'
            self.content += '<!ENTITY {} "{}">\n'.format(item, value)
        self.content = re.sub(
            r'^(<!ENTITY\s+' + re.escape(item) + r'\s+)"(.*)"',
            r'\1"' + value.replace('\\', '\\\\') + '"',
            self.content, flags=re.MULTILINE)
        self.dirty = True

    def items(self):
        for match in re.finditer(r'^<!ENTITY\s+(.*\S)\s+"(.*)"',
                                 self.content, re.MULTILINE):
            yield match.group(1), match.group(2)


class PropertiesLocaleFile(LocaleFileMeta):
    def __getitem__(self, item):
        match = re.search(r'^' + re.escape(item) + r'\s*=\s*(\S.*)',
                          self.content, re.MULTILINE)
        if not match:
            raise KeyError('Could not find {} in {}'.format(
                item, self.file_name))
        return match.group(1)

    def __setitem__(self, item, value):
        try:
            old = self[item]
            if old == value:
                return
        except KeyError:
            if self.content and not self.content.endswith('\n'):
                self.content += '\n'
            self.content += '{}={}\n'.format(item, value)
        self.content = re.sub(
            r'^(' + re.escape(item) + r')\s*=\s*(.*)',
            r'\1=' + value.replace('\\', '\\\\'),
            self.content, flags=re.MULTILINE)
        self.dirty = True

    def items(self):
        for match in re.finditer(r'^(\S+)\s*=\s*(.*)',
                                 self.content, re.MULTILINE):
            yield match.group(1), match.group(2)


def LocaleFile(file_name):
    if file_name.endswith('.dtd'):
        return DTDLocaleFile(file_name)
    elif file_name.endswith('.properties'):
        return PropertiesLocaleFile(file_name)
    else:
        raise Exception('Unrecognized locale file type: {}'.format(file_name))


def substitute_string_in_locale_file(locale_file, key, string, replacement):
    try:
        value = locale_file[key]
    except KeyError:
        print('Warning: {}: {}: not found'.format(locale_file.file_name, key))
        return True
    if string not in value:
        print('ERROR: {}: {}: "{}" does not contain "{}"'.format(
            locale_file.file_name, key, value, string))
        return False
    locale_file[key] = value.replace(string, replacement)
    return True


def substitute_strings_in_locale_file(locale_file, keys, string, replacement):
    ok = True
    if not isinstance(locale_file, LocaleFileMeta):
        locale_file = LocaleFile(locale_file)
    for key in keys:
        ok = substitute_string_in_locale_file(
            locale_file, key, string, replacement) and ok
    if ok:
        locale_file.save()
    return ok


def substitute_addon_name():
    ok = True
    addon_name = LocaleFile('chrome/locale/en-US/background.properties')[
        'MessageTag']

    for locale_dir in glob.glob('chrome/locale/*'):
        for fn, keys in SUBSTITUTIONS.items():
            locale_file = LocaleFile(os.path.join(locale_dir, fn))
            ok = substitute_strings_in_locale_file(
                locale_file, keys, NAME_TOKEN, addon_name) and ok
            for key, value in locale_file.items():
                if NAME_TOKEN in value:
                    print('ERROR: {}: {}: "{}" contains {}'.format(
                          locale_file.file_name, key, value, NAME_TOKEN))
                    ok = False
    return ok


if __name__ == '__main__':
    ok = True
    ok = substitute_addon_name() and ok
    sys.exit(0 if ok else 1)
