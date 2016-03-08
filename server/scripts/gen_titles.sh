#!/bin/bash

#---- wikipedia ----
LANG="enwiki dewiki nlwiki frwiki itwiki ruwiki eswiki ptwiki plwiki hewiki svwiki jawiki arwiki hiwiki kowiki zhwiki"
HOWMANY=(150 50 50 50 50 50 50 30 30 20 10 10 10 10 10 10)
# link prefix languages
LANG=$LANG" ckbwiki cuwiki cvwiki hywiki iswiki kaawiki kawiki lbewiki lnwiki mznwiki pnbwiki ukwiki uzwiki"
HOWMANY=("${HOWMANY[@]}" 2 2 2 2 2 2 2 2 2 2 2 2 2)

#---- wiktionary ----
LANG=$LANG" enwiktionary frwiktionary itwiktionary eswiktionary"
HOWMANY=("${HOWMANY[@]}" 2 2 2 2)

#---- wikisource ----
LANG=$LANG" enwikisource frwikisource itwikisource eswikisource"
HOWMANY=("${HOWMANY[@]}" 2 2 2 2)

#---- wikivoyage ----
LANG=$LANG" enwikivoyage frwikivoyage itwikivoyage eswikivoyage"
HOWMANY=("${HOWMANY[@]}" 2 2 2 2)

i=0
FRACTION=$[100*2/3];
for l in $LANG ; do
	n=${HOWMANY[$i]}
	suffix=".random_titles.txt"
	echo $l, $n
	zcat ${l}-latest-all-titles-in-ns0.gz | sort -R | head -$[$n*FRACTION] > ${l}${suffix}
	head -2 ${l}${suffix}
	cat ${l}${suffix} ${l}.rc_titles.txt | sort | uniq | head -$[$n*1000+100] | tail -$[$n*1000] > ${l}.all_titles.txt
	$(dirname $0)/jsonify.js ${l}.all_titles.txt > ${l}.json
	i=`expr $i + 1`
done
