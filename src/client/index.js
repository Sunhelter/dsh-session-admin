/**
 * Entry of the client bundle. `build.mjs` bundles this module into `client.js`
 * and wraps the output in the factory the Host's module loader expects.
 */
import { apply } from './apply.js';

export const inject = ['slots', 'locale'];

export { apply };
