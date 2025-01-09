#!/usr/bin/env node
'use strict';

const fs = require('fs');
const request = require('request');
const cp = require('child_process');
const testdb = require('./testdb.info.js');
const wikis = testdb.wikis;
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
	100:"Appendix", // wiktionary-specific
	106:"Rhymes", // wiktonary-specific
	108:"Transwiki", // wiktionary-specific
	110:"Thesaurus", // wiktionary-specific
	114:"Citations", // wiktionary-specific
	116:"Sign gloss", // wiktionary-specific
	118:"Reconstruction", // wiktionary-specific
	828:"Module",
};

function generate_titles() {
	const sum = wikis.reduce(function(s, w) {
		return s + w.limit;
	}, 0);
	Promise.reduce(wikis, function(unused, w) {
		const wiki = w.prefix;
		const fraction = testdb.dump_percentage / 100;
		const wikiWithNS = wiki;
		const n = Math.ceil(w.limit / sum * fraction * testdb.size);
		const total = Math.ceil(n / fraction);
		let dumpCommands;

		console.log(`--- wiki ${ wikiWithNS } ----`);
		console.log(`Generating ${ total } titles in all`);
		const randTitlesFile = `${ wiki }.random_titles.txt`;
		const dumpFile = `dumps/${ wiki }-latest-all-titles.gz`;
		if (forceDumpsRefresh || !fs.existsSync(dumpFile)) {
			dumpCommands = [
				`wget https://dumps.wikimedia.org/${ wiki }/latest/${ wiki }-latest-all-titles.gz`,
				`mv *.gz dumps/`
			];
		} else {
			dumpCommands = [];
		}
		dumpCommands = dumpCommands.concat([
			`zcat ${ dumpFile } | shuf | head -${ n } > ${ randTitlesFile }`,
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
				`cat ${ wiki }.top_titles.txt ${ wikiWithNS }.rc_titles.txt ${ randTitlesFile } | sort | uniq | shuf | head -${ total } > ${ wikiWithNS }.all_titles.txt`,
			];
			console.log(`Generating ${ n } random titles from dump`);

			execP(commands.join("; ")).then(function(out2) {
				console.log(out2.stdout);
				const titles = fs.readFileSync(`${ wikiWithNS }.all_titles.txt`, 'utf8').split(/[\n\r]+/);
				out2 = [];
				for (let i = 0; i < titles.length; i++) {
					const t = titles[i].replace(/"/g, '\\"');
					if (t) {
						let value = /"/.test(t) ? "'" + t + "'" : '"' + t + '"';
						value = value.replace(/\\/g, "\\\\");
						out2.push(`INSERT IGNORE INTO pages(title, prefix) VALUES(${ value }, "${ wiki }");`);
					}
				}
				fs.writeFileSync(`${ wikiWithNS }.titles.sql`, out2.join("\n"));
				console.log(`Generated sql import script @ ${ wikiWithNS }.titles.sql`);
				return true;
			}).catch(function(e) {
				console.log(`Error: ${ e }`);
			});
		}).catch(function(e) {
			console.log(`Error: ${ e }`);
		});
	}, 0);
}

generate_titles();
