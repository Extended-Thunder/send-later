# Assumes that there is a copy of the legacy send later code in a sibling
# directory called `send-later-legacy`. Kludgey temporary workaround.
_locales:
	mkdir "$@"
	./dev/migrate_locales.py ../send-later-legacy/chrome/locale

send_later.xpi: $(shell find $(shell cat dev/include-manifest) 2>/dev/null)
	zip -q -r "$@" . -i@dev/include-manifest
