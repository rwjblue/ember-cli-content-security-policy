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
  }
};
