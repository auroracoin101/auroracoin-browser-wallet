/**
 * bip38.js
 * Decrypts BIP38 password-protected private keys (the "6P..." keys printed on
 * encrypted paper wallets). Supports both BIP38 modes:
 *   0x0142  key encrypted directly with a password
 *   0x0143  EC-multiply keys made from a passphrase code (common on paper wallet generators)
 * Everything runs locally in the browser. MIT license.
 *
 * Uses: scrypt-js (window.scrypt), aes-js (window.aesjs), bitcoinjs_aur.
 */
(function (window) {
  var B = window.bitcoinjs_aur;
  var N_CURVE = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  // Plain Base58Check decode (the bundled library only exposes the WIF-specific one)
  function base58check(str) {
    var n = 0n;
    for (var i = 0; i < str.length; i++) {
      var v = ALPHABET.indexOf(str[i]);
      if (v < 0) throw Error('bad character');
      n = n * 58n + BigInt(v);
    }
    var hex = n.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    var zeros = 0;
    while (zeros < str.length && str[zeros] === '1') zeros++;
    var buf = B.Buffer.concat([B.Buffer.alloc(zeros), B.Buffer.from(n === 0n ? '' : hex, 'hex')]);
    var payload = buf.slice(0, -4);
    if (!sha256d(payload).slice(0, 4).equals(buf.slice(-4))) throw Error('bad checksum');
    return payload;
  }

  function toBuf(u8) { return B.Buffer.from(u8); }
  function sha256d(buf) { return B.crypto.hash256(buf); }
  function xor(a, b) {
    var out = B.Buffer.alloc(a.length);
    for (var i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
    return out;
  }
  function aesDecryptBlock(key, block) {
    var ecb = new window.aesjs.ModeOfOperation.ecb(Array.from(key));
    return toBuf(ecb.decrypt(Array.from(block)));
  }
  function bufToBig(buf) { return BigInt('0x' + buf.toString('hex')); }
  function bigToBuf(n) {
    var hex = n.toString(16);
    while (hex.length < 64) hex = '0' + hex;
    return B.Buffer.from(hex, 'hex');
  }
  // ECPair for a raw 32-byte secret, on the Auroracoin network
  function keyFromSecret(secret, compressed) {
    return B.ECPair.fromWIF(B.bs58check.encode(0x97, secret, compressed));
  }
  function passwordBytes(pass) {
    return B.Buffer.from(String(pass).normalize('NFC'), 'utf8');
  }

  function isBip38(str) {
    return /^6P[1-9A-HJ-NP-Za-km-z]{56}$/.test(str);
  }

  // Paper wallet generators hash the address of their own coin into the key.
  // Accept Auroracoin first, then Bitcoin format (some generators were Bitcoin tools).
  function addressHashMatches(eckey, addresshash) {
    var pub = eckey.getPublicKeyBuffer();
    var h160 = B.crypto.hash160(pub);
    var versions = [0x17, 0x00];
    for (var i = 0; i < versions.length; i++) {
      var addr = B.address.toBase58Check(h160, versions[i]);
      if (sha256d(B.Buffer.from(addr, 'ascii')).slice(0, 4).equals(addresshash)) return true;
    }
    return false;
  }

  // Returns Promise<{ secret: Buffer(32), compressed: bool }>
  function decrypt(str, passphrase, onProgress) {
    var raw;
    try {
      raw = base58check(String(str).replace(/\s+/g, ''));
    } catch (e) {
      return Promise.reject(Error('That password-protected key has a typo. Check it against the paper wallet.'));
    }
    if (raw.length !== 39 || raw[0] !== 0x01 || (raw[1] !== 0x42 && raw[1] !== 0x43)) {
      return Promise.reject(Error('That is not a password-protected (6P) key this wallet can read.'));
    }
    if (!passphrase) return Promise.reject(Error('Enter the paper wallet password.'));

    var ecMultiply = raw[1] === 0x43;
    var flag = raw[2];
    var compressed = (flag & 0x20) !== 0;
    var addresshash = raw.slice(3, 7);
    var pass = passwordBytes(passphrase);
    var progress = function (p) { if (onProgress) onProgress(p); return false; };

    if (!ecMultiply) {
      return window.scrypt.scrypt(pass, addresshash, 16384, 8, 8, 64, progress).then(function (d) {
        d = toBuf(d);
        var half1 = d.slice(0, 32), half2 = d.slice(32, 64);
        var part1 = xor(aesDecryptBlock(half2, raw.slice(7, 23)), half1.slice(0, 16));
        var part2 = xor(aesDecryptBlock(half2, raw.slice(23, 39)), half1.slice(16, 32));
        var secret = B.Buffer.concat([part1, part2]);
        var n = bufToBig(secret);
        if (n === 0n || n >= N_CURVE) throw Error('Wrong password.');
        if (!addressHashMatches(keyFromSecret(secret, compressed), addresshash)) throw Error('Wrong password.');
        return { secret: secret, compressed: compressed };
      });
    }

    // EC-multiply mode
    var hasLot = (flag & 0x04) !== 0;
    var ownerentropy = raw.slice(7, 15);
    var ownersalt = hasLot ? ownerentropy.slice(0, 4) : ownerentropy;
    var encryptedpart1 = raw.slice(15, 23);
    var encryptedpart2 = raw.slice(23, 39);
    var passfactor;

    return window.scrypt.scrypt(pass, ownersalt, 16384, 8, 8, 32, progress).then(function (prefactor) {
      prefactor = toBuf(prefactor);
      passfactor = hasLot ? sha256d(B.Buffer.concat([prefactor, ownerentropy])) : prefactor;
      var pf = bufToBig(passfactor);
      if (pf === 0n || pf >= N_CURVE) throw Error('Wrong password.');
      var passpoint = keyFromSecret(passfactor, true).getPublicKeyBuffer();
      return window.scrypt.scrypt(passpoint, B.Buffer.concat([addresshash, ownerentropy]), 1024, 1, 1, 64);
    }).then(function (d) {
      d = toBuf(d);
      var dh1 = d.slice(0, 32), dh2 = d.slice(32, 64);
      var decrypted2 = xor(aesDecryptBlock(dh2, encryptedpart2), dh1.slice(16, 32));
      var part1full = B.Buffer.concat([encryptedpart1, decrypted2.slice(0, 8)]);
      var decrypted1 = xor(aesDecryptBlock(dh2, part1full), dh1.slice(0, 16));
      var seedb = B.Buffer.concat([decrypted1.slice(0, 16), decrypted2.slice(8, 16)]);
      var factorb = bufToBig(sha256d(seedb));
      var dval = (bufToBig(passfactor) * factorb) % N_CURVE;
      if (dval === 0n) throw Error('Wrong password.');
      var secret = bigToBuf(dval);
      if (!addressHashMatches(keyFromSecret(secret, compressed), addresshash)) throw Error('Wrong password.');
      return { secret: secret, compressed: compressed };
    });
  }

  window.bip38 = { isBip38: isBip38, decrypt: decrypt };
})(window);
