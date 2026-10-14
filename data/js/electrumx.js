/**
 * electrumx.js
 * Copyright (c) 2022 Mikael Hannes, connection handling reworked 2026
 * MIT license.
 *
 * Handles communication with ElectrumX servers via ecoin.min.js.
 * Changes from the original:
 *  - each server gets a connect timeout, so one dead server can't hang the wallet
 *  - every request reconnects and retries once if the socket dropped
 *  - failures are reported instead of being swallowed
 */
(function (window) {
  const MINUTES = 60000;
  const CONNECT_TIMEOUT_MS = 12000;
  const REQUEST_TIMEOUT_MS = 20000;

  const electrumServers = [
    { host: 'electrum1.valhala.is', port: 50004, protocol: 'wss' },
    { host: 'electrumx.aur.ewmcx.info', port: 50003, protocol: 'wss' },
    { host: 'failover.aur.ewmcx.biz', port: 50003, protocol: 'wss' },
    { host: 'lenoir.ecoincore.com', port: 50003, protocol: 'wss' },
  ];

  let client = null;
  let connectedHost = null;
  let connecting = null; // shared promise so parallel calls don't open several sockets
  let pingTimer = null;

  function withTimeout(promise, ms, label) {
    let t;
    const timeout = new Promise(function (_, reject) {
      t = setTimeout(function () {
        reject(new Error(label + ' timed out'));
      }, ms);
    });
    // No .finally(): the wallet bundles an old Promise library that doesn't have it.
    return Promise.race([promise, timeout]).then(
      function (v) { clearTimeout(t); return v; },
      function (e) { clearTimeout(t); throw e; }
    );
  }

  function dropClient() {
    if (client) {
      try { client.close(); } catch (e) { /* ignore */ }
    }
    client = null;
    connectedHost = null;
  }

  async function connectAny() {
    dropClient();
    for (const server of electrumServers) {
      const c = new ecoin.ElectrumClient(server.host, server.port, server.protocol);
      try {
        await withTimeout(c.connect(), CONNECT_TIMEOUT_MS, 'Connect to ' + server.host);
        // The original wallet ignored a failed version handshake, and some servers
        // reject it here. Treat it as optional so a working server isn't skipped.
        try {
          await withTimeout(c.server_version('aur-wallet', '1.4'), CONNECT_TIMEOUT_MS, 'Handshake');
        } catch (e) {
          console.warn('Version handshake not accepted by ' + server.host + ', continuing', e);
        }
        client = c;
        connectedHost = server.host;
        console.log('Connected to Electrum server: ' + server.host);
        return;
      } catch (err) {
        console.error('Failed to connect to ' + server.host, err);
        try { c.close(); } catch (e) { /* ignore */ }
      }
    }
    throw new Error('Could not reach any Auroracoin server. Check your connection and try again.');
  }

  function ensureConnected() {
    if (client) return Promise.resolve(client);
    if (!connecting) {
      connecting = connectAny().then(
        function () { connecting = null; },
        function (e) { connecting = null; throw e; }
      );
    }
    return connecting.then(function () { return client; });
  }

  // Run a request; if it fails (dropped socket, server hiccup), reconnect and try once more.
  async function request(method, args) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const c = await ensureConnected();
      try {
        return await withTimeout(c[method].apply(c, args), REQUEST_TIMEOUT_MS, method);
      } catch (err) {
        console.error(method + ' failed on ' + connectedHost, err);
        // Server-side rejections (e.g. a bad transaction) must not be retried.
        const msg = String((err && err.message) || err);
        if (method === 'blockchain_transaction_broadcast' && !/timed out|close|socket|connect/i.test(msg)) {
          throw err;
        }
        if (attempt === 1) throw err;
        dropClient();
      }
    }
  }

  const manager = {
    getserver: function () { return connectedHost; },
    isConnected: function () { return !!client; },
    getutxo: function (scripthash) {
      return request('blockchain_scripthash_listunspent', [scripthash]);
    },
    getbalance: function (scripthash) {
      return request('blockchain_scripthash_getBalance', [scripthash]);
    },
    broadcastrawtx: function (rawtx) {
      return request('blockchain_transaction_broadcast', [rawtx]);
    },
    // Minimum relay fee in AUR per kB, or null if the server doesn't say.
    relayfee: function () {
      return request('blockchain_relayfee', []).then(
        function (r) { return Number(r) || null; },
        function () { return null; }
      );
    },
    subscribeScriptHash: function (scripthash) {
      return request('blockchain_scripthash_subscribe', [scripthash]);
    },
    electrumInit: async function () {
      await ensureConnected();
      if (!pingTimer) {
        pingTimer = setInterval(function () {
          if (!client) return;
          client.server_ping().catch(function () { dropClient(); });
        }, 8 * MINUTES);
      }
      return connectedHost;
    },
  };

  window.electrumxManager = manager;
})(window);
