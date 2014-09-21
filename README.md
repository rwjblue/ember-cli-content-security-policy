# ember-cli-content-security-policy

This addon adds the `Content-Security-Policy` header to response sent from the Ember CLI Express server.
Clearly, Ember CLI is not intended for production use, and neither is this addon. This is intended as a
tool to ensure that CSP is kept in the forefront of your thoughts while developing an Ember application.

## Options

This addon is configured via your applications `config/environment.js` file. Two specific properties are
used from your projects configuration:

* `contentSecurityPolicyHeader` -- The header to use for CSP (**default: `Content-Security-Policy`**)
* `contentSecurityPolicy` -- This is an object that is used to build the final header value. Each key/value
  in this object is converted into a key/value pair in the resulting header value.

The default `contentSecurityPolicy` value is:

```javascript
  contentSecurityPolicy: {
    'default-src': 'none',
    'script-src': 'self',
    'connect-src': 'self',
    'img-src': 'self',
    'style-src': 'self'
  }
```

Which is translated into:

```
default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self';
```

Please note, that when running `ember serve` with live reload enabled, we also add the `liveReloadPort` to
the `connect-src` whitelist.

## Installation

```bash
npm install --save-dev ember-cli-content-security-policy
```

## Resources:

* http://www.w3.org/TR/CSP/
* http://content-security-policy.com/
* https://developer.mozilla.org/en-US/docs/Web/Security/CSP/Using_Content_Security_Policy
