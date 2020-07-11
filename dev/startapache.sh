#!/bin/bash

case "$1" in
    'start')
        rootdir=`readlink -f ../`
        docker run -dit --name my-apache-app -p 8081:80 -v "$rootdir":/usr/local/apache2/htdocs/ httpd:2.4
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
