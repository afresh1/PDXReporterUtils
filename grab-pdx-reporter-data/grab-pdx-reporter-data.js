#!/usr/bin/env node

/* some stuff we need, most seem to come with node */
const fs = require('fs');
const cheerio = require('cheerio');
const https = require('https');

/* 
 * now we see if we've downloaded the file and are testing parsing
 * with `curl $url > /tmp/html
 */

var rawData;
try {
    rawData = require('fs').readFileSync('/tmp/html', 'utf8');
}
catch {}

if (rawData) {
/* now we grab the markers and output them as JSON */
/* There's probably a "more correct" way to do this, but this one works */
/* and you may have noticed this is an ugly hack */
var markers = getMarkers(rawData);
//console.log(markers);
console.log(JSON.stringify(markers));
}
else {

/* 
 * otherwise we'll grab the content for real,
 * this is from node's http.get example
 */
https.get('https://www.portlandoregon.gov/trackit/devicemap/', (res) => {
  //console.log('statusCode:', res.statusCode);
  //console.log('headers:', res.headers);

  res.setEncoding('utf8');
  let rawData = false;
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    try {
      //console.log(rawData);
      /* now we grab the markers and output them as JSON */
      var markers = getMarkers(rawData);
      console.log(JSON.stringify(markers));
      //const parsedData = JSON.parse(rawData);
      //console.log(parsedData);
    } catch (e) {
      console.error(e.message);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
}

/*
 * Here we parse the HTML to get the one line that has the "markers" on it
 * that we then strip the "google" stuff out of and eval.
 * because Node knows how to exec javascript, if we give it correctly.
 */
function getMarkers(rawData) {
  var rawLine;
  /* no idea why this page comes in with `\r` as the separator */
  for ( const [index, line] of rawData.split(/\r/).entries() ) {
      /* once we find the right line, write it down and stop looking */
      if ( line.match(/var markers/) ) {
          rawLine = line;
          break;
      }
   }

   /* now we load the matches tha tare inside the "loadPoints" function */
   /* avoiding the google "map" calls at the end */
   var match = rawLine.match(/loadPoints\(\)\{(.*?);map\..*\}/);
   /* and then we strip out the "addPoint" attributes that don't work */
   var js = match[1].replace(/;markers[^;]*=addPoint\([^;]*\);?/g, ';')
   
   /* and initialize the variable to hold the markers */
   /* no idea why they like the "new Object()" style instead of just {} */
   var markers = new Object();
   /* and then eval the javascript we grabbed from the page, too add markers */
   eval(js);

   /* then loop over the markers to pull additional data out of the HTML */
   for ( let [ id, marker ] of Object.entries(markers) ) {
      //console.log(marker['html']);
      decodeMarkerHTML(marker);
   }

   return markers;
}

/* 
 * This looks at the html content for the report and grabs the "label"
 * in the "p"aragraph and uses that as the key and the rest of the data
 * in the HTML as the value for new keys in the marker.
 */
function decodeMarkerHTML(marker) {
  const $ = cheerio.load(marker['html']);
  /* cheerio seems nice, at least I like jQuery so it's familiar */
  $('p').each( (i,n) => {
    /* Here we convert the element into a cheerio object */
    var p = $(n);
    /* and find and remove the label from it */
    var label = p.find('label').remove();

    //console.log(label.text());
    //console.log(p.text());
    /* If we found a label, then we'll save the stripped data */
    if ( label ) {
      key = label.text().replace(/:$/, '');
      marker[key] = p.text().replace(/^\s+|\s+$/g, '');
    }
  } );
}
