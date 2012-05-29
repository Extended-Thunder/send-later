#!/usr/bin/perl

use strict;
use warnings;

# Tool to assist in making XUL ids compliant with Mozilla add-on
# standards by prefixing them properly.
#
# Run this in the top-level source directory of an add-on.
#
# Run it with "--check" to check for invalid ids without fixing
# anything. This can be used, e.g., from a Makefile to confirm that
# your add-on's ids are valid before packaging it.
#
# Create a file in this directory called ".ignore-ids" or "igore-ids"
# which contains, one per line, a list of ids which this script should
# ignore. Specify "--save-ignored" if you want the script to update
# the ignore file with the possibly modified list of ignored ids when
# it's done running.
#
# You can specify "--convert=before=after" to indicate a specific
# id translation explicitly on the command line.
#
# Modify the $prefix and $ok_regex variables and transform subrouting
# below.
#
# Written by Jonathan Kamens <jik@kamens.us>.
# Released into the public domain.
# Feel free to contact me with any questions, comments, suggestions,
# or concerns.

use File::Find;
use Getopt::Long;

# Regex indicating which ids should be left as-is.
my $ok_regex = qr/^[Ss]end[Ll]ater3[-_]/;

# Function to transform a not-ok id into an ok one. It must match
# $ok_regex when the transformation is complete! If this function
# returns undef, then $prefix will be prepended to the id.
sub transform {
    local($_) = @_;
    # return undef;
    s/^sl3[-_]/sendlater3-/ && return $_;
    s/^sendlater3?[-_]?/sendlater3-/ && return $_;
}

# Prefix to add to ids that don't match $ok_regex and aren't
# transformed by the transform function.
my $prefix = "sendlater3-";

my @ignore_files = qw/.ignore-ids ignore-ids/;

my(%ignore, %convert, %converted, $check_only, $save_ignored,
   $ignore_file, $ignore_changed, $scan_stopped);

die if (! GetOptions("check" => \$check_only,
		     "save-ignored" => \$save_ignored,
		     "convert=s%" => \%convert));

foreach my $convert (keys %convert) {
    die "Can't map multiple before ids to the same after id\n" 
	if ($converted{$convert});
    die "$convert{$convert} does not match $ok_regex\n"
	if ($convert{$convert} !~ /$ok_regex/o);
    $converted{$convert} = 1;
}

# First, read list of ids to ignore

for (@ignore_files) {
    next if (! -f $_);
    $ignore_file = $_;
    open(IGNORE, "<", $ignore_file) or die;
    while (<IGNORE>) {
	s/\s+$//;
	$ignore{$_} = 1;
    }
    close(IGNORE) or die;
    last;
}

if ($save_ignored and ! $ignore_file) {
    die("You can't specify --save-ignored unless one of @ignore_files\n",
	"already exists\n");
}

# Now, find ids in XUL files that need to be fixed

find({ wanted => \&scan_xul, no_chdir => 1 }, ".");

# Now do the fixing

if (%convert) {
    print "\nI am about to do the following id translations:\n\n";

    foreach my $id (sort keys %convert) {
	printf("  %-24s  %s\n", $id, $convert{$id});
    }

    while (1) {
	print "\nEnter 'y' to proceed or 'n' to abort: ";
	my $answer = <STDIN>;
	if ($answer =~ /^n/i) {
	    print "OK, aborting!\n";
	    exit;
	}
	elsif ($answer !~ /^y/i) {
	    print "That is not a valid answer!\n";
	    next;
	}
	last;
    }

    find({ wanted => \&fix_file, no_chdir => 1 }, ".");

    print "\nPlease examine the changes carefully for correctness!\n";
    print "This script might not make all necessary changes, especially if\n";
    print "you build ids dynamically in your JS code. It also might change\n";
    print "things that shouldn't have changed, e.g., if you have preference\n";
    print "names that are the same as ids.\n";
}
else {
    print "\nNothing to translate!\n";
}

if ($save_ignored && $ignore_changed) {
    open(NEW, ">", "$ignore_file.new") or die;
    map(print(NEW $_, "\n") || die, sort keys %ignore);
    close(NEW) or die;
    rename("$ignore_file.new", $ignore_file) or die;
    print "\nSaved new $ignore_file.\n";
}

sub scan_xul {
    my $xul_file = $_;
    local($_);

    return if ($xul_file !~ /\.xul$/i);
    if ($scan_stopped) {
	$File::Find::prune = 1;
	return;
    }

    open(XUL, "<", $xul_file) or die;
    line: while (<XUL>) {
	if (/\bid\s*=\s*[\"\']([^\"\']+)[\"\']/) {
	    my $id = $1;
	    next if ($id =~ /$ok_regex/o);
	    next if ($ignore{$id});
	    next if ($convert{$id});
	    if ($check_only) {
		die "Invalid id in $xul_file (line $.): $id\n";
	    }
	    if ($converted{$id}) {
		die("ERROR: Namespace conflict! Converted id $id conflicts ",
		    "with existing id in $xul_file (line $.).\n");
	    }
	    my $new = &transform($id);
	    if (! $new) {
		$new = "$prefix$id";
	    }
	    while (1) {
		print "At $xul_file line $.:\n";
		print "  $id -> $new\n";
		print "  Hit Enter for default new id, or 'i' to ignore this\n";
		print "  id, or enter a different new id, or 's' to stop\n";
		print "  searching for ids to change and process the changes\n";
		print "  that have already been specified: ";
		my $answer = <STDIN>;
		die if (! defined($answer));
		$answer =~ s/\s+$//;
		if (! $answer) {
		    $convert{$id} = $new;
		    $converted{$new} = 1;
		}
		elsif ($answer eq "s") {
		    $scan_stopped = 1;
		    last line;
		}
		elsif ($answer eq "i") {
		    $ignore{$id} = 1;
		    $ignore_changed = 1;
		}
		elsif ($answer !~ /$ok_regex/o) {
		    print "$answer does not match $ok_regex\n";
		    next;
		}
		else {
		    $convert{$id} = $answer;
		    $converted{$new} = 1;
		}
		last;
	    }
	}
    }
    close(XUL) or die;
}

sub fix_file {
    my($file) = $_;
    local($/) = undef;
    local($_);
    return if ($file !~ /\.(?:xul|js)$/i);

    open(FILE, "<", $file) or die;
    local $_ = <FILE>;
    close(FILE) or die;

    my $orig = $_;
    foreach my $id (keys %convert) {
	s/([\"\'])$id([\"\'])/$1 . $convert{$id} . $2/eg;
    }

    if ($orig ne $_) {
	open(NEW, ">", "$file.new") or die;
	print(NEW $_) or die;
	close(NEW) or die;
	rename("$file.new", $file) or die;
	print "Updated $file\n";
    }
}
