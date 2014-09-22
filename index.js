module.exports = {
  name: 'ember-cli-content-security-policy',

  config: function(/* environment, appConfig */) {
    return {
      contentSecurityPolicyHeader: 'Content-Security-Policy',
      contentSecurityPolicy: {
        'default-src': 'none',
        'script-src': 'self',
        'connect-src': 'self',
        'img-src': 'self',
        'style-src': 'self'
      }
    }
  },

  serverMiddleware: function(config) {
    var addonContent = this;
    var app = config.app;
    var options = config.options;
    var project = options.project;

    app.use(function(req, res, next) {
      var appConfig = project.config(config.environment);

      var header = appConfig.contentSecurityPolicyHeader;
      var headerConfig = appConfig.contentSecurityPolicy;

      if (options.liveReload) {
        headerConfig['connect-src'] = headerConfig['connect-src'] + ' localhost:' + options.liveReloadPort;
      }

      var headerValue = Object.keys(headerConfig).reduce(function(memo, value) {
        return memo + '; ' + value + ' ' + headerConfig[value] + '; ';
      }, '');

      if (!header || !headerValue) {
        next();
        return;
      }

      res.removeHeader("Content-Security-Policy");
      res.removeHeader("X-Content-Security-Policy");

      res.removeHeader('Content-Security-Policy-Report-Only');
      res.removeHeader('X-Content-Security-Policy-Report-Only');

      res.setHeader(header, headerConfig);
      res.setHeader('X-' + header, headerConfig);

      next();
    });
  }
};
