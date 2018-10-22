# ember-cli-content-security-policy

This addon makes it easy to use Content Security Policy (CSP) in your project. It can be deployed either
via a `Content-Security-Policy` header sent from the Ember CLI Express server, or as a meta tag in the
`index.html` file.

When using the header, configuration is still needed on the production server (Ember CLI's express server 
is not intended for production use). When using the meta tag this addon can be used for production deployment.
In any case, using this addon helps keeping CSP in the forefront of your thoughts while developing an Ember application.

## Installation

```bash
ember install ember-cli-content-security-policy
```

## Options

This addon is configured via your applications `config/environment.js` file. Two specific properties are
used from your projects configuration:

* `contentSecurityPolicyHeader` -- The header to use for CSP. There are two options:
  - `Content-Security-Policy-Report-Only` This is the default and means nothing is actually blocked but you get warnings in the console.
  - `Content-Security-Policy` This makes the browser block any action that conflicts with the Content Security Policy.

* `contentSecurityPolicy` -- This is an object that is used to build the final header value. Each key/value
  in this object is converted into a key/value pair in the resulting header value.

* `contentSecurityPolicyMeta` -- Boolean. Toggle delivery via meta-tag. Useful for deployments where headers are not available (mobile, S3, etc) or to tether the CSP policy to the client payload (i.e. policy can be updated without reconfiguring servers).

The default `contentSecurityPolicy` value is:

```javascript
  contentSecurityPolicy: {
    'default-src': ["'none'"],
    'script-src':  ["'self'"],
    'font-src':    ["'self'"],
    'connect-src': ["'self'"],
    'img-src':     ["'self'"],
    'style-src':   ["'self'"],
    'media-src':   ["'self'"]
  }
```

Which is translated into:

```
default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self';
```

If a directive is omitted it will default to `'self'`. To clear a directive from the default policy above, set it to `null`. The browser will fallback to the `default-src` if a directive does not exist.

### Example

If your site uses **Google Fonts**, **Mixpanel** and a custom API at **custom-api.local**:

```javascript
// config/environment.js
ENV.contentSecurityPolicy = {
  // Deny everything by default
  'default-src': "'none'",
  
  // Allow scripts at https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js
  'script-src': ["'self'", "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"],
  
  // Allow fonts to be loaded from http://fonts.gstatic.com
  'font-src': ["'self'", "http://fonts.gstatic.com"],
  
  // Allow data (xhr/websocket) from api.mixpanel.com and custom-api.local
  'connect-src': ["'self'", "https://api.mixpanel.com", "https://custom-api.local"],
  
  // Allow images from the origin itself (i.e. current domain)
  'img-src': "'self'",
  
  // Allow CSS loaded from https://fonts.googleapis.com
  'style-src': ["'self'", "https://fonts.googleapis.com"],
  
  // Omit `media-src` from policy
  // Browser will fallback to default-src for media resources (which is 'none', see above)
  'media-src': null
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
+ When using the meta-tag, the report-only mode is not available (a restriction in the CSP spec).
+ The Internet Explorer variant of the header (prefixed with `X-`) is automatically added.
+ When setting the values on `contentSecurityPolicy` object to 'self', 'none', 'unsafe-inline' or 'unsafe-eval', 
  you must include the single quote as shown in the default value above.

## Resources

* http://www.w3.org/TR/CSP/
* http://content-security-policy.com/
* https://developer.mozilla.org/en-US/docs/Web/Security/CSP/Using_Content_Security_Policy
* http://caniuse.com/contentsecuritypolicy
* http://caniuse.com/contentsecuritypolicy2
* https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/45542.pdf
