'use strict';

const chalk = require('chalk');
const VersionChecker = require('ember-cli-version-checker');
const {
  appendSourceList,
  buildPolicyString,
  calculateConfig,
  isIndexHtmlForTesting,
  readConfig
} = require('./lib/utils');

const REPORT_PATH     = '/csp-report';

const CSP_HEADER              = 'Content-Security-Policy';
const CSP_HEADER_REPORT_ONLY  = 'Content-Security-Policy-Report-Only';

const CSP_REPORT_URI          = 'report-uri';
const CSP_FRAME_ANCESTORS     = 'frame-ancestors';
const CSP_SANDBOX             = 'sandbox';

const META_UNSUPPORTED_DIRECTIVES = [
  CSP_REPORT_URI,
  CSP_FRAME_ANCESTORS,
  CSP_SANDBOX,
];

const STATIC_TEST_NONCE = 'abcdefg';

let unsupportedDirectives = function(policyObject) {
  return META_UNSUPPORTED_DIRECTIVES.filter(function(name) {
    return policyObject && (name in policyObject);
  });
};

// appends directives needed for Ember CLI live reload feature to policy object
let allowLiveReload = function(policyObject, liveReloadConfig) {
  let { hostname, port, ssl } = liveReloadConfig;

  ['localhost', '0.0.0.0', hostname].filter(Boolean).forEach(function(hostname) {
    let protocol = ssl ? 'wss://' : 'ws://';
    let host = hostname + ':' + port;
    appendSourceList(policyObject, 'connect-src', protocol + host);
    appendSourceList(policyObject, 'script-src', host);
  });
}

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
  config: function(environment, runConfig) {
    // calculate configuration and policy string
    // hook may be called more than once, but we only need to calculate once
    if (!this._config) {
      let { app, project } = this;
      let ui = project.ui;
      let ownConfig = readConfig(project, environment);
      let config = calculateConfig(environment, ownConfig, runConfig, ui);

      this._config = config;
      this._policyString = buildPolicyString(config.policy);

      // generate config for test environment if app includes tests
      // Note: app is not defined for CLI commands
      if (app && app.tests) {
        let ownConfigForTest = readConfig(project, 'test');
        let runConfigForTest = project.config('test');
        let configForTest = calculateConfig('test', ownConfigForTest, runConfigForTest, ui);

        // add static nonce required for tests
        appendSourceList(configForTest.policy, 'script-src', `'nonce-${STATIC_TEST_NONCE}'`);

        // testem requires frame-src to run
        configForTest.policy['frame-src'] = ["'self'"];

        this._configForTest = configForTest;
        this._policyStringForTest = buildPolicyString(configForTest.policy);
      }
    }

    // CSP header should only be set in FastBoot if
    // - addon is enabled and
    // - configured to deliver CSP via header and
    // - application has ember-cli-fastboot dependency.
    this._needsFastBootSupport = this._config.enabled &&
      this._config.delivery.includes('header') &&
      // TODO: check if application has ember-cli-fastboot-dependency
      // https://github.com/rwjblue/ember-cli-content-security-policy/issues/116
      true;

    // Run-time configuration is only needed for FastBoot support.
    if (!this._needsFastBootSupport) {
      return {};
    }

    // In order to set the correct CSP headers in FastBoot only a limited part of
    // configuration is required: The policy string, which is used as header value,
    // and the report only flag, which is determines the header name.
    return {
      'ember-cli-content-security-policy': {
        policy: this._policyString,
        reportOnly: this._config.reportOnly,
      },
    };
  },

  serverMiddleware: function({ app, options }) {
    // Configuration is not changeable at run-time. Therefore it's safe to not
    // register the express middleware at all if addon is disabled and
    // precalculate dynamic values.
    if (!this._config.enabled) {
      return;
    }

    // Need to recalculate the policy if local development server is used to
    // support live reload, executing tests in development enviroment via
    // `http://localhost:4200/tests` and reporting CSP violations on CLI.
    let policyObject = this._config.policy;
    let policyObjectForTest = this._configForTest.policy;

    // live reload requires some addition CSP directives
    if (options.liveReload) {
      allowLiveReload(policyObject, {
        hostname: options.liveReloadHost,
        port: options.liveReloadPort,
        ssl: options.ssl
      });

      allowLiveReload(policyObjectForTest, {
        hostname: options.liveReloadHost,
        port: options.liveReloadPort,
        ssl: options.ssl
      });
    }

    // add report URI to policy object and allow it as connection source
    if (this._config.reportOnly && !('report-uri' in policyObject)) {
      let ecHost = options.host || 'localhost';
      let ecProtocol = options.ssl ? 'https://' : 'http://';
      let ecOrigin = ecProtocol + ecHost + ':' + options.port;

      appendSourceList(policyObject, 'connect-src', ecOrigin);
      appendSourceList(policyObjectForTest, 'connect-src', ecOrigin);

      policyObject['report-uri'] = ecOrigin + REPORT_PATH;
      policyObjectForTest['report-uri'] = policyObject['report-uri'];
    }

    this._policyString = buildPolicyString(policyObject);
    this._policyStringForTest = buildPolicyString(policyObjectForTest);

    app.use((req, res, next) => {
      let isRequestForTests = req.originalUrl.startsWith('/tests');
      let config = isRequestForTests ? this._configForTest : this._config;
      let policyString = isRequestForTests ? this._policyStringForTest : this._policyString;
      let header = config.reportOnly ? CSP_HEADER_REPORT_ONLY : CSP_HEADER;

      // clear existing headers before setting ours
      res.removeHeader(CSP_HEADER);
      res.removeHeader(CSP_HEADER_REPORT_ONLY);
      res.setHeader(header, policyString);

      // for Internet Explorer 11 and below (Edge support the standard header name)
      res.removeHeader('X-' + CSP_HEADER);
      res.removeHeader('X-' + CSP_HEADER_REPORT_ONLY);
      res.setHeader('X-' + header, policyString);

      next();
    });

    // register handler for CSP reports
    let bodyParser = require('body-parser');
    app.use(REPORT_PATH, bodyParser.json({ type: 'application/csp-report' }));
    app.use(REPORT_PATH, bodyParser.json({ type: 'application/json' }));
    app.use(REPORT_PATH, function(req, res, _next) {
      // eslint-disable-next-line no-console
      console.log(chalk.red('Content Security Policy violation:') + '\n\n' + JSON.stringify(req.body, null, 2));
      res.send({ status:'ok' });
    });
  },

  contentFor: function(type, appConfig, existingContent) {
    if (!this._config.enabled) {
      return;
    }

    // inject CSP meta tag
    if (
      // if addon is configured to deliver CSP by meta tag
      ( type === 'head' && this._config.delivery.indexOf('meta') !== -1 ) ||
      // ensure it's injected in tests/index.html to ensure consistent test results
      type === 'test-head'
    ) {
      // skip head slot for tests/index.html to prevent including the CSP meta tag twice
      if (type === 'head' && isIndexHtmlForTesting(existingContent)) {
        return;
      }

      let config = type === 'head' ? this._config : this._configForTest;
      let policyString = type === 'head' ? this._policyString : this._policyStringForTest;

      this.ui.writeWarnLine(
        'Content Security Policy does not support report only mode if delivered via meta element. ' +
        "Either set `ENV['ember-cli-content-security-policy'].reportOnly` to `false` or remove `'meta'` " +
        "from `ENV['ember-cli-content-security-policy'].delivery`.",
        config.reportOnly
      );

      unsupportedDirectives(config.policy).forEach(function(name) {
        let msg = 'CSP delivered via meta does not support `' + name + '`, ' +
                  'per the W3C recommendation.';
        console.log(chalk.yellow(msg)); // eslint-disable-line no-console
      });

      return `<meta http-equiv="${CSP_HEADER}" content="${policyString}">`;
    }

    // inject event listener needed for test support
    if (type === 'test-body' && this._config.failTests) {
      let qunitDependency = (new VersionChecker(this.project)).for('qunit');
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
        if (/<script>\s*Ember.assert\(.*EmberENV.TESTS_FILE_LOADED\);\s*<\/script>/.test(entry)) {
          existingContent[index] = entry.replace('<script>', '<script nonce="' + STATIC_TEST_NONCE + '">');
        }
      });
    }
  },

  includedCommands: function() {
    return require('./lib/commands');
  },

  treeForFastBoot: function(tree) {
    // Instance initializer should only be included in build if required.
    // It's only required for FastBoot support.
    if (!this._needsFastBootSupport) {
      return null;
    }

    return tree;
  },

  // holds configuration for this addon
  _config: null,

  // controls if code needed to set CSP header in fastboot
  // is included in build output
  _needsFastBootSupport: null,

  // holds calculated policy string
  _policyString: null,
};

