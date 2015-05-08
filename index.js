var _headerData = function(appConfig, options) {
  if (!options) {
    options = {};
  }

  var header = appConfig.contentSecurityPolicyHeader;
  var headerConfig = appConfig.contentSecurityPolicy;
  var normalizedHost = options.host === '0.0.0.0' ? 'localhost' : options.host;

  if (options.liveReload) {
    ['localhost', '0.0.0.0'].forEach(function(host) {
      headerConfig['connect-src'] = headerConfig['connect-src'] + ' ws://' + host + ':' + options.liveReloadPort;
      headerConfig['script-src'] = headerConfig['script-src'] + ' ' + host + ':' + options.liveReloadPort;
    });
  }

  if (header.indexOf('Report-Only')!==-1 && !('report-uri' in headerConfig)) {
    headerConfig['connect-src'] = headerConfig['connect-src'] + ' http://' + normalizedHost + ':' + options.port + '/csp-report';
    headerConfig['report-uri'] = 'http://' + normalizedHost + ':' + options.port + '/csp-report';
  }

  var headerValue = Object.keys(headerConfig).reduce(function(memo, value) {
    return memo + value + ' ' + headerConfig[value] + '; ';
  }, '');

  if (!header || !headerValue) {
    return;
  }

  return {
    header: header,
    headerValue: headerValue
  };
};

module.exports = {
  name: 'ember-cli-content-security-policy',

  config: function(environment /*, appConfig */) {
    var ENV = {
      contentSecurityPolicyHeader: 'Content-Security-Policy-Report-Only',
      contentSecurityPolicy: {
        'default-src': "'none'",
        'script-src': "'self'",
        'font-src': "'self'",
        'connect-src': "'self'",
        'img-src': "'self'",
        'style-src': "'self'",
        'media-src': "'self'"
      }
    };

    if (environment === 'development') {
      ENV.contentSecurityPolicy['script-src'] = ENV.contentSecurityPolicy['script-src'] + " 'unsafe-eval'";
    }

    return ENV;
  },

  serverMiddleware: function(config) {
    var app = config.app;

    app.use(function(req, res, next) {
      var options = config.options;
      var project = options.project;

      var appConfig = project.config(options.environment);

      var headerData = _headerData(appConfig, options),
         headerValue = headerData.headerValue,
              header = headerData.header;

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
      console.log('Content Security Policy violation: ' + JSON.stringify(req.body));
      res.send({status:'ok'});
    });
  },

  contentFor: function(type, config) {
    if (type === 'head' && config.contentSecurityPolicyMetatag) {
      var headerData = _headerData(config),
         headerValue = headerData.headerValue,
              header = headerData.header;

      return '<meta http-equiv="' + header + '" content="' + headerValue + '">';
    }
  }
};
