const expect = require('chai').expect;
const TestProject = require('ember-addon-tests').default;
const fs = require('fs-extra');
const denodeify = require('denodeify');
const request = denodeify(require('request'));
const {
  CSP_META_TAG_REG_EXP,
  removeConfig,
  setConfig,
  setResolutionForDependency,
  readPackageJson,
  removeResolutionsForDependencies,
} = require('../utils');
const path = require('path');
const semverGtr = require('semver/ranges/gtr');
const semverRangeSubset = require('semver/ranges/subset');

// Depending on Ember CLI version used some manual adjustments are needed even
// for newly created projects to not violate the default CSP.
async function adjustForCompatibility(testProject) {
  // Ember Auto Import is a default dependency of new Ember projects. It uses an `eval` function
  // internally unless configured to not do so. This violates the default CSP and causes an
  // `EvalError` to be thrown. This uncatched error will cause the tests to fail - regardless
  // of our custom test support.
  // We need to adjust Ember Auto Import's configuration prevent this. It can be removed as
  // soon as Ember CLI Content Security Policy works out of the box with Ember Auto Import.
  try {
    const emberCliBuildJs = await testProject.readFile('ember-cli-build.js');
    await testProject.writeFile(
      'ember-cli-build.js',
      emberCliBuildJs.replace(
        '// Add options here',
        'autoImport: { forbidEval: true }'
      )
    );
  } catch (error) {
    // Trying to remove ember-auto-import dependency may fail cause that dependency is not
    // present for older Ember CLI versions.
  }

  // Older Ember CLI versions install a QUnit version, which violates the
  // default CSP. We ask consumer to upgrade QUnit to a more recent QUnit
  // version in a warning that is logged if QUnit version is less than
  // 2.9.2. The issue was fixed in Ember CLI 3.10 by upgrading ember-qunit
  // to ^4.4.1.
  // We need to upgrade QUnit in tests as well if an Ember CLI version less
  // than 3.10 is used.
  const packageJson = await readPackageJson(testProject);
  const emberCliVersionUsed = packageJson.devDependencies['ember-cli'];
  if (semverGtr('3.10.0', emberCliVersionUsed)) {
    await setResolutionForDependency(testProject, { qunit: '>= 2.9.2' });
    await testProject.runCommand('yarn', 'install');
  }
}

