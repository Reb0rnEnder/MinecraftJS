// Reads the pinned native data component codec manifest for tests. The manifest is generated
// by component-codecs.mjs from DataComponents' networkSynchronized expressions.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root} from './prepare.mjs';

export const DATA_COMPONENTS=JSON.parse(readFileSync(join(root,'tools/port-26.3/fixtures/data-component-codecs-26.3.json'),'utf8'));
