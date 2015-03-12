#!/bin/bash

sudo mkdir -p /opt/<%= appName %>/
sudo mkdir -p /opt/<%= appName %>/config
sudo mkdir -p /opt/<%= appName %>/tmp

sudo mkdir -p /opt/<%= appName %>/ssl

sudo chown ${USER} /opt/<%= appName %> -R
