const CACHE='wmq-workbench-v20';
const ASSETS=['./index.html?v=20&page=overview','./styles.css?v=20','./drawer.css?v=20','./review.css?v=20','./modules.css?v=20','./overview.css?v=20','./readability.css?v=20','./settings.css?v=20','./app.js?v=20','./data/trends.json?v=20','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./review-template.csv'];

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))])));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.endsWith('/data/trends.json')){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(response=>response||fetch(event.request)));
});
self.addEventListener('push',event=>{
  let payload={title:'wmq的工作台',body:'今日热点已经准备好，点击查看选题灵感。',url:'./?v=20&page=inspiration'};
  try{payload={...payload,...event.data?.json()}}catch(error){if(event.data)payload.body=event.data.text()}
  event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'./icon-192.png',badge:'./icon-192.png',tag:payload.tag||'wmq-daily-trends',renotify:true,data:{url:payload.url||'./?v=20&page=inspiration'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const requested=String(event.notification.data?.url||'./?v=20&page=inspiration'),target=new URL(requested.startsWith('/')?`.${requested}`:requested,self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{const existing=clients.find(client=>client.url.startsWith(self.location.origin));if(existing){existing.navigate(target);return existing.focus()}return self.clients.openWindow(target)}));
});
