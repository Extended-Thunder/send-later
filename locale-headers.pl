#!/usr/bin/perl -i

@ARGV = glob("chrome/locale/*/*.{properties,dtd}");

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
