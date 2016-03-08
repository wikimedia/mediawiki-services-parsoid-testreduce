#!/bin/bash

#---- for wikis ---
LANG="en de nl fr it ru es sv pl pt ja ar he hi ko zh"
# link prefix languages
LANG=$LANG" ckb cu cv hy is kaa ka lbe ln mzn pnb uk uz"

for l in $LANG ; do
    wget http://dumps.wikimedia.org/${l}wiki/latest/${l}wiki-latest-all-titles-in-ns0.gz
done

#---- for wiktionaries ---
LANG="en fr it es"
for l in $LANG ; do
    wget http://dumps.wikimedia.org/${l}wiktionary/latest/${l}wiktionary-latest-all-titles-in-ns0.gz
done

#---- for wikisource ---
LANG="en fr it es"
for l in $LANG ; do
    wget http://dumps.wikimedia.org/${l}wikisource/latest/${l}wikisource-latest-all-titles-in-ns0.gz
done

#---- for wikivoyage ---
LANG="en fr it es"
for l in $LANG ; do
    wget http://dumps.wikimedia.org/${l}wikivoyage/latest/${l}wikivoyage-latest-all-titles-in-ns0.gz
done
