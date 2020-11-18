/* eslint-env node */

'use strict';

const chalk = require('chalk');
const { buildPolicyString, calculateConfig, readConfig } = require('./utils');

const CSP_HEADER = 'Content-Security-Policy';
const CSP_HEADER_REPORT_ONLY = 'Content-Security-Policy-Report-Only';

module.exports = {
  'csp-headers': {
    name: 'csp-headers',
    description: 'Generate Content-Security-Policy headers',
    works: 'insideProject',
    availableOptions: [
      {
        name: 'environment',
        type: String,
        aliases: ['e'],
        default: 'development',
      },
      {
        name: 'report-uri',
        type: String,
        description: 'Sets report-uri for the policy',
      },
      {
        name: 'silent',
        type: Boolean,
        default: false,
        description:
          'Only outputs the policy without the instructions for Apache and Nginx',
      },
    ],

    run: function (options) {
      let { environment, reportUri } = options;
      let { project, ui } = this;
      let ownConfig = readConfig(project);
      let runConfig = project.config(environment);
      let { reportOnly, policy } = calculateConfig(
        environment,
        ownConfig,
        runConfig,
        ui
      );

      if (reportUri) {
        policy['report-uri'] = reportUri;
      }

      let header = reportOnly ? CSP_HEADER_REPORT_ONLY : CSP_HEADER;

      this.ui.writeLine(
        chalk.dim.cyan('# Content Security Policy Header Configuration')
      );
      this.ui.writeLine(chalk.dim.cyan('#'));
      this.ui.writeLine(
        chalk.dim.cyan('# for Apache: Header set ' + header + ' "..."')
      );
      this.ui.writeLine(
        chalk.dim.cyan('# for Nginx : add_header ' + header + ' "...";') + '\n'
      );

      let policyString = buildPolicyString(policy);
      // eslint-disable-next-line no-console
      console.log(policyString);
    },
  },
};
