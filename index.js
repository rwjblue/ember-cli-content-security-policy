'use strict';

const chalk = require('chalk');
const VersionChecker = require('ember-cli-version-checker');
const {
  appendSourceList,
  buildPolicyString,
  calculateConfig,
  debug,
  getEnvironmentFromRuntimeConfig,
  readConfig,
} = require('./lib/utils');

const REPORT_PATH = '/csp-report';

const CSP_HEADER = 'Content-Security-Policy';
const CSP_HEADER_REPORT_ONLY = 'Content-Security-Policy-Report-Only';

const CSP_REPORT_URI = 'report-uri';
const CSP_FRAME_ANCESTORS = 'frame-ancestors';
const CSP_SANDBOX = 'sandbox';

const META_UNSUPPORTED_DIRECTIVES = [
  CSP_REPORT_URI,
  CSP_FRAME_ANCESTORS,
  CSP_SANDBOX,
];

const STATIC_TEST_NONCE = 'abcdefg';

let unsupportedDirectives = function (policyObject) {
  return META_UNSUPPORTED_DIRECTIVES.filter(function (name) {
    return policyObject && name in policyObject;
  });
};

// appends directives needed for Ember CLI live reload feature to policy object
let allowLiveReload = function (policyObject, liveReloadConfig) {
  let { hostname, port, ssl } = liveReloadConfig;

  ['localhost', '0.0.0.0', hostname]
    .filter(Boolean)
    .forEach(function (hostname) {
      let protocol = ssl ? 'wss://' : 'ws://';
      let host = hostname + ':' + port;
      appendSourceList(policyObject, 'connect-src', protocol + host);
      appendSourceList(policyObject, 'script-src', host);
    });
};

module.exports = {
  name: require('./package').name,

  // Configuration is only available by public API in `app` passed to some hook.
  // We calculate configuration in `config` hook and use it in `serverMiddleware`
  // and `contentFor` hooks, which are executed later. This prevents us from needing to
  // calculate the config more than once. We can't do this in `contentFor` hook cause
  // that one is executed after `serverMiddleware` and can't do it in `serverMiddleware`
  // hook cause that one is only executed on `ember serve` but not on `ember build` or
  // `ember test`. We can't do it in `init` hook cause app is not available by then.
  //
  // The same applies to policy string generation. It's also calculated in `config`
  // hook and reused in both others. But this one might be overriden in `serverMiddleware`
  // hook to support live reload. This is safe because `serverMiddleware` hook is executed
  // before `contentFor` hook.
  //
  // Only a small subset of the configuration is required at run time in order to support
  // FastBoot. This one is returned here as default configuration in order to make it
  // available at run time.
  config: function (environment, runConfig) {
    debug('### Cache run-time config locally in config hook');

    // store run config to be available later
    this._runConfig = runConfig;

    let config = this._getConfigFor(environment);
    let policyString = buildPolicyString(config.policy);

    // CSP header should only be set in FastBoot if
    // - addon is enabled and
    // - configured to deliver CSP via header and
    // - application has ember-cli-fastboot dependency.
    this._needsFastBootSupport =
      config.enabled &&
      config.delivery.includes('header') &&
      this.project.findAddonByName('ember-cli-fastboot') !== null;

    // Run-time configuration is only needed for FastBoot support.
    if (!this._needsFastBootSupport) {
      return {};
    }

    // In order to set the correct CSP headers in FastBoot only a limited part of
    // configuration is required: The policy string, which is used as header value,
    // and the report only flag, which is determines the header name.
    return {
      'ember-cli-content-security-policy': {
        policy: policyString,
        reportOnly: config.reportOnly,
      },
    };
  },

  serverMiddleware: function ({ app: expressApp, options }) {
    debug('### Register middleware to set CSP headers in development server');

    const requiresLiveReload = options.liveReload;

    if (requiresLiveReload) {
      debug('Build requires live reload support');

      this._requiresLiveReloadSupport = true;
      this._liveReloadConfiguration = {
        hostname: options.liveReloadHost,
        port: options.liveReloadPort,
        ssl: options.ssl,
      };
    } else {
      debug('Build does not require live reload support');
    }

    expressApp.use((req, res, next) => {
      debug('### Setting CSP header in middleware of development server');

      // Use policy for test environment if both of these conditions are met:
      // 1. the request is for tests and
      // 2. the build include tests
      let buildIncludeTests = this.app.tests;
      let isRequestForTests =
        req.originalUrl.startsWith('/tests') && buildIncludeTests;
      let environment = isRequestForTests ? 'test' : this.app.env;

      debug(
        buildIncludeTests
          ? 'Build includes tests'
          : 'Build does not include tests'
      );
      debug(
        isRequestForTests ? 'Request is for tests' : 'Request is not for tests'
      );
      debug(`Generating CSP for environment ${environment}`);
      let config = this._getConfigFor(environment);

      if (!config.enabled) {
        debug('Skipping middleware because addon is not enabled');
        next();
        return;
      }

      if (config.reportOnly && !(CSP_REPORT_URI in config.policy)) {
        debug(
          'Injecting report-uri directive into CSP because addon is configured to ' +
            'use report only mode and CSP does not include report-uri directive'
        );

        let ecHost = options.host || 'localhost';
        let ecProtocol = options.ssl ? 'https://' : 'http://';
        let ecOrigin = ecProtocol + ecHost + ':' + options.port;

        appendSourceList(config.policy, 'connect-src', ecOrigin);
        config.policy[CSP_REPORT_URI] = ecOrigin + REPORT_PATH;
      }

      let policyString = buildPolicyString(config.policy);
      let header = config.reportOnly ? CSP_HEADER_REPORT_ONLY : CSP_HEADER;

      // clear existing headers before setting ours
      res.removeHeader(CSP_HEADER);
      res.removeHeader(CSP_HEADER_REPORT_ONLY);

      // set csp header
      res.setHeader(header, policyString);

      next();
    });

    // register handler for CSP reports
    let bodyParser = require('body-parser');
    expressApp.use(
      REPORT_PATH,
      bodyParser.json({ type: 'application/csp-report' })
    );
    expressApp.use(REPORT_PATH, bodyParser.json({ type: 'application/json' }));
    expressApp.use(REPORT_PATH, function (req, res) {
      // eslint-disable-next-line no-console
      console.log(
        chalk.red('Content Security Policy violation:') +
          '\n\n' +
          JSON.stringify(req.body, null, 2)
      );
      // send empty ok response, to avoid Cross-Origin Resource Blocking (CORB) warning
      res.status(204).send();
    });
  },

  contentFor: function (type, appConfig, existingContent) {
    // early skip not implemented contentFor hooks to avoid calculating
    // configuration for them
    const implementedContentForHooks = [
      'head',
      'test-head',
      'test-body',
      'test-body-footer',
    ];
    if (!implementedContentForHooks.includes(type)) {
      return;
    }

    const isTestIndexHtml =
      type.startsWith('test-') ||
      getEnvironmentFromRuntimeConfig(existingContent) === 'test';
    const environment = isTestIndexHtml ? 'test' : appConfig.environment;
    debug(
      `### Process contentFor hook for ${type} of ${
        isTestIndexHtml ? 'index.html' : 'tests/index.html'
      }`
    );

    const config = this._getConfigFor(environment);
    if (!config.enabled) {
      debug('Skip because not enabled in configuration');
      return;
    }

    // inject CSP meta tag in
    if (
      // 1. `head` slot of `index.html` and
      (type === 'head' && !isTestIndexHtml) ||
      // 2. `test-head` slot of `tests/index.html`
      type === 'test-head'
    ) {
      // skip if not configured to deliver via meta tag
      if (!config.delivery.includes('meta')) {
        debug(`Skip because not configured to deliver CSP via meta tag`);
        return;
      }

      debug(`Inject meta tag into ${type}`);

      let policyString = buildPolicyString(config.policy);

      if (config.reportOnly && config.delivery.indexOf('meta') !== -1) {
        this.ui.writeWarnLine(
          'Content Security Policy does not support report only mode if delivered via meta element. ' +
            "Either set `reportOnly` to `false` or remove `'meta' from `delivery` in " +
            '`config/content-security-policy.js`.',
          config.reportOnly
        );
      }

      unsupportedDirectives(config.policy).forEach(function (name) {
        let msg =
          'CSP delivered via meta does not support `' +
          name +
          '`, ' +
          'per the W3C recommendation.';
        console.log(chalk.yellow(msg)); // eslint-disable-line no-console
      });

      return `<meta http-equiv="${CSP_HEADER}" content="${policyString}">`;
    }

    // inject event listener needed for test support
    if (type === 'test-body' && config.failTests) {
      let qunitDependency = new VersionChecker(this.project).for('qunit');
      if (qunitDependency.exists() && qunitDependency.lt('2.9.2')) {
        this.ui.writeWarnLine(
          'QUnit < 2.9.2 violates a strict Content Security Policy (CSP) by itself. ' +
            `You are using QUnit ${qunitDependency.version}. You should upgrade the ` +
            'dependency to avoid issues.\n' +
            'Your project might not depend directly on QUnit but on ember-qunit. ' +
            'In that case you might want to upgrade ember-qunit to > 4.4.1.'
        );
      }

      return `
        <script nonce="${STATIC_TEST_NONCE}">
          document.addEventListener('securitypolicyviolation', function(event) {
            throw new Error(
              'Content-Security-Policy violation detected: ' +
              'Violated directive: ' + event.violatedDirective + '. ' +
              'Blocked URI: ' + event.blockedURI
            );
          });
        </script>
      `;
    }

    // Add nonce to <script> tag inserted by Ember CLI to assert that test file was loaded.
    if (type === 'test-body-footer') {
      existingContent.forEach((entry, index) => {
        if (
          /<script>\s*Ember.assert\(.*EmberENV.TESTS_FILE_LOADED\);\s*<\/script>/.test(
            entry
          )
        ) {
          existingContent[index] = entry.replace(
            '<script>',
            '<script nonce="' + STATIC_TEST_NONCE + '">'
          );
        }
      });
    }
  },

  includedCommands: function () {
    return require('./lib/commands');
  },

  treeForFastBoot: function (tree) {
    // Instance initializer should only be included in build if required.
    // It's only required for FastBoot support.
    if (!this._needsFastBootSupport) {
      return null;
    }

    return tree;
  },

  // controls if code needed to set CSP header in fastboot
  // is included in build output
  _needsFastBootSupport: null,

  // holds the run config
  // It's set in `config` hook and used later
  _runConfig: null,

  // controls if live reload support is append to given CSP policy or not
  // may be set to `true` by `serverMiddleware` hook
  _requiresLiveReloadSupport: false,

  // hold live reload configuration such as hostname, port and if using ssl
  // if live reload is used
  _liveReloadConfiguration: null,

  // returns the config for a given environment and delivery method
  _getConfigFor(environment) {
    debug(`Calculate configuration for environment ${environment}`);

    const { project } = this;
    const { ui } = project;
    const ownConfig = readConfig(project, environment);
    const runConfig = this._runConfig;
    debug(`Own configuration is: ${JSON.stringify(ownConfig)}`);
    debug(`Run-time configuration is: ${JSON.stringify(runConfig)}`);

    const config = calculateConfig(environment, ownConfig, runConfig, ui);
    debug(`Calculated configuration: ${JSON.stringify(config)}`);

    if (environment === 'test') {
      debug('Manipulating configuration to fit test specific needs');

      // add static nonce required for tests, but only if if script-src
      // does not contain 'unsafe-inline'. if a nonce is present, browsers
      // ignore the 'unsafe-inline' directive.
      let scriptSrc = config.policy['script-src'];
      if (!(scriptSrc && scriptSrc.includes("'unsafe-inline'"))) {
        appendSourceList(
          config.policy,
          'script-src',
          `'nonce-${STATIC_TEST_NONCE}'`
        );
      }

      // testem requires frame-src to run
      config.policy['frame-src'] = ["'self'"];

      // enforce delivery through meta
      config.delivery.push('meta');

      debug(
        `Configuration adjusted for test needs is: ${JSON.stringify(config)}`
      );
    }

    if (this._requiresLiveReloadSupport) {
      debug('Adjusting policy to support live reload');

      allowLiveReload(config.policy, this._liveReloadConfiguration);

      debug(
        `Configuration adjusted to support live reload is: ${JSON.stringify(
          config
        )}`
      );
    }

    return config;
  },
};
