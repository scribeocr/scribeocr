// Annoyingly, import.meta.url causes a syntax error when not run in a module (which cannot be bypassed with if/else statements).
// While we will switch everything to worker modules eventually, Firefox still does not support them:
// https://developer.mozilla.org/en-US/docs/Web/API/Worker#browser_compatibility
// Therefore, we use a dynamic import statement to run the following code only in the Node.js version.
const { createRequire } = await import('module');
globalThis.require = createRequire(import.meta.url);
globalThis.__dirname = import.meta.url;
