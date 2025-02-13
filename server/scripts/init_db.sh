#!/bin/bash
set -eu -o pipefail
if [ $# -lt 1 ]; then
	echo "USAGE: $0 MYSQL_DB_PASSWORD"
	exit 1
fi
db_password=$1

mkdir -p dbdata

# Run the scripts
echo "---- FETCHING TOP_RANKED PAGES ----"
node fetch_top_ranked.js

echo "---- FETCHING RECENT_STREAM PAGES ----"
node fetch_rc.js

echo "---- FETCHING DUMPS & GENERATING SQL FILES ----"
node gen_titles.js

echo "---- BACKUP DB ----"
date=$(date '+%Y-%m-%d')
mysqldump --databases parsoid_rv_deploy_targets -u testreduce -p"$db_password" > parsoid_rv_deploy_targets.$date.sql

echo "---- CLEAR DB ----"
mysql -u testreduce -p"$db_password" parsoid_rv_deploy_targets <<@END
truncate commits;
truncate pages;
truncate results;
truncate stats;
@END

echo "---- IMPORTING TITLES INTO DB ----"
# -- if we want do this the node way --
# wikis=`echo "console.log(require('./testdb.info.js').wikis.map(function(w) { return w.prefix; }).join(' '))" | node`
#
wikis=$(grep prefix testdb.info.js | sed "s/.*:'//g;s/'.*$//g;")
echo $wikis
for w in $wikis
do
	echo "-- Importing titles for $w --"
	echo "mysql -u testreduce -p$db_password parsoid_rv_deploy_targets < dbdata/$w.titles.sql"
	mysql -u testreduce -p"$db_password" parsoid_rv_deploy_targets < "dbdata/$w.titles.sql"
done
echo "---- ALL DONE ----"
