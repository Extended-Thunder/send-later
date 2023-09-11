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

atn_url = 'https://addons.thunderbird.net/thunderbird/addon/send-later-3/'
atn_versions_url = f'{atn_url}versions/'
gh_versions_url = 'https://github.com/Extended-Thunder/send-later/releases'
markdown_file_path = 'download-response.md'


def parse_args():
    parser = argparse.ArgumentParser(description='Create Send Later upgrade '
                                     'message in Markdown or HTML')
    parser.add_argument('--test', action='store_true')
    parser.add_argument('--version', action='store', help='Defaults to most '
                        'recent version on GitHub or ATN')
    parser.add_argument('--html', action='store_true')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--browser', action='store_true',
                       help='Show message in browser (implies --html)')
    group.add_argument('--clipboard', action='store_true', help='Copy message '
                       'to clipboard using xclip or wl-copy')
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
    return re.sub(r'(\S)\n[ \t]*\b', r'\1 ', dedent(text))


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
    markdown += unwrap(f'''\
    This issue should be fixed in release {version} of Send Later.

    To check what version of Send Later you have:

    * Open the Add-ons page in Thunderbird ("Add-ons and Themes" from
    the corner "hamburger" menu).
    * Click on Extensions on the left if you're not already on the
    left if you're not already there.
    * Find Send Later in the list of extensions and click on it to
    open its details page.
    * The version number should be displayed there next to
    "Version".\n
    ''')

    if on_atn:
        markdown += unwrap('''\
        This release is available on addons.thunderbird.net, and unless you've
        turned off automatic add-on updates, Thunderbird will eventually update
        to the new version automatically. To update immediately:\n\n''')

        markdown += atn_steps
    else:
        xpi_url = next(a['url'] for a in gh_info['assets']
                       if a['name'] == 'send_later.xpi')
        beta_url = next(a['url'] for a in gh_info['assets']
                       if a['name'] == 'send_later_beta.xpi')
        release_url = gh_info['url']
        markdown += unwrap(f'''\
        This release is not yet available for download from
        addons.thunderbird.net, but you can download and install it from
        its [GitHub release page]({release_url}) as follows:

        * Download [send_later.xpi]({xpi_url}) to your computer. (If you are
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
        Thunderbird.

        To subscribe to future beta releases (we love beta testers!),
        download and install [send_later_beta.xpi]({beta_url})
        instead. The advantage is that if there's a bug that affects
        your workflow you'll help find it and get it fixed quickly.
        The disadvantage is that bugs are a bit more likely in beta
        releases. You can unsubscribe from beta releases at any time
        by downloading and installing send_later.xpi or installing
        from [addons.thunderbird.net]({atn_url}).\n\n''')

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
    elif args.clipboard:
        clip_command = (('xclip', '-selection', 'clipboard')
                        if os.environ['XDG_SESSION_TYPE'] == 'x11'
                        else ('wl-copy',))
        subprocess.run(clip_command, input=output, check=True,
                       encoding='utf8')
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
            next(a for a in gh_info['assets'] if a['name'] == 'send_later.xpi')
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
