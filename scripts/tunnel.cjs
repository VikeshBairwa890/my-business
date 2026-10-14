const localtunnel = require('localtunnel');

let activeTunnel = null;
let reconnectTimer = null;

function scheduleReconnect(delayMs = 3000) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startTunnel();
  }, delayMs);
}

async function startTunnel() {
  if (activeTunnel) {
    try { activeTunnel.close(); } catch {}
    activeTunnel = null;
  }

  console.log('[Tunnel] Connecting localtunnel to port 4000 (subdomain: thekabook-live-api)...');
  try {
    const tunnel = await localtunnel({
      port: 4000,
      subdomain: 'thekabook-live-api',
    });

    activeTunnel = tunnel;
    console.log(`[Tunnel] Live URL ready: ${tunnel.url}`);

    if (tunnel.url !== 'https://thekabook-live-api.loca.lt') {
      console.warn(`[Tunnel] Notice: Assigned ${tunnel.url} instead of thekabook-live-api. Retrying in 4s to reclaim custom subdomain...`);
      try { tunnel.close(); } catch {}
      activeTunnel = null;
      scheduleReconnect(4000);
      return;
    }

    tunnel.on('close', () => {
      console.log('[Tunnel] Tunnel closed. Reconnecting in 3s...');
      activeTunnel = null;
      scheduleReconnect(3000);
    });

    tunnel.on('error', (err) => {
      console.error('[Tunnel] Error:', err.message);
      try { tunnel.close(); } catch {}
      activeTunnel = null;
      scheduleReconnect(3000);
    });
  } catch (err) {
    console.error('[Tunnel] Failed to start:', err.message);
    activeTunnel = null;
    scheduleReconnect(3000);
  }
}

// Keep node alive indefinitely
setInterval(() => {}, 1000 * 60 * 60);

process.on('uncaughtException', (err) => {
  console.error('[Tunnel] Uncaught exception:', err.message);
  scheduleReconnect(3000);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Tunnel] Unhandled rejection:', reason);
  scheduleReconnect(3000);
});

startTunnel();
