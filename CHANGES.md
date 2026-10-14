# Changelog

All notable changes to the Auroracoin Browser Wallet are documented here.

## 3.0.3 (in testing)

### Contributors
- BIP38 sweep: key unlocking approach and early implementation by Matthew ([@Mattakazulu7](https://github.com/Mattakazulu7))

### Added
- **Sweep Private Key** — move funds held by another private key into this wallet without replacing the wallet's own key. Accepts:
  - BIP38 password-protected paper wallet keys (`6P...`), both direct (`0x0142`) and EC-multiply (`0x0143`) modes
  - Auroracoin WIF keys and same-format WIF keys from other coins
  - Raw 64-character hex secrets
- Sweep preview: shows the key's address, balance, network fee, and net amount before confirming; reports progress percentage during BIP38 unlock
- Connection status banner with retry when Electrum servers can't be reached
- This changelog file

### Changed
- **Wallet storage moved from `chrome.storage.sync` to `chrome.storage.local`** — the private key and other wallet data no longer leave the machine via browser sync. Existing wallets are migrated automatically on first load (copy-then-delete, never losing data if interrupted)
- **Dynamic transaction fees** — fees are now estimated from transaction size and the server's relay fee, with the old 0.0003 AUR flat fee as a floor. Fixes transactions with many inputs (including sweeps) being rejected for low fees
- Balance display now includes unconfirmed coins, so freshly received or swept funds appear immediately
- Electrum connection handling reworked: per-server connect timeouts, one shared connection, and automatic reconnect + retry so a dropped socket no longer hangs the wallet
- Tries both compressed and uncompressed forms of a swept key and uses whichever holds coins

### Fixed
- Low-fee sends no longer rejected for transactions with many inputs (see dynamic fees above)
- A dropped Electrum connection no longer leaves the wallet showing stale data with no indication
- Removed dead code: unreachable OP_RETURN block, unused server list in `wallet.js`

## 3.0.2
- Fixed T-prefix WIF import issue

## 3.0.1
- Removed tab requirement, not needed

## 3.0.0
- Upgraded to Google Manifest V3

## 2.2.0
- Added dark mode
- Fixed currency exchange
- Increased tx fee to 0.0003 for large transactions (miners)

## 2.1.3
- Insert OP_RETURN transaction support

## 2.1.2
- Added Electrum server @ electrum1.valhala.is

## 2.1.1
- Improved fallback

## 2.1.0
- Moved blockchain interface to Electrum(x) SPV servers; began eCoinCore integration

## 2.0.9
- Updated logo to 2020 version; display private key/QR in 2 WIF formats

## 2.0.7
- Using TransactionBuilder per bitcore warning; moved to Auroracoin101 GitHub repository

## 2.0.5
- Removed context menu features and related required permissions

## 2.0.4
- Removed BitCoinAverage API, using CryptoCompare

## 2.0.0
- Updated to use Insight exclusively for blockchain access and tx send

## 1.3.0
- Updated for Multi-Algo
