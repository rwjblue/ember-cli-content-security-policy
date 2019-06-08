'use strict';
var chalk = require('chalk');

var buildPolicyString = require('./lib/utils')['buildPolicyString'];

var CSP_SELF        = "'self'";
var CSP_NONE        = "'none'";
var REPORT_PATH     = '/csp-report';

var CSP_HEADER              = 'Content-Security-Policy';
var CSP_HEADER_REPORT_ONLY  = 'Content-Security-Policy-Report-Only';

var CSP_REPORT_URI          = 'report-uri';
var CSP_FRAME_ANCESTORS     = 'frame-ancestors';
var CSP_SANDBOX             = 'sandbox';

var META_UNSUPPORTED_DIRECTIVES = [
  CSP_REPORT_URI,
  CSP_FRAME_ANCESTORS,
  CSP_SANDBOX,
];

var STATIC_TEST_NONCE = 'abcdefg';

var unsupportedDirectives = function(policyObject) {
  return META_UNSUPPORTED_DIRECTIVES.filter(function(name) {
    return policyObject && (name in policyObject);
  });
};

// CSP has a built-in fallback mechanism. If, say, `connect-src` is not defined it
// will fall back to `default-src`. This can cause issues. An example:
//
// Developer has has defined the following policy:
// `default-src: 'self' example.com;`
// and an addon appends the connect-src entry live-reload.local the result is:
// `default-src: 'self' example.com; connect-src: live-reload.local;`
//
// After the addons change an xhr to example.com (which was previously permitted, via fallback)
// will now be rejected since it doesn't match live-reload.local.
//
// To mitigate, whenever we append to a non-existing directive we must also copy all sources from
// default-src onto the specified directive.
var appendSourceList = function(policyObject, name, sourceList) {
  var oldSourceList;
  var oldValue = policyObject[name];

  // cast string syntax into array
  if (oldValue && typeof oldValue === 'string') {
    oldValue = oldValue.split(' ');
  }

  if (oldValue !== null && typeof oldValue !== 'undefined' && !Array.isArray(oldValue)) {
    throw new Error('Unknown source list value');
  }

  if (!oldValue || oldValue.length === 0) {
    // copy default-src (see above)
    oldSourceList = policyObject['default-src'] || [];
  } else { // array
    oldSourceList = oldValue;
  }

  oldSourceList.push(sourceList);
  policyObject[name] = oldSourceList.join(' ');
};

