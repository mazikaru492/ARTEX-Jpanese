#!/bin/sh
set -eu

# Fail before starting the service if an old Node.js binary was reintroduced.
node /app/scripts/check-node-security.cjs
exec /app/start.sh "$@"
