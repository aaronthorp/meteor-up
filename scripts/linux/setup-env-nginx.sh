#!/bin/bash

sudo mkdir -p /opt/<%= appName %>/
sudo mkdir -p /opt/<%= appName %>/config
sudo mkdir -p /opt/<%= appName %>/tmp

sudo mkdir -p /opt/<%= appName %>/ssl

sudo chown ${USER} /opt/<%= appName %> -R

sudo chmod o-w /usr/share/nginx/html/index.html
sudo chmod -R a+w /etc/nginx/sites-available/
sudo chmod -R a+w /etc/nginx/sites-enabled/
sudo chmod -R a+w /var/log/nginx/

sudo chown ${USER} /run/nginx.pid
sudo chmod u+rwx /run/nginx.pid
