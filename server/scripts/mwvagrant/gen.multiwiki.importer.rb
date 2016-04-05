#!/usr/bin/ruby

puts <<EOF
#!/bin/bash

EOF
wikis = "arwiki ckbwiki cuwiki cvwiki dewiki enwiki enwikisource enwikivoyage enwiktionary eswiki eswikisource eswikivoyage eswiktionary frwiki frwikisource frwikivoyage frwiktionary hewiki hiwiki hywiki iswiki itwiki itwikisource itwikivoyage itwiktionary jawiki kaawiki kawiki kowiki lbewiki lnwiki mznwiki nlwiki plwiki pnbwiki ptwiki ruwiki svwiki ukwiki uzwiki zhwiki".split(' ')
wikis.each do |s|
   puts <<EOF
mwscript maintenance/update.php --wiki #{s}
curl 'http://dumps.wikimedia.org/other/testfiles/20160405/#{s}_20160405_testsamples.xml.bz2' -o - | bunzip2 | mwscript maintenance/importDump.php --wiki #{s} 
mwscript maintenance/rebuildrecentchanges.php
EOF
end
