const expect = require('chai').expect;
const TestProject = require('ember-addon-tests').default;
const path = require('path');

describe('e2e: test support warns if dependencies are not supported', function() {
  this.timeout(300000);

  it('warns if QUnit version is to old', async function() {
    let testProject = new TestProject({
      projectRoot: path.join(__dirname, '../..'),
    });

    await testProject.createEmberApp();
    await testProject.addOwnPackageAsDevDependency('ember-cli-content-security-policy');
    await testProject.addDevDependency('ember-qunit', '4.0.0');

    try {
      // throws cause QUnit 4.4.0 violates default CSP
      await testProject.runEmberCommand('test');

      // expect runEmberCommand to throw
      expect(false).to.be.true;
    } catch ({ stdout }) {
      expect(stdout).to.include('WARNING: QUnit < 2.9.2 violates a strict Content Security Policy (CSP) by itself.');
    }
  });
});
