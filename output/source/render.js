// usage: node render.js <outDir> <w> <h> <fps> [times comma list]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = __dirname;
const [outDir, w, h, fps, list] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5], process.argv[6]];
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0, async () => {
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto(`http://localhost:${port}/${process.env.PAGE||'index.html'}?w=${w}&h=${h}&dbg=${process.env.DBG||""}`);
  await page.waitForFunction('window.ready === true', null, { timeout: 120000 });
  const times = list ? list.split(',').map(Number) : Array.from({ length: Math.round((+process.env.DUR||7) * fps) }, (_, i) => i / fps);
  const t0 = Date.now();
  for (let i = 0; i < times.length; i++) {
    await page.evaluate(t => window.renderAt(t), times[i]);
    await page.screenshot({ path: path.join(outDir, list ? `t_${times[i].toFixed(2)}.png` : `f_${String(i).padStart(4, '0')}.png`) });
    if (i % 20 === 0) console.log(`frame ${i}/${times.length} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  await browser.close(); srv.close();
});
