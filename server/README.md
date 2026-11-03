# Hushwood online relay

`hushwood.js` — WebSocket-relay для игры по интернету. Он не хранит мир:
только сводит игроков в комнаты (до 4 человек) и пересылает пакеты
хозяину и клиентам. Игру считает хозяин, как и в LAN-режиме.

## Куда подключено

Клиент игры подключается к:

```
wss://klyrosm.ru/ws?game=hushwood
```

На сервере `hushwood.js` подключён к существующему Node-сервису
`/srv/klyro/ws/server.js` (тот же процесс, что обслуживает чат Klyro).
Nginx уже проксирует `/ws` на `127.0.0.1:8099`, поэтому отдельный
домен или порт не нужен.

## Как подключить на другом сервере

1. Установи Node.js и `ws`.
2. Положи `hushwood.js` рядом с `server.js`.
3. В `server.js`:

```js
const { createHushwoodRelay } = require('./hushwood');
const hushwood = createHushwoodRelay();

server.on('upgrade', (req, socket, head) => {
  // ...
  if (url.pathname === '/hushwood'
      || (url.pathname === '/ws' && url.searchParams.get('game') === 'hushwood')) {
    hushwood.handleUpgrade(req, socket, head);
    return;
  }
  // ... остальная авторизация
});
```

4. Проксируй WebSocket через nginx:

```nginx
location = /ws {
    proxy_pass http://127.0.0.1:8099;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}
```

5. Поменяй адрес в `game-source/src/net.js` (`WS_URL`) и пересобери игру.
