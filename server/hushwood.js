'use strict';
/**
 * Hushwood online relay.
 *
 * Подключается к тому же Node-процессу, что и Klyro WS, по адресу
 * /ws?game=hushwood (nginx уже проксирует /ws на 127.0.0.1:8099).
 *
 * Сервер не хранит мир игры: он только сводит игроков в комнаты
 * и пересылает пакеты хозяину/клиентам. Хозяин по-прежнему считает игру.
 */

const { WebSocketServer } = require('ws');

const MAX_ROOMS = 200;
const MAX_CLIENTS = 4;
const MAX_TOTAL = 2000;
const MAX_MSG = 65536;
const MAX_RATE = 240;

function cleanName(value, max = 16) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'Игрок';
}

function createHushwoodRelay() {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
  const rooms = new Map();   // roomId -> room
  const browsing = new Set(); // ws, которые сейчас ищут игру
  const peers = new Map();    // ws -> peer state
  let total = 0;

  function send(ws, obj) {
    if (!ws || ws.readyState !== 1) return;
    try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }

  function roomList() {
    const out = [];
    for (const room of rooms.values()) {
      if (!room.locked && room.clients.size < MAX_CLIENTS) {
        out.push({ id: room.id, name: room.name });
      }
    }
    return out;
  }

  function broadcastRooms() {
    const list = roomList();
    for (const ws of browsing) send(ws, { e: 'rooms', rooms: list });
  }

  function leaveRoom(ws) {
    const p = peers.get(ws);
    if (!p || !p.roomId) return;
    const room = rooms.get(p.roomId);
    p.roomId = null;
    p.role = 'idle';
    if (!room) return;
    if (room.host === ws) {
      for (const client of room.clients.values()) {
        send(client, { e: 'disconnected', id: room.id });
        send(client, { e: 'error', msg: 'Хозяин вышел из игры' });
      }
      rooms.delete(room.id);
    } else {
      room.clients.delete(p.peerId);
      send(room.host, { e: 'disconnected', id: p.peerId });
    }
    broadcastRooms();
  }

  function joinRoom(ws, roomId) {
    const p = peers.get(ws);
    if (!p) return;
    const room = rooms.get(String(roomId || ''));
    if (!room) return send(ws, { e: 'error', msg: 'Игра не найдена' });
    if (room.locked) return send(ws, { e: 'error', msg: 'Хозяин уже начал игру' });
    if (room.clients.size >= MAX_CLIENTS) return send(ws, { e: 'error', msg: 'В игре уже 4 игрока' });
    if (p.roomId === room.id) return;

    leaveRoom(ws);
    const name = cleanName(p.name);
    let peerId;
    do { peerId = name + '|' + Math.floor(1000 + Math.random() * 9000); }
    while (room.clients.has(peerId));
    p.role = 'client';
    p.roomId = room.id;
    p.peerId = peerId;
    room.clients.set(peerId, ws);
    send(ws, { e: 'me', id: peerId });
    send(ws, { e: 'connected', id: room.id });
    send(room.host, { e: 'connected', id: peerId });
    broadcastRooms();
  }

  function handleConnection(ws) {
    total++;
    peers.set(ws, { role: 'idle', roomId: null, peerId: null, name: 'Игрок', rateAt: Date.now(), rate: 0 });
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('error', () => {});

    ws.on('message', (raw) => {
      const p = peers.get(ws);
      if (!p) return;
      const now = Date.now();
      if (now - p.rateAt > 1000) { p.rateAt = now; p.rate = 0; }
      if (++p.rate > MAX_RATE) return;

      let m;
      try { m = JSON.parse(String(raw)); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;

      if (m.cmd === 'host') {
        leaveRoom(ws);
        if (rooms.size >= MAX_ROOMS) {
          return send(ws, { e: 'error', msg: 'Сервер перегружен, попробуйте позже' });
        }
        const name = cleanName(m.name);
        let roomId;
        do { roomId = name + '|' + Math.floor(1000 + Math.random() * 9000); }
        while (rooms.has(roomId));
        rooms.set(roomId, {
          id: roomId,
          name,
          host: ws,
          clients: new Map(),
          locked: false,
          createdAt: now,
        });
        p.role = 'host';
        p.roomId = roomId;
        p.peerId = roomId;
        p.name = name;
        send(ws, { e: 'me', id: roomId });
        broadcastRooms();
        return;
      }

      if (m.cmd === 'browse') {
        leaveRoom(ws);
        p.role = 'browse';
        p.roomId = null;
        p.name = cleanName(m.name);
        if (!p.peerId) {
          p.peerId = p.name + '|' + Math.floor(1000 + Math.random() * 9000);
        }
        browsing.add(ws);
        send(ws, { e: 'me', id: p.peerId });
        send(ws, { e: 'rooms', rooms: roomList() });
        return;
      }

      if (m.cmd === 'join') {
        browsing.delete(ws);
        if (m.name) p.name = cleanName(m.name);
        joinRoom(ws, m.id);
        return;
      }

      if (m.cmd === 'lock') {
        if (p.role !== 'host') return;
        const room = rooms.get(p.roomId);
        if (!room) return;
        room.locked = !!m.on;
        broadcastRooms();
        return;
      }

      if (m.cmd === 'send') {
        if (!p.roomId) return;
        const room = rooms.get(p.roomId);
        if (!room) return;
        const data = typeof m.data === 'string' ? m.data : '';
        if (!data || data.length > MAX_MSG) return;
        if (p.role === 'client') {
          send(room.host, { e: 'data', from: p.peerId, d: data });
          return;
        }
        if (p.role === 'host') {
          const to = String(m.to || '');
          if (!to || to === '*') {
            for (const client of room.clients.values()) {
              send(client, { e: 'data', from: p.peerId, d: data });
            }
          } else {
            const client = room.clients.get(to);
            if (client) send(client, { e: 'data', from: p.peerId, d: data });
          }
        }
        return;
      }

      if (m.cmd === 'leave') {
        browsing.delete(ws);
        leaveRoom(ws);
        p.role = 'idle';
      }
    });

    ws.on('close', () => {
      browsing.delete(ws);
      leaveRoom(ws);
      peers.delete(ws);
      total = Math.max(0, total - 1);
    });
  }

  wss.on('connection', handleConnection);

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch (e) { /* ignore */ }
        return;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch (e) { /* ignore */ }
    });
  }, 30000);
  if (heartbeat.unref) heartbeat.unref();

  return {
    handleUpgrade(req, socket, head) {
      if (total >= MAX_TOTAL) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    },
  };
}

module.exports = { createHushwoodRelay };
