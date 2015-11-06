var nodemiral = require('nodemiral');
var fs = require('fs');
var path = require('path');
var util = require('util');

var SCRIPT_DIR = path.resolve(__dirname, '../../scripts/linux');
var TEMPLATES_DIR = path.resolve(__dirname, '../../templates/linux');

exports.setup = function(config) {
  var taskList = nodemiral.taskList('Setup (linux)');

  // Installation
  if(config.setupNode) {
    taskList.executeScript('Installing Node.js', {
      script: path.resolve(SCRIPT_DIR, 'install-node.sh'),
      vars: {
        nodeVersion: config.nodeVersion
      }
    });
  }

  if(config.setupPhantom) {
    taskList.executeScript('Installing PhantomJS', {
      script: path.resolve(SCRIPT_DIR, 'install-phantomjs.sh')
    });
  }

  if(config.setupNginx) {
    taskList.executeScript('Installing Nginx', {
      script: path.resolve(SCRIPT_DIR, 'install-nginx.sh')
    });

    taskList.copy('Configuring Nginx', {
      src: path.resolve(TEMPLATES_DIR, 'index.html'),
      dest: '/usr/share/nginx/html/index.html'
    });

  }

  taskList.executeScript('Setting up Environment', {
    script: path.resolve(SCRIPT_DIR, 'setup-env.sh'),
    vars: {
      appName: config.appName
    }
  });

  if(config.setupMongo) {
    taskList.copy('Copying MongoDB configuration', {
      src: path.resolve(TEMPLATES_DIR, 'mongodb.conf'),
      dest: '/etc/mongodb.conf'
    });

    taskList.executeScript('Installing MongoDB', {
      script: path.resolve(SCRIPT_DIR, 'install-mongodb.sh')
    });
  }

  if(config.ssl) {
    if (!config.setupNginx) {
      installStud(taskList);
      configureStud(taskList, config.ssl.pem, config.ssl.backendPort);
    }
  }

  //Configurations
  taskList.copy('Configuring upstart', {
    src: path.resolve(TEMPLATES_DIR, 'meteor.conf'),
    dest: '/etc/init/' + config.appName + '.conf',
    vars: {
      appName: config.appName
    }
  });

  return taskList;
};

exports.deploy = function(bundlePath, env, deployCheckWaitTime, appName, setupNginx, ssl, enableUploadProgressBar) {
  var taskList = nodemiral.taskList("Deploy app '" + appName + "' (linux)");

  if (setupNginx) {
    //configure nginx

    taskList.executeScript('Setting up Environment for "'+appName+'"', {
      script: path.resolve(SCRIPT_DIR, 'setup-env-nginx.sh'),
      vars: {
        appName: appName
      }
    });

    //Configurations for upstart for different app
    taskList.copy('Configuring upstart for "'+appName+'"', {
      src: path.resolve(TEMPLATES_DIR, 'meteor.conf'),
      dest: '/etc/init/' + appName + '.conf',
      vars: {
        appName: appName
      }
    });

    if (ssl) {

      taskList.copy('Uploading Nginx PEM file', {
        src: ssl.pem,
        dest: '/opt/' + appName + '/ssl/nginx.pem'
      });

      taskList.copy('Uploading Nginx KEY file', {
        src: ssl.key,
        dest: '/opt/' + appName + '/ssl/nginx.key'
      });

    }

    // Different nginx script if it is using SSL
    var nginxConf = "nginx.conf";
    if (ssl)
      nginxConf = "nginx_ssl.conf";

    taskList.copy('Configuring Nginx (App Instance)', {
      src: path.resolve(TEMPLATES_DIR, nginxConf),
      dest: '/etc/nginx/sites-available/' + appName + '.conf',
      vars: {
        appName: appName,
        appPort: env['PORT'],
        appRoot: env['ROOT_URL'].replace(/.*?:\/\//g, ""),
        hostName: ((env['ROOT_URL']).match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i) || [,''])[1]
      }
    });

    taskList.executeScript('Configuring Nginx (Enabling Site)', {
      script: path.resolve(SCRIPT_DIR, 'setup-nginx.sh'),
      vars: {
        appPort: env['PORT'],
        appName: appName
      }
    });

  }

  taskList.copy('Uploading bundle', {
    src: bundlePath,
    dest: '/opt/' + appName + '/tmp/bundle.tar.gz',
    progressBar: enableUploadProgressBar
  });

  taskList.copy('Setting up Environment Variables', {
    src: path.resolve(TEMPLATES_DIR, 'env.sh'),
    dest: '/opt/' + appName + '/config/env.sh',
    vars: {
      env: env || {},
      appName: appName
    }
  });

  // deploying
  taskList.executeScript('Invoking deployment process', {
    script: path.resolve(TEMPLATES_DIR, 'deploy.sh'),
    vars: {
      deployCheckWaitTime: deployCheckWaitTime || 10,
      appName: appName
    }
  });

  return taskList;
};

