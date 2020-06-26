# Kludgey temporary workaround until Crowdin integration is fixed.
_locales:
	mkdir "$@"
	git restore -s ef21bfd -- chrome/locale
	./dev/migrate_locales.py chrome/locale
	rm -rf chrome

send_later.xpi: $(shell find $(shell cat dev/include-manifest) 2>/dev/null)
	zip -q -r "$@" . -i@dev/include-manifest
