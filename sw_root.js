const url = 'https://ihalilaltun.me/SegmentifySw.js';

self.addEventListener('error', function(e) {
  console.log(e.filename, e.lineno, e.colno, e.message, JSON.stringify(e.error));
});

importScripts(url);
