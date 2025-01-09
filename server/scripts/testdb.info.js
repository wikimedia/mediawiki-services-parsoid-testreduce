#!/usr/bin/env node
'use strict';

module.exports = {
	// How many titles do you want?
	size: 75000,

	// How many of those do you want from traffic popularity
	popular_pages_percentage: 5,

	// How many of those do you want from the dumps?
	// Rest will come from recent changes stream
	dump_percentage: 85,

	// I used the wiki comparison public sheets and used # content pages
	// as a benchmark to decide the relative ratio between wikis with
	// rounding up.
	wikis: [
		{ prefix:'enwiktionary', limit:20 },
		{ prefix:'frwiktionary', limit:12 },
		{ prefix:'ruwiktionary', limit:4 },
		{ prefix:'dewiktionary', limit:4 },
		{ prefix:'eswiktionary', limit:3 },
		{ prefix:'plwiktionary', limit:3 },
		{ prefix:'elwiktionary', limit:5 },
		{ prefix:'jawiktionary', limit:2 },
		{ prefix:'zhwiktionary', limit:5 },
		{ prefix:'nlwiktionary', limit:3 },
		{ prefix:'idwiktionary', limit:1 },
		{ prefix:'cswiktionary', limit:1 },
		{ prefix:'itwiktionary', limit:2 },
		{ prefix:'viwiktionary', limit:1 },
		{ prefix:'ptwiktionary', limit:2 },
		{ prefix:'svwiktionary', limit:3 },
		{ prefix:'fiwiktionary', limit:2 },
		{ prefix:'trwiktionary', limit:2 },
		{ prefix:'thwiktionary', limit:1 },
		{ prefix:'kowiktionary', limit:1 },
		{ prefix:'hewiktionary', limit:1 },
		{ prefix:'simplewiktionary', limit:1 },
		{ prefix:'tawiktionary', limit:2 },
		{ prefix:'mswiktionary', limit:1 },
		{ prefix:'cawiktionary', limit:2 },
		{ prefix:'fawiktionary', limit:1 },
		{ prefix:'huwiktionary', limit:2 },
		{ prefix:'ukwiktionary', limit:1 },
		{ prefix:'rowiktionary', limit:1 },
		{ prefix:'uzwiktionary', limit:1 },
		{ prefix:'hiwiktionary', limit:1 },
		{ prefix:'hywiktionary', limit:1 },
		{ prefix:'mgwiktionary', limit:10 },
		{ prefix:'kuwiktionary', limit:3 },
		{ prefix:'srwiktionary', limit:1 },
		{ prefix:'arwiktionary', limit:1 },
		{ prefix:'bgwiktionary', limit:1 },
		{ prefix:'bnwiktionary', limit:1 },
		{ prefix:'knwiktionary', limit:1 },
		{ prefix:'nowiktionary', limit:1 },
	],
};
