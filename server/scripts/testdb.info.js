#!/usr/bin/env node
'use strict';

module.exports = {
	// 1.5% of all wiki titles
	sample_size: 0.15,

	// but, at least 500 titles per wiki
	min_titles: 500,

	// How many of those do you want from traffic popularity
	popular_pages_percentage: 5,

	// How many of those do you want from the dumps?
	// Rest will come from recent changes stream
	dump_percentage: 85,

	wikis: [
		"enwikiquote", "itwikiquote", "ruwikiquote", "plwikiquote", "trwikiquote",
		"frwikiquote", "zhwikiquote", "eswikiquote", "ukwikiquote", "hewikiquote",
		"fawikiquote", "ptwikiquote", "arwikiquote", "dewikiquote", "cswikiquote",
		"etwikiquote", "idwikiquote", "azwikiquote", "svwikiquote", "srwikiquote",
		"fiwikiquote", "jawikiquote", "eowikiquote", "bgwikiquote", "huwikiquote",
		"nlwikiquote", "skwikiquote", "bnwikiquote", "thwikiquote", "bswikiquote",
		"aswikiquote", "ltwikiquote", "cawikiquote", "elwikiquote", "hiwikiquote",
		"hywikiquote", "hrwikiquote", "tawikiquote", "slwikiquote", "kawikiquote",
		"igwikiquote", "kowikiquote", "viwikiquote", "nowikiquote", "tlwikiquote",
		"guwwikiquote", "bclwikiquote", "tewikiquote", "liwikiquote", "rowikiquote",
		"uzwikiquote", "dawikiquote", "sawikiquote", "suwikiquote", "urwikiquote",
		"sahwikiquote", "mlwikiquote", "knwikiquote", "bewikiquote", "kywikiquote",
		"lawikiquote", "mrwikiquote", "brwikiquote", "euwikiquote", "afwikiquote",
		"guwikiquote", "bjnwikiquote", "kuwikiquote", "glwikiquote", "iswikiquote",
		"sqwikiquote", "cywikiquote", "nnwikiquote"
	],
};
