const expect = require('chai').expect;
const AddonModel = require('ember-cli/lib/models/addon');
const EmberCliContentSecurityPolicy = require('../../index');

function getAppMock(customOptions = {}) {
  let options = Object.assign({
    environment: 'development',
    runtimeConfig: {},
    buildConfig: {
      liveReload: true,
    },
  }, customOptions);

  return {
    env: options.environment,
    options: options.buildConfig,
    project: {
      config() {
        return options.runtimeConfig;
      },
      ui: {
        writeWarnLine() {},
      },
    },
  };
}

describe('unit: configuration', function() {
  let addon;

  beforeEach(function() {
    let Addon = AddonModel
      .extend({ root: '.' })
      .extend(EmberCliContentSecurityPolicy);

    addon = new Addon();
  });

  it('is enabled by default', function() {
    addon.calculateConfig(getAppMock());

    expect(addon._config.enabled).to.be.true;
  });

  it('delivers CSP by HTTP header by default', function() {
    addon.calculateConfig(getAppMock());
    expect(addon._config.delivery).to.deep.equal(['header']);
  });

  it('defaults to report only mode', function() {
    addon.calculateConfig(getAppMock());

    expect(addon._config.reportOnly).to.be.true;
  });

  describe('legacy support', function() {
    it('supports `contentSecurityPolicy` config option', function() {
      let policy = {
        'default-src': ['"self"'],
        'font-src': ["'self'", "http://fonts.gstatic.com"],
      };
      addon.calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicy: policy,
        },
      }));
      expect(addon._config.policy).to.deep.equal(policy);
    });

    it('supports `contentSecurityPolicyMeta` config option', function() {
      addon.calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicyMeta: true,
        },
      }));
      expect(addon._config.delivery).to.include('meta');

      addon.calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicyMeta: false,
        },
      }));
      expect(addon._config.delivery).to.not.include('meta');
    });

    it('supports `contentSecurityPolicyHeader` config', function() {
      addon.calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicyHeader: 'Content-Security-Policy-Report-Only',
        },
      }));
      expect(addon._config.reportOnly).to.be.true;

      addon.calculateConfig(getAppMock({
        runtimeConfig: {
          contentSecurityPolicyHeader: 'Content-Security-Policy',
        },
      }));
      expect(addon._config.reportOnly).to.be.false;
    });
  });
});
