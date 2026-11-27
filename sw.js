/* Service worker do Painel do Ancião: deixa o app abrir e funcionar sem internet.
   Os dados em si ficam guardados no aparelho pelo próprio app (index.html).
   Ao publicar uma nova versão do index.html, aumente o número em VERSAO. */
const VERSAO = 'painel-v5';
const LOCAIS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const EXTERNOS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap'
];
const HOSTS_CACHE = /(^|\.)(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSAO);
    await Promise.allSettled(LOCAIS.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await Promise.allSettled(EXTERNOS.map(async u => { const r = await fetch(u, { mode: 'no-cors' }); await c.put(u, r); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // chamadas ao servidor (POST) nunca passam por aqui
  const url = new URL(req.url);
  if (/(^|\.)(script\.google\.com|googleusercontent\.com)$/.test(url.hostname)) return;
  if (req.mode === 'navigate') { e.respondWith(pagina(e)); return; }
  if (url.origin === location.origin || HOSTS_CACHE.test(url.hostname)) e.respondWith(arquivo(e));
});

/* Página: abre na hora o que está guardado e atualiza em segundo plano para a próxima abertura. */
async function pagina(e) {
  const c = await caches.open(VERSAO);
  /* Páginas públicas dos ministérios (musica.html, escolasabatina.html…) têm cada uma a sua própria cópia
     e NUNCA recebem o painel dos anciãos. Só a raiz, index.html e endereços desconhecidos abrem o painel. */
  const nome = new URL(e.request.url).pathname.split('/').pop().toLowerCase();
  const outra = /\.html$/.test(nome) && nome !== 'index.html';
  const chave = outra ? nome : 'index.html';
  const guardada = (await c.match(chave)) || (outra ? null : await c.match('./'));
  const rede = fetch(e.request).then(r => { if (r && r.ok) c.put(chave, r.clone()); return r; }).catch(() => null);
  if (guardada) { e.waitUntil(rede); return guardada; }
  return (await rede) || new Response('Sem internet e o app ainda não foi guardado. Abra uma vez com internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function arquivo(e) {
  const c = await caches.open(VERSAO);
  const guardado = await c.match(e.request);
  const rede = fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(e.request, r.clone()); return r; }).catch(() => null);
  if (guardado) { e.waitUntil(rede); return guardado; }
  return (await rede) || Response.error();
}
