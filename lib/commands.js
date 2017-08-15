/* eslint-env node */

'use strict';

var buildPolicyString = require('./utils')['buildPolicyString'];
var chalk = require('chalk');

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

      if (reportUri) {
        config.contentSecurityPolicy['report-uri'] = reportUri;
      }

      this.ui.writeLine(chalk.dim.cyan('# Content Security Policy Header Configuration'));
      this.ui.writeLine(chalk.dim.cyan('#'));
      this.ui.writeLine(chalk.dim.cyan('# for Apache: Header set ' + config.contentSecurityPolicyHeader + ' "..."'));
      this.ui.writeLine(chalk.dim.cyan('# for Nginx : add_header ' + config.contentSecurityPolicyHeader + ' "...";') + '\n');

      var policyObject = config.contentSecurityPolicy;
      this.ui.writeLine(buildPolicyString(policyObject), 'ERROR');
    }
  }
};
