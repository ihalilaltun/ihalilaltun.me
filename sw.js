const url = 'https://cdn.segmentify.com/v3/dev/sw.debug.js?v' + Math.round(Math.random() * 5000);
console.log('Importing url: ' + url);
importScripts(url);
//importScripts('https://cdn.segmentify.com/v3/dev/sw.debug.js?v4');
