index.md: blog.kamens.us/send-later/index.html
	pandoc -t markdown -o "$@" -f html "$^"
	sed -i -e 's!https\S*blog.kamens.us/\S*/\([^'"'"'" <>?]*\)?[^'"'"'" <>]*!assets/\1!g' "$@"

#	grep -o 'https://[^"'"'"' ?<>#]*blog.kamens.us/[^"'"'"' ?<>#]*' "$^" | \
#		grep -v '/$$' | \
#		sed -e 's!/[^/]*$$!/!g' | \
#		grep -v '\.us$$' | \
#		sort -r | uniq | \
#		awk '{printf("sed -ie '"'"'s!%s!/assets/!g'"'"' '"$@"'\n",$$1)}' | \
#		xargs -l1
