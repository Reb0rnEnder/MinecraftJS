#!/usr/bin/env bash
# Rebuild builder/client/bundle/*.js from client/js with esbuild. Run after ANY change under client/js.
set -euo pipefail
cd "$(dirname "$0")/../builder/client"
npx --yes esbuild@0.25.0 js/main.js --bundle --format=iife --outfile=bundle/main.bundle.js '--define:import.meta.url=document.baseURI' --log-level=error
npx --yes esbuild@0.25.0 js/render/mesh-worker.js --bundle --format=iife --outfile=bundle/worker.bundle.js "--define:import.meta.url=''" --log-level=error
ls -l bundle
