#!/bin/bash
set -eu -o pipefail
if [ $# -lt 1 ]; then
	echo "USAGE: $0 MYSQL_DB MYSQL_DB_PASSWORD"
	exit 1
fi
db=$1
db_password=$2

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
mysqldump --databases "$db" -u testreduce -p"$db_password" > backups/$db.$date.sql

echo "---- CLEAR DB ----"
mysql -u testreduce -p"$db_password" "$db" <<@END
truncate commits;
truncate pages;
truncate results;
truncate stats;
@END

echo "---- IMPORTING TITLES INTO DB ----"
# -- if we want do this the node way --
wikis=$(echo "console.log(require('./testdb.info.js').wikis.join(' '))" | node)
echo $wikis
for w in $wikis
do
	echo "-- Importing titles for $w --"
	echo "mysql -u testreduce -p"$db_password" "$db" < dbdata/$w.titles.sql"
	if [ -f dbdata/$w.titles.sql ]
	then
		mysql -u testreduce -p"$db_password" "$db" < "dbdata/$w.titles.sql"
	else
		echo "FAILED to generate titles for $w"
	fi
done
echo "---- ALL DONE ----"
