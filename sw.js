//const url = 'https://cdn.segmentify.com/v3/dev/sw.debug.js';
const url = 'https://ihalilaltun.me/custom_sw.js';

self.addEventListener('error', function(e) {
  console.log(e.filename, e.lineno, e.colno, e.message, JSON.stringify(e.error));
});

importScripts(url);

//importScripts('https://cdn.segmentify.com/v3/dev/sw.debug.js?v4');
