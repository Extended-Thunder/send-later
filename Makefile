all: send_later.xpi send_later-translatable.xpi

CMD=find . \( -name '.??*' -prune \) -o \! -name '*~' \
    \! -name '.\#*' \! -name '*,v' \! -name Makefile \! -name '*.xpi' \
    \! -name '\#*' \! -name '*.pl' \! -name core -type f -print
FILES=$(shell $(CMD))

send_later.xpi: $(FILES) check-locales.pl
	./check-locales.pl
	./fix-addon-ids.pl --check
	rm -f $@.tmp
	zip -r $@.tmp $(FILES)
	mv $@.tmp $@

translatable: send_later-translatable.xpi
.PHONY: translatable

send_later-translatable.xpi: $(FILES)
	./fix-addon-ids.pl --check
	rm -f $@.tmp
	zip -r $@.tmp $(FILES)
	mv $@.tmp $@

clean: ; -rm -f *.xpi

locale_import: Send_Later_selected_locales_skipped.tar.gz
	tar -C chrome/locale -xzf $<
	./import-localized.pl
	./locale-headers.pl
	rm -f chrome/locale/BZ_localized.txt $<
