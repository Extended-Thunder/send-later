SHELL=/bin/bash

LOCALE_DIRS=$(filter-out %/en-US,$(wildcard chrome/locale/*))
LOCALE_FILES=$(foreach dir,$(LOCALE_DIRS),$(wildcard $(dir)/*))

all: send_later.xpi send_later-translatable.xpi

manifest: $(shell find . -type f \! -name manifest \! -name '*.xpi' -print) \
          chrome/content/backgroundingPostbox.xul
	find . \( \( -name '.??*' -o -name '*~' -o -name '.\#*' \
		-o -name '*,v' -o -name Makefile -o -name '*.xpi' \
		-o -name '\#*' -o -name '*.pl' -o -name core \
		-o -name '*.tmp' -o -name 'manifest' -o -name src \) -prune \) \
                -o -type f -print > $@.tmp
	mv $@.tmp $@

send_later.xpi: check-locales.pl Makefile manifest
	./fix-addon-ids.pl --check
	-rm -rf $@.tmp
	mkdir $@.tmp
	tar c --files-from manifest | tar -C $@.tmp -x
	cd $@.tmp; ../check-locales.pl --replace
	cd $@.tmp; ../propagate_strings.py
	cd $@.tmp; ../check-accesskeys.py
	cd $@.tmp; zip -q -r $@.tmp -@ < ../manifest
	mv $@.tmp/$@.tmp $@
	rm -rf $@.tmp

translatable: send_later-translatable.xpi
.PHONY: translatable

send_later-translatable.xpi: Makefile manifest
	./fix-addon-ids.pl --check
	rm -f $@.tmp
	zip -q -r $@.tmp -@ < manifest
	mv $@.tmp $@

clean: ; -rm -f *.xpi manifest chrome/content/backgroundingPostbox.xul

locale_import:
	crowdin-cli download translations
	sed -i -e '/^$$/d' $(LOCALE_FILES)
	sed -i -e 's/\(<!ENTITY [^ ]* \)  */\1/' $(filter %.dtd,$(LOCALE_FILES))
	sed -i -e '/^#X-Generator: crowdin.com/d' -e 's/\\\([#:!=]\)/\1/g' \
		$(filter %.properties,$(LOCALE_FILES))

locale_import.babelzilla: Send_Later_selected_locales_skipped.tar.gz
	tar -C chrome/locale -xzf $<
	./import-localized.pl
	./locale-headers.pl chrome/locale/*/*.{properties,dtd}
	rm -f chrome/locale/BZ_localized.txt $<

chrome/content/backgroundingPostbox.xul: chrome/content/backgrounding.xul
	sed -e 's/statusbar id="status-bar"/vbox id="folderPaneBox"/' \
            -e 's,</statusbar>,</vbox>,' $< > $@.tmp
	! cmp -s $< $@.tmp
	mv -f $@.tmp $@