exports.reconfig = function(env, appName, setupNginx) {
  var taskList = nodemiral.taskList("Updating configurations (linux)");

  if (setupNginx) {
    //configure nginx

    taskList.executeScript('Setting up Environment', {
      script: path.resolve(SCRIPT_DIR, 'setup-env-nginx.sh'),
      vars: {
        appName: appName
      }
    });

    taskList.copy('Configuring Nginx (App Instance)', {
      src: path.resolve(TEMPLATES_DIR, 'nginx.conf'),
      dest: '/etc/nginx/sites-available/' + appName + '.conf',
      vars: {
        appName: appName,
        appPort: env['PORT'] || 80,
        appRoot: env['ROOT_URL'].replace(/.*?:\/\//g, "")
      }
    });

    taskList.executeScript('Configuring Nginx (Enabling Site)', {
      script: path.resolve(SCRIPT_DIR, 'setup-nginx.sh'),
      vars: {
        appName: appName
      }
    });

  }

  taskList.copy('Setting up Environment Variables', {
    src: path.resolve(TEMPLATES_DIR, 'env.sh'),
    dest: '/opt/' + appName + '/config/env.sh',
    vars: {
      env: env || {},
      appName: appName
    }
  });

  //restarting
  taskList.execute('Restarting app', {
    command: '(sudo stop ' + appName + ' || :) && (sudo start ' + appName + ')'
  });

  if (setupNginx) {
    //configure nginx
    taskList.copy('Configuring Nginx (App Instance)', {
      src: path.resolve(TEMPLATES_DIR, 'nginx.conf'),
      dest: '/etc/nginx/sites-available/' + appName + '.conf',
      vars: {
        appPort: env['PORT'] || 80,
        appRoot: env['ROOT_URL'].replace(/.*?:\/\//g, "")
      }
    });

    taskList.executeScript('Configuring Nginx (Enabling Site)', {
      script: path.resolve(SCRIPT_DIR, 'setup-nginx.sh'),
      vars: {
        appName: appName
      }
    });

  }

  return taskList;
};

exports.restart = function(appName) {
  var taskList = nodemiral.taskList("Restarting Application (linux)");

  //restarting
  taskList.execute('Restarting app', {
    command: '(sudo stop ' + appName + ' || :) && (sudo start ' + appName + ')'
  });

  return taskList;
};

exports.stop = function(appName) {
  var taskList = nodemiral.taskList("Stopping Application (linux)");

  //stopping
  taskList.execute('Stopping app', {
    command: '(sudo stop ' + appName + ')'
  });

  return taskList;
};

exports.start = function(appName) {
  var taskList = nodemiral.taskList("Starting Application (linux)");

  //starting
  taskList.execute('Starting app', {
    command: '(sudo start ' + appName + ')'
  });

  return taskList;
};

function installStud(taskList) {
  taskList.executeScript('Installing Stud', {
    script: path.resolve(SCRIPT_DIR, 'install-stud.sh')
  });
}

function configureStud(taskList, pemFilePath, port) {
  var backend = {host: '127.0.0.1', port: port};

  taskList.copy('Configuring Stud for Upstart', {
    src: path.resolve(TEMPLATES_DIR, 'stud.init.conf'),
    dest: '/etc/init/stud.conf'
  });

  taskList.copy('Configuring SSL', {
    src: pemFilePath,
    dest: '/opt/stud/ssl.pem'
  });


  taskList.copy('Configuring Stud', {
    src: path.resolve(TEMPLATES_DIR, 'stud.conf'),
    dest: '/opt/stud/stud.conf',
    vars: {
      backend: util.format('[%s]:%d', backend.host, backend.port)
    }
  });

  taskList.execute('Verifying SSL Configurations (ssl.pem)', {
    command: 'stud --test --config=/opt/stud/stud.conf'
  });

  //restart stud
  taskList.execute('Starting Stud', {
    command: '(sudo stop stud || :) && (sudo start stud || :)'
  });
}
