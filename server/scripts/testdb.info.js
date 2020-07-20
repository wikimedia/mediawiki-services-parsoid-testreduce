#!/usr/bin/env node

module.exports = {
	// How many titles do you want?
	size: 180000,

	// How many of those do you want from the dumps?
	// Rest will come from recent changes stream
	dump_percentage: 75,

	wikis: [
		// 1M+ wikipedias (ordered by depth)
		{ prefix: 'enwiki',  limit: 60 },
		{ prefix: 'frwiki',  limit: 20 },
		{ prefix: 'eswiki',  limit: 20 },
		{ prefix: 'ruwiki',  limit: 20 },
		{ prefix: 'itwiki',  limit: 15 },
		{ prefix: 'dewiki',  limit: 15 },
		{ prefix: 'jawiki',  limit: 10 },
		{ prefix: 'viwiki',  limit: 10 },
		{ prefix: 'plwiki',  limit: 10 },
		{ prefix: 'nlwiki',  limit: 10 },
		{ prefix: 'svwiki',  limit: 8 },
		{ prefix: 'warwiki', limit: 8 },
		{ prefix: 'cebwiki', limit: 8 },

		// 100K+ wikipedias (ordered by edits)
		{ prefix: 'ptwiki',  limit: 6 },
		{ prefix: 'zhwiki',  limit: 6 },
		{ prefix: 'shwiki',  limit: 6 },
		{ prefix: 'arwiki',  limit: 4 },
		{ prefix: 'hewiki',  limit: 4 },
		{ prefix: 'kowiki',  limit: 3 },
		{ prefix: 'ukwiki',  limit: 3 },
		{ prefix: 'trwiki',  limit: 2 },
		{ prefix: 'huwiki',  limit: 2 },
		{ prefix: 'cawiki',  limit: 2 },
		{ prefix: 'nowiki',  limit: 2 },

		// Other language wikipedias
		{ prefix: 'zh_yuewiki',  limit: 2 },
		{ prefix: 'thwiki',  limit: 2 },
		{ prefix: 'hiwiki',  limit: 2 },
		{ prefix: 'bnwiki',  limit: 2 },
		{ prefix: 'mlwiki',  limit: 2 },

		// link prefix languages
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

		// Talk namespaces from some wikis
		{ prefix: 'enwiki',  ns: 1, limit: 5 },
		{ prefix: 'itwiki',  ns: 1, limit: 2 },
		{ prefix: 'dewiki',  ns: 1, limit: 3 },
		{ prefix: 'hewiki',  ns: 1, limit: 1 },
		{ prefix: 'zhwiki',  ns: 1, limit: 1 },
	],
};
