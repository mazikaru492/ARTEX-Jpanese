'use strict';

// Node.js security releases containing the CVE-2026-111497 fix.
const MINIMUM_VERSIONS = { 22: [23, 4], 24: [22, 1], 26: [12, 1] };

function assertPatchedNode(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Unsupported Node.js version: ${version}`);
  const [, major, minor, patch] = match.map(Number);
  const minimum = MINIMUM_VERSIONS[major];
  if (!minimum || minor < minimum[0] ||
      (minor === minimum[0] && patch < minimum[1])) {
    throw new Error(`Node.js ${version} is not a supported patched runtime. ` +
      'CVE-2026-111497 requires 22.23.4+, 24.22.1+, or 26.12.1+ in those release lines.');
  }
}

if (require.main === module) {
  try {
    assertPatchedNode(process.versions.node);
    console.log(`Node.js ${process.versions.node}: CVE-2026-111497 version check passed`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertPatchedNode };
