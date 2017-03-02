SHELL=/bin/bash
export PYTHONPATH=$(CURDIR)

all: send_later.xpi

check-manifest: chrome/content/backgroundingPostbox.xul
	@if comm -12 <(sort -u include-manifest) <(sort -u exclude-manifest) | \
	   grep .; then \
	    echo "Files listed above in both include-and exclude-manifest!" 1>&2; \
	    exit 1; \
	fi
	@rm -f $@.tmp
	@find * \( \( -name '.??*' -o -name '*~' -o -name '.\#*' \
		-o -name '*.xpi' -o -name '\#*' -o -name core \
		-o -name '*.tmp' -o -name '*.pyc' \) -prune \) \
	-o -type f -print | sort > $@.tmp
	@if comm -13 <(sort -u include-manifest exclude-manifest) $@.tmp | \
	   grep .; then \
	    echo "Files listed above not in include-/exclude-manifest!" 1>&2; \
	    exit 1; \
	fi
	@if comm -23 <(sort -u include-manifest exclude-manifest) $@.tmp | \
	   grep .; then \
	    echo "Nonexistent files listed above in include-/exclude-manifest!" 1>&2; \
	    exit 1; \
	fi
	@rm -f $@.tmp
.PHONY: check-manifest

send_later.xpi: utils/check-locales.pl utils/propagate_strings.py \
    utils/check-accesskeys.py utils/check-locale-integration.py Makefile \
    check-manifest
	./utils/fix-addon-ids.pl --check
	./utils/check-locale-integration.py
	-rm -rf $@.tmp
	mkdir $@.tmp
	tar c --files-from include-manifest | tar -C $@.tmp -x
	cd $@.tmp; ../utils/check-locales.pl --replace
	cd $@.tmp; ../utils/propagate_strings.py
	cd $@.tmp; ../utils/check-accesskeys.py
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
