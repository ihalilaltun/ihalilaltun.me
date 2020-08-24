const url = 'https://cdn.segmentify.com/v3/dev/sw.debug.js?v' + Math.round(Math.random() * 5000);

self.addEventListener('error', function(e) {
  console.log(e.filename, e.lineno, e.colno, e.message);
  console.log(e);
  e.preventDefault();
});

self.addEventListener('install', function (event) {
  console.log('Imported url: ' + url);
  self.skipWaiting();
});

importScripts(url);

//importScripts('https://cdn.segmentify.com/v3/dev/sw.debug.js?v4');
