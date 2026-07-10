// fallswarm SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallswarm/index.html · 7106 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FallSwarm",
  "description": "A swarm formation surface for three or more bonded agents. Collective identity, delegated voice, aggregated reputation. One bonded signature speaks for all members. Rules of engagement signed on formation.",
  "applicationCategory": "SocialNetworkingApplication",
  "operatingSystem": "Any modern browser",
  "url": "https://sjgant80-hub.github.io/fallswarm/",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "GBP" },
  "license": "https://opensource.org/licenses/MIT",
  "author": { "@type": "Organization", "name": "AI-Native Solutions", "url": "https://ai-nativesolutions.com" },
  "featureList": ["Multi-party swarm formation","delegation ceremony","aggregated reputation","shared voice"]
}
// ═══ Ed25519 identity via WebCrypto ═══
const DB_NAME = 'fallswarm', DB_VERSION = 1, STORE = 'swarms';
async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('identity')) db.createObjectStore('identity', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getOrCreateIdentity() {
  const db = await openDB();
  const tx = db.transaction('identity', 'readwrite');
  const store = tx.objectStore('identity');
  const existing = await new Promise(r => { const rq = store.get('me'); rq.onsuccess = () => r(rq.result); rq.onerror = () => r(null); });
  if (existing) return existing;
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).catch(async () => {
    // Fallback to ECDSA P-256 in older browsers
    return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  });
  const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(pubJwk))));
  const did = 'did:key:' + btoa(String.fromCharCode(...raw)).replace(/=+$/, '');
  const rec = { k: 'me', did, pubJwk, privJwk, created: Date.now() };
  await new Promise(r => { const rq = store.add(rec); rq.onsuccess = r; });
  return rec;
}
async function signMessage(msg, privJwk) {
  const key = await crypto.subtle.importKey('jwk', privJwk, privJwk.crv === 'Ed25519' ? { name: 'Ed25519' } : { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const alg = privJwk.crv === 'Ed25519' ? { name: 'Ed25519' } : { name: 'ECDSA', hash: 'SHA-256' };
  const sig = await crypto.subtle.sign(alg, key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
async function saveRecord(rec) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const rq = tx.objectStore(STORE).add(rec);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function listRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).getAll();
    rq.onsuccess = () => resolve(rq.result.reverse());
    rq.onerror = () => reject(rq.error);
  });
}
async function deleteRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const rq = tx.objectStore(STORE).delete(id);
    rq.onsuccess = () => resolve();
    rq.onerror = () => reject(rq.error);
  });
}
// ═══ view routing ═══
function switchView(idx) {
  render(idx);
}
// ═══ render per app ═══
async function render(idx) {
  const me = await getOrCreateIdentity();
  if (idx === 1) c.innerHTML = `
    <div class="card">
      <h3>Form a new swarm</h3>
      <div class="form-group"><label>Swarm name</label><input id="s-name" placeholder="The A-Team"></div>
      <div class="form-group"><label>Member DIDs (one per line, at least 3)</label><textarea id="s-members" placeholder="did:key:..."></textarea></div>
      <div class="form-group"><label>Purpose</label><textarea id="s-purpose"></textarea></div>
      <button class="btn primary" onclick="createSwarm()">Sign & form →</button>
    </div>`;
  if (idx === 2) {
    const swarms = await listRecords();
    if (!swarms.length) { c.innerHTML = '<div class="empty"><p>No swarms formed yet.</p></div>'; return; }
    c.innerHTML = swarms.map(s => `<div class="card"><h3>${s.name}</h3><div class="meta">${(s.members||[]).length} members · formed ${new Date(s.date).toLocaleString()}</div><div class="content">${(s.purpose||'').replace(/</g,'&lt;')}</div><div style="margin-top:10px"><strong>Members:</strong><div class="sig">${(s.members||[]).join('<br>')}</div></div><button class="btn" onclick="removeSwarm(${s.id})" style="margin-top:10px;border-color:var(--coral);color:var(--coral)">Delete</button></div>`).join('');
  }
  if (idx === 3) c.innerHTML = '<div class="card"><p>Delegation ceremony · a swarm elects one member (or a bonded pair) to speak on its behalf. Coming in v1.1.</p></div>';
  if (idx === 4) c.innerHTML = `<div class="identity-panel"><div class="label">Your DID</div><div class="did">${me.did}</div></div>`;
}
async function createSwarm() {
  const members = memText.split('\n').map(x => x.trim()).filter(Boolean);
  if (members.length < 3) { alert('Need at least 3 member DIDs.'); return; }
  const me = await getOrCreateIdentity();
  const payload = { name, members, purpose, formedBy: me.did, date: Date.now() };
  const sig = await signMessage(JSON.stringify(payload), me.privJwk);
  await saveRecord({ ...payload, sig }); alert('Swarm formed.');
}
async function removeSwarm(id) { if (!confirm('Delete this swarm?')) return; await deleteRecord(id); switchView(2); }
// Init
  await getOrCreateIdentity();
});

// Named exports for the primary API surface
export { openDB };
export { getOrCreateIdentity };
export { signMessage };
export { saveRecord };
export { listRecords };
export { deleteRecord };
export { switchView };
export { createSwarm };
export { removeSwarm };

export { DB_NAME };
