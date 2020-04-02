const expect = require('chai').expect;
const AddonTestApp = require('ember-cli-addon-tests').AddonTestApp;
const fs = require('fs-extra');
const denodeify = require('denodeify');
const request = denodeify(require('request'));
const {
  removeConfig,
  setConfig
} = require('../utils');

function getRunTimeConfig(html) {
  let encodedConfig = html.match(/<meta name="default\/config\/environment" content="(.*)" \/>/)[1];
  return JSON.parse(decodeURIComponent(encodedConfig));
}

describe('e2e: fastboot integration', function() {
  this.timeout(300000);

  let app;
  let serverProcess;
  let serverPromise;

  // code to start and stop fastboot app server is highly inspired by ember-cli-addon-tests
  // https://github.com/tomdale/ember-cli-addon-tests/blob/master/lib/commands/start-server.js
  function startServer() {
    return new Promise((resolve, reject) => {
      serverPromise = app.run('node', 'server.js', {
        onOutput(output, child) {
          // detect start of fastboot app server
          if (output.includes('HTTP server started')) {
            serverProcess = child;
            resolve();
          }
        },
      }).catch(reject);
    });
  }

  async function stopServer() {
    // stop fastboot app server
    if (process.platform === 'win32') {
      serverProcess.send({ kill: true });
    } else {
      serverProcess.kill('SIGINT');
    }

    // wait until sever terminated
    await serverPromise;
  }

  before(async function() {
    app = new AddonTestApp();

    await app.create('default', {
      noFixtures: true,
      skipNpm: true,
    });

    await app.editPackageJSON(pkg => {
      pkg.devDependencies['ember-cli-fastboot'] = "*";
      pkg.devDependencies['fastboot-app-server'] = "*";
    });

    await app.run('npm', 'install');

    // Quick Start instructions of FastBoot App Server
    // https://github.com/ember-fastboot/fastboot-app-server
    await fs.writeFile(app.filePath('server.js'),
      `
        const FastBootAppServer = require('fastboot-app-server');

        let server = new FastBootAppServer({
          distPath: 'dist',
          port: 49742,
        });

        server.start();
      `
    );
  });

  describe('scenario: default', function() {
    before(async function() {
      await app.runEmberCommand('build');
      await startServer();
    });

    after(async function() {
      await stopServer();
      await removeConfig(app);
    });

    it('sets CSP header if served via FastBoot', async function() {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          'Accept': 'text/html'
        },
      });

      expect(response.headers).to.include.key('content-security-policy-report-only');
    });
  });

  describe('scenario: disabled', function() {
    before(async function() {
      await setConfig(app, { enabled: false });
      await app.runEmberCommand('build');
      await startServer();
    });

    after(async function() {
      await stopServer();
      await removeConfig(app);
    });

    it('does not set CSP header if disabled', async function() {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          'Accept': 'text/html'
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.not.include.key('content-security-policy-report-only');
    });

    it('does not push run-time configuration into app if disabled', async function() {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          'Accept': 'text/html'
        },
      });

      let runTimeConfig = getRunTimeConfig(response.body);
      expect(response.statusCode).to.equal(200);
      expect(runTimeConfig).to.not.include.key('ember-cli-content-security-policy');
    });

    it('does not push instance initializer into app if disabled', async function() {
      let response = await request({
        url: 'http://localhost:49742/assets/vendor.js',
        headers: {
          'Accept': 'application/javascript'
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.not.include('instance-initializers/content-security-policy');
    });
  });

  describe('scenario: delivery does not include header', function() {
    before(async function() {
      await setConfig(app, { delivery: ['meta'] });
      await app.runEmberCommand('build');
      await startServer();
    });

    after(async function() {
      await stopServer();
      await removeConfig(app);
    });

    it('does not set CSP header if delivery does not include header', async function() {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          'Accept': 'text/html'
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.not.include.key('content-security-policy-report-only');
    });

    it('does not push run-time configuration into app if delivery does not include header', async function() {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          'Accept': 'text/html'
        },
      });

      let runTimeConfig = getRunTimeConfig(response.body);
      expect(response.statusCode).to.equal(200);
      expect(runTimeConfig).to.not.include.key('ember-cli-content-security-policy');
    });

    it('does not push instance initializer into app if disabled', async function() {
      let response = await request({
        url: 'http://localhost:49742/assets/vendor.js',
        headers: {
          'Accept': 'application/javascript'
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.not.include('instance-initializers/content-security-policy');
    });
  });

  describe('scenario: CSP header already defined', function() {
    before(async function() {
      await fs.rename(app.filePath('server.js'), app.filePath('server.js.org'));

      // FastBoot App Server that sets a CSP header
      await fs.writeFile(app.filePath('server.js'),
        `
          const FastBootAppServer = require('fastboot-app-server');
          const ExpressHTTPServer = require('fastboot-app-server/src/express-http-server');

          const httpServer = new ExpressHTTPServer({
            port: 49742,
          });
          const app = httpServer.app;

          app.use(function (req, res, next) {
            res.append('Content-Security-Policy', "default-src 'none';");
            next();
          });

          let server = new FastBootAppServer({
            distPath: 'dist',
            httpServer: httpServer,
          });

          server.start();
        `
      );

      await app.runEmberCommand('build');
      await startServer();
    });

    after(async function() {
      await stopServer();
      await removeConfig(app);
      await fs.rename(app.filePath('server.js.org'), app.filePath('server.js'));
    });

    it('does not override existing CSP header if served via FastBoot', async function() {
      let response = await request({
        url: 'http://localhost:49742',
        headers: {
          'Accept': 'text/html'
        },
      });
      expect(response.headers).to.include.key('content-security-policy');
      expect(response.headers['content-security-policy']).to.equal("default-src 'none';");

      expect(response.headers).to.not.include.key('content-security-policy-report-only');
    });
  })
});
