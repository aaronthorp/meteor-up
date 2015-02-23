#!/bin/bash

## The nginx binary.
NGINX=$(which nginx)
[ -x $NGINX ] || exit 0

## The nginx configuration folder
if [ -d /usr/local/etc/nginx ]; then
    NGINX_CONF_DIR=/usr/local/etc/nginx
else
    NGINX_CONF_DIR=/etc/nginx
fi

## The paths for both nginx configuration files and the sites
## configuration files and symbolic link destinations.
AVAILABLE_SITES_PATH="$NGINX_CONF_DIR/sites-available"
ENABLED_SITES_PATH="$NGINX_CONF_DIR/sites-enabled"
AVAILABLE_SITES_DIR="sites-available"
SCRIPTNAME=${0##*/}

if grep "http://localhost:<%= appPort %>" $AVAILABLE_SITES_PATH/* --exclude=<%= appName %>.conf; then
    echo "The port <%= appPort %> is already configured on this server"
    exit 2
fi

if grep "server_name <%= appName %>" $AVAILABLE_SITES_PATH/* --exclude=<%= appName %>.conf; then
    echo "The hostname '<%= appName %>' is already configured on this server"
    exit 2
fi

SITE_AVAILABLE="$AVAILABLE_SITES_PATH/<%= appName %>.conf"
SITE_ENABLED="$ENABLED_SITES_PATH/<%= appName %>.conf"

if [ -r $SITE_AVAILABLE ]; then
  if [ -h $SITE_ENABLED ]; then
      ## If already enabled say it and exit.
      echo "$1 is already enabled."
  else # symlink if not yet enabled
      ln -s $SITE_AVAILABLE $SITE_ENABLED
  fi
  ## Test for a well formed configuration.
  echo "Testing nginx configuration..."
  $NGINX -t && STATUS=0
  if [ $STATUS ]; then
      echo -n "Site $1 has been enabled. "
  else
      exit 2
  fi
else
  echo "Site configuration file $1 not found."
  exit 3
fi

echo "Testing nginx configuration..."
$NGINX -t && STATUS=0
if [ $STATUS ]; then
    echo -n "Site $1 has been enabled. "
else
    exit 2
fi

sudo service nginx reload
