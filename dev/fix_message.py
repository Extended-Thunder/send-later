#!/usr/bin/env python3

import argparse
from bs4 import BeautifulSoup
import json
import markdown
import os
import re
import requests
import subprocess
import sys
import tempfile
from textwrap import dedent
import time

atn_versions_url = ('https://addons.thunderbird.net/thunderbird/addon/'
                    'send-later-3/versions/')
gh_versions_url = 'https://github.com/Extended-Thunder/send-later/releases'
markdown_file_path = 'download-response.md'


def parse_args():
    parser = argparse.ArgumentParser(description='Create Send Later upgrade '
                                     'message in Markdown or HTML')
    parser.add_argument('--test', action='store_true')
    parser.add_argument('--version', action='store', help='Defaults to most '
                        'recent version on GitHub or ATN')
    parser.add_argument('--html', action='store_true')
    parser.add_argument('--browser', action='store_true',
                        help='Implies --html')
    args = parser.parse_args()
    if args.browser:
        args.html = True
    return args


def check_atn_version(want_version):
    '''Returns true if the specified release is available'''
    response = requests.get(atn_versions_url)
    soup = BeautifulSoup(response.content, 'lxml')
    versions = soup.find_all('a')
    versions = (v.get('href') for v in versions)
    versions = (re.search(r'-([0-9.]+)-', v)[1]
                for v in versions if re.search(r'send_later.*\.xpi', v) and
                'type:attachment' not in v)
    for v in versions:
        if v == want_version:
            return True
    else:
        return False


def get_gh_info(want_version):
    '''Returns info for the specified release, if present'''
    result = subprocess.run(('gh', 'release', 'view', f'v{want_version}',
                             '--json', 'url,isDraft,isPrerelease,url,assets'),
                            capture_output=True, encoding='utf8')
    if not result.stdout:
        return None
    return json.loads(result.stdout)


def unwrap(text):
    return re.sub(r'\n\s*\b', ' ', dedent(text))

        
def generate_markdown(version, on_atn, gh_info):
    atn_steps = unwrap(f'''\
    * Go to [addons.thunderbird.net]({atn_versions_url}) and confirm that
    release {version} is available for download there.
    * Open the Add-ons page in Thunderbird ("Add-ons and Themes" from the
    corner "hamburger" menu).
    * Click on Send later.
    * Click the gear icon and select "Check for Updates".
    * The add-on should update and then you should see the message, "Your
    add-ons have been updated," next to the gear icon.\n\n''')

    markdown = ''
    markdown += (f'This issue should be fixed in release {version} of '
                 f'Send Later.\n\n')
    if on_atn:
        markdown += unwrap('''\
        This release is available on addons.thunderbird.net, and unless you've
        turned off automatic add-on updates, Thunderbird will eventually update
        to the new version automatically. To update immediately:\n\n''')

        markdown += atn_steps
    else:
        xpi_url = next(a['url'] for a in gh_info['assets']
                       if a['url'].endswith('.xpi'))
        release_url = gh_info['url']
        markdown += unwrap(f'''\
        This release is not yet available for download from
        addons.thunderbird.net, but you can download and install it from
        its [GitHub release page]({release_url}) as follows:

        * Download [this file]({xpi_url}) to your computer. (If you are
        using Firefox, make sure to right click on the link and select
        "Save Link As..." rather than just clicking on it, because
        otherwise Firefox will try to install it as a Firefox add-on.)
        * Open the Add-ons page in Thunderbird ("Add-ons and Themes" from
        the corner "hamburger" menu).
        * Click the gear icon at the top and select "Install Add-on From
        File...".
        * Browse to and select the downloaded file.
        * Click through the installation pop-ups.
        * You can delete the downloaded file once you've installed it into
        Thunderbird.\n\n''')

        if gh_info['isPrerelease']:
            markdown += unwrap('''\
            Note that this is a prerelease. While we make every effort to
            ensure that prereleases are stable, they are a bit more likely
            to have bugs, so proceed with caution.\n\n''')

        markdown += unwrap('''\
        If you prefer to wait, the release will eventually be available on
        addons.thunderbird.net, and unless you've turned off automatic
        add-on updates, Thunderbird will eventually update to the new
        version automatically. To update immediately once it's available:\n
        ''')

        markdown += atn_steps

    markdown += ('Please let me know if you still see this issue in this '
                 'release.\n\n')

    return markdown


def process(args, version, on_atn, gh_info):
    output = generate_markdown(version, on_atn, gh_info)
    if args.html:
        output = markdown.markdown(output)
    if args.browser:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf8',
                                         suffix='.html', dir=os.getcwd()) as f:
            f.write(output)
            f.flush()
            subprocess.run(('xdg-open', f'file://{f.name}'),
                           check=True)
            # Give the browser time to read the file.
            time.sleep(5)
    else:
        print(output, end='')


def main():
    args = parse_args()
    if args.version:
        on_atn = check_atn_version(args.version)
        gh_info = get_gh_info(args.verson)
        if not (on_atn or gh_info):
            sys.exit(f"Version {args.version} isn't on ATN or GitHub.")
        return process(args, args.version, on_atn, gh_info)
    result = subprocess.run(
        ('git', 'tag', '--list', '--sort=-v:refname', 'v*'),
        check=True, capture_output=True, encoding='utf8')
    tags = result.stdout.strip().split('\n')
    for tag in tags:
        version = re.match(r'v(.*)', tag)[1]
        on_atn = check_atn_version(version)
        gh_info = get_gh_info(version)
        if gh_info and gh_info['isDraft']:
            gh_info = None
        try:
            next(a for a in gh_info['assets'] if a['url'].endswith('.xpi'))
        except StopIteration:
            print(f'WARNING: release {version} has no assets on GitHub',
                  file=sys.stderr)
            continue
        if on_atn or gh_info:
            break
    else:
        sys.exit('Failed to find any release')
    return process(args, version, on_atn, gh_info)


if __name__ == '__main__':
    main()
