# Deprecations

## Configuration is moved to ember-cli-build.js

Configuration has been moved from runtime config in `config/environment.js` to build-time in `ember-cli-build.js`.
The configuration keys have been changed as well. Please follow these steps for migrating your existing configuration:

* Create a configuration object under `ember-cli-content-security-policy` key in `ember-cli-build.js`.
* If existing config defines a custom policy object under `contentSecurityPolicy` key, copy that one to `policy` key.
  Application's policy object is not merged with default one anymore. Therefore you should add missing keys from default
  policy object to your application specific policy directives.
* If existing config contains `contentSecurityPolicyHeader = "Content-Security-Policy"`, include `reportOnly: false`.
* If existing config contains `contentSecurityPolicyMeta = true`, include `delivery: ['header', 'meta']`.

Please refer to [`readme`](README.md) for details on new configuration syntax.
