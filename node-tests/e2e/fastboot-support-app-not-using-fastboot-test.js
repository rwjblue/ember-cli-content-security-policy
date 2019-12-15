const expect = require('chai').expect;
const AddonTestApp = require('ember-cli-addon-tests').AddonTestApp;
const denodeify = require('denodeify');
const request = denodeify(require('request'));

function getRunTimeConfig(html) {
  let encodedConfig = html.match(/<meta name="default\/config\/environment" content="(.*)" \/>/)[1];
  return JSON.parse(decodeURIComponent(encodedConfig));
}

// ember-cli-version-checker reports wrong information if used together with ember-cli-addon-tests.
describe.skip('e2e: fastboot integration if consumer does not use FastBoot', function() {
  this.timeout(300000);

  let app;

  before(async function() {
    app = new AddonTestApp();

    await app.create('default', {
      noFixtures: true,
      skipNpm: true,
    });

    await app.editPackageJSON(pkg => {
      delete pkg.devDependencies['ember-cli-fastboot'];
      delete pkg.devDependencies['fastboot-app-server'];
    });

    await app.run('npm', 'install');

    await app.startServer();
  });

  after(async function() {
    await app.stopServer();
  });

  it('does not push run-time configuration into app if app does not use FastBoot', async function() {
    let response = await request({
      url: 'http://localhost:49741',
      headers: {
        'Accept': 'text/html'
      }
    });

    expect(response.statusCode).to.equal(200);

    let runTimeConfig = getRunTimeConfig(response.body);
    expect(runTimeConfig).to.not.include.key('ember-cli-content-security-policy');
  });
});
