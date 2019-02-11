#!/usr/bin/perl

use strict;
use warnings;

use File::Path 'make_path';
use JSON;

my %locale_dirs;

open(MANIFEST, "<", "chrome.manifest") or die;
while (<MANIFEST>) {
    next if (! /^locale\s+\S+\s+(\S+)\s+(\S+)/);
    $locale_dirs{$1} = $2;
}
close(MANIFEST) or die;

my($default_name, $default_description) = &load_locale($locale_dirs{'en-US'});

foreach my $locale (keys %locale_dirs) {
    my($name, $description) = &load_locale($locale_dirs{$locale}, $default_name,
                                           $default_description);
    &save_locale($locale, $name, $description);
}

sub load_locale {
    my($dir, $default_name, $default_description) = @_;
    my($name, $description);
    if (! open(PROP, "<:utf8", "$dir/prompt.properties")) {
        warn "Warning: No ${dir}prompt.properties\n";
        $name = $default_name;
    }
    else {
        while (<PROP>) {
            chomp;
            if (s/^MessageTag=//) {
                $name = $_;
                last;
            }
        }
        if (! $name) {
            warn "Warning: No MessageTag in ${dir}prompt.properties\n";
            $name = $default_name;
        }
        close(PROP) or die;
    }
    if (! open(PROP, "<:utf8", "$dir/sendlater3.properties")) {
        warn "Warning: No ${dir}sendlater3.properties\n";
        $description = $default_description;
    }
    else {
        while (<PROP>) {
            chomp;
            if (s/^extensions.sendlater3\@kamens.us.description=//) {
                $description = $_;
                last;
            }
        }
        if (! $description) {
            warn("Warning: No extensions.sendlater3\@kamens.us.description in ",
                 "${dir}sendlater3.properties\n");
            $description = $default_description;
        }
        close(PROP) or die;
    }
    return($name, $description);
}

sub save_locale {
    my($locale, $name, $description) = @_;
    my $data = {
        "appName" => {
            "message" => $name,
                "description" => "The name of the add-on, displayed in various places.",
        },
            "appDesc" => {
                "message" => $description,
                    "description" => "A short description of the add-on."
        },
    };
    make_path("_locales/$locale");
    open(JSON, ">", "_locales/$locale/messages.json") or die;
    print(JSON encode_json($data)) or die;
    close(JSON) or die;
}
