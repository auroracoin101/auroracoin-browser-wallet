/**
 * electrumx.js
 * Copyright (c) 2022 Mikael Hannes
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * electrumx handles communication with electrumx server via wss
 */

(function (window) {
  var electrumxManager = function () {};
  const electrum = new ecoin.ElectrumClient(
    'failover.aur.ewmcx.biz',
    50003,
    'wss'
  );
  const MINUTES = 60000;
  const walletaddress = 'AGFFte5J3SfXpsNXxW81zD9JTz3K6BqDie';
  const p2pkh = '76a914052dcc96ce75d0b2d43baad6c07b12a5cb912c0988ac';
  const sha256 =
    'f4c606acf6f5f23ebe54d32d9d0103b91ca2deee80a3b9df1213c9d5d59cbd31';
  const revhex =
    '13dbc95d5d9c3121fd9b3a08eeed2ac19b3010d9d23d45ebe32f5f6fca606c4f';

  electrumxManager.prototype = {
    getutxo: async (scripthash = revhex) => {
      try {
        var utxo = await electrum.blockchain_scripthash_listunspent(scripthash);
        console.log(scripthash);
        console.log(utxo);
      } catch (error) {
        console.error({ error });
      }
    },
    aurmain: async () => {
      try {
        electrum.subscribe.on('blockchain.headers.subscribe', (blob) => {
          console.log(blob);
        });

        electrum.subscribe.on('blockchain.scripthash.subscribe', (blob) => {
          console.log(blob);
        });

        await electrum.connect();

        const ver = await electrum.server_version('electrum-client-js', '1.4');
        console.log('Negotiated version:', ver);
        // const serverfeatures = await electrum.server_features()
        // console.log('Server Features:', serverfeatures)

        const header = await electrum.blockchain_headers_subscribe();
        console.log('Latest header:', header);

        const scripthashStatus = await electrum.blockchain_scripthash_subscribe(
          revhex
        );
        console.log('Latest scripthash status:', scripthashStatus);

        console.log('Waiting for notifications...');

        // Keep connection alive.
        setInterval(async () => {
          await electrum.server_ping();
        }, 8 * MINUTES);
      } catch (error) {
        console.error({ error });
      }
    },
  };

  var ret = new electrumxManager();
  // aurmain();
  window.electrumxManager = ret;
})(window);
