// Сеть для игры по LAN.
// На iPhone — нативный мост MultipeerConnectivity (Wi-Fi/Bluetooth без интернета и серверов).
// В браузере для проверки — BroadcastChannel между вкладками (адрес с ?lan=bc).

const listeners = {};
const WS_URL = (window.__HUSHWOOD_WS__ || 'wss://klyrosm.ru/ws?game=hushwood');
export const Net = {
  kind: null,        // 'native' | 'bc' | null
  role: 'single',    // 'single' | 'host' | 'client'
  myId: null, myName: '',
  hostId: null,
  peers: new Map(),  // id -> имя (подключённые)
  found: new Map(),  // id -> имя (найденные хосты)
  on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  emit(ev, a) { (listeners[ev] || []).forEach(f => { try { f(a); } catch (e) { window.__showError && window.__showError('Сеть: ' + e.message); } }); },
  available() { return !!this.kind; },
  canOnline() { return typeof WebSocket !== 'undefined'; },
  canLan() { return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.lan) || (/[?&]lan=bc/.test(location.search) && 'BroadcastChannel' in window); },
  mode() { return this.kind === 'ws' ? 'online' : ((this.kind === 'native' || this.kind === 'bc') ? 'lan' : 'none'); },
  setMode(mode) {
    this.leave();
    if (mode === 'online' && this.canOnline()) this.kind = 'ws';
    else if (mode === 'lan' && this.canLan()) this.kind = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.lan ? 'native' : 'bc';
    else this.kind = this.canOnline() ? 'ws' : (this.canLan() ? 'native' : null);
    this.emit('mode');
    return this.kind;
  },
  host(name) { this.reset(); this.role = 'host'; this.myName = name; T().host(name); },
  browse(name) { this.reset(); this.role = 'client'; this.myName = name; T().browse(name); },
  join(id) { this.hostId = id; T().join(id); },
  lock(on) { T().lock && T().lock(on); },
  leave() { if (this.kind) T().leave(); this.reset(); this.role = 'single'; },
  reset() { this.peers.clear(); this.found.clear(); this.hostId = null; },
  // to: id или null (всем); клиент всегда шлёт хосту
  send(obj, reliable = false, to = null) {
    if (this.role === 'single') return;
    const s = JSON.stringify(obj);
    if (this.role === 'client') T().send(this.hostId, s, reliable);
    else T().send(to, s, reliable);
  },
  nameOf(id) { return (id || '').split('|')[0]; },
  // голос (только в приложении на iPhone)
  voiceAvail() { return this.kind === 'native'; },
  mic(on) { if (this.kind === 'native') NativeT.post({ cmd: 'mic', on: !!on }); },
  vvol(id, g, pan) { if (this.kind === 'native') NativeT.post({ cmd: 'vvol', id, g, pan }); },
  listen(on) { if (this.kind === 'native') NativeT.post({ cmd: 'listen', on: !!on }); },
};
function T() { return Net.kind === 'native' ? NativeT : (Net.kind === 'bc' ? BcT : WsT); }

// входящие события транспорта — одинаковые для обоих транспортов
function incoming(ev) {
  switch (ev.e) {
    case 'me': Net.myId = ev.id; Net.emit('me'); break;
    case 'found': Net.found.set(ev.id, Net.nameOf(ev.id)); Net.emit('found'); break;
    case 'rooms':
      Net.found.clear();
      (ev.rooms || []).forEach((r) => {
        if (r && r.id) Net.found.set(String(r.id), r.name ? String(r.name) : Net.nameOf(String(r.id)));
      });
      Net.emit('found');
      break;
    case 'lost': Net.found.delete(ev.id); Net.emit('found'); break;
    case 'connected':
      if (Net.role === 'client' && ev.id !== Net.hostId) break; // клиенту важен только хозяин
      Net.peers.set(ev.id, Net.nameOf(ev.id)); Net.emit('peers'); Net.emit('connected', ev.id); break;
    case 'disconnected':
      if (!Net.peers.has(ev.id)) break;
      Net.peers.delete(ev.id); Net.emit('peers'); Net.emit('disconnected', ev.id); break;
    case 'data': {
      let m; try { m = JSON.parse(ev.d); } catch (e) { return; }
      Net.emit('msg', { from: ev.from, m }); break;
    }
    case 'error': Net.emit('error', ev.msg); break;
    case 'vlevel': case 'vtalk': case 'heard': case 'vstate': Net.emit(ev.e, ev); break;
  }
}

