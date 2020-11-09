const expect = require('chai').expect;
const TestProject = require('ember-addon-tests').default;
const denodeify = require('denodeify');
const request = denodeify(require('request'));
const {
  CSP_META_TAG_REG_EXP,
  removeConfig,
  setConfig
} = require('../utils');
const path = require('path');

describe('e2e: delivers CSP as configured', function() {
  this.timeout(300000);

  let testProject;

  before(async function() {
    testProject = new TestProject({
      projectRoot: path.join(__dirname, '../..')
    });

    await testProject.createEmberApp();
    await testProject.addOwnPackageAsDevDependency('ember-cli-content-security-policy');
  });

  describe('scenario: delivery through meta element', function() {
    before(async function() {
      await setConfig(testProject, {
        delivery: ['header', 'meta'],
        policy: {
          'font-src': ["'self'", "http://fonts.gstatic.com"],
        },
        reportOnly: false,
      });

      await testProject.startEmberServer({
        port: '49741',
      });
    });

    after(async function() {
      await testProject.stopEmberServer();
      await removeConfig(testProject);
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
      await setConfig(testProject, {
        delivery: ['header'],
        reportOnly: true,
      });

      await testProject.startEmberServer({
        port: '49741',
      });
    });

    after(async function() {
      await testProject.stopEmberServer();
      await removeConfig(testProject);
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
      await setConfig(testProject, {
        delivery: ['meta'],
      });

      await testProject.startEmberServer({
        port: '49741',
      });
    });

    after(async function() {
      await testProject.stopEmberServer();
      await removeConfig(testProject);
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
      await setConfig(testProject, {
        enabled: false,
      });

      await testProject.startEmberServer({
        port: '49741',
      });
    });

    after(async function() {
      await testProject.stopEmberServer();
      await removeConfig(testProject);
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
    afterEach(async function() {
      await testProject.stopEmberServer();
      await removeConfig(testProject);
    });

    it('adds CSP directives required by live reload', async function() {
      await setConfig(testProject, {
        delivery: ['header', 'meta'],
      });
      await testProject.startEmberServer({
        port: '49741',
      });

      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.match(/connect-src[^;]* ws:\/\/0.0.0.0:49741/);
        expect(csp).to.match(/connect-src[^;]* ws:\/\/localhost:49741/);
        expect(csp).to.match(/script-src[^;]* 0.0.0.0:49741/);
        expect(csp).to.match(/script-src[^;]* localhost:49741/);
      });
    });

    it('takes live reload configuration into account', async function() {
      await setConfig(testProject, {
        delivery: ['header', 'meta'],
      });
      await testProject.startEmberServer({
        liveReloadHost: 'examples.com',
        liveReloadPort: '49494',
        port: '49494',
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
        expect(csp).to.match(/connect-src[^;]* ws:\/\/examples.com:49494/);
        expect(csp).to.match(/script-src[^;]* examples.com:49494/);
      });
    });

    it('inherits from default-src if connect-src and script-src are not present', async function() {
      await setConfig(testProject, {
        delivery: ['header', 'meta'],
        policy: {
          'default-src': ["'self'", "foo.com"],
        },
      });
      await testProject.startEmberServer({
        port: '49741',
      });

      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.match(/connect-src[^;]* 'self'/);
        expect(csp).to.match(/connect-src[^;]* foo.com/);
        expect(csp).to.match(/connect-src[^;]* ws:\/\/0.0.0.0:49741/);
        expect(csp).to.match(/connect-src[^;]* ws:\/\/localhost:49741/);

        expect(csp).to.match(/script-src[^;]* 'self'/);
        expect(csp).to.match(/script-src[^;]* foo.com/);
        expect(csp).to.match(/script-src[^;]* 0.0.0.0:49741/);
        expect(csp).to.match(/script-src[^;]* localhost:49741/);
      });
    });

    it("removes existing 'none' keyword from connect-src", async function() {
      await setConfig(testProject, {
        delivery: ['header', 'meta'],
        policy: {
          'default-src': ["'self'"],
          'connect-src': ["'none'"],
        },
      });
      await testProject.startEmberServer({
        port: '49741',
      });

      let response = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.not.match(/connect-src[^;]* 'none'/);
        expect(csp).to.match(/connect-src[^;]* ws:\/\/0.0.0.0:49741/);
        expect(csp).to.match(/connect-src[^;]* ws:\/\/localhost:49741/);
      });
    });
  });
});
