#!/usr/bin/env python3

import json
import re
import subprocess
import sys

addon_id = 'sendlater3@kamens.us'

json_filename = sys.argv[1]
try:
    data = json.load(open(json_filename, 'r'))
except FileNotFoundError:
    data = {
        'addons': {
            addon_id: {
                'updates': [
                ]
            }
        }
    }
updates = data['addons'][addon_id]['updates']

# It sure would be great if gh release list had JSON output
result = subprocess.run(('gh', 'release', 'list', '--exclude-drafts'),
                        check=True, capture_output=True, encoding='utf-8')
insert_index = 0
for release_line in result.stdout.split('\n'):
    match = re.search(r'\bv[0-9.]+\b', release_line)
    if not match:
        continue
    tag = match[0]
    version = tag[1:]
    if any(u for u in updates if u['version'] == version):
        print(f'Found version ${version} in ${json_filename}`',
              file=sys.stderr)
        break

    result = subprocess.run(('gh', 'release', 'view', tag, '--json',
                             'url,assets'), check=True, capture_output=True,
                            encoding='utf-8')
    release_data = json.loads(result.stdout)
    try:
        beta_asset = next(a for a in release_data['assets']
                          if a['name'] == 'send_later_beta.xpi')
    except StopIteration:
        print(f'No beta asset in ${version}, skipping', file=sys.stderr)
        continue
    download_url = beta_asset['url']

    result = subprocess.run(('git', 'show', f'{tag}:manifest.json'),
                            check=True, capture_output=True, encoding='utf-8')
    manifest_data = json.loads(result.stdout)
    strict_min_version = \
        manifest_data['applications']['gecko']['strict_min_version']

    updates.insert(insert_index, {
        'version': version,
        'update_info_url': release_data['url'],
        'update_link': download_url,
        'applications': {
            'gecko': {
                'strict_min_version': strict_min_version
            }
        }
    })
    insert_index += 1

print(json.dumps(data, indent=2))