describe('e2e: provides test support', function () {
  this.timeout(300000);

  let testProject;

  before(async function () {
    testProject = new TestProject({
      projectRoot: path.join(__dirname, '../..'),
    });

    await testProject.createEmberApp();
    await testProject.addOwnPackageAsDevDependency(
      'ember-cli-content-security-policy'
    );
    await adjustForCompatibility(testProject);
  });

  after(async function () {
    await removeResolutionsForDependencies(testProject);
  });

  describe('does not cause test failures on new project', async function () {
    it('tests are passing for untouched application', async function () {
      await testProject.runEmberCommand('test');

      // No need to assert anything. Test scenario is fulfilled as long as the
      // command does not throw.
    });

    it('tests are passing for untouched addon', async function () {
      // Global test project is an application. To assert against an addon
      // we need to create another test project.
      const testProject = new TestProject({
        projectRoot: path.join(__dirname, '../..'),
      });

      await testProject.createEmberAddon();
      await testProject.addOwnPackageAsDevDependency(
        'ember-cli-content-security-policy'
      );
      await adjustForCompatibility(testProject);

      await testProject.runEmberCommand('test');

      // No need to assert anything. Test scenario is fulfilled as long as the
      // command does not throw.
    });
  });

  describe('causes tests to fail on CSP violations', async function () {
    const folderForIntegrationTests = 'tests/integration/components';
    const fileViolatingCSP = `${folderForIntegrationTests}/my-component-test.js`;

    beforeEach(async function () {
      // create a simple rendering tests that violates default CSP by using
      // inline JavaScript
      await fs.ensureDir(
        path.join(testProject.path, folderForIntegrationTests)
      );
      await testProject.writeFile(
        fileViolatingCSP,
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

    afterEach(async function () {
      await removeConfig(testProject);
    });

    it('causes tests to fail on CSP violations', async function () {
      // runEmberCommand throws result object if command exists with non zero
      // exit code
      try {
        await testProject.runEmberCommand('test');

        // expect runEmberCommand to throw
        expect(false).to.be.true;
      } catch ({ exitCode }) {
        expect(exitCode).to.equal(1);
      }
    });

    it('does not cause tests failures if addon is disabled', async function () {
      await setConfig(testProject, {
        enabled: false,
      });
      let { exitCode } = await testProject.runEmberCommand('test');

      expect(exitCode).to.equal(0);
    });

    it('does not cause tests failures if `failTests` config option is `false`', async function () {
      await setConfig(testProject, {
        failTests: false,
      });

      let { exitCode } = await testProject.runEmberCommand('test');

      expect(exitCode).to.equal(0);
    });

    // One common scenario is when running the server in production mode locally, i.e.
    // you are doing the production build on your local machine, connecting to your actual production server,
    // for example via `ember serve -prod`. In these cases we don't want this addon to break.
    it('does not break development server for builds not including tests', async function () {
      // TODO: not supported yet
      await testProject.startEmberServer({
        environment: 'prodocution',
        port: '49741',
      });

      let response = await request({
        url: 'http://localhost:49741/',
        headers: {
          Accept: 'text/html',
        },
      });
      let responseForTests = await request({
        url: 'http://localhost:49741/tests',
        headers: {
          Accept: 'text/html',
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(responseForTests.statusCode).to.equal(200);

      await testProject.stopEmberServer();
    });
  });

  describe('ensures consistent results regardless how tests are executed', async function () {
    afterEach(async function () {
      await removeConfig(testProject);
    });

    it('ensures CSP is applied in tests regradless if executed with development server or not', async function () {
      await setConfig(testProject, {
        delivery: ['header'],
      });

      await testProject.runEmberCommand('build');

      let testsIndexHtml = await testProject.readFile(
        'dist/tests/index.html',
        'utf8'
      );
      let indexHtml = await testProject.readFile('dist/index.html', 'utf8');
      expect(testsIndexHtml).to.match(CSP_META_TAG_REG_EXP);
      expect(indexHtml).to.not.match(CSP_META_TAG_REG_EXP);
    });
  });

  describe('adds nonce to script-src if needed', function () {
    afterEach(async function () {
      await removeConfig(testProject);
      await testProject.stopEmberServer();
    });

    it('adds nonce to script-src when required by tests', async function () {
      await setConfig(testProject, {
        delivery: ['meta'],
      });

      await testProject.startEmberServer({
        port: '49741',
      });

      let response = await request({
        url: 'http://localhost:49741/tests/',
        headers: {
          Accept: 'text/html',
        },
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.match(/script-src [^;]* 'nonce-/);
      });
    });

    it("does not add nonce to script-src if directive contains 'unsafe-inline'", async function () {
      await setConfig(testProject, {
        delivery: ['meta'],
        policy: {
          'script-src': ["'self'", "'unsafe-inline'"],
        },
      });

      await testProject.startEmberServer({
        port: '49741',
      });

      let response = await request({
        url: 'http://localhost:49741/tests/',
        headers: {
          Accept: 'text/html',
        },
      });

      let cspInHeader = response.headers['content-security-policy-report-only'];
      let cspInMetaElement = response.body.match(CSP_META_TAG_REG_EXP)[1];
      [cspInHeader, cspInMetaElement].forEach((csp) => {
        expect(csp).to.not.include('nonce-');
      });
    });
  });

  describe('it uses CSP configuration for test environment if running tests', function () {
    before(async function () {
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
      await testProject.writeFile(
        'config/content-security-policy.js',
        configuration
      );

      await testProject.startEmberServer({
        port: '49741',
      });
    });

    after(async function () {
      await testProject.stopEmberServer();
      await removeConfig(testProject);
    });

    it('uses CSP configuration for test environment for meta tag in tests/index.html', async function () {
      let testsIndexHtml = await testProject.readFile(
        'dist/tests/index.html',
        'utf8'
      );
      let indexHtml = await testProject.readFile('dist/index.html', 'utf8');

      let [, cspInTestsIndexHtml] = testsIndexHtml.match(CSP_META_TAG_REG_EXP);
      let [, cspInIndexHtml] = indexHtml.match(CSP_META_TAG_REG_EXP);

      expect(cspInTestsIndexHtml).to.include("default-src 'none';");
      expect(cspInIndexHtml).to.include("default-src 'self';");
    });

    it('uses CSP configuration for test environment for CSP header serving tests/', async function () {
      let responseForTests = await request({
        url: 'http://localhost:49741/tests',
        headers: {
          Accept: 'text/html',
        },
      });
      let responseForApp = await request({
        url: 'http://localhost:49741',
        headers: {
          Accept: 'text/html',
        },
      });

      let cspForTests = responseForTests.headers['content-security-policy'];
      let cspForApp = responseForApp.headers['content-security-policy'];

      expect(cspForTests).to.include("default-src 'none';");
      expect(cspForApp).to.include("default-src 'self';");
    });
  });

  describe('includes frame-src required by testem', function () {
    before(async function () {
      await setConfig(testProject, {
        delivery: ['header', 'meta'],
        reportOnly: false,
      });

      await testProject.startEmberServer({
        port: '49741',
      });
    });

    after(async function () {
      await testProject.stopEmberServer();

      await removeConfig(testProject);
    });

    it('includes frame-src required by testem in CSP delivered by meta tag', async function () {
      let testsIndexHtml = await testProject.readFile(
        'dist/tests/index.html',
        'utf8'
      );
      let [, cspInTestsIndexHtml] = testsIndexHtml.match(CSP_META_TAG_REG_EXP);

      expect(cspInTestsIndexHtml).to.include("frame-src 'self';");
    });

    it('includes frame-src required by testem in CSP delivered by HTTP header', async function () {
      let responseForTests = await request({
        url: 'http://localhost:49741/tests',
        headers: {
          Accept: 'text/html',
        },
      });
      let cspForTests = responseForTests.headers['content-security-policy'];

      expect(cspForTests).to.include("frame-src 'self';");
    });
  });

  describe('it appends to existing frame-src', function () {
    before(async function () {
      await setConfig(testProject, {
        delivery: ['header', 'meta'],
        reportOnly: false,
        policy: {
          'frame-src': ['data:'],
        },
      });

      await testProject.startEmberServer({
        port: '49741',
      });
    });

    after(async function () {
      await testProject.stopEmberServer();

      await removeConfig(testProject);
    });

    it('it appends to existing frame-src in CSP delivered by meta tag', async function () {
      let testsIndexHtml = await testProject.readFile(
        'dist/tests/index.html',
        'utf8'
      );
      let [, cspInTestsIndexHtml] = testsIndexHtml.match(CSP_META_TAG_REG_EXP);

      expect(cspInTestsIndexHtml).to.include("frame-src data: 'self';");
    });

    it('it appends to existing frame-src in CSP delivered by HTTP header', async function () {
      let responseForTests = await request({
        url: 'http://localhost:49741/tests',
        headers: {
          Accept: 'text/html',
        },
      });
      let cspForTests = responseForTests.headers['content-security-policy'];

      expect(cspForTests).to.include("frame-src data: 'self';");
    });
  });
});
