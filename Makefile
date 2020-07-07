# Kludgey temporary workaround until Crowdin integration is fixed.
_locales: dev/migrate_locales.py
	mkdir -p "$@"
	git restore -s ef21bfd -- chrome/locale
	./dev/migrate_locales.py chrome/locale
	rm -rf chrome

send_later.xpi: $(shell find $(shell cat dev/include-manifest) 2>/dev/null)
	zip -q -r "$@" . -i@dev/include-manifest

## Requires the Node 'addons-linter' package is installed
## npm install -g addons-linter
## Note: this will produce a lot of "UNSUPPORTED_API" and "MANIFEST_PERMISSIONS"
## warnings because the addons-linter assumes vanilla firefox target.
lint:
	addons-linter .
