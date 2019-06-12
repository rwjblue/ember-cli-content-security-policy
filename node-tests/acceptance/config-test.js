const expect = require('chai').expect;
const AddonModel = require('ember-cli/lib/models/addon');
const EmberCliContentSecurityPolicy = require('../../index');

const CONFIG_KEY = 'ember-cli-content-security-policy';

describe('configuration', function() {
  let addon;

  beforeEach(function() {
    let ui =  {
      writeWarnLine() {},
    };
    let project = { ui };
    let parent = {};

    let Addon = AddonModel
      .extend({ root: '.' })
      .extend(EmberCliContentSecurityPolicy);

    addon = new Addon(parent, project);
  });

  it('is enabled by default', function() {
    let config = addon.config('development', {});
    expect(config[CONFIG_KEY].enabled).to.be.true;
  });

  it('delivers CSP by HTTP header by default', function() {
    let config = addon.config('development', {});
    expect(config[CONFIG_KEY].delivery).to.deep.equal(['header']);
  });

  it('defaults to report only mode', function() {
    let config = addon.config('development', {});
    expect(config[CONFIG_KEY].reportOnly).to.be.true;
  });

  describe('legacy support', function() {
    it('supports `contentSecurityPolicy` config option', function() {
      let policy = {
        'default-src': ['"self"'],
        'font-src': ["'self'", "http://fonts.gstatic.com"],
      };
      let config = addon.config('development', {
        contentSecurityPolicy: policy,
      });
      expect(config[CONFIG_KEY].policy).to.deep.equal(policy);
    });

    it('supports `contentSecurityPolicyMeta` config option', function() {
      let config = addon.config('development', {
        contentSecurityPolicyMeta: true,
      });
      expect(config[CONFIG_KEY].delivery).to.include('meta');

      config = addon.config('development', {
        contentSecurityPolicyMeta: false,
      });
      expect(config[CONFIG_KEY].delivery).to.not.include('meta');
    });

    it('supports `contentSecurityPolicyHeader` config', function() {
      let config = addon.config('development', {
        contentSecurityPolicyHeader: 'Content-Security-Policy-Report-Only',
      });
      expect(config[CONFIG_KEY].reportOnly).to.be.true;

      config = addon.config('development', {
        contentSecurityPolicyHeader: 'Content-Security-Policy',
      });
      expect(config[CONFIG_KEY].reportOnly).to.be.false;
    });
  });
});
