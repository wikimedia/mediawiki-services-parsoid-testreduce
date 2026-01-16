<?php

$l = file_get_contents( "wps.json" );
$pr = file_get_contents( "parsoidrendered.dblist" );

$l = json_decode( $l );
$pr = array_flip( explode( "\n", $pr ) );

$l = array_filter( $l, function ( $v ) use ( $pr ) {
	return !isset( $pr[$v->prefix] ) && !isset( $v->lvs );
} );

$l = array_map( function( $v ) {
	return $v->prefix;
}, $l );

$l = array_values( $l );

// Last runs wikis from testdb.info.js
$wikis = [
	"kcgwiki", "lowiki", "lldwiki", "szlwiki", "nds-nlwiki",
	"frrwiki", "diqwiki", "shnwiki", "madwiki", "map-bmswiki",
	"acewiki", "vrowiki",
	"smnwiki", "avkwiki", "extwiki", "avwiki", "gvwiki",
	"sewiki", "dzwiki", "mdfwiki", "sgswiki", "kabwiki",
	"mnwwiki", "cdowiki", "roa-tarawiki", "tumwiki", "fatwiki",
	"dtpwiki", "bewwiki", "gagwiki", "gurwiki", "rupwiki",
	"myvwiki", "btmwiki", "cbk-zamwiki", "iglwiki", "towiki",
	"wowiki", "kuswiki", "koiwiki", "chwiki", "gotwiki"
];

$l = array_diff( $l, $wikis );
$l = array_slice( $l, -30 );

print_r( json_encode( $l ) );
