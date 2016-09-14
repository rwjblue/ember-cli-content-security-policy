'use strict';

var buildPolicyString = require('./utils')['buildPolicyString'];

module.exports = {
  'csp-headers': {
    name: 'csp-headers',
    description: 'Generate Content-Security-Policy headers',
    works: 'insideProject',
    availableOptions: [
      {
        name: 'environment',
        type: String,
        aliases: [ 'e' ],
        default: 'development'
      },
      {
        name: 'report-uri',
        type: String
      }
    ],

    run: function(options) {
      var config = this.project.config(options.environment);
      var reportUri = options.reportUri;

      if (!!reportUri) {
        config.contentSecurityPolicy['report-uri'] = reportUri;
      }

      var policyObject = config.contentSecurityPolicy;
      this.ui.writeLine(buildPolicyString(policyObject));
    }
  }
};
