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
* Ember CLI v2.13 or above


Installation
------------------------------------------------------------------------------

```bash
ember install ember-cli-content-security-policy
```

## Configuration

This addon is configured via `config/content-security-policy.js` file.

- `delivery: string[]`
  CSP is delivered via HTTP Header if delivery includes `"header"` and via meta element if it includes `"meta"`.
  Defaults to `["header"]`.
- `enabled: boolean`
  Controls if addon is enabled at all.
  Defaults to `true`.
- `policy: object`
  A hash of options representing a Content Security Policy.
  Defaults to:
  ```js
  {
    'default-src':  ["'none'"],
    'script-src':   ["'self'"],
    'font-src':     ["'self'"],
    'connect-src':  ["'self'"],
    'img-src':      ["'self'"],
    'style-src':    ["'self'"],
    'media-src':    ["'self'"],
  }
  ```
  To clear a directive from the default policy, set it to `null`.
  The browser will fallback to the `default-src` if a directive does not exist.
- `reportOnly: boolean`
  Controls if CSP is used in report only mode. For delivery mode `"header"` this causes `Content-Security-Policy-Report-Only` HTTP header to be used.
  Can not be used together with delivery mode `"meta"` as this is not supported by CSP spec.
  Defaults to `true`.

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

## Resources

* http://www.w3.org/TR/CSP/
* http://content-security-policy.com/
* https://developer.mozilla.org/en-US/docs/Web/Security/CSP/Using_Content_Security_Policy
* http://caniuse.com/contentsecuritypolicy
* http://caniuse.com/contentsecuritypolicy2
* https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/45542.pdf
