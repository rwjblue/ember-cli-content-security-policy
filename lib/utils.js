/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');

const CSP_SELF = "'self'";
const CSP_NONE = "'none'";

const CSP_HEADER = 'Content-Security-Policy';

const DELIVERY_HEADER = 'header';
const DELIVERY_META   = 'meta';

const unique = function(array) {
  return array.filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });
};

const buildPolicyString = function(policyObject) {
  return Object.keys(policyObject).reduce(function(memo, name) {
    var value = policyObject[name];
    if (value === null) {
      // Override the default value of `'self'`. Instead no entry will be included
      // in the CSP. This, in turn, will cause the CSP to fallback to `default-src`
      // for this directive. http://www.w3.org/TR/CSP2/#default-src-usage
      return memo;
    } else {
      var sourceList = Array.isArray(value) ? unique(value).join(' ') : value;
      return memo + name + ' ' + sourceList + '; ';
    }
  }, '').trim();
};

const getConfigPath = function(projectPkg, projectRoot) {
  let configDir = 'config';

  if (projectPkg['ember-addon'] && projectPkg['ember-addon']['configPath']) {
    configDir = projectPkg['ember-addon']['configPath'];
  }

  return path.join(projectRoot, configDir, 'content-security-policy.js');
};

/**
 * Returns the configuration stored in `config/content-security-policy.js`.
 * Returns an empty object if that file does not exist.
 *
 * @param {string} projectRoot
 * @return {object}
 */
const readConfig = function(project, environment) {
  let configPath = getConfigPath(project.pkg, project.root);

  return fs.existsSync(configPath) ? require(configPath)(environment) : {};
};

/**
 * Calculates the configuration based on
 * - own config (`config/content-security-policy.js`) and
 * - run-time config (`config/environment.js`) for legacy support.
 *
 * @params {string} environment
 * @params {object} ownConfig
 * @params {object} runConfig
 * @params {object} ui
 * @returns {object}
 */
function calculateConfig(environment, ownConfig, runConfig, ui) {
  let config = {
    delivery: [DELIVERY_HEADER],
    enabled: true,
    policy: {
      'default-src':  [CSP_NONE],
      'script-src':   [CSP_SELF],
      'font-src':     [CSP_SELF],
      'connect-src':  [CSP_SELF],
      'img-src':      [CSP_SELF],
      'style-src':    [CSP_SELF],
      'media-src':    [CSP_SELF],
    },
    reportOnly: true,
  };

  // testem requires frame-src to run
  if (environment === 'test') {
    config.policy['frame-src'] = CSP_SELF;
  }

  ui.writeWarnLine(
    'Configuring ember-cli-content-security-policy using `contentSecurityPolicy`, ' +
    '`contentSecurityPolicyHeader` and `contentSecurityPolicyMeta` keys in `config/environment.js` ' +
    'is deprecate and will be removed in v2.0.0. ember-cli-content-security-policy is now configured ' +
    'using `ember-cli-build.js`. Please find detailed information about new configuration options ' +
    'in addon documentation at https://github.com/rwjblue/ember-cli-content-security-policy/blob/master/DEPRECATIONS.md.',
    !runConfig.contentSecurityPolicy || !runConfig.contentSecurityPolicyHeader || !runConfig.contentSecurityPolicyMeta
  );

  // support legacy configuration options
  if (runConfig.contentSecurityPolicy) {
    // policy object is merged not replaced
    Object.assign(config.policy, runConfig.contentSecurityPolicy);
  }
  if (runConfig.contentSecurityPolicyMeta) {
    config.delivery = [DELIVERY_META];
  }
  if (runConfig.contentSecurityPolicyHeader) {
    config.reportOnly = runConfig.contentSecurityPolicyHeader !== CSP_HEADER;
  }

  // apply configuration
  Object.assign(config, ownConfig);

  return config;
}

module.exports = {
  buildPolicyString,
  calculateConfig,
  readConfig
};
