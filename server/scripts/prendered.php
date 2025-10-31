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
$l = array_slice( $l, -30 );

print_r( json_encode( $l ) );
