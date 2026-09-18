#!/usr/bin/env bash
# Deploys run in GitHub Actions, never from here. The web app needs Node 20 to
# build, and the server only accepts a deploy through its restricted wrapper
# (see ops/deploy-wrapper.sh), so root rsync from a laptop is gone. This just
# starts the deploy workflow for whatever is on origin/main.
set -euo pipefail

gh workflow run deploy.yml -R joelcrawford/tibetan-flash --ref main
echo "✓ Deploy started for origin/main. Follow it with:"
echo "  gh run watch -R joelcrawford/tibetan-flash"