module.exports = {
  name: require('./package').name,

  config: function(environment, appConfig) {
    let defaultConfig = {
      delivery: ['header'],
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
      defaultConfig.policy['frame-src'] = CSP_SELF;
    }

    this.ui.writeWarnLine(
      'Using `contentSecurityPolicy`, `contentSecurityPolicyHeader` and `contentSecurityPolicyMeta` keys ' +
      'to configure ember-cli-content-security-policy is deprecate and will be removed in v2.0.0. ' +
      'Please find detailed information about new configuration options in addon documentation.',
      !appConfig.contentSecurityPolicy || !appConfig.contentSecurityPolicyHeader || !appConfig.contentSecurityPolicyMeta
    );

    if (appConfig.contentSecurityPolicy) {
      defaultConfig.policy = appConfig.contentSecurityPolicy;
    }
    if (appConfig.contentSecurityPolicyMeta === false) {
      defaultConfig.delivery = ['header'];
    }
    if (appConfig.contentSecurityPolicyHeader) {
      defaultConfig.reportOnly = appConfig.contentSecurityPolicyHeader !== CSP_HEADER;
    }

    return {
      'ember-cli-content-security-policy': defaultConfig
    };
  },

  serverMiddleware: function(config) {
    var app = config.app;
    var options = config.options;
    var project = options.project;

    app.use(function(req, res, next) {
      var appConfig = project.config(options.environment);

      if (!appConfig['ember-cli-content-security-policy'].enabled) {
        next();
        return;
      }

      var header = appConfig['ember-cli-content-security-policy'].reportOnly ? CSP_HEADER_REPORT_ONLY : CSP_HEADER;
      var policyObject = appConfig['ember-cli-content-security-policy'].policy;

      // the local server will never run for production builds, so no danger in adding the nonce all the time
      // even so it's only needed if tests are executed by opening `http://localhost:4200/tests`
      if (policyObject) {
        appendSourceList(policyObject, 'script-src', "'nonce-" + STATIC_TEST_NONCE + "'");
      }

      // can be moved to the ember-cli-live-reload addon if RFC-22 is implemented
      // https://github.com/ember-cli/rfcs/pull/22
      if (options.liveReload) {
        ['localhost', '0.0.0.0', options.liveReloadHost].filter(Boolean).forEach(function(host) {
          var liveReloadHost = host + ':' + options.liveReloadPort;
          var liveReloadProtocol = options.ssl ? 'wss://' : 'ws://';
          appendSourceList(policyObject, 'connect-src', liveReloadProtocol + liveReloadHost);
          appendSourceList(policyObject, 'script-src', liveReloadHost);
        });
      }

      // only needed for headers, since report-uri cannot be specified in meta tag
      if (header.indexOf('Report-Only') !== -1 && !('report-uri' in policyObject)) {
        var ecHost = options.host || 'localhost';
        var ecProtocol = options.ssl ? 'https://' : 'http://';
        var ecOrigin = ecProtocol + ecHost + ':' + options.port;
        appendSourceList(policyObject, 'connect-src', ecOrigin);
        policyObject['report-uri'] = ecOrigin + REPORT_PATH;
      }

      var headerValue = buildPolicyString(policyObject);

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

    var bodyParser = require('body-parser');
    app.use(REPORT_PATH, bodyParser.json({ type: 'application/csp-report' }));
    app.use(REPORT_PATH, bodyParser.json({ type: 'application/json' }));
    app.use(REPORT_PATH, function(req, res, _next) {
      // eslint-disable-next-line no-console
      console.log(chalk.red('Content Security Policy violation:') + '\n\n' + JSON.stringify(req.body, null, 2));
      res.send({ status:'ok' });
    });
  },

  contentFor: function(type, appConfig, existingContent) {
    let addonConfig = appConfig['ember-cli-content-security-policy'];

    if (!addonConfig.enabled) {
      return;
    }

    if (type === 'head' && addonConfig.delivery.indexOf('meta') !== -1) {
      this.ui.writeWarnLine(
        'Content Security Policy does not support report only mode if delivered via meta element. ' +
        "Either set `ENV['ember-cli-content-security-policy'].reportOnly` to `false` or remove `'meta'` " +
        "from `ENV['ember-cli-content-security-policy'].delivery`.",
        appConfig['ember-cli-content-security-policy'].reportOnly
      );

      var policyObject = addonConfig.policy;
      var liveReloadPort = process.env.EMBER_CLI_INJECT_LIVE_RELOAD_PORT;

      // can be moved to the ember-cli-live-reload addon if RFC-22 is implemented
      // https://github.com/ember-cli/rfcs/pull/22
      if (policyObject && liveReloadPort) {
        ['localhost', '0.0.0.0'].forEach(function(host) {
          var liveReloadHost = host + ':' + liveReloadPort;
          appendSourceList(policyObject, 'connect-src', 'ws://' + liveReloadHost);
          appendSourceList(policyObject, 'connect-src', 'wss://' + liveReloadHost);
          appendSourceList(policyObject, 'script-src', liveReloadHost);
        });
      }

      if (policyObject && appConfig.environment === 'test') {
        appendSourceList(policyObject, 'script-src', "'nonce-" + STATIC_TEST_NONCE + "'");
      }

      var policyString = buildPolicyString(policyObject);

      unsupportedDirectives(policyObject).forEach(function(name) {
        var msg = 'CSP delivered via meta does not support `' + name + '`, ' +
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
  }
};
