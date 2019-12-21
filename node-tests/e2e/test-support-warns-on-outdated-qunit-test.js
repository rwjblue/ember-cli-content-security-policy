const expect = require('chai').expect;
const AddonTestApp = require('ember-cli-addon-tests').AddonTestApp;

describe('e2e: test support warns if dependencies are not supported', function() {
  this.timeout(300000);

  it('warns if QUnit version is to old', async function() {
    let app = new AddonTestApp();

    await app.create('outdated-qunit', {
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
