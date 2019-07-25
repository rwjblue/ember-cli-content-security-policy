const expect = require('chai').expect;
const AddonTestApp = require('ember-cli-addon-tests').AddonTestApp;
const {
  removeConfig,
  setConfig
} = require('../utils');

describe('e2e: CLI command csp-headers', function() {
  this.timeout(300000);

  let app;

  before(async function() {
    app = new AddonTestApp();

    await app.create('default', { noFixtures: true });
  });

  afterEach(async function() {
    await removeConfig(app);
  });

  it('returns CSP on stdout', async function() {
    await setConfig(app, {
      policy: {
        'default-src': "'self'",
        'script-src': "'self' 'unsafe-inline'",
      },
    });

    let { output } = await app.runEmberCommand('csp-headers', '--silent');
    expect(output[0]).to.equal("default-src 'self'; script-src 'self' 'unsafe-inline';\n");
  });
});
