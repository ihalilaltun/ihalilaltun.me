const url = 'https://cdn.segmentify.com/v3/dev/sw.debug.js?v' + Math.round(Math.random() * 5000);
importScripts(url);
self.addEventListener('install', function (event) {
  console.log('Imported url: ' + url);
  self.skipWaiting();
});

//importScripts('https://cdn.segmentify.com/v3/dev/sw.debug.js?v4');
