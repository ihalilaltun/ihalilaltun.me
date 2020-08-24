const url = 'https://cdn.segmentify.com/v3/dev/sw.debug.js?v' + Math.round(Math.random() * 5000);

self.addEventListener('error', function(e) {
  console.log(e.filename, e.lineno, e.colno, e.message, JSON.stringify(e.error));
  console.log(e, JSON.stringify(e.message));
});

self.addEventListener('install', function (event) {
  console.log('Imported url: ' + url);
  self.skipWaiting();
});

importScripts(url);

//importScripts('https://cdn.segmentify.com/v3/dev/sw.debug.js?v4');
