// Copies the web app into www/ for the Android/iOS builds and bundles the Firebase SDK
// so the app opens without an internet connection.
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'www');
const FILES = ['index.html','app.js','styles.css','config.js','privacy.html','terms.html','manifest.webmanifest',
  'icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];
fs.rmSync(out, {recursive:true, force:true}); fs.mkdirSync(path.join(out,'courses'), {recursive:true}); fs.mkdirSync(path.join(out,'vendor'));
for (const f of FILES) fs.copyFileSync(path.join(root,f), path.join(out,f));
for (const f of fs.readdirSync(path.join(root,'courses'))) fs.copyFileSync(path.join(root,'courses',f), path.join(out,'courses',f));

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const libs = ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js'];
let html = fs.readFileSync(path.join(out,'index.html'),'utf8');
for (const lib of libs){
  try {
    const res = await fetch(SDK+lib); if (!res.ok) throw new Error(res.status);
    fs.writeFileSync(path.join(out,'vendor',lib), Buffer.from(await res.arrayBuffer()));
    html = html.replace(SDK+lib, 'vendor/'+lib);
    console.log('bundled', lib);
  } catch(e){ console.warn('could not bundle', lib, '- the app will load it from the internet:', e.message); }
}
// The service worker is for browsers only; the app ships its files inside the package.
html = html.replace('<link rel="manifest" href="manifest.webmanifest">','');
fs.writeFileSync(path.join(out,'index.html'), html);
console.log('www ready');
