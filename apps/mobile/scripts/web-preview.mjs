/**
 * Дзеркало веб-перегляду для розробки: те саме, що віддає Expo, але з
 * заголовками ізоляції походження. Без них браузер не дає WebAssembly-версії
 * SQLite стартувати, і застосунок зависає на завантаженні.
 *
 * На телефон це не впливає: там база нативна, а скрипт узагалі не запускається.
 *
 *   node scripts/web-preview.mjs        # слухає 8082, проксіює на 8081
 */
import http from 'node:http';

const FROM = Number(process.env.PORT ?? 8082);
const TO = Number(process.env.EXPO_PORT ?? 8081);

const ISOLATION = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'credentialless',
  'cross-origin-resource-policy': 'cross-origin',
};

const server = http.createServer((req, res) => {
  const upstream = http.request(
    { host: '127.0.0.1', port: TO, path: req.url, method: req.method, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, { ...up.headers, ...ISOLATION });
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Expo на порту ${TO} не відповідає. Запустіть «npx expo start --web».`);
  });
  req.pipe(upstream);
});

// Гаряче оновлення ходить вебсокетом — його теж треба пропустити.
server.on('upgrade', (req, socket, head) => {
  const upstream = http.request({ host: '127.0.0.1', port: TO, path: req.url, method: req.method, headers: req.headers });
  upstream.end();
  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${Object.entries(upRes.headers)
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('')}\r\n`,
    );
    if (upHead?.length) socket.unshift(upHead);
    if (head?.length) upSocket.write(head);
    upSocket.pipe(socket).pipe(upSocket);
  });
  upstream.on('error', () => socket.destroy());
});

server.listen(FROM, () => console.log(`Веб-перегляд мобільного застосунку: http://localhost:${FROM}`));
