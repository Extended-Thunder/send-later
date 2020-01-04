#!/bin/bash -e

if grep -q -s ShowAllBodyParts chrome.manifest &>/dev/null; then
    key=ShowAllBodyParts
elif grep -q -s FolderPaneSwitcher chrome.manifest &>/dev/null; then
    key=FolderPaneSwitcher
elif grep -q -s IMAPReceivedDate chrome.manifest &>/dev/null; then
    key=IMAPReceivedDate
elif grep -q -s EnhancedPriorityDisplay chrome.manifest &>/dev/null; then
    key=EnhancedPriorityDisplay
elif grep -q -s reply-to-multiple-messages chrome.manifest &>/dev/null; then
    key=reply-to-multiple-messages
elif grep -q -s togglereplied chrome.manifest &>/dev/null; then
    key=togglereplied
elif grep -q -s userchromejs chrome.manifest &>/dev/null; then
    key=userchromejs
else
    echo "I don't know which add-on I'm in." 1>&2
    exit 1
fi

content_dir=$(awk "/^content.*$key.*content/ {print \$3}" chrome.manifest)
content_dir=${content_dir%/}
if [ ! "$content_dir" ]; then
    echo "Could not find content directory in chrome.manifest" 1>&2
    exit 1
fi

english_dir=$(awk "/^locale.*(en-US| en )/ {print \$4}" chrome.manifest)
english_dir=${english_dir%/}
ld=${english_dir%-US}
ld=${ld%/en}
if [ ! "$content_dir" ]; then
    echo "Could not find locale directory in chrome.manifest" 1>&2
    exit 1
fi

cd send-later
make &> /dev/null
cd ..
status=0
for slocale in $(cd send-later/build/chrome/locale && ls); do
    tlocale=$slocale
    if [ ! -d $ld/$tlocale -a -d $ld/${tlocale%-*} ]; then
        tlocale=${tlocale%-*}
    fi
    mkdir -p $ld/$tlocale
    for file in $(cd $english_dir && ls | grep -v kickstarter 2>/dev/null); do
        test -f $ld/$tlocale/$file || cp $english_dir/$file $ld/$tlocale
    done
    if [ -d _locales/$tlocale ]; then
        ld2=$tlocale
    else
        ld2=en-US
    fi
    fromname1="Send Later"
    fromname2=$(sed -n -e 's/^MessageTag=//p' \
                    send-later/build/chrome/locale/$slocale/prompt.properties)
    if [ ! "$fromname2" ]; then
        echo Could not find Send Later name for $slocale 1>&2
        status=1
        continue
    fi
    if [ -d _locales ]; then
        toname=$(jq -r .appName.message _locales/$ld2/messages.json)
    else
        toname=$(jq -r .name manifest.json)
    fi
    sed -e "s/$fromname1/$toname/" -e "s/$fromname2/$toname/" \
        send-later/build/chrome/locale/$slocale/kickstarter.dtd > \
        $ld/$tlocale/kickstarter.dtd
    if [ $(diff {send-later/build/chrome/locale/$slocale,$ld/$tlocale}/kickstarter.dtd | \
                grep -c '^>') -lt 2 ]; then
        echo Name substitution in kickstarter.dtd for $slocale failed 1>&2
        status=1
        continue
    fi
    if ! grep -q -s -w $tlocale chrome.manifest; then
        echo locale $key $tlocale $ld/$tlocale/ >> \
             chrome.manifest
    fi
    cp send-later/build/chrome/resource/kickstarter.jsm $content_dir/.
    sed -e "s/sendlater3/$key/" \
        send-later/build/chrome/content/kickstarter.xul > \
        $content_dir/kickstarter.xul
done

exit $status
