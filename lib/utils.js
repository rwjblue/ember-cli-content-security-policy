/* eslint-env node */

'use strict';

const debug = require('./utils/debug');
const fs = require('fs');
const path = require('path');

const CSP_SELF = "'self'";
const CSP_NONE = "'none'";

const CSP_HEADER = 'Content-Security-Policy';

const unique = function (array) {
  return array.filter(function (value, index, self) {
    return self.indexOf(value) === index;
  });
};

const buildPolicyString = function (policyObject) {
  return Object.keys(policyObject)
    .reduce(function (memo, name) {
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
    }, '')
    .trim();
};

const getConfigPath = function (projectPkg, projectRoot) {
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
 * @param {string} project
 * @return {object}
 */
const readConfig = function (project, environment) {
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
    delivery: ['header'],
    enabled: true,
    failTests: true,
    policy: {
      'default-src': [CSP_NONE],
      'script-src': [CSP_SELF],
      'font-src': [CSP_SELF],
      'connect-src': [CSP_SELF],
      'img-src': [CSP_SELF],
      'style-src': [CSP_SELF],
      'media-src': [CSP_SELF],
    },
    reportOnly: true,
  };

  ui.writeWarnLine(
    'Configuring ember-cli-content-security-policy using `contentSecurityPolicy`, ' +
      '`contentSecurityPolicyHeader` and `contentSecurityPolicyMeta` keys in `config/environment.js` ' +
      'is deprecate and will be removed in v3.0.0. ember-cli-content-security-policy is now configured ' +
      'using `config/content-security-polic.js`. Please find detailed information about this change ' +
      'and recommended migration steps in deprecation guide at ' +
      'https://github.com/rwjblue/ember-cli-content-security-policy/blob/master/DEPRECATIONS.md.',
    !runConfig.contentSecurityPolicy ||
      !runConfig.contentSecurityPolicyHeader ||
      !runConfig.contentSecurityPolicyMeta
  );

  // support legacy configuration options
  if (runConfig.contentSecurityPolicy) {
    // policy object is merged not replaced
    Object.assign(config.policy, runConfig.contentSecurityPolicy);
  }
  if (runConfig.contentSecurityPolicyMeta) {
    config.delivery = ['meta'];
  }
  if (runConfig.contentSecurityPolicyHeader) {
    config.reportOnly = runConfig.contentSecurityPolicyHeader !== CSP_HEADER;
  }

  // apply configuration
  Object.assign(config, ownConfig);

  return config;
}

/**
 * Appends additional directives to an existing policy object.
 * It mutates the existing policy object and it's directive values.
 *
 * If the directive is not defined yet, it's initalized with a copy
 * of default-src directive. This is required to not break the built-in
 * fallback mechanism of CSP.
 *
 * If, say, `connect-src` is not defined it will fall back to `default-src`.
 * This can cause issues if not respected when extending a given policy
 * object. An example:
 *
 * Developer has has defined the following policy:
 * `default-src: 'self' example.com;`
 * and an addon appends the connect-src entry live-reload.local the result is:
 * `default-src: 'self' example.com; connect-src: live-reload.local;`
 *
 * After the addons change an xhr to example.com (which was previously permitted,
 *  via fallback) will now be rejected since it doesn't match live-reload.local.
 *
 * To mitigate, whenever we append to a non-existing directive we must also copy
 * all sources from default-src onto the specified directive.
 *
 * @param {object} policyObject
 * @param {string} directiveName
 * @param {string} sourceList
 * @return {void}
 */
function appendSourceList(policyObject, directiveName, sourceList) {
  let value = policyObject[directiveName];

  if (!Array.isArray(value) && value !== undefined && value !== null) {
    // null is only supported for legacy reasons
    throw new Error(
      `Source list must be an array or undefined, ${value} given.`
    );
  }

  if (!Array.isArray(value)) {
    // initialize source list with an copy of default-src (see above)
    policyObject[directiveName] = policyObject['default-src']
      ? policyObject['default-src'].slice()
      : [];
  }

  if (policyObject[directiveName].includes("'none'")) {
    if (policyObject[directiveName].length > 1) {
      throw new Error(
        `'none' keyword is exclusive in a CSP directive but source list is ${JSON.stringify(
          value
        )}`
      );
    }

    policyObject[directiveName] = [];
  }

  policyObject[directiveName].push(sourceList);
}

module.exports = {
  appendSourceList,
  buildPolicyString,
  calculateConfig,
  debug,
  readConfig,
};
