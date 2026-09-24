const fs = require('fs');
const p = '/app/frontend/dist';
console.log('dist exists:', fs.existsSync(p), 'index:', fs.existsSync(p + '/index.html'));
fetch('http://localhost:5001/')
  .then((r) => r.text().then((t) => {
    console.log('root status:', r.status);
    console.log('content-type:', r.headers.get('content-type'));
    console.log('body prefix:', t.slice(0, 80));
  }))
  .catch((e) => console.log('fetch error:', e.message));