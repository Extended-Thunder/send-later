SHELL=/bin/bash
export PYTHONPATH=$(CURDIR)

all: send_later.xpi

send_later.xpi: utils/check-locales.pl utils/propagate_strings.py \
    utils/check-accesskeys.py utils/check-locale-integration.py \
    utils/check-manifests.sh Makefile include-manifest exclude-manifest \
    chrome/content/backgroundingPostbox.xul \
    $(shell ls $(shell cat include-manifest) 2>/dev/null)
	./utils/check-manifests.sh --overlap --extra
	./utils/fix-addon-ids.pl --check
	./utils/check-locale-integration.py
	-rm -rf $@.tmp
	mkdir $@.tmp
	# Some locale files are generated dynamically below, and therefore
	# tar won't be able to find them here.
	tar c --files-from include-manifest \
          2> >(egrep -v '^tar: chrome/.*: No such file or directory|due to previous errors' \
               >/tmp/$@.errors) | tar -C $@.tmp -x
	@if [ -s /tmp/$@.errors ]; then \
	    cat /tmp/$@.errors; \
	    exit 1; \
        fi
	@rm -f /tmp/$@.errors
	cd $@.tmp; ../utils/check-locales.pl --replace
	cd $@.tmp; ../utils/propagate_strings.py
	cd $@.tmp; ../utils/check-accesskeys.py
	cd $@.tmp; ../utils/check-manifests.sh --includes ../include-manifest \
	    --excludes ../exclude-manifest --missing
	cd $@.tmp; zip -q -r $@.tmp -@ < ../include-manifest
	mv $@.tmp/$@.tmp $@
	rm -rf $@.tmp

clean: ; -rm -f *.xpi *.tmp */*.pyc chrome/content/backgroundingPostbox.xul

locale_import: crowdin.yaml
	crowdin-cli download translations
	sed -i -e '/^$$/d' $(shell ls chrome/locale/*/* | grep -v /en-US/)
	sed -i -e 's/\(<!ENTITY [^ ]* \)  */\1/' \
	  $(shell ls chrome/locale/*/*.dtd | grep -v /en-US/)
	sed -i -e '/^#X-Generator: crowdin.com/d' -e 's/\\\([#:!=]\)/\1/g' \
	  $(shell ls chrome/locale/*/*.properties | grep -v /en-US/)
	wc -l chrome/locale/*/* | awk '$$1 == 1 {print $$2}' | \
	  xargs grep -l utf-8 | xargs --no-run-if-empty rm

locale_export: crowdin.yaml
	crowdin-cli upload source
	crowdin-cli upload translations --auto-approve-imported \
	  --import-duplicates --import-eq-suggestions

crowdin.yaml: crowdin.yaml.template
	set -e; echo -n "Enter Crowdin API key: "; read api_key; \
	sed -e "s/{{api_key}}/$$api_key/" $< > $@.tmp
	mv -f $@.tmp $@

locale_import.babelzilla: Send_Later_selected_locales_skipped.tar.gz
	tar -C chrome/locale -xzf $<
	./utils/import-localized.pl
	./utils/locale-headers.pl chrome/locale/*/*.{properties,dtd}
	rm -f chrome/locale/BZ_localized.txt $<

chrome/content/backgroundingPostbox.xul: chrome/content/backgrounding.xul
	sed -e 's/statusbar id="status-bar"/vbox id="folderPaneBox"/' \
            -e 's,</statusbar>,</vbox>,' $< > $@.tmp
	! cmp -s $< $@.tmp
	mv -f $@.tmp $@
