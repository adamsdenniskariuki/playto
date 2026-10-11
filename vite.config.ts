import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function offlineWorker(): Plugin {
  return {
    name: 'playto-offline',
    generateBundle(_, bundle) {
      this.emitFile({ type: 'asset', fileName: 'font-license.txt', source: readFileSync(resolve('node_modules', '@fontsource', 'opendyslexic', 'LICENSE'), 'utf8') });
      const assets = [...new Set(['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/font-license.txt', '/CNAME',
        ...Object.keys(bundle).map(file => `/${file}`)])];
      this.emitFile({
        type: 'asset', fileName: 'sw.js',
        source: `const CACHE='playto-${Date.now()}';
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('playto-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true}).then(cached=>cached||fetch(event.request).catch(error=>{
  if(event.request.mode==='navigate')return cache.match('/index.html');
  throw error;
 }))));
});`
      });
    }
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), offlineWorker()]
});
