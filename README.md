# ember-cli-content-security-policy

This addon makes it easy to use [Content Security Policy](https://content-security-policy.com/) (CSP) in your project. The policy can be delivered either via a `Content-Security-Policy` HTTP response header or as a meta tag in the `index.html` file.

If configured to deliver the CSP using a HTTP response header, the header is set automatically if served with Ember CLI's express server in development or via [FastBoot](https://ember-fastboot.com/) in production. If FastBoot is not used to serve the app in production, the web server must be configured to set the CSP header. The configured CSP could be exported with a provided Ember CLI command.

If configured to deliver the CSP using the meta tag no additional configuration of the web server serving the application in production is needed.

In any case, using this addon helps keeping CSP in the forefront of your thoughts while developing an Ember application.

Compatibility
------------------------------------------------------------------------------

* Ember.js v2.18 or above
* Ember CLI v3.4 or above
* Node.js v10 or above

Installation
------------------------------------------------------------------------------

```bash
ember install ember-cli-content-security-policy
```

Configuration
------------------------------------------------------------------------------

This addon is configured via `config/content-security-policy.js` file.

```ts
type directiveName =
  // Fetch Directives
  'child-src' | 'connect-src' | 'default-src' | 'font-src' | 'frame-src' | 'image-src' | 'manifest-src' | 'media-src' | 'object-src' | 'prefetch-src' | 'script-src' | 'script-src-elem' | 'script-src-attr' | 'style-src' | 'style-src-elem' | 'style-src-attr' | 'worker-src' |
  // Document Directives
  'base-uri' | 'plugin-types' | 'sandbox' |
  // Navigation Directives
  'form-action' | 'form-ancestors' | 'navigate-to' |
  // Reporting Directives
  'report-uri' | 'report-uri' | 'report-to' |
  // Directives Defined in Other Documents
  'block-all-mixed-content' | 'upgrade-insecure-requests' | 'require-sri-for';

interface EmberCLIContentSecurityPolicyConfig {
  // CSP is delivered via HTTP Header if delivery includes `"header"` and via
  // meta element if it includes `"meta"`.
  delivery?: string,

  // Controls if addon is enabled at all.
  enabled?: boolean,

  // Controls if addon causes tests to fail if they violate configured CSP
  // policy.
  failTests: true,

  // A hash of options representing a Content Security Policy. The key must be
  // a CSP directive name as defined by spec. The value must be an array of
  // strings that form a CSP directive value, most likely a source list, e.g.
  // {
  //   'default-src': ["'none'"],
  //   'style-src': ["'self'", 'examples.com']
  // }
  // Please refer to CSP specification for details on valid CSP directives:
  // https://w3c.github.io/webappsec-csp/#framework-directives
  policy?: { [key: directiveName]: string[]; },

  // Controls if CSP is used in report only mode. For delivery mode `"header"`
  // this causes `Content-Security-Policy-Report-Only` HTTP header to be used.
  // Can not be used together with delivery mode `"meta"` as this is not
  // supported by CSP spec.
  reportOnly?: boolean,
}
```

If you omit some or all of the keys, the default configuration will be used, which is:

```js
// config/content-security-policy.js

export default function(environment) {
  return {
    delivery: ['header'],
    enabled: true,
    failTests: true,
    policy: {
      'default-src':  ["'none'"],
      'script-src':   ["'self'"],
      'font-src':     ["'self'"],
      'connect-src':  ["'self'"],
      'img-src':      ["'self'"],
      'style-src':    ["'self'"],
      'media-src':    ["'self'"],
    },
    reportOnly: true,
  };
}
```

> Keywords such as `self`, `none`, `unsafe-inline`, nonces and digests must be wrapped in single quotes (`'`) as shown above. Please find more details about valid source expression in [§ 2.3.1. Source Lists of CSP specification](https://www.w3.org/TR/CSP3/#framework-directive-source-list).

### Example

If your site uses **Google Fonts**, **Mixpanel**, a custom API at **custom-api.local** and you want to deliver the CSP using a meta element:

```js
// config/content-security-policy.js

module.exports = function(environment) {
  return {
    delivery: ['meta'],
    policy: {
      // Deny everything by default
      'default-src': ["'none'"],
      // Allow scripts at https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js
      'script-src':  ["'self'", "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"],
      // Allow fonts to be loaded from http://fonts.gstatic.com
      'font-src': ["'self'", "http://fonts.gstatic.com"],
      // Allow data (xhr/websocket) from api.mixpanel.com and custom-api.local
      'connect-src': ["'self'", "https://api.mixpanel.com", "https://custom-api.local"],
      // Allow images from the origin itself (i.e. current domain)
      'img-src': ["'self'"],
      // Allow CSS loaded from https://fonts.googleapis.com
      'style-src': ["'self'", "https://fonts.googleapis.com"],
      // Omit `media-src` from policy
      // Browser will fallback to default-src for media resources (which is 'none', see above)
      'media-src': null
    },
    reportOnly: false
  };
};
```


FastBoot Integration
------------------------------------------------------------------------------

This addon sets the CSP HTTP response header in FastBoot if it's enabled for the used environment and `delivery` contains `"header"`. It does not override existing CSP headers.

If using `reportOnly` mode you must provide a valid `reportUri` directive pointing to an endpoint that accepts violation reports. As `reportUri` directive is deprecated you should additionally provide a `reportTo` directive, even so it's only supported by Google Chrome so far.

If you don't want the addon to inject the CSP header in FastBoot on production (e.g. cause CSP header should be set by a reverse proxy in front of FastBoot App Server), you should either remove `"header"` from `delivery` option or disable the addon entirely.

```js
// config/content-security-policy.js

module.exports = function(environment) {
  return {
    enabled: environment !== 'production',
    delivery: ["header"],
  };
};
```


External Configuration
------------------------------------------------------------------------------

In order to configure your production web server, you can use the `csp-headers` Ember CLI command to obtain the configured Content Security Policy:

```bash
$ ember csp-headers --environment production --report-uri /csp-report

# Content Security Policy Header Configuration
#
# for Apache: Header set Content-Security-Policy-Report-Only "..."
# for Nginx : add_header Content-Security-Policy-Report-Only "...";

default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; report-uri /csp-report;
```


Development Support
------------------------------------------------------------------------------

Ember CLI's live reload feature requires a Web Socket connection. If live reload is used with `ember serve` or `ember test --server` the URL used for that Web Socket connection is injected into `connect-src` and `script-src` directives automatically.


Test Support
------------------------------------------------------------------------------

The addon helps you to ensure that your app or addon is compliant with a specific Content Security Policy by providing test support. It causes tests to fail if the code triggers a violation of the configured CSP.

It's recommended to test your project for CSP compliance. But you could disable it nevertheless by setting `enabled` option to `false` for `test` environment:

```js
// config/content-security-policy.js

module.exports = function(environment) {
  return {
    enabled: environment !== 'test',
  };
};
```


Compatibility with other addons
------------------------------------------------------------------------------

Some addons are not compatible with a strict Content Security Policy. If you face any CSP violations caused by a third-party addon please report at their side. Often it's only a small change to required to make it compliant with a strict CSP. You may want to suggest adding this addon to test for compliance with a strict CSP.

For some addons compliance with a strict CSP requires a custom configuration. This documentation lists required configuration for some very famous once.

### Ember Auto Import

[Ember Auto Import](https://github.com/ef4/ember-auto-import#ember-auto-import) uses the `eval` function by default in development builds. This violates the default CSP policy. It's recommended to set Ember Auto Import's `forbidEval` option to `true` if using Content Security Policy. You should _not_ add `'unsafe-eval'` to `script-src` directive as this disalbes main security provided by CSP.
