# ember-cli-content-security-policy

This addon makes it easy to use Content Security Policy (CSP) in your project. It can be deployed either
via a `Content-Security-Policy` header sent from the Ember CLI Express server, or as a meta tag in the
`index.html` file.

When using the header, configuration is still needed on the production server (Ember CLI's express server 
is not intended for production use). When using the meta tag this addon can be used for production deployment.
In any case, using this addon helps keeping CSP in the forefront of your thoughts while developing an Ember application.


Compatibility
------------------------------------------------------------------------------

* Ember.js v2.18 or above
* Ember CLI v3.4 or above
* Node.js v8 or above


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

This addon sets CSP headers in FastBoot if enabled for FastBoot environment and `delivery`
contains `"header"`. If using `reportOnly` mode you must provide a valid `reportUri` directive
pointing to an endpoint that accepts violation reports. As `reportUri` directive is deprecated
you should additionally provide a `reportTo` directive, even so it'ss only supported by Google
Chrome so far.

## External Configuration

In order to configure your production server, you can use the `csp-headers` command to obtain
the current headers:

```bash
$ ember csp-headers --environment production --report-uri /csp-report

# Content Security Policy Header Configuration
#
# for Apache: Header set Content-Security-Policy-Report-Only "..."
# for Nginx : add_header Content-Security-Policy-Report-Only "...";

default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; report-uri /csp-report;
```

*Please note*:
+ When running `ember serve` with live reload enabled, we also add the `liveReloadPort` to
  the `connect-src` and `script-src` whitelists.
+ Browser support for CSP varies between browsers, for example the meta-tag delivery method is only available
  in newer browsers. See the resources below.
+ The Internet Explorer variant of the header (prefixed with `X-`) is automatically added.
+ When setting the values on policy object (`ENV['ember-cli-content-security-policy'].policy`) to 'self', 'none', 'unsafe-inline' or 'unsafe-eval',
  you must include the single quote as shown in the default value above.

Resources
------------------------------------------------------------------------------

* https://w3c.github.io/webappsec-csp/
* http://content-security-policy.com/
* https://developer.mozilla.org/en-US/docs/Web/Security/CSP/Using_Content_Security_Policy
* http://caniuse.com/contentsecuritypolicy
* http://caniuse.com/contentsecuritypolicy2
* https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/45542.pdf

Contributing
------------------------------------------------------------------------------

See the [Contributing](CONTRIBUTING.md) guide for details.

License
------------------------------------------------------------------------------

This project is licensed under the [MIT License](LICENSE.md).
