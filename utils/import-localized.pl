#!/usr/bin/perl

use FindBin;

chdir($FindBin::Bin) or die;

open(LOCALIZED, "<:utf8", "chrome/locale/BZ_localized.txt") or die;

while (<LOCALIZED>) {
    if (m,<em:locale>(.*)</em:locale>,) {
	$locale = $1;
	next;
    }
    if (m,<em:description>(.*)</em:description>,) {
	die if (! $locale);
	$descriptions{$locale} = $1;
	$locale = undef;
	next;
    }
}
close(LOCALIZED);

open(NEW, ">:utf8", "install.rdf.new") or die;
open(OLD, "<:utf8", "install.rdf") or die;

$locale = undef;
while (<OLD>) {
    if (/<em:localized>/) {
	$started = 1;
	next;
    }
    next if (! $started);
    if (m,<em:locale>(.*)</em:locale>,) {
	$locale = $1;
	next;
    }
    if (m,<em:description>(.*)</em:description>,) {
	die if (! $locale);
	$old = $1;
	$new = $descriptions{$locale};
	if ($new) {
	    if ($old eq $new) {
		warn "Locale $locale unchanged\n";
	    }
	    else {
		warn "Locale $locale changed\n";
		$changed = 1;
		s,(<em:description>).*(</em:description>),$1$new$2,;
	    }
	}
	else {
	    warn "$locale missing from BZ_localized.txt\n";
	}
    }
}
continue {
    print(NEW) or die;
}

close(OLD) or die;
close(NEW) or die;

if ($changed) {
    rename("install.rdf.new", "install.rdf") or die;
}
else {
    unlink("install.rdf.new");
}
