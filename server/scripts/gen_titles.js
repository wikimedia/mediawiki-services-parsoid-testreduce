#!/usr/bin/env node
'use strict';

const fs = require('fs');
const request = require('request');
const cp = require('child_process');
const testdb = require('./testdb.info.js');
const wikisizes = require('./wikisizes.json');
const Promise = require('prfun/wrap')(require('babybird'));
const execP = Promise.promisify(cp.exec, ['stdout', 'stderr'], cp);
const forceDumpsRefresh = false;
const NS_MAP = {
	0:"",
	2:"User",
	4:"Project",
	6:"File",
	8:"MediaWiki",
	10:"Template",
	12:"Help",
	14:"Category",
	90:"Thread", // LQT
	92:"Summary", // LQT
	828:"Module",
};

function generate_titles(wikis) {
	Promise.reduce(wikis, function(unused, prefix) {
		const [baseprefix, variant] = prefix.split('.', 2); // allow for a variant
		const fraction = testdb.dump_percentage / 100;
		const wiki = prefix;
		const wikiWithNS = wiki;
		let count = Math.ceil(fraction * wikisizes[baseprefix] * testdb.sample_size);
		let total = Math.ceil(count / fraction);
		if (total < testdb.min_titles) {
			total = testdb.min_titles;
			count = total * fraction;
		}

		let dumpCommands;

		console.log(`--- wiki ${ wikiWithNS } ----`);
		console.log(`Generating ${ total } titles in all`);
		const randTitlesFile = `dbdata/${ wiki }.random_titles.txt`;
		const dumpVersion = "20250720"; // "latest"
		const dumpFile = `dumps/${ baseprefix }-${ dumpVersion }-all-titles.gz`;
		if (forceDumpsRefresh || !fs.existsSync(dumpFile)) {
			dumpCommands = [
				`wget https://dumps.wikimedia.org/${ baseprefix }/${ dumpVersion }/${ baseprefix }-${ dumpVersion }-all-titles.gz`,
				`mv *-all-titles.gz dumps/`
			];
		} else {
			dumpCommands = [];
		}
		dumpCommands = dumpCommands.concat([
			`zcat ${ dumpFile } | shuf | head -${ count } > ${ randTitlesFile }`,
			`head -2 ${ randTitlesFile }`,
		]);
		return execP(dumpCommands.join("; ")).then(function(out) {
			console.log(out.stdout);
			const dumpTitles = fs.readFileSync(randTitlesFile, 'utf8').split(/[\n]/);
			const resolvedTitles = [];
			for (let i = 0; i < dumpTitles.length; i++) {
				const t = dumpTitles[i].split(/\t/);
				const nsId = Number(t[0]);
				let ns;
				if (nsId % 2 === 0) {
					ns = NS_MAP[String(nsId)];
					ns = ns ? ns + ':' : '';
				} else {
					ns = NS_MAP[String(nsId - 1)];
					ns = ns + (ns ? '_' : '') + 'Talk:';
				}
				resolvedTitles.push(ns + t[1]);
			}
			fs.writeFileSync(randTitlesFile, resolvedTitles.join('\n'));
			const commands = [
				// This will emit less than 'total' titles because of
				// - we may not have (100 - testdb.dump_percentage)% titles from RC
				// - title dupes between the two files
				// Additionally, in the case of talk ns, since not all talk:* titles from
				// dumps might exist, the actual working set once we run the first test run
				// will be smaller.
				`cat dbdata/${ wiki }.top_titles.txt dbdata/${ wikiWithNS }.rc_titles.txt ${ randTitlesFile } | sort | uniq | shuf | head -${ total } > dbdata/${ wikiWithNS }.all_titles.txt`,
			];
			console.log(`Generating ${ count } random titles from dump`);

			execP(commands.join("; ")).then(function(out2) {
				console.log(out2.stdout);
				const titles = fs.readFileSync(`dbdata/${ wikiWithNS }.all_titles.txt`, 'utf8').split(/[\n\r]+/);
				out2 = [];
				for (let i = 0; i < titles.length; i++) {
					const t = titles[i].replace(/'/g, "''");
					if (t) {
						let value = "'" + t + "'";
						value = value.replace(/\\/g, "\\\\");
						out2.push(`INSERT IGNORE INTO pages(title, prefix) VALUES(${ value }, "${ wiki }");`);
					}
				}
				fs.writeFileSync(`dbdata/${ wikiWithNS }.titles.sql`, out2.join("\n"));
				console.log(`Generated sql import script @ dbdata/${ wikiWithNS }.titles.sql`);
				return true;
			}).catch(function(e) {
				console.log(`Error: ${ e }`);
			});
		}).catch(function(e) {
			console.log(`Error: ${ e }`);
		});
	}, 0);
}

generate_titles(process.argv.length > 2 ? [ process.argv[2] ] : testdb.wikis);
