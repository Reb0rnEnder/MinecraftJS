#!/usr/bin/env node
const {encodeBase85} = require('../lib/packed-html.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { ZipFile } = require('../lib/zip.js');
const mcassets = require('../lib/mcassets.js');
const {indexedClientAssets} = require('../lib/asset-layers.js');
const { extractModels, assertCompleteModels } = require('../lib/modelextract.js');

const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');

const PROXY_TYPES = ['mcjs', 'relay', 'wisp', 'gravrust-via'];

// ... rest of build.cjs (keep existing, ensure PROXY_TYPES includes 'gravrust-via')
