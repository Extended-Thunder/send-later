index.md: blog.kamens.us/send-later/index.html
	pandoc -t markdown -o "$@" -f html "$^"
	sed -i -e 's!https\S*blog.kamens.us/\S*/\([^'"'"'" <>?]*\)?[^'"'"'" <>]*!assets/\1!g' "$@"

blog.kamens.us/send-later/index.html:
	mkdir -p "blog.kamens.us/send-later"
	cd "blog.kamens.us/send-later"
	wget --convert-links https://blog.kamens.us/send-later/index.html

blog.kamens.us/send-later/converted.md: blog.kamens.us/send-later/index.html
	pandoc -t markdown -o "$@" -f html "$^"

assets: blog.kamens.us/send-later/converted.md
	cd assets; \
		grep -o 'http[^)]*blog.kamens.us[^)" #]*' ../blog.kamens.us/send-later/converted.md | \
		sed -e 's/, .*//' | sed 's/ .*//' | sed 's/\?.*//' | sort | \
		uniq | grep '/[^/]*\.[^/]*$' | xargs wget
	find 'blog.kamens.us' -type f | xargs file | grep 'image data' | \
		sed 's/: .*//' | while read f; do mv "$f" assets/; done
