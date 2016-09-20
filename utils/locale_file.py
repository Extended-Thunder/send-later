from abc import ABCMeta, abstractmethod
import codecs
from errno import ENOENT
import os
import re


class LocaleFileMeta:
    __metaclass__ = ABCMeta

    def __init__(self, file_name):
        self.file_name = file_name
        self.dirty = False
        try:
            self.content = codecs.open(file_name, 'r', 'utf-8').read()
        except IOError as e:
            if e.errno != ENOENT:
                raise
            self.content = ''

    def save(self):
        if not (self.dirty and self.content):
            return
        tmp_file = self.file_name + '.tmp'
        codecs.open(tmp_file, 'w', 'utf-8').write(self.content)
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
