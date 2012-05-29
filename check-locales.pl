#!/usr/bin/perl

use File::Basename;

$debug = 0;
$errors = 0;

@locales = glob("chrome/locale/*");
($master) = grep($_ eq "chrome/locale/en-US", @locales);
die if (! $master);
@locales = grep($_ ne $master, @locales);

for $file (map(basename($_), glob("$master/*.dtd"))) {
    &check_dtd($file);
}

for $file (map(basename($_), glob("$master/*.properties"))) {
    &check_properties($file);
}

exit($errors);

sub check_dtd {
    my($file) = @_;
    &check_generic($file, qr/^<!ENTITY\s+(\S+)/, qr/\&(?!quot)(?!;)/);
}

sub check_properties {
    my($file) = @_;
    &check_generic($file, qr/^([^=]+)=/, qr/\&(?!quot)(?!;)/);
}

sub check_generic {
    my($file, $pattern, $error_pattern) = @_;
    my(@keys);
    &debug("Reading $master/$file\n");
    open(MASTER, "<", "$master/$file") or die;
    while (<MASTER>) {
	next if (/^$/);
	next if (/-\*-.*-\*-/);
	if (! /$pattern/) {
	    die "Unrecognized line $. of $master/$file: $_";
	}
	push(@keys, $1);
	&debug("Read key $1 from $master/$file\n");
    }
    close(MASTER);
    foreach my $locale (@locales) {
	my(%keys);
	map($keys{$_}++, @keys);
	&debug("Checking $locale/$file\n");
	if (! open(SLAVE, "<", "$locale/$file")) {
	    warn "Can't open $locale/$file: $!\n";
	    $errors++;
	    next;
	}
	while (<SLAVE>) {
	    next if (/^$/);
	    next if (/-\*-.*-\*-/);
	    if ($error_pattern and /$error_pattern/) {
		warn "Bad content on line $. of $locale/$file: $_";
		$errors++;
	    }
	    if (! /$pattern/) {
		warn "Unrecognized line $. of $locale/$file: $_";
		$errors++;
		next;
	    }
	    my $key = $1;
	    if (! delete $keys{$key}) {
		warn "Extra or unrecognized key $key in $locale/$file\n";
		$errors++;
		next;
	    }
	    &debug("Good key $key in $locale/$file\n");
	}
	close(SLAVE);
	foreach my $key (sort keys %keys) {
	    warn "Missing key $key in $locale/$file\n";
	    $errors++;
	}
    }
}

sub debug {
    print(@_) if ($debug);
}
