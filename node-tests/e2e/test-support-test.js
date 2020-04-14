const expect = require('chai').expect;
const AddonTestApp = require('ember-cli-addon-tests').AddonTestApp;
const fs = require('fs-extra');
const denodeify = require('denodeify');
const request = denodeify(require('request'));
const {
  CSP_META_TAG_REG_EXP,
  getConfigPath,
  removeConfig,
  setConfig
} = require('../utils');

describe('e2e: provides test support', function() {
  this.timeout(300000);

  let app;

  before(async function() {
    app = new AddonTestApp();

    await app.create('default', { noFixtures: true });

    // create a simple rendering tests that violates default CSP by using
    // inline JavaScript
    let testFolder = 'tests/integration/components';
    let testFile = `${testFolder}/my-component-test.js`;
    await fs.ensureDir(app.filePath(testFolder));
    await fs.writeFile(
      app.filePath(testFile),
      `
        import { module, test } from 'qunit';
        import { setupRenderingTest } from 'ember-qunit';
        import { render } from '@ember/test-helpers';
        import hbs from 'htmlbars-inline-precompile';

        module('Integration | Component | my-component', function(hooks) {
          setupRenderingTest(hooks);

          test('it renders', async function(assert) {
            await render(hbs\`<div style='display: none;'></div>\`);
            assert.ok(true);
          });
        });
      `
    );
  });

  afterEach(async function() {
    await removeConfig(app);
  });

  it('causes tests to fail on CSP violations', async function() {
    // runEmberCommand throws result object if command exists with non zero
    // exit code
    try {
      await app.runEmberCommand('test');

      // expect runEmberCommand to throw
      expect(false).to.be.true;
    } catch({ code }) {
      expect(code).to.equal(1);
    }
  });

  it('ensures CSP is applied in tests regradless if executed with development server or not', async function() {
    await setConfig(app, {
      delivery: ['header'],
    });

    await app.runEmberCommand('build');

    let testsIndexHtml = await fs.readFile(app.filePath('dist/tests/index.html'), 'utf8');
    let indexHtml = await fs.readFile(app.filePath('dist/index.html'), 'utf8');
    expect(testsIndexHtml).to.match(CSP_META_TAG_REG_EXP);
    expect(indexHtml).to.not.match(CSP_META_TAG_REG_EXP);
  });

  describe('adds nonce to script-src if needed', function() {
    afterEach(async function() {
      await removeConfig(app);
      await app.stopServer();
    });

    it('adds nonce to script-src when required by tests', async function() {
      await setConfig(app, {
        delivery: ['meta'],
      });

      await app.startServer();

      let response = await request({
        url: 'http://localhost:49741/tests/',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.match(/script-src [^;]* 'nonce-/);
      });
    });

    it('does not add nonce to script-src if directive contains \'unsafe-inline\'', async function() {
      await setConfig(app, {
        delivery: ['meta'],
        policy: {
          'script-src': ["'self'", "'unsafe-inline'"]
        }
      });

      await app.startServer();

      let response = await request({
        url: 'http://localhost:49741/tests/',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.not.include('nonce-');
      });
    });
  });

  describe('it uses CSP configuration for test environment if running tests', function() {
    before(async function() {
      // setConfig utility does not support configuration depending on environment
      // need to write the file manually
      let configuration = `
        module.exports = function(environment) {
          return {
            delivery: ['header', 'meta'],
            policy: {
              'default-src': environment === 'test' ? ["'none'"] : ["'self'"]
            },
            reportOnly: false
          };
        };
      `;
      await fs.writeFile(getConfigPath(app), configuration);

      await app.startServer();
    });

    after(async function() {
      await app.stopServer();
    });

    it('uses CSP configuration for test environment for meta tag in tests/index.html', async function() {
      let testsIndexHtml = await fs.readFile(app.filePath('dist/tests/index.html'), 'utf8');
      let indexHtml = await fs.readFile(app.filePath('dist/index.html'), 'utf8');

      let [,cspInTestsIndexHtml] = testsIndexHtml.match(CSP_META_TAG_REG_EXP);
      let [,cspInIndexHtml] = indexHtml.match(CSP_META_TAG_REG_EXP);

      expect(cspInTestsIndexHtml).to.include("default-src 'none';");
      expect(cspInIndexHtml).to.include("default-src 'self';");
    });

    it('uses CSP configuration for test environment for CSP header serving tests/', async function() {
      let responseForTests = await request({
        url: 'http://localhost:49741/tests',
        headers: {
          'Accept': 'text/html'
        }
      });
      let responseForApp = await request({
        url: 'http://localhost:49741',
        headers: {
          'Accept': 'text/html'
        }
      });

      let cspForTests = responseForTests.headers['content-security-policy'];
      let cspForApp = responseForApp.headers['content-security-policy'];

      expect(cspForTests).to.include("default-src 'none';");
      expect(cspForApp).to.include("default-src 'self';");
    });
  });

  describe('includes frame-src required by testem', function() {
    before(async function() {
      await setConfig(app, {
        delivery: ['header', 'meta'],
        reportOnly: false,
      });

      await app.startServer();
    });

    after(async function() {
      await app.stopServer();

      await removeConfig(app);
    });

    it('includes frame-src required by testem in CSP delivered by meta tag', async function() {
      let testsIndexHtml = await fs.readFile(app.filePath('dist/tests/index.html'), 'utf8');
      let [,cspInTestsIndexHtml] = testsIndexHtml.match(CSP_META_TAG_REG_EXP);

      expect(cspInTestsIndexHtml).to.include("frame-src 'self';");
    });

    it('includes frame-src required by testem in CSP delivered by HTTP header', async function() {
      let responseForTests = await request({
        url: 'http://localhost:49741/tests',
        headers: {
          'Accept': 'text/html'
        }
      });
      let cspForTests = responseForTests.headers['content-security-policy'];

      expect(cspForTests).to.include("frame-src 'self';");
    });
  });

  it('does not cause tests failures if addon is disabled', async function() {
    await setConfig(app, {
      enabled: false,
    });
    let { code } = await app.runEmberCommand('test');

    expect(code).to.equal(0);
  });

  it('does not cause tests failures if `failTests` config option is `false`', async function() {
    await setConfig(app, {
      failTests: false,
    });
    let { code } = await app.runEmberCommand('test');

    expect(code).to.equal(0);
  });

  // One common scenario is when running the server in production mode locally, i.e.
  // you are doing the production build on your local machine, connecting to your actual production server,
  // for example via `ember serve -prod`. In these cases we don't want this addon to break.
  it('does not break development server for builds not including tests', async function() {
    await app.startServer({
      additionalArguments: ['-prod']
    });

    let response = await request({
      url: 'http://localhost:49741/',
      headers: {
        'Accept': 'text/html'
      }
    });
    let responseForTests = await request({
      url: 'http://localhost:49741/tests',
      headers: {
        'Accept': 'text/html'
      }
    });

    expect(response.statusCode).to.equal(200);
    expect(responseForTests.statusCode).to.equal(200);

    await app.stopServer();
  });
});
