SHELL=/bin/bash
export PYTHONPATH=$(CURDIR)

all: send_later.xpi send_later-translatable.xpi

manifest: $(shell find . -type f \! -name manifest \! -name '*.xpi' -print) \
          chrome/content/backgroundingPostbox.xul
	find . \( \( -name '.??*' -o -name '*~' -o -name '.\#*' \
		-o -name '*,v' -o -name Makefile -o -name '*.xpi' \
		-o -name '\#*' -o -name '*.pl' -o -name core \
		-o -name '*.tmp' -o -name 'manifest' -o -name src \) -prune \) \
                -o -type f -print > $@.tmp
	mv $@.tmp $@

send_later.xpi: utils/check-locales.pl utils/propagate_strings.py \
    utils/check-accesskeys.py Makefile manifest
	./utils/fix-addon-ids.pl --check
	-rm -rf $@.tmp
	mkdir $@.tmp
	tar c --files-from manifest | tar -C $@.tmp -x
	cd $@.tmp; ../utils/check-locales.pl --replace
	cd $@.tmp; ../utils/propagate_strings.py
	cd $@.tmp; ../utils/check-accesskeys.py
	cd $@.tmp; zip -q -r $@.tmp -@ < ../manifest
	mv $@.tmp/$@.tmp $@
	rm -rf $@.tmp

translatable: send_later-translatable.xpi
.PHONY: translatable

send_later-translatable.xpi: Makefile manifest
	./utils/fix-addon-ids.pl --check
	rm -f $@.tmp
	zip -q -r $@.tmp -@ < manifest
	mv $@.tmp $@

clean: ; -rm -f *.xpi manifest chrome/content/backgroundingPostbox.xul

locale_import:
	crowdin-cli download translations
	sed -i -e '/^$$/d' $(ls chrome/locale/*/* | grep -v /en-US/)
	sed -i -e 's/\(<!ENTITY [^ ]* \)  */\1/' \
	  $(ls chrome/locale/*/*.dtd | grep -v /en-US/)
	sed -i -e '/^#X-Generator: crowdin.com/d' -e 's/\\\([#:!=]\)/\1/g' \
	  $(ls chrome/locale/*/*.properties | grep -v /en-US/)
	wc -l chrome/locale/*/* | awk '$$1 == 1 {print $$2}' | \
	  xargs grep -l utf-8 | xargs --no-run-if-empty rm

locale_export:
	crowdin-cli upload source
	crowdin-cli upload translations --auto-approve-imported \
	  --import-duplicates --import-eq-suggestions

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

