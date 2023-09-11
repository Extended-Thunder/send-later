VERSION=$(shell jq -r .version < manifest.json)
MEDITOR=$(if $(EDITOR),$(EDITOR),$(VISUAL))
# https://stackoverflow.com/a/17055840/937306
define n


endef
RELEASE_PATTERNS=$(subst $n, ,$(file <dev/include-manifest))
RELEASE_FILES=$(filter-out *~,$(wildcard $(RELEASE_PATTERNS)))
# The line in the HTML that we're matching here looks like this:
#    <li>Versions: <code>0.3, 0.4, ....lots of versions..., 119.*, *</code></li>
# We can't currently use "*" as max version, so we need the second-to-last
# version number on the line
MAX_GECKO_VERSION=$(shell curl --silent https://addons.thunderbird.net/en-US/thunderbird/pages/appversions/ | sed -n -e 's/.*Versions: <code>.*, \([^,]*\),.*/\1/p' | head -1)
BETA_JSON=beta-channel.json

.PHONY: release

all: send_later.xpi
clean:: ; -rm -f send_later.xpi

send_later.xpi: dev/include-manifest $(RELEASE_FILES)
	rm -f "$@" "$@".tmp
	zip -q -r "$@".tmp $(RELEASE_FILES)
	mv "$@".tmp "$@"

# Makes sure release tag is on origin.
# Makes sure our checked-out files are what's supposed to be in the release.
# Creates XPI files.
# Prompts for title and for user to edit release notes.
# Creates GitHub release as prerelease, uploading release notes and XPI files.
# Regenerates and commits beta-channel.json.
# Pushes new beta-channel.json to GitHub.

TITLE_FILE=/tmp/send-later-github-release-title.$(VERSION)
NOTES_FILE=/tmp/send-later-github-release-notes.$(VERSION).md
FULL_NOTES_FILE=/tmp/send-later-github-release-notes-full.$(VERSION).md

gh_release: send_later.xpi send_later_beta.xpi send_later_atn.xpi
# No releases that aren't pushed to main
	git merge-base --is-ancestor v$(VERSION) origin/main
# No changes to release files in our checked-out tree
	@set -e; for file in $(RELEASE_FILES); do \
	  git diff --exit-code v$(VERSION) $$file; \
	done
	@title=$$(cat $(TITLE_FILE) 2>/dev/null); \
	[ -n "$$title" ] || title=$(VERSION); \
	echo -n "Enter release title [$$title]: "; \
        read newtitle; if [ -n "$$newtitle" ]; then title="$$newtitle"; fi; \
	echo "$$title" > $(TITLE_FILE)
	touch $(NOTES_FILE)
	$(MEDITOR) $(NOTES_FILE)
	cat $(NOTES_FILE) >| $(FULL_NOTES_FILE)
	echo -e '\n\n**Note:** Downloading and installing `send_later_beta.xpi` will subscribe you to future beta releases. We love beta-testers! The advantage is that if there'\''s a bug that affects your workflow you'\''ll help find it and get it fixed quickly. The disadvantage is that bugs are a bit more likely in beta releases. You can unsubscribe from beta releases at any time by downloading and installing `send_later.xpi` or installing from [addons.thunderbird.net](https://addons.thunderbird.net/thunderbird/addon/send-later-3/).' >> $(FULL_NOTES_FILE)
	@echo -n "Hit Enter to proceed or ctrl-C to abort: "; read response
# N.B. This uses $$(cat instead of $(file to read the title file because the
# contents of the file change while the rule is running but Make expands the
# rule earlier.
	@set -x; gh release create v$(VERSION) --prerelease \
	  --title "$$(cat $(TITLE_FILE))" --notes-file $(FULL_NOTES_FILE) \
	  --verify-tag send_later.xpi send_later_beta.xpi
	$(MAKE) update_beta_channel
.PHONY: gh_release

update_beta_channel:
	pipenv run dev/beta-channel-generator.py $(BETA_JSON) > $(BETA_JSON).tmp
	mv $(BETA_JSON).tmp $(BETA_JSON)
	@if git diff --exit-code $(BETA_JSON); then \
	  git commit -m "Update beta channel from GitHub" $(BETA_JSON); \
	  git push; \
	else echo "$(BETA_JSON) unchanged" 1>&2; exit 1; fi
.PHONY: update_beta_channel

beta: send_later_beta.xpi
clean:: ; rm -fr send_later_beta.xpi tmp
.PHONY: beta

send_later_beta.xpi: send_later.xpi
	rm -rf tmp $@.tmp
	mkdir tmp
	cd tmp && unzip -q ../send_later.xpi
	cd tmp && jq '.applications.gecko.update_url="https://raw.githubusercontent.com/Extended-Thunder/send-later/main/beta-channel.json"' manifest.json > manifest.json.tmp
	cd tmp && mv manifest.json.tmp manifest.json
	cd tmp && zip -q -r ../$@.tmp *
	mv $@.tmp $@

send_later_atn.xpi: send_later.xpi
	[ -n "$(MAX_GECKO_VERSION)" ]
	rm -rf $@.tmp tmp
	mkdir tmp
	cd tmp && unzip -q ../send_later.xpi
	cd tmp && jq '.applications.gecko.strict_max_version="$(MAX_GECKO_VERSION)"' manifest.json > manifest.json.tmp
	cd tmp && mv manifest.json.tmp manifest.json
	cd tmp && zip -q -r ../$@.tmp *
	mv $@.tmp $@

## Requires the Node 'addons-linter' package is installed
## npm install -g addons-linter
## Note: this will produce a lot of "MANIFEST_PERMISSIONS"
## warnings because the addons-linter assumes vanilla firefox target.
lint:
	addons-linter .

unit_test: $(RELEASE_FILES)
	@node test/run_tests.js 2>&1 \
		| sed -e '/^+ TEST'/s//"`printf '\033[32m+ TEST\033[0m'`"'/' \
		| sed -e '/^- TEST'/s//"`printf '\033[31m- TEST\033[0m'`"'/' \
		| sed -e 's/All \([0-9]*\) tests are passing!'/"`printf '\033[1m\033[32m'`"'All \1 tests are passing!'"`printf '\033[0m'`"/ \
		| sed -e 's/\([0-9]*\/[0-9]*\) tests failed.'/"`printf '\033[1m\033[31m'`"'\1 tests failed.'"`printf '\033[0m'`"/

test: lint unit_test
