#!/bin/bash
# Upload test coverage to Codecov

os="$1"
os="${os/-latest/}"

node="$2"
node="node_${node//./_}"

# We don't use the -Z flag (which makes CI build fail on upload error) because
# Codecov fails wait too often.
# curl --fail fails silently (no output) on server errors
curl --fail -s https://codecov.io/bash | \
  bash -s -- -f coverage/coverage-final.json -F "$os" -F "$node"
