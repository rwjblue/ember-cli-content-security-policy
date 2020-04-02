import { assert } from '@ember/debug';

// reads addon config stored in meta element
function readAddonConfig(appInstance) {
  let config = appInstance.resolveRegistration('config:environment');
  let addonConfig = config['ember-cli-content-security-policy'];

  // TODO: do not require policy to be stored in config object
  //       if already available through CSP meta element
  assert(
    'Required configuration is available at run-time',
    addonConfig && addonConfig.hasOwnProperty('reportOnly') && addonConfig.hasOwnProperty('policy')
  );

  return config['ember-cli-content-security-policy'];
}

export function initialize(appInstance) {
  let fastboot = appInstance.lookup('service:fastboot');

  if (!fastboot || !fastboot.get('isFastBoot')) {
    // nothing to do if application does not run in FastBoot or
    // does not even have a FastBoot service
    return;
  }

  let { policy, reportOnly } = readAddonConfig(appInstance);
  let header = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  let responseHeaders = fastboot.get('response.headers');

  // do not override existing CSP header
  if (responseHeaders.has('Content-Security-Policy-Report-Only') || responseHeaders.has('Content-Security-Policy')) {
    return;
  }

  responseHeaders.set(header, policy);
}

export default {
  initialize
};
