/**
 * The one place the client bundle touches the shared module table.
 *
 * The Host's module loader calls every plugin factory with a `require` that
 * resolves platform modules, so React must come from that table and never from
 * a copy bundled into client.js. Every other module imports this one.
 */
const React = require('react');

export default React;

/** Shorthand for `React.createElement`, matching the rest of the plugin. */
export const h = React.createElement;
