#!/usr/bin/perl -i

$last = "";

while (<>) {
    if ($ARGV ne $last and ! /coding:/) {
	if ($ARGV =~ /\.properties$/) {
	    print "# -*- coding: utf-8 -*-\n";
	}
	else {
	    print "<!-- -*- coding: utf-8 -*- -->\n";
	}
    }
    $last = $ARGV;
}
continue {
    print;
}
