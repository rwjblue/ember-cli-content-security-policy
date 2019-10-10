const expect = require('chai').expect;
const denodeify = require('denodeify');
const request = denodeify(require('request'));
const AddonTestApp = require('ember-cli-addon-tests').AddonTestApp;
const {
  removeConfig,
  setConfig
} = require('../utils');

const CSP_META_TAG_REG_EXP = /<meta http-equiv="Content-Security-Policy" content="(.*)">/i;

describe('e2e: delivers CSP as configured', function() {
  this.timeout(300000);

  let app;

  before(async function() {
    app = new AddonTestApp();

    await app.create('default', { noFixtures: true });
  });

  describe('scenario: delivery through meta element', function() {
    before(async function() {
      await setConfig(app, {
        delivery: ['header', 'meta'],
        policy: {
          'font-src': ["'self'", "http://fonts.gstatic.com"],
        },
        reportOnly: false,
      });

      await app.startServer();
    });

    after(async function() {
      await app.stopServer();
      await removeConfig(app);
    });

    it('creates a CSP meta tag if `delivery` option includes `"meta"`', async function() {
      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      expect(response.body).to.match(CSP_META_TAG_REG_EXP);
    });

    it('delivers same policy by meta element as by HTTP header', async function() {
      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspInHeader = response.headers['content-security-policy'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      expect(cspInHeader).to.equal(cspInMetaElement);
    });
  });

  describe('scenario: report only', function() {
    before(async function() {
      await setConfig(app, {
        delivery: ['header'],
        reportOnly: true,
      });

      await app.startServer();
    });

    after(async function() {
      await app.stopServer();
      await removeConfig(app);
    });

    it('uses Content-Security-Policy-Report-Only header if `reportOnly` option is `true`', async function() {
      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      expect(response.headers).to.include.key('content-security-policy-report-only');
      expect(response.headers).to.not.have.key('content-security-policy');
    });
  });

  describe('scenario: delivery through meta only', function() {
    before(async function() {
      await setConfig(app, {
        delivery: ['meta'],
      });

      await app.startServer();
    });

    after(async function() {
      await app.stopServer();
      await removeConfig(app);
    });

    it('does not deliver CSP through HTTP header if delivery does not include "header"', async function() {
      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      expect(response.headers).to.not.have.key('content-security-policy-report-only');
      expect(response.headers).to.not.have.key('content-security-policy');
      expect(response.body).to.match(CSP_META_TAG_REG_EXP);
    });
  });

  describe('scenario: disabled', function() {
    before(async function() {
      await setConfig(app, {
        enabled: false,
      });

      await app.startServer();
    });

    after(async function() {
      await app.stopServer();
      await removeConfig(app);
    });

    it('does not deliver CSP if `enabled` option is `false`', async function() {
      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      expect(response.headers).to.not.have.key('content-security-policy');
      expect(response.headers).to.not.have.key('content-security-policy-report-only');
      expect(response.body).to.not.match(CSP_META_TAG_REG_EXP);
    });
  });

  describe('feature: live reload support', function() {
    before(async function() {
      await setConfig(app, {
        delivery: ['header', 'meta'],
      });
    });

    after(async function() {
      await removeConfig(app);
    });

    afterEach(async function() {
      await app.stopServer();
    });

    it('adds CSP directives required by live reload', async function() {
      await app.startServer();

      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.match(/connect-src [^;]* ws:\/\/0.0.0.0:49741/);
        expect(csp).to.match(/connect-src [^;]* ws:\/\/localhost:49741/);
        expect(csp).to.match(/script-src [^;]* 0.0.0.0:49741/);
        expect(csp).to.match(/script-src [^;]* localhost:49741/);
      });
    });

    it('takes live reload configuration into account', async function() {
      await app.startServer({
        additionalArguments: [
          '--live-reload-host',
          'examples.com',
          '--live-reload-port',
          '49494',
          '--port',
          '49494'
        ],
      });

      let response = await request({
        url: 'http://localhost:49494',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.match(/connect-src [^;]* ws:\/\/examples.com:49494/);
        expect(csp).to.match(/script-src [^;]* examples.com:49494/);
      });
    });
  });
});
