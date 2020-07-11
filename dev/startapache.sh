#!/bin/bash

## Developing the UI bits is much easier in a browser, rather than needing to
## repeatedly reload the addon in thunderbird. This script spins up a
## lightweight apache container, and uses it to host the addon as a webpage.
##
## To use it, run: `./startapache.sh start`
## and then point a browser at http://localhost:8081/ui/popup.html or
## http://localhost:8081/ui/options.html

case "$1" in
    'start')
        rootdir=$(readlink -f $(dirname $0)/../)
        docker run -dit --name my-apache-app -p 8081:80 \
          -v "$rootdir":/usr/local/apache2/htdocs/ httpd:2.4
        ;;
    'stop')
        docker stop my-apache-app
        docker rm my-apache-app
        ;;
    'restart')
        $0 stop
        $0 start
        ;;
    *)
        echo "Command not recognized: $1"
esac
