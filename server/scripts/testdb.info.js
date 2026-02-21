#!/usr/bin/env node
'use strict';

module.exports = {
	// 0.25% of all wiki titles
	sample_size: 0.0025,

	// but, at least 1000 titles per wiki
	min_titles: 1000,

	// How many of those do you want from traffic popularity
	popular_pages_percentage: 5,

	// How many of those do you want from the dumps?
	// Rest will come from recent changes stream
	dump_percentage: 85,

	wikis: [
		"banwiki.ban-bali",
		"banwiki.ban-x-dharma",
		"banwiki.ban-x-palmleaf",
		"banwiki.ban-x-pku",
		"crhwiki.crh-cyrl",
		"crhwiki.crh-latn",
		"ganwiki.gan-hans",
		"ganwiki.gan-hant",
		"iuwiki.ike-cans",
		"iuwiki.ike-latn",
		"kuwiki.ku-arab",
		"kuwiki.ku-latn",
		"shiwiki.shi-tfng",
		"shiwiki.shi-latn",
		"shwiki.sh-latn",
		"shwiki.sh-cyrl",
		"srwiki.sr-ec",
		"srwiki.sr-el",
		"tgwiki.tg",
		"tgwiki.tg-latn",
		"tlywiki.tly",
		"tlywiki.tly-cyrl",
		"uzwiki.uz-latn",
		"uzwiki.uz-cyrl",
		"wuuwiki.wuu-hans",
		"wuuwiki.wuu-hant",
		"zghwiki.zgh",
		"zghwiki.zgh-latn",
		"zhwiki.zh-cn",
		"zhwiki.zh-hk",
		"zhwiki.zh-mo",
		"zhwiki.zh-my",
		"zhwiki.zh-sg",
		"zhwiki.zh-tw",
	],
};
