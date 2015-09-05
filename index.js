var chalk = require('chalk');

module.exports = {
  name: 'ember-cli-content-security-policy',

  config: function(environment /*, appConfig */) {
    var ENV = {
      contentSecurityPolicyHeader: 'Content-Security-Policy-Report-Only',
      contentSecurityPolicy: {
        'default-src': ["'none'"],
        'script-src': ["'self'"],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'img-src': ["'self'"],
        'style-src': ["'self'"],
        'media-src': ["'self'"]
      }
    };

    if (environment === 'development') {
      ENV.contentSecurityPolicy['script-src'].push("'unsafe-eval'");
    }

    return ENV;
  },

  serverMiddleware: function(config) {
    var app = config.app;
    var options = config.options;
    var project = options.project;
    var ui = this.ui;

    // provide compatibility with the string format
    function directiveStringsToLists(headerConfig) {
      Object.keys(headerConfig).forEach(function(key) {
        var policy = headerConfig[key];
        if ( typeof policy === "string" || policy instanceof String ) {
          ui.writeLine(chalk.yellow('Warning: Content Security Policy'));
          ui.writeLine(chalk.yellow('Deprecated string format for: ' + key));
          ui.writeLine(chalk.yellow('Use an array of strings instead.'));
          headerConfig[key] = policy.split(/ +/);
        }
      });
     
      return headerConfig;
    };

    app.use(function(req, res, next) {
      var appConfig = project.config(options.environment);

      var header = appConfig.contentSecurityPolicyHeader;
      var headerConfig = directiveStringsToLists(appConfig.contentSecurityPolicy);
      var normalizedHost = options.host === '0.0.0.0' ? 'localhost' : options.host;

      if (options.liveReload) {
        ['localhost', '0.0.0.0'].forEach(function(host) {
          headerConfig['connect-src'].push('ws://' + host + ':' + options.liveReloadPort);
          headerConfig['script-src'].push(host + ':' + options.liveReloadPort);
        });
      }

      if (header.indexOf('Report-Only')!==-1 && !('report-uri' in headerConfig)) {
        headerConfig['connect-src'].push('http://' + normalizedHost + ':' + options.port + '/csp-report');
        headerConfig['report-uri'] = ['http://' + normalizedHost + ':' + options.port + '/csp-report'];
      }

      var headerValue = Object.keys(headerConfig).reduce(function(memo, value) {
        var flattenedList = headerConfig[value].reduce(function(preV, curV) {
          return preV + ' ' + curV;
        }, '');

        return memo + value + ' ' + flattenedList + '; ';
      }, '');

      if (!header || !headerValue) {
        next();
        return;
      }

      res.removeHeader("Content-Security-Policy");
      res.removeHeader("X-Content-Security-Policy");

      res.removeHeader('Content-Security-Policy-Report-Only');
      res.removeHeader('X-Content-Security-Policy-Report-Only');

      res.setHeader(header, headerValue);
      res.setHeader('X-' + header, headerValue);

      next();
    });

    var bodyParser = require('body-parser');
    app.use('/csp-report', bodyParser.json({type:'application/csp-report'}));
    app.use('/csp-report', bodyParser.json({type:'application/json'}));
    app.use('/csp-report', function(req, res, next) {
      console.log(chalk.red('Content Security Policy violation:') + '\n\n' + JSON.stringify(req.body, null, 2));
      res.send({status:'ok'});
    });
  }
};
