SHELL=/bin/bash
export PYTHONPATH=$(CURDIR)

all: send_later.xpi

send_later.xpi: utils/check-locales.pl utils/propagate_strings.py \
    utils/check-accesskeys.py utils/check-locale-integration.py \
    utils/check-manifests.sh Makefile include-manifest exclude-manifest2 \
    $(shell ls $(shell cat include-manifest) 2>/dev/null)
	-rm -rf build
	./utils/check-manifests.sh --excludes exclude-manifest2 --overlap \
		--extra
	./utils/fix-addon-ids.pl --check
	./utils/make-manifest-locales.pl
	./utils/check-locale-integration.py
	mkdir build
	# Some locale files are generated dynamically below, and therefore
	# tar won't be able to find them here.
	tar c --files-from include-manifest \
          2> >(egrep -v '^tar: chrome/.*: No such file or directory|due to previous errors' \
               >/tmp/$@.errors) | tar -C build -x
	@if [ -s /tmp/$@.errors ]; then \
	    cat /tmp/$@.errors; \
	    exit 1; \
        fi
	@rm -f /tmp/$@.errors
	cd build; ../utils/check-locales.pl --replace
	cd build; ../utils/propagate_strings.py
	cd build; ../utils/check-accesskeys.py
	cd build; ../utils/check-manifests.sh --includes ../include-manifest \
	    --excludes ../exclude-manifest2 --missing --extra
	cd build; zip -q -r $@.tmp -@ < ../include-manifest
	mv build/$@.tmp $@

clean:: ; -rm -rf *.xpi *.tmp */*.pyc build
clean:: ; -rm -f exclude-manifest2

exclude-manifest2: exclude-manifest
	cat $< > $@.tmp
	echo $@ >> $@.tmp
	find contrib -type f >> $@.tmp
	mv -f $@.tmp $@

locale_import: crowdin.yaml
	crowdin-cli download translations
	sed -i -e '/^$$/d' $$(ls chrome/locale/*/* | grep -v /en-US/)
	sed -i -e 's/\(<!ENTITY [^ ]* \)  */\1/' \
	  $$(ls chrome/locale/*/*.dtd | grep -v /en-US/)
	sed -i -e '/^#X-Generator: crowdin.com/d' -e 's/\\\([#:!=]\)/\1/g' \
	  $$(ls chrome/locale/*/*.properties | grep -v /en-US/)
	wc -l chrome/locale/*/* | awk '$$1 == 1 {print $$2}' | \
	  xargs grep -l utf-8 | xargs --no-run-if-empty rm

locale_export: crowdin.yaml
	crowdin-cli upload sources

# Be very careful about this because it could mess with translation
# work in progress.
upload_translations:
	crowdin-cli upload translations --import-eq-suggestions

crowdin.yaml: crowdin.yaml.template
	set -e; echo -n "Enter Crowdin API key: "; read api_key; \
	sed -e "s/{{api_key}}/$$api_key/" $< > $@.tmp
	mv -f $@.tmp $@
