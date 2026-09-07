const CACHE='sasj-science-lab-v0.8';
const ASSETS=[
  './','index.html','css/styles.css','js/app.js','data/bootstrap.json',
  'assets/sasj-crest-transparent.webp','assets/sasj-fallback.svg',
  'assets/inventory/electricity-kit.webp','assets/inventory/thermometers.webp',
  'assets/inventory/beakers-250.webp','assets/inventory/light-shadows-kit.webp',
  'manifest.webmanifest'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request)));});
