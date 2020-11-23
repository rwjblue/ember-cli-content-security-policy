# Deprecations

## Until 3.0

### Configuration is moved to config/content-security-policy.js

Configuration has been moved from `config/environment.js` to `config/content-security-policy.js`.
The configuration keys have been changed as well. Please follow these steps for migrating your existing configuration:

- Create `config/content-security-policy.js` file with default configuration as [shown in readme](https://github.com/rwjblue/ember-cli-content-security-policy#configuration).
- If existing config defines a custom policy object under `contentSecurityPolicy` key, copy that one to `policy` key in newly created config file. The application's policy object is not merged with default policy object anymore. Therefore you should add missing keys from default policy object to your application specific policy directives.
- If existing config contains `contentSecurityPolicyHeader = "Content-Security-Policy"`, include `reportOnly: false`.
- If existing config contains `contentSecurityPolicyMeta = true`, include `delivery: ['header', 'meta']`.

Please refer to [documentation in readme](README.md) for details on new configuration syntax.
