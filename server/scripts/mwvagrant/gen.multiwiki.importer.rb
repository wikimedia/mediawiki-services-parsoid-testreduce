#!/usr/bin/ruby

puts <<EOF
#!/bin/bash

EOF
wikis = "arwiki ckbwiki cuwiki cvwiki dewiki enwiki enwikisource enwikivoyage enwiktionary eswiki eswikisource eswikivoyage eswiktionary frwiki frwikisource frwikivoyage frwiktionary hewiki hiwiki hywiki iswiki itwiki itwikisource itwikivoyage itwiktionary jawiki kaawiki kawiki kowiki lbewiki lnwiki mznwiki nlwiki plwiki pnbwiki ptwiki ruwiki svwiki ukwiki uzwiki zhwiki".split(' ')
wikis.each do |s|
   dbname = "#{s}wiki".sub(/wikiwiki/, 'wiki')
   puts <<EOF
echo "------------- #{s} --------------"
curl 'http://dumps.wikimedia.org/other/testfiles/20160405/#{s}_20160405_testsamples.xml.bz2' -o - | bunzip2 > ../#{s}.dump.xml
echo "Number of titles to import: " `grep "<title" ../#{s}.dump.xml | wc -l`
mwscript maintenance/update.php --wiki #{dbname}
mwscript maintenance/importDump.php --wiki #{dbname} < ../#{s}.dump.xml
rm ../#{s}.dump.xml
mwscript maintenance/rebuildrecentchanges.php
rm ../logs/mediawiki-#{dbname}-debug.log
df
EOF
end
