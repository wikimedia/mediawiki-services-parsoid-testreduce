#!/usr/bin/env node

module.exports = {
	// How many titles do you want?
	size: 15000,

	// How many of those do you want from the dumps?
	// Rest will come from recent changes stream
	dump_percentage: 75,

	wikis: [
		// wikipedias
		{ prefix: 'enwiki',  limit: 62 },
		{ prefix: 'dewiki',  limit: 20 },
		{ prefix: 'nlwiki',  limit: 20 },
		{ prefix: 'frwiki',  limit: 20 },
		{ prefix: 'itwiki',  limit: 20 },
		{ prefix: 'ruwiki',  limit: 20 },
		{ prefix: 'eswiki',  limit: 20 },
		{ prefix: 'ptwiki',  limit: 13 },
		{ prefix: 'plwiki',  limit: 12 },
		{ prefix: 'hewiki',  limit: 8 },
		{ prefix: 'zhwiki',  limit: 5 },
		{ prefix: 'hiwiki',  limit: 4 },

		// link prefix languages
		{ prefix: 'svwiki',  limit: 4 },
		{ prefix: 'jawiki',  limit: 4 },
		{ prefix: 'arwiki',  limit: 4 },
		{ prefix: 'kowiki',  limit: 4 },
		{ prefix: 'ckbwiki', limit: 1 },
		{ prefix: 'cuwiki',  limit: 1 },
		{ prefix: 'cvwiki',  limit: 1 },
		{ prefix: 'hywiki',  limit: 1 },
		{ prefix: 'iswiki',  limit: 1 },
		{ prefix: 'kaawiki', limit: 1 },
		{ prefix: 'kawiki',  limit: 1 },
		{ prefix: 'lbewiki', limit: 1 },
		{ prefix: 'lnwiki',  limit: 1 },
		{ prefix: 'mznwiki', limit: 1 },
		{ prefix: 'pnbwiki', limit: 1 },
		{ prefix: 'ukwiki',  limit: 1 },
		{ prefix: 'uzwiki',  limit: 1 },

		// wiktionary
		{ prefix: 'enwiktionary', limit: 1 },
		{ prefix: 'frwiktionary', limit: 1 },
		{ prefix: 'itwiktionary', limit: 1 },
		{ prefix: 'eswiktionary', limit: 1 },

		// wikisource
		{ prefix: 'enwikisource', limit: 1 },
		{ prefix: 'frwikisource', limit: 1 },
		{ prefix: 'itwikisource', limit: 1 },
		{ prefix: 'eswikisource', limit: 1 },

		// wikivoyage
		{ prefix: 'enwikivoyage', limit: 1 },
		{ prefix: 'frwikivoyage', limit: 1 },
		{ prefix: 'itwikivoyage', limit: 1 },
		{ prefix: 'eswikivoyage', limit: 1 },
	]
};
