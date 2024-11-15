
/**
 * electrumx.js
 * Copyright (c) 2022 Mikael Hannes
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * electrumx handles communication with electrumx server via ecoin.min.js
 */
(function (window) {
  var electrumxManager = function () {
    this.electrum = null; // Initially null, will be assigned later
  };

  const MINUTES = 60000;
  
  // List of Electrum servers
  const electrumServers = [
    { host: 'electrum1.valhala.is', port: 50004, protocol: 'wss' },
    { host: 'failover.aur.ewmcx.biz', port: 50003, protocol: 'wss' },
    { host: 'electrumx.aur.ewmcx.info', port: 50003, protocol: 'wss' },
    { host: 'lenoir.ecoincore.com', port: 50003, protocol: 'wss' },
  ];

  // Attempt to connect to each server
  async function tryElectrumServers(manager) {
    for (const server of electrumServers) {
      try {
        manager.electrum = new ecoin.ElectrumClient(server.host, server.port, server.protocol);
        await manager.electrum.connect();
        console.log(`Connected to Electrum server: ${server.host}`);
        return;
      } catch (err) {
        console.error(`Failed to connect to Electrum server: ${server.host}`, err);
      }
    }
    throw new Error('All Electrum servers failed to connect.');
  }

  electrumxManager.prototype = {
    getserver: async () => {
      return this.electrum;
    },
    getutxo: async (scripthash) => {
      try {
        var utxo = await this.electrum.blockchain_scripthash_listunspent(scripthash);
        return utxo;
      } catch (error) {
        console.error({ error });
        throw error;
      }
    },
    broadcastrawtx: async (rawtx) => {
      try {
        var txhash = await this.electrum.blockchain_transaction_broadcast(rawtx);
        return txhash;
      } catch (error) {
        console.error({ error });
        throw error;
      }
    },

    getbalance: async (scripthash) => {
      try {
        var balance = await this.electrum.blockchain_scripthash_getBalance(
          scripthash
        );
        return balance;
      } catch (error) {
        console.error({ error });
        throw error;
      }
    },
    subscribeScriptHash: async (scripthash) => {
      try {
        const scripthashStatus = await this.electrum.blockchain_scripthash_subscribe(
          scripthash
        );

        //console.log('Latest scripthash status:', scripthashStatus);
        return scripthashStatus;
      } catch (error) {
        console.error({ error });
        throw error;
      }
    },
    electrumInit: async () => {
      try {
        // removed automatic subscribes until we are able to process messages
        /*  electrum.subscribe.on('blockchain.headers.subscribe', (blob) => {          console.log(blob);        });
        electrum.subscribe.on('blockchain.scripthash.subscribe', (blob) => {          console.log(blob);        }); */
        // TODO pass in server parameters and manage electrum "active" connection(s)
        
        await tryElectrumServers(this); // Try connecting to available servers

        // var ret = await electrum.connect();
        const ver = await this.electrum.server_version('aur-wallet', '1.4');
        // Keep connection alive.
        setInterval(async () => {
          console.log('ping');
          await this.electrum.server_ping();
        }, 8 * MINUTES);

        return ver;

        // const serverfeatures = await electrum.server_features()
        // console.log('Server Features:', serverfeatures)

        //const header = await electrum.blockchain_headers_subscribe();
        //console.log('Latest header:', header);
      } catch (error) {
        console.error({ error });
        throw error;
      }
    },
  };

  var ret = new electrumxManager();
  window.electrumxManager = ret;
})(window);
