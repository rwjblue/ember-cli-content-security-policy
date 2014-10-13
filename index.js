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
    }

    if (environment === 'development') {
      ENV.contentSecurityPolicy['script-src'] = ENV.contentSecurityPolicy['script-src'] + " 'unsafe-eval'";
    }

    return ENV;
  },

  serverMiddleware: function(config) {
    var addonContent = this;
    var app = config.app;
    var options = config.options;
    var project = options.project;

    app.use(function(req, res, next) {
      var appConfig = project.config(options.environment);

      var header = appConfig.contentSecurityPolicyHeader;
      var headerConfig = appConfig.contentSecurityPolicy;

      if (options.liveReload) {
        ['localhost', '0.0.0.0'].forEach(function(host) {
          headerConfig['connect-src'] = headerConfig['connect-src'] + ' ws://' + host + ':' + options.liveReloadPort;
          headerConfig['script-src'] = headerConfig['script-src'] + ' ' + host + ':' + options.liveReloadPort;
        });
      }

      var headerValue = Object.keys(headerConfig).reduce(function(memo, value) {
        return memo + value + ' ' + headerConfig[value] + '; ';
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
  }
};
