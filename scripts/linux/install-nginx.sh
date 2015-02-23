#!/bin/bash

# Remove the lock
set +e
sudo rm /var/lib/dpkg/lock > /dev/null
sudo rm /var/cache/apt/archives/lock > /dev/null
sudo dpkg --configure -a
set -e

sudo apt-get update -y
sudo apt-get install nginx -y

# Restart nginx
sudo service nginx stop || :
sudo service nginx start