// ---------- iPhone: MultipeerConnectivity ----------
const NativeT = {
  post(o) { try { window.webkit.messageHandlers.lan.postMessage(o); } catch (e) { } },
  host(name) { this.post({ cmd: 'host', name }); },
  browse(name) { this.post({ cmd: 'browse', name }); },
  join(id) { this.post({ cmd: 'join', id }); },
  lock(on) { this.post({ cmd: 'lock', on: !!on }); },
  leave() { this.post({ cmd: 'leave' }); },
  send(to, data, reliable) { this.post({ cmd: 'send', to: to || '', data, reliable: !!reliable }); },
};
window.__lan = (ev) => incoming(ev);

// ---------- интернет: общий WebSocket-сервер ----------
const WsT = {
  ws: null,
  queue: [],
  name: '',
  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return this.ws;
    let ws;
    try { ws = new WebSocket(WS_URL); }
    catch (e) { incoming({ e: 'error', msg: 'Не удалось открыть соединение с сервером игры' }); return null; }
    this.ws = ws;
    ws.onopen = () => {
      const q = this.queue;
      this.queue = [];
      q.forEach((s) => { try { ws.send(s); } catch (e) { } });
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      incoming(m);
    };
    ws.onerror = () => { incoming({ e: 'error', msg: 'Ошибка соединения с сервером игры' }); };
    ws.onclose = () => {
      this.ws = null;
      if (Net.role !== 'single') incoming({ e: 'error', msg: 'Соединение с сервером потеряно' });
    };
    return ws;
  },
  sendObj(obj) {
    const s = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === 1) { try { this.ws.send(s); } catch (e) { } }
    else this.queue.push(s);
  },
  host(name) { this.name = name; this.connect(); this.sendObj({ cmd: 'host', name }); },
  browse(name) { this.name = name; this.connect(); this.sendObj({ cmd: 'browse', name }); },
  join(id) { this.sendObj({ cmd: 'join', id, name: this.name }); },
  lock(on) { this.sendObj({ cmd: 'lock', on: !!on }); },
  leave() {
    this.queue = [];
    if (!this.ws) return;
    const ws = this.ws;
    this.ws = null;
    try { ws.send(JSON.stringify({ cmd: 'leave' })); } catch (e) { }
    try { ws.close(); } catch (e) { }
  },
  send(to, data, reliable) { this.sendObj({ cmd: 'send', to: to || '', data, reliable: !!reliable }); },
};

// ---------- браузер: вкладки одного браузера (для проверки) ----------
const BcT = {
  ch: null, timer: null, locked: false,
  open() {
    if (this.ch) return;
    this.ch = new BroadcastChannel('hushwood-lan');
    this.ch.onmessage = (e) => this.onMsg(e.data);
  },
  start(name) { this.open(); Net.myId = name.slice(0, 20) + '|' + (1000 + Math.floor(Math.random() * 9000)); incoming({ e: 'me', id: Net.myId }); },
  host(name) { this.start(name); this.locked = false; clearInterval(this.timer); this.timer = setInterval(() => { if (!this.locked) this.ch.postMessage({ k: 'adv', from: Net.myId }); }, 700); },
  browse(name) { this.start(name); },
  join(id) { this.ch.postMessage({ k: 'join', from: Net.myId, to: id }); },
  lock(on) { this.locked = on; },
  leave() { clearInterval(this.timer); if (this.ch) this.ch.postMessage({ k: 'bye', from: Net.myId }); },
  send(to, data, reliable) { if (this.ch) this.ch.postMessage({ k: 'data', from: Net.myId, to: to || '*', d: data }); },
  onMsg(m) {
    if (!Net.myId || m.from === Net.myId) return;
    if (m.k === 'adv' && Net.role === 'client' && !Net.found.has(m.from)) incoming({ e: 'found', id: m.from });
    else if (m.k === 'join' && m.to === Net.myId && Net.role === 'host' && !this.locked && Net.peers.size < 3) { this.ch.postMessage({ k: 'accept', from: Net.myId, to: m.from }); incoming({ e: 'connected', id: m.from }); }
    else if (m.k === 'accept' && m.to === Net.myId) incoming({ e: 'connected', id: m.from });
    else if (m.k === 'bye') { incoming({ e: 'lost', id: m.from }); incoming({ e: 'disconnected', id: m.from }); }
    else if (m.k === 'data' && (m.to === Net.myId || m.to === '*') && Net.peers.has(m.from)) incoming({ e: 'data', from: m.from, d: m.d });
  },
};

// Онлайн — по умолчанию; ?lan=bc оставляем для локальной проверки в браузере.
if (/[?&]lan=bc/.test(location.search) && 'BroadcastChannel' in window) Net.kind = 'bc';
else if (typeof WebSocket !== 'undefined') Net.kind = 'ws';
else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.lan) Net.kind = 'native';
