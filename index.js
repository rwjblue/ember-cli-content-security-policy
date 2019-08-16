'use strict';

const chalk = require('chalk');
const VersionChecker = require('ember-cli-version-checker');
const {
  appendSourceList,
  buildPolicyString,
  calculateConfig,
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

const DELIVERY_META = 'meta';

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

  serverMiddleware: function({ app, options }) {
    // Calculate livereload settings and cache it to be reused in `contentFor` hook.
    // Can't do that one in another hook cause it depends on middleware options,
    // which are only available in `serverMiddleware` hook.
    if (options.liveReload) {
      this._liveReload = {
        hostname: options.liveReloadHost,
        port: options.liveReloadPort,
        ssl: options.ssl
      }
    }

    app.use((req, res, next) => {
      if (!this._config.enabled) {
        next();
        return;
      }

      let header = this._config.reportOnly ? CSP_HEADER_REPORT_ONLY : CSP_HEADER;
      // clone policy object cause config should not be mutated
      let policyObject = Object.assign({}, this._config.policy);

      // the local server will never run for production builds, so no danger in adding the nonce all the time
      // even so it's only needed if tests are executed by opening `http://localhost:4200/tests`
      if (policyObject) {
        appendSourceList(policyObject, 'script-src', "'nonce-" + STATIC_TEST_NONCE + "'");
      }

      if (this._liveReload) {
        allowLiveReload(policyObject, this._liveReload);
      }

      // only needed for headers, since report-uri cannot be specified in meta tag
      if (header.indexOf('Report-Only') !== -1 && !('report-uri' in policyObject)) {
        let ecHost = options.host || 'localhost';
        let ecProtocol = options.ssl ? 'https://' : 'http://';
        let ecOrigin = ecProtocol + ecHost + ':' + options.port;
        appendSourceList(policyObject, 'connect-src', ecOrigin);
        policyObject['report-uri'] = ecOrigin + REPORT_PATH;
      }

      let headerValue = buildPolicyString(policyObject);

      if (!headerValue) {
        next();
        return;
      }

      // clear existing headers before setting ours
      res.removeHeader(CSP_HEADER);
      res.removeHeader(CSP_HEADER_REPORT_ONLY);
      res.setHeader(header, headerValue);

      // for Internet Explorer 11 and below (Edge support the standard header name)
      res.removeHeader('X-' + CSP_HEADER);
      res.removeHeader('X-' + CSP_HEADER_REPORT_ONLY);
      res.setHeader('X-' + header, headerValue);

      next();
    });

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

    if (type === 'head' && this._config.delivery.indexOf(DELIVERY_META) !== -1) {
      this.ui.writeWarnLine(
        'Content Security Policy does not support report only mode if delivered via meta element. ' +
        "Either set `ENV['ember-cli-content-security-policy'].reportOnly` to `false` or remove `'meta'` " +
        "from `ENV['ember-cli-content-security-policy'].delivery`.",
        this._config.reportOnly
      );

      let policyObject = Object.assign({}, this._config.policy);

      if (policyObject && appConfig.environment === 'test') {
        appendSourceList(policyObject, 'script-src', "'nonce-" + STATIC_TEST_NONCE + "'");
      }

      if (this._liveReload) {
        allowLiveReload(policyObject, this._liveReload);
      }

      // clone policy object cause config should not be mutated
      let policyString = buildPolicyString(policyObject);

      unsupportedDirectives(policyObject).forEach(function(name) {
        let msg = 'CSP delivered via meta does not support `' + name + '`, ' +
                  'per the W3C recommendation.';
        console.log(chalk.yellow(msg)); // eslint-disable-line no-console
      });

      if (!policyString) {
        // eslint-disable-next-line no-console
        console.log(chalk.yellow('CSP via meta tag enabled but no policy exist.'));
      } else {
        return '<meta http-equiv="' + CSP_HEADER + '" content="' + policyString + '">';
      }
    }

    if (type === 'test-body' && this._config.failTests) {
      let qunitDependency = (new VersionChecker(this)).for('qunit');
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

    if (type === 'test-body-footer') {
      // Add nonce to <script> tag inserted by ember-cli to assert that test file was loaded.
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

  // Configuration is only available by public API in `app` passed to `included` hook.
  // We calculate configuration in `included` hook and use it in `serverMiddleware`
  // and `contentFor` hooks, which are executed later. This prevents us from needing to
  // calculate the config more than once. We can't do this in `contentFor` hook cause
  // that one is executed after `serverMiddleware` and can't do it in `serverMiddleware`
  // hook cause that one is only executed on `ember serve` but not on `ember build` or
  // `ember test`. We can't do it in `init` hook cause app is not available by then.
  included: function(app) {
    let environment = app.env;
    let ownConfig = readConfig(app.project, environment);  // config/content-security-policy.js
    let runConfig = app.project.config(); // config/environment.js
    let ui = app.project.ui;

    this._config = calculateConfig(environment, ownConfig, runConfig, ui);
  },

  // holds configuration for this addon
  _config: null,

  // holds live reload configuration if express server is used and live reload is enabled
  _liveReload: null,
};

