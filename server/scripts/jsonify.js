#!/usr/bin/env node
'use strict';

const fs = require('fs');

const filename = process.argv[2];

const titles = fs.readFileSync(filename, 'utf8').split(/[\n\r]+/);
console.assert(titles.pop() === ''); // trailing newline.

console.log(JSON.stringify(titles, null, '\t'));
