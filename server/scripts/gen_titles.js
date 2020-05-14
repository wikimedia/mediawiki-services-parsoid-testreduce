#!/usr/bin/env node
'use strict';

const fs = require('fs');
const request = require('request');
const cp = require('child_process');
const testdb = require('./testdb.info.js');
const wikis = testdb.wikis;
const Promise = require('prfun/wrap')(require('babybird'));
const execP = Promise.promisify(cp.exec, ['stdout', 'stderr'], cp);
const forceDumpsRefresh = true;

function generate_titles() {
	const sum = wikis.reduce(function(s, w) { return s + w.limit; }, 0);
	Promise.reduce(wikis, function(unused, w) {
		const wiki = w.prefix;
		const isTalk = w.ns === 1;
		const fraction = isTalk ? 1 : testdb.dump_percentage / 100;
		const wikiWithNS = isTalk ? `${wiki}_talk` : wiki;
		const n = Math.round(w.limit/sum * fraction * testdb.size);
		const total = Math.round(n / fraction);
		let commands;

		console.log(`--- wiki ${wikiWithNS} ----`);
		console.log(`Generating ${total} titles in all`);
		if (isTalk) {
			commands = [
				`cp ${wikiWithNS}.rc_titles.txt ${wikiWithNS}.all_titles.txt`
			];
		} else {
			const file = `${wiki}.random_titles.txt`;
			const dumpFile = `dumps/${wiki}-latest-all-titles-in-ns0.gz`;
			if (forceDumpsRefresh || !fs.existsSync(dumpFile)) {
				commands = [
					`wget http://dumps.wikimedia.org/${wiki}/latest/${wiki}-latest-all-titles-in-ns0.gz`,
					`mv *.gz dumps/`
				];
			} else {
				commands = [];
			}
			commands = commands.concat([
				`zcat ${dumpFile} | shuf | head -${n} > ${file}`,
				`head -2 ${file}`,
				`cat ${file} ${wikiWithNS}.rc_titles.txt | sort | uniq | shuf | head -${total} > ${wikiWithNS}.all_titles.txt`,
			]);
			console.log(`Generating ${n} random titles from dump`);
		}

		return execP(commands.join("; ")).then(function(out) {
			console.log(out.stdout);
			const titles = fs.readFileSync(`${wikiWithNS}.all_titles.txt`, 'utf8').split(/[\n\r]+/);
			out = [];
			for (let i = 0; i < titles.length; i++) {
				const t = titles[i].replace(/"/g, '\\"');
				if (t) {
					out.push(`INSERT IGNORE INTO pages(title, prefix) VALUES("${t}", "${wiki}");`);
				}
			}
			fs.writeFileSync(`${wikiWithNS}.titles.sql`, out.join("\n"));
			console.log(`Generated sql import script @ ${wikiWithNS}.titles.sql`);
			return true;
		}).catch(function(e) {
			console.log(`Error: ${e}`);
		});
	}, 0);
}

generate_titles();
