// Handpan Studio service worker — ends the GitHub Pages cache lag.
// The app shell is network-first (updates land on the next load);
// the sample bank is cache-first (7 MB, versioned by query string).
const CACHE="hps-v1";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(clients.claim()));
self.addEventListener("fetch",e=>{
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;
  if(url.pathname.endsWith("/bank.js")){
    e.respondWith(caches.open(CACHE).then(async c=>{
      const hit=await c.match(e.request); if(hit) return hit;
      const r=await fetch(e.request); if(r.ok) c.put(e.request,r.clone()); return r;
    }));
  } else {
    e.respondWith(fetch(e.request,{cache:"no-cache"}).then(r=>{
      if(r.ok) caches.open(CACHE).then(c=>c.put(e.request,r.clone()));
      return r;
    }).catch(()=>caches.match(e.request)));
  }
});
