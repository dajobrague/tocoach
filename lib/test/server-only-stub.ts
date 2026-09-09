// vitest alias target for the `server-only` package. Outside Next's bundler
// the package throws on import (its default export condition is the error);
// tests import server modules directly, so they get this empty module instead.
export {};
