// Envia um script Python para execução no Blender via MCP (127.0.0.1:9876).
// Uso: node scripts/blender_exec.js caminho/do/script_blender.py
const net = require('net');
const fs = require('fs');

const code = fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, '');
const sock = net.connect(9876, '127.0.0.1', () => {
  sock.write(JSON.stringify({ type: 'execute_code', params: { code } }));
});
let buf = '';
sock.setTimeout(600000, () => { console.error('timeout'); sock.destroy(); process.exit(1); });
sock.on('data', (d) => {
  buf += d.toString('utf8');
  try {
    const res = JSON.parse(buf);
    const out = res.result && res.result.result !== undefined ? res.result.result : res;
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
    if (res.status !== 'success') process.exitCode = 1;
    sock.end();
  } catch (_) { /* aguarda mais dados */ }
});
sock.on('error', (e) => { console.error(e.message); process.exit(1); });
