import { createRequire } from "node:module";

/**
 * The package version, read from the package root's package.json at load
 * time. npm always ships package.json in the tarball, and dist/version.js
 * sits one level below it, so the path holds in the published package as
 * well as in a checkout.
 */
const pkg = createRequire(import.meta.url)("../package.json") as { version: string };

export const version: string = pkg.version;
