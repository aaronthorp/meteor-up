var cjson = require('cjson');
var path = require('path');
var fs = require('fs');
var helpers = require('./helpers');
var format = require('util').format;

require('colors');

exports.read = function() {
  var mupJsonPath = path.resolve('mup.json');
  if(fs.existsSync(mupJsonPath)) {
    var mupJson = cjson.load(mupJsonPath);

    //initialize options
    mupJson.env = mupJson.env || {};

    if(typeof mupJson.setupNode === "undefined") {
      mupJson.setupNode = true;
    }
    if(typeof mupJson.setupPhantom === "undefined") {
      mupJson.setupPhantom = true;
    }
    if(typeof mupJson.setupNginx === "undefined") {
      mupJson.setupNginx = false;
    }
    mupJson.meteorBinary = (mupJson.meteorBinary) ? getCanonicalPath(mupJson.meteorBinary) : 'meteor';
    if(typeof mupJson.appName === "undefined") {
      mupJson.appName = "meteor";
    }
    if(typeof mupJson.enableUploadProgressBar === "undefined") {
      mupJson.enableUploadProgressBar = true;
    }

    // make sure a PORT and ROOT_URL is specified for Nginx config
    if (mupJson.setupNginx) {
      if (!mupJson.env['PORT'])
        mupErrorLog('PORT environment variable must be specified for a Nginx deploy');
      if (!mupJson.env['ROOT_URL'])
        mupErrorLog('ROOT_URL environment variable must be specified for a Nginx deploy');
    }

    //validating servers
    if(!mupJson.servers || mupJson.servers.length == 0) {
      mupErrorLog('Server information does not exist');
    } else {
      mupJson.servers.forEach(function(server) {
        var sshAgentExists = false;
        var sshAgent = process.env.SSH_AUTH_SOCK;
        if(sshAgent) {
          sshAgentExists = fs.existsSync(sshAgent);
          server.sshOptions = server.sshOptions || {};
          server.sshOptions.agent = sshAgent;
        }

        if(!server.host) {
          mupErrorLog('Server host does not exist');
        } else if(!server.username) {
          mupErrorLog('Server username does not exist');
        } else if(!server.password && !server.pem && !sshAgentExists) {
          mupErrorLog('Server password, pem or a ssh agent does not exist');
        } else if(!mupJson.app) {
          mupErrorLog('Path to app does not exist');
        }

        server.os = server.os || "linux";

        if(server.pem) {
          server.pem = rewriteHome(server.pem);
        }

        server.env = server.env || {};
        var defaultEndpointUrl =
          format("http://%s:%s", server.host, mupJson.env['PORT'] || 80);
        server.env['CLUSTER_ENDPOINT_URL'] =
          server.env['CLUSTER_ENDPOINT_URL'] || defaultEndpointUrl;

      });
    }

    //rewrite ~ with $HOME
    mupJson.app = rewriteHome(mupJson.app);

    if(mupJson.ssl) {

      if (mupJson.setupNginx) {
        mupJson.ssl.pem = path.resolve(rewriteHome(mupJson.ssl.pem));
        if(!fs.existsSync(mupJson.ssl.pem)) {
          mupErrorLog('Nginx SSL - pem file does not exist');
        }
        mupJson.ssl.key = path.resolve(rewriteHome(mupJson.ssl.key));
        if(!fs.existsSync(mupJson.ssl.key)) {
          mupErrorLog('Nginx SSL - key file does not exist');
        }
      } else {
        mupJson.ssl.backendPort = mupJson.ssl.backendPort || 80;
        mupJson.ssl.pem = path.resolve(rewriteHome(mupJson.ssl.pem));
        if(!fs.existsSync(mupJson.ssl.pem)) {
          mupErrorLog('stud SSL - pem file does not exist');
        }
      }
    }

    return mupJson;
  } else {
    console.error('mup.json file does not exist!'.red.bold);
    helpers.printHelp();
    process.exit(1);
  }
};

function rewriteHome(location) {
  if(/^win/.test(process.platform)) {
    return location.replace('~', process.env.USERPROFILE);
  } else {
    return location.replace('~', process.env.HOME);
  }
}

function mupErrorLog(message) {
  var errorMessage = 'Invalid mup.json file: ' + message;
  console.error(errorMessage.red.bold);
  process.exit(1);
}

function getCanonicalPath(location) {
  var localDir = path.resolve(__dirname, location);
  if(fs.existsSync(localDir)) {
    return localDir;
  } else {
    return path.resolve(rewriteHome(location));
  }
}
