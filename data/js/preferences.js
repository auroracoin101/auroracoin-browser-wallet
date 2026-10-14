/**
 * preferences.js
 * Copyright (c) 2014 Andrew Toth
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Preferences handles storing and retrieving saved values
 */

(function (window) {
  var ADDRESS = 'wallet.address',
    PRIVATE_KEY = 'wallet.private_key',
    SCRIPTHASH = 'wallet.scripthash',
    IS_ENCRYPTED = 'wallet.is_encrypted',
    LAST_BALANCE = 'wallet.last_balance',
    EXCHANGE_RATE = 'wallet.exchange_rate',
    BTC_UNITS = 'wallet.btc_units',
    CURRENCY = 'wallet.currency',
    SITE = 'https://chainz.cryptoid.info/aur/api.dws?q=addressinfo&a=%address%',
    THEME = 'wallet.theme',
    MIGRATED = 'wallet.migrated_to_local',
    preferences = function () {};

  // All wallet data keys, used for the sync-to-local migration
  var WALLET_KEYS = [
    ADDRESS,
    PRIVATE_KEY,
    SCRIPTHASH,
    IS_ENCRYPTED,
    LAST_BALANCE,
    EXCHANGE_RATE,
    BTC_UNITS,
    CURRENCY,
    THEME,
  ];

  // One-time migration: copy wallet data from chrome.storage.sync to
  // chrome.storage.local, then remove it from sync. The sync data is
  // only deleted after the local write has succeeded, so the wallet
  // is never left without its data if the local write fails.
  function migrateSyncToLocal() {
    return new Promise(function (resolve) {
      // Skip if we have already migrated
      chrome.storage.local.get(MIGRATED, function (localValues) {
        if (localValues && localValues[MIGRATED]) {
          return resolve();
        }
        // Read everything currently in sync storage
        chrome.storage.sync.get(null, function (syncValues) {
          if (chrome.runtime.lastError || !syncValues) {
            // Cannot read sync, retry on next load
            return resolve();
          }
          var hasWalletData =
            syncValues[PRIVATE_KEY] || syncValues[ADDRESS];
          var migrationFlag = {};
          migrationFlag[MIGRATED] = true;
          if (!hasWalletData) {
            // Nothing to migrate, just mark as done
            chrome.storage.local.set(migrationFlag, function () {
              resolve();
            });
            return;
          }
          // Copy only the known wallet keys
          var copy = {};
          WALLET_KEYS.forEach(function (key) {
            if (typeof syncValues[key] !== 'undefined') {
              copy[key] = syncValues[key];
            }
          });
          chrome.storage.local.set(copy, function () {
            if (chrome.runtime.lastError) {
              // Local write failed: keep sync data, retry on next load
              return resolve();
            }
            // Local write succeeded, safe to remove from sync
            chrome.storage.sync.remove(WALLET_KEYS, function () {
              chrome.storage.local.set(migrationFlag, function () {
                console.log(
                  'Wallet data migrated from sync to local storage.'
                );
                resolve();
              });
            });
          });
        });
      });
    });
  }

  function sync() {
    return new Promise(function (resolve) {
      // Different APIs for Chrome and Firefox
      if (typeof chrome !== 'undefined') {
        migrateSyncToLocal().then(function () {
          var object = {};
          object[ADDRESS] = '';
          object[PRIVATE_KEY] = '';
          object[SCRIPTHASH] = '';
          object[IS_ENCRYPTED] = false;
          object[LAST_BALANCE] = 0;
          object[EXCHANGE_RATE] = 0;
          object[BTC_UNITS] = 'AUR';
          object[CURRENCY] = 'ISK';
          object[THEME] = 1;
          chrome.storage.local.get(object, resolve);
        });
      } else {
        util
          .message('get')
          .then(function (message) {
            if (typeof message[PRIVATE_KEY] === 'undefined') {
              message[ADDRESS] = '';
              message[PRIVATE_KEY] = '';
              message[SCRIPTHASH] = '';
              message[IS_ENCRYPTED] = false;
              message[LAST_BALANCE] = 0;
              message[EXCHANGE_RATE] = 0;
              message[BTC_UNITS] = 'AUR';
              message[CURRENCY] = 'ISK';
              message[THEME] = 1;
              return util.message('save', message);
            } else {
              return message;
            }
          })
          .then(function (message) {
            resolve(message);
          });
      }
    });
  }

  function get(pref) {
    return function () {
      return sync().then(function (values) {
        return values[pref];
      });
    };
  }

  function set(key, value) {
    return new Promise(function (resolve) {
      var object = {};
      object[key] = value;
      // Different APIs for Chrome and Firefox
      if (typeof chrome !== 'undefined') {
        chrome.storage.local.set(object, resolve);
      } else {
        util.message('save', object).then(resolve);
      }
    });
  }

  preferences.prototype = {
    getAddress: get(ADDRESS),
    setAddress: function (address) {
      return set(ADDRESS, address);
    },

    getScriptHash: get(SCRIPTHASH),
    setScriptHash: function (scripthash) {
      return set(SCRIPTHASH, scripthash);
    },

    getPrivateKey: get(PRIVATE_KEY),
    setPrivateKey: function (privateKey) {
      return set(PRIVATE_KEY, privateKey);
    },

    getIsEncrypted: get(IS_ENCRYPTED),
    setIsEncrypted: function (isEncrypted) {
      return set(IS_ENCRYPTED, isEncrypted);
    },

    getLastBalance: get(LAST_BALANCE),
    setLastBalance: function (lastBalance) {
      return set(LAST_BALANCE, lastBalance);
    },

    getExchangeRate: get(EXCHANGE_RATE),
    setExchangeRate: function (exchangeRate) {
      return set(EXCHANGE_RATE, exchangeRate);
    },

    getBTCUnits: get(BTC_UNITS),
    setBTCUnits: function (btcUnits) {
      return set(BTC_UNITS, btcUnits);
    },

    getCurrency: get(CURRENCY),
    setCurrency: function (currency) {
      return set(CURRENCY, currency).then(function () {
        currencyManager.updateExchangeRate();
      });
    },

    getTheme: get(THEME),
    setTheme: function (theme) {
      return set(THEME, theme);
    },

    getSite: function () {
      return SITE;
    },
  };

  window.preferences = new preferences();
})(window);
