SHELL=/bin/bash

all: send_later.xpi send_later-translatable.xpi

manifest: $(shell find . -type f \! -name manifest \! -name '*.xpi' -print)
	find . \( \( -name '.??*' -o -name '*~' -o -name '.\#*' \
		-o -name '*,v' -o -name Makefile -o -name '*.xpi' \
		-o -name '\#*' -o -name '*.pl' -o -name core \
		-o -name '*.tmp' -o -name 'manifest' \) -prune \) -o -type f -print >\
	    $@.tmp
	mv $@.tmp $@

send_later.xpi: check-locales.pl Makefile manifest
	./fix-addon-ids.pl --check
	-rm -rf $@.tmp
	mkdir $@.tmp
	tar c --files-from manifest | tar -C $@.tmp -x
	cd $@.tmp; ../check-locales.pl --replace
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

clean: ; -rm -f *.xpi manifest

locale_import: Send_Later_selected_locales_skipped.tar.gz
	tar -C chrome/locale -xzf $<
	./import-localized.pl
	./locale-headers.pl chrome/locale/*/*.{properties,dtd}
	rm -f chrome/locale/BZ_localized.txt $<
