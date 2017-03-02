#!/bin/bash

WHOAMI="$(basename "$0")"
INCLUDES=include-manifest
EXCLUDES=exclude-manifest
CHECK_OVERLAP=false
CHECK_EXTRA=false
CHECK_MISSING=false
EXIT_STATUS=0
TMP_PREFIX="/tmp/$WHOAMI.$$"

trap "rm -f $TMP_PREFIX.*" EXIT

while [ -n "$1" ] ; do
    case "$1" in
        "--includes") shift; INCLUDES="$1"; shift ;;
        "--excludes") shift; EXCLUDES="$1"; shift ;;
        "--overlap") shift; CHECK_OVERLAP=true; shift ;;
        "--extra") shift; CHECK_EXTRA=true; shift ;;
        "--missing") shift; CHECK_MISSING=true; shift ;;
        *) echo "Unrecognized argument: $1" 1>&2; exit 1 ;;
    esac
done

if ! ($CHECK_OVERLAP || $CHECK_EXTRA || $CHECK_MISSING); then
    echo "Must specify at least one of --overlap, --extra, --missing" 1>&2
    exit 1
fi

if [ ! -f "$INCLUDES" ]; then
    echo "Could not find $INCLUDES" 1>&2
    exit 1
fi

if [ ! -f "$EXCLUDES" ]; then
    echo "Could not find $EXCLUDES" 1>&2
    exit 1
fi

if $CHECK_OVERLAP; then
    if comm -12 <(sort -u "$INCLUDES") <(sort -u "$EXCLUDES") | grep .; then
        echo "The files listed above are in both $INCLUDES and $EXCLUDES." 1>&2
        EXIT_STATUS=1
    fi
fi

if $CHECK_EXTRA || $CHECK_MISSING; then
    DISK_LIST="$TMP_PREFIX.disk"

    find * \( \( -name '.??*' -o -name '*~' -o -name '.\#*' -o \
                 -name '*.xpi' -o -name '\#*' -o -name core -o \
                 -name '*.tmp' -o -name '*.pyc' \) -prune \) \
        -o -type f -print | sort > "$DISK_LIST"

    
    if $CHECK_EXTRA; then
        MERGED_LIST="$TMP_PREFIX.merged"
        sort -u -o "$MERGED_LIST" "$INCLUDES" "$EXCLUDES"
        if comm -13 "$MERGED_LIST" "$DISK_LIST" | grep .; then
            echo "The files listed above aren't in $INCLUDES or $EXCLUDES." 1>&2
            EXIT_STATUS=1
        fi
    fi

    if $CHECK_MISSING && comm -23 "$INCLUDES" "$DISK_LIST" | grep .; then
        echo "The files listed above are missing." 1>&2
        EXIT_STATUS=1
    fi
fi

exit $EXIT_STATUS
