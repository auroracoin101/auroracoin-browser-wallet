/**
 * wallet.js
 * Copyright (c) 2014 Andrew Toth, © 2019-2022 Mikael Hannes
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Wallet handles the address, private key and encryption,
 * as well as sending and determining balance
 */

(function (window) {
  var balance = 0,
    address = '',
    scripthash = '',
    privateKey = '',
    isEncrypted = false,
    websocket = null,
    balanceListener = null,
    statusListener = null;

  var MIN_FEE = 30000; // 0.0003 AUR, the wallet's original flat fee
  var DUST = 546;
  var MAX_SWEEP_INPUTS = 400; // keeps a sweep transaction well under standard size limits

  // Size-based fee: the old flat fee was too low for transactions with many inputs,
  // which is why sweeps of keys holding lots of small payments got rejected.
  function estimateFee(nIn, nOut, relayPerKbSat) {
    var size = 10 + nIn * 180 + nOut * 34;
    var perKb = Math.max(MIN_FEE, relayPerKbSat || 0);
    return Math.max(MIN_FEE, Math.ceil(size / 1000) * perKb);
  }

  function relayPerKbSat() {
    return electrumxManager.relayfee().then(function (aurPerKb) {
      return aurPerKb ? Math.ceil(aurPerKb * 100000000) : 0;
    });
  }

  function scripthashFor(addr) {
    var outputscript = bitcoinjs_aur.address.toOutputScript(addr);
    var sha = bitcoinjs_aur.crypto.sha256(outputscript);
    return bitcoinjs_aur.Buffer.from(sha.reverse()).toString('hex');
  }

  var wallet = function () {};

  wallet.prototype = {
    getAddress: function () {
      return address;
    },

    getBalance: function () {
      return balance;
    },

    getScriptHash: function () {
      return scripthash;
    },

    isEncrypted: function () {
      return isEncrypted;
    },

    // Balance listener gets called with new balance whenever it updates
    setBalanceListener: function (listener) {
      balanceListener = listener;
    },

    // Status listener gets called with an Error when the server can't be reached, or null when OK
    setStatusListener: function (listener) {
      statusListener = listener;
    },

    // Create a new address
    generateAddress: function (password) {
      console.log('wallet.js.generateAddress');
      return new Promise(function (resolve, reject) {
        if (ret.validatePassword(password)) {
          var eckey = bitcoinjs_aur.ECPair.makeRandom();
          if (isEncrypted) {
            if (typeof chrome !== 'undefined') {
              privateKey = CryptoJS.AES.encrypt(eckey.toWIF(), password);
            } else {
              privateKey = JSON.parse(
                CryptoJS.AES.encrypt(eckey.toWIF(), password, {
                  format: jsonFormatter,
                })
              );
            }
          } else {
            privateKey = eckey.toWIF();
          }
          address = eckey.getAddress();
          var outputscript = bitcoinjs_aur.address.toOutputScript(address);
          var sha = bitcoinjs_aur.crypto.sha256(outputscript);
          scripthash = bitcoinjs_aur.Buffer.from(sha.reverse()).toString('hex');

          balance = 0;
          Promise.all([
            preferences.setAddress(address),
            preferences.setScriptHash(scripthash),
            preferences.setPrivateKey(privateKey),
            preferences.setIsEncrypted(isEncrypted),
          ]).then(function () {
            updateBalance();
            resolve();
          });
        } else {
          reject(Error('Incorrect password'));
        }
      });
    },

    // Restore the previously saved address
    restoreAddress: function () {
      return new Promise(function (resolve, reject) {
        Promise.all([
          preferences.getAddress(),
          preferences.getPrivateKey(),
          preferences.getIsEncrypted(),
          preferences.getScriptHash(),
        ]).then(function (values) {
          if (values[0].length > 0) {
            address = values[0];
            privateKey = values[1];
            isEncrypted = values[2];
            scripthash = values[3];
            updateBalance();
            resolve();
          } else {
            reject(Error('No address'));
          }
        });
      });
    },

    // Check if the password is valid
    validatePassword: function (password) {
      if (isEncrypted) {
        try {
          // If we can decrypt the private key with the password, then the password is correct
          // We never store a copy of the password anywhere
          if (typeof chrome !== 'undefined') {
            return CryptoJS.AES.decrypt(privateKey, password).toString(
              CryptoJS.enc.Utf8
            );
          } else {
            return CryptoJS.AES.decrypt(JSON.stringify(privateKey), password, {
              format: jsonFormatter,
            }).toString(CryptoJS.enc.Utf8);
          }
        } catch (e) {
          return false;
        }
      } else {
        return true;
      }
    },

    // Return a decrypted private key using the password
    getDecryptedPrivateKey: function (password) {
      if (isEncrypted) {
        if (typeof chrome !== 'undefined') {
          var decryptedPrivateKey = CryptoJS.AES.decrypt(privateKey, password);
        } else {
          var decryptedPrivateKey = CryptoJS.AES.decrypt(
            JSON.stringify(privateKey),
            password,
            { format: jsonFormatter }
          );
        }
        try {
          if (!decryptedPrivateKey.toString(CryptoJS.enc.Utf8)) {
            return null;
          }
        } catch (e) {
          return null;
        }
        return decryptedPrivateKey.toString(CryptoJS.enc.Utf8);
      } else {
        return privateKey;
      }
    },

    // Return WIF with byte 1=B0(176), which is the WIF code used in the core wallet
    // ie. "sweeping private key" now supports other browser wallet or core desktop wallets
    getWIFb0: function (wifKey) {
      try {
        var newKey = bitcoinjs_aur.bs58check.decode(wifKey);
        var newWif = bitcoinjs_aur.bs58check.encode(176,newKey.privateKey,true);
      } catch (e) {
        return 'Error creating Alternate WIF';
      }
      return newWif;
    },

    // "temporary" prototype exposed function
    updateBal: function () {
      updateBalance();
    },

    // "temporary" object array of servers, maybe add IsConnected parameter and more
    servers: [
      { host: 'lenoir.ecoincore.com', port: 12345, protocol: 'wss' },
      { host: 'electrumx.aur.ewmcx.info', port: 50003, protocol: 'wss' },
      { host: 'failover.aur.ewmcx.biz', port: 50003, protocol: 'wss' },
    ],
  };

  // Gets the current balance
  function updateBalance() {
    // Make sure we have an address
    if (address.length) {
      if (!scripthash.length) {
        // calculate scripthash from address.  important for new release deployment
        console.log('Need to create scripthash');
        alert('Remember to backup your private key.');
        var outputscript = bitcoinjs_aur.address.toOutputScript(address);
        var sha = bitcoinjs_aur.crypto.sha256(outputscript);
        scripthash = bitcoinjs_aur.Buffer.from(sha.reverse()).toString('hex');
        preferences.setScriptHash(scripthash);
        console.log('New ScriptHash: ', scripthash);
      }
      // Last stored balance is the fastest way to update
      preferences.getLastBalance().then(function (result) {
        balance = result;
        if (balanceListener) balanceListener(balance);
        // Check Auroracoin-node for the current balance

        electrumxManager
          .getbalance(scripthash)
          .then(function (response) {
            console.log('Get Electrum Balance', response);
            // Include unconfirmed so freshly received or swept coins show up right away
            balance = Number(response.confirmed) + Number(response.unconfirmed || 0);
            if (statusListener) statusListener(null);
            return preferences.setLastBalance(balance);
          })
          .then(function () {
            if (balanceListener) balanceListener(balance);
          })
          .catch(function (err) {
            console.error('Balance update failed', err);
            if (statusListener) statusListener(err);
          });
      });
    }
  }

  var ret = new wallet();

  // Change the password to a new password
  wallet.prototype.updatePassword = function (password, newPassword) {
    return new Promise(function (resolve, reject) {
      // Make sure the previous password is correct
      var decryptedPrivateKey = ret.getDecryptedPrivateKey(password);
      if (decryptedPrivateKey) {
        // If we have a new password we use it, otherwise leave cleartext
        if (newPassword) {
          if (typeof chrome !== 'undefined') {
            privateKey = CryptoJS.AES.encrypt(decryptedPrivateKey, newPassword);
          } else {
            privateKey = JSON.parse(
              CryptoJS.AES.encrypt(decryptedPrivateKey, newPassword, {
                format: jsonFormatter,
              })
            );
          }
          isEncrypted = true;
        } else {
          privateKey = decryptedPrivateKey;
          isEncrypted = false;
        }
        // Save the encrypted private key
        // Passwords are never saved anywhere
        Promise.all([
          preferences.setIsEncrypted(isEncrypted),
          preferences.setPrivateKey(privateKey),
        ]).then(resolve);
      } else {
        reject(Error('Incorrect password'));
      }
    });
  };

  // Build, sign and broadcast a transaction spending `utxos` with `eckey`.
  function buildAndBroadcast(eckey, utxos, outputs) {
    var txb = new bitcoinjs_aur.TransactionBuilder();
    utxos.forEach(function (u) { txb.addInput(u.tx_hash, u.tx_pos); });
    outputs.forEach(function (o) { txb.addOutput(o.address, o.value); });
    for (var i = 0; i < utxos.length; i++) txb.sign(i, eckey);
    var txdata = txb.build().toHex();
    return electrumxManager.broadcastrawtx(txdata).then(function (result) {
      if (!result) throw new Error('Server did not accept the transaction');
      return result;
    });
  }

  // Send auroracoin from the wallet to another address.
  // `fee` is the minimum fee; it is raised automatically for larger transactions.
  wallet.prototype.send = function (sendAddress, amount, fee, password) {
    var decryptedPrivateKey = ret.getDecryptedPrivateKey(password);
    if (!decryptedPrivateKey) return Promise.reject(Error('Incorrect password'));
    var eckey = bitcoinjs_aur.ECPair.fromWIF(decryptedPrivateKey);
    amount = Math.round(Number(amount));

    return Promise.all([electrumxManager.getutxo(scripthash), relayPerKbSat()]).then(function (r) {
      var inputs = (r[0] || []).slice().sort(function (x, y) { return y.value - x.value; });
      var perKb = r[1];
      var selected = [], available = 0, txFee = Math.max(Number(fee) || 0, MIN_FEE);
      for (var i = 0; i < inputs.length; i++) {
        selected.push(inputs[i]);
        available += Number(inputs[i].value);
        txFee = Math.max(Number(fee) || 0, estimateFee(selected.length, 2, perKb));
        if (available >= amount + txFee) break;
      }
      if (available < amount + txFee) {
        throw Error('Insufficient funds (need ' + (amount + txFee) / 1e8 + ' AUR including fee)');
      }
      var outputs = [{ address: sendAddress, value: amount }];
      var change = available - amount - txFee;
      if (change >= DUST) outputs.push({ address: eckey.getAddress(), value: change });
      else txFee += change; // tiny change would be unspendable, give it to the fee
      return buildAndBroadcast(eckey, selected, outputs).then(function (txid) {
        preferences.setLastBalance(balance - amount - txFee);
        setTimeout(updateBalance, 3000);
        return txid;
      });
    });
  };

  // Turn whatever the user pasted into candidate Auroracoin keys.
  // Accepts Auroracoin WIF (starts with P, T or 6), WIF from other coins that share
  // the same format (e.g. Bitcoin K/L/5), and raw 64-character hex keys.
  function parseKeyCandidates(input) {
    var str = String(input || '').replace(/\s+/g, '');
    if (!str) throw Error('Paste a private key first.');
    var secret, compressedOptions;
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(str)) {
      secret = bitcoinjs_aur.Buffer.from(str.replace(/^0x/, ''), 'hex');
      compressedOptions = [true, false]; // hex doesn't say which; check both addresses
    } else {
      var decoded;
      try {
        decoded = bitcoinjs_aur.bs58check.decode(str);
      } catch (e) {
        try {
          bitcoinjs_aur.address.fromBase58Check(str);
          throw Error('That is an address, not a private key. You need the secret key that controls it.');
        } catch (e2) {
          if (/address, not/.test(e2.message)) throw e2;
        }
        if (/^[0-9a-fA-F]+$/.test(str)) {
          throw Error('This looks like a hex key but it is ' + str.length + ' characters long. A full hex key is 64 characters.');
        }
        throw Error('That key has a typo or is incomplete (' + str.length + ' characters). Auroracoin keys are 51 or 52 characters and usually start with P, T or 6.');
      }
      if (!decoded || !decoded.privateKey || decoded.privateKey.length !== 32) {
        throw Error('That is an address or another kind of code, not a private key.');
      }
      secret = decoded.privateKey;
      // Check the other form too: some tools export a key in a different
      // compressed/uncompressed form than the one the coins were sent to.
      compressedOptions = [!!decoded.compressed, !decoded.compressed];
    }
    return compressedOptions.map(function (c) {
      return bitcoinjs_aur.ECPair.fromWIF(bitcoinjs_aur.bs58check.encode(0x97, secret, c));
    });
  }

  function previewFor(eckey, perKb) {
    var from = eckey.getAddress();
    return electrumxManager.getutxo(scripthashFor(from)).then(function (list) {
      var utxos = (list || []).slice().sort(function (x, y) { return y.value - x.value; });
      var all = utxos.length;
      utxos = utxos.slice(0, MAX_SWEEP_INPUTS);
      var total = utxos.reduce(function (s, u) { return s + Number(u.value); }, 0);
      var fee = estimateFee(utxos.length, 1, perKb);
      return {
        eckey: eckey, from: from, to: address, utxos: utxos,
        count: utxos.length, remaining: all - utxos.length,
        total: total, fee: fee, net: total - fee,
      };
    });
  }

  // Password-protected (BIP38, "6P...") paper wallet keys. Unlocking takes a few
  // seconds, so the result is kept briefly for the sweep that follows the preview.
  var bip38Cache = null;

  function candidatesFor(input, password, onProgress) {
    var str = String(input || '').replace(/\s+/g, '');
    if (!window.bip38 || !bip38.isBip38(str)) {
      try {
        return Promise.resolve(parseKeyCandidates(str));
      } catch (e) {
        return Promise.reject(e);
      }
    }
    var fromSecret = function (r) {
      return [r.compressed, !r.compressed].map(function (c) {
        return bitcoinjs_aur.ECPair.fromWIF(bitcoinjs_aur.bs58check.encode(0x97, r.secret, c));
      });
    };
    if (bip38Cache && bip38Cache.key === str && bip38Cache.password === password) {
      return Promise.resolve(fromSecret(bip38Cache.result));
    }
    return bip38.decrypt(str, password, onProgress).then(function (r) {
      bip38Cache = { key: str, password: password, result: r };
      return fromSecret(r);
    });
  }

  wallet.prototype.clearSweepCache = function () {
    bip38Cache = null;
  };

  wallet.prototype.isPasswordProtectedKey = function (input) {
    return !!window.bip38 && /^6P/.test(String(input || '').replace(/\s+/g, ''));
  };

  // Look at a private key without importing it: where its funds are and what a sweep would do.
  wallet.prototype.sweepPreview = function (wif, password, onProgress) {
    return candidatesFor(wif, password, onProgress).then(function (candidates) {
      return previewCandidates(candidates);
    });
  };

  function previewCandidates(candidates) {
    var isOwn = candidates.some(function (k) { return k.getAddress() === address; });
    if (isOwn) {
      return Promise.reject(Error('That is this wallet\'s own key. There is nothing to sweep.'));
    }
    return relayPerKbSat().then(function (perKb) {
      return Promise.all(candidates.map(function (k) { return previewFor(k, perKb); }));
    }).then(function (previews) {
      // If more than one address is possible, use the one that holds coins.
      previews.sort(function (a, b) { return b.total - a.total; });
      return previews[0];
    });
  }

  // Sweep: move everything held by `wif` into this wallet. Never replaces this wallet's key.
  wallet.prototype.sweep = function (wif, password) {
    return ret.sweepPreview(wif, password).then(function (p) {
      if (p.count === 0) throw Error('No coins found on ' + p.from + '.');
      if (p.net < DUST) throw Error('Balance on that key is too small to cover the network fee.');
      return buildAndBroadcast(p.eckey, p.utxos, [{ address: p.to, value: p.net }]).then(function (txid) {
        bip38Cache = null;
        setTimeout(updateBalance, 3000);
        return { txid: txid, net: p.net, fee: p.fee, from: p.from, remaining: p.remaining };
      });
    });
  };

  var jsonFormatter = {
    stringify: function (cipherParams) {
      // create json object with ciphertext
      var jsonObj = {
        ct: cipherParams.ciphertext.toString(CryptoJS.enc.Hex),
      };

      // optionally add iv and salt
      if (cipherParams.iv) {
        jsonObj.iv = cipherParams.iv.toString();
      }
      if (cipherParams.salt) {
        jsonObj.s = cipherParams.salt.toString();
      }

      // stringify json object
      return JSON.stringify(jsonObj);
    },

    parse: function (jsonStr) {
      // parse json string
      var jsonObj = JSON.parse(jsonStr);

      // extract ciphertext from json object, and create cipher params object
      var cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Hex.parse(jsonObj.ct),
      });

      // optionally extract iv and salt
      if (jsonObj.iv) {
        cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv);
      }
      if (jsonObj.s) {
        cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s);
      }

      return cipherParams;
    },
  };

  window.wallet = ret;
})(window);
