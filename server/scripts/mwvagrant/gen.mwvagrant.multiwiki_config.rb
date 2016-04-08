#!/usr/bin/ruby

puts <<EOF
# == Class: role::wtexp_wiki
# Configures a multi-site wiki for wikitext experiments
class local::wtexp_wiki
{
EOF

wikis = "arwiki ckbwiki cuwiki cvwiki dewiki enwiki enwikisource enwikivoyage enwiktionary eswiki eswikisource eswikivoyage eswiktionary frwiki frwikisource frwikivoyage frwiktionary hewiki hiwiki hywiki iswiki itwiki itwikisource itwikivoyage itwiktionary jawiki kaawiki kawiki kowiki lbewiki lnwiki mznwiki nlwiki plwiki pnbwiki ptwiki ruwiki svwiki ukwiki uzwiki zhwiki".split(' ')
wikis.each do |s|
   prefix = s.gsub(/wiki$/, '')
   langcode = s.gsub(/wikisource|wiktionary|wikivoyage|wiki/, '')
   type = case s
      when /wiki$/      then "Wikipedia"
      when /wikisource/ then "Wikisource"
      when /wikivoyage/ then "Wikivoyage"
      when /wiktionary/ then "Wiktionary"
   end
   puts <<EOF
     mediawiki::wiki { '#{prefix}': }
       mediawiki::settings { '#{prefix} settings':
       wiki   => '#{prefix}',
         values => [
            '$wgLanguageCode = "#{langcode}";',
            '$wgSitename     = "#{type}";',
            '$wgUseInstantCommons = true;',
            '$wgUseTidy = true;',
            '$wgDebugLogGroups = [];',
         ]
     }
EOF
end

puts "}"
