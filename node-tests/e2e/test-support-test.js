const expect = require('chai').expect;
const AddonTestApp = require('ember-cli-addon-tests').AddonTestApp;
const fs = require('fs-extra');
const {
  removeConfig,
  setConfig
} = require('../utils');

describe('e2e: provides test support', function() {
  this.timeout(300000);

  let app;

  // tests not altering package.json
  describe('', function() {
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
  });

  // tests altering package.json
  describe('', function() {
    // @ToDo: VersionChecker reports qunit@2.9.2 even so app uses 2.7.1
    it.skip('warns if QUnit version is to old', async function() {
      let app = new AddonTestApp();

      await app.create('default', {
        noFixtures: true,
        skipNpm: true,
      });

      app.editPackageJSON(pkg => {
        // ember-qunit@4.0.0 depends on qunit@~2.7.1, which is less than required >= 2.9.2
        pkg.devDependencies['ember-qunit'] = "4.0.0";
      });

      await app.run('npm', 'install');

      try {
        // throws cause QUnit 4.4.0 violates default CSP
        await app.runEmberCommand('test');

        // expect runEmberCommand to throw
        expect(false).to.be.true;
      } catch ({ output }) {
        let warning = output.find((_) => _.startsWith('WARNING'));
        expect(warning).to.include('QUnit < 2.9.2');
      }
    });
  });
});
