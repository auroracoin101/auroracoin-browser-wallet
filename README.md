![Auroracoin Official Logo.](/data/auroracoin128.png)
# Auroracoin Browser Wallet Extension 3.0.1

### Provided by Auroracoin101 Project Team
Auroracoin wallet in your browser.  

## Releases
| Version    | Description |
|------------------ |------------ |
|  1.3.0 | Updated for Multi-Algo |
|  2.0.0 | Updated to use Insight exclusively for blockchain access and tx send |
|  2.0.1 | Removed incompatible API, exchange rates currently unavailable |
|  2.0.2 | Fixed API calls, exchange rates and currencies re-enabled |
|  2.0.3 | Internal Changes related to Github management |
|  2.0.4 | Removed BitCoinAverage API, using CryptoCompare |
|  2.0.5 | Removed Context Menu Features and Related Required Permissions |
|  2.0.6 | Various math fixes |
|  2.0.7 | Using TransactionBuilder now per bitcore warning. Now under Auroracoin101 github repository |
|  2.0.8 | Using chainz.cryptoid.info/aur as Blockchain Address Explorer |
|  2.0.9 | Updated Logo to 2020 version. Display Private Key/QR in 2 WIF formats |
|  2.1.0 | Moved Blockchain Interface to Electrum(x) SPV servers. Begin eCoinCore Integration |
|  2.1.1 | Improved Fallback |
|  2.1.2 | Added Electrum server @ electrum1.valhala.is |
|  2.1.3 | Insert OP_RETURN transaction support 
|  2.2.0 | Added Dark Mode, Fixed Currency Exchange, increased txfee to 0.0003 for large transactions (miners) |
|  3.0.0 | Upgraded to Google Manifest v3 |
|  3.0.1 | Removed tab requirement, not needed |


## Security

The private key is stored securely in your local browser storage and you may choose to encrypt it,
for added Security.

Transactions are signed in the browser and are published to Auroracoin Network via Electrum(x) Servers.

The private key will only leave the browser to be synced with other Chrome browsers you are signed into,
This is managed by the Browser Software.

Encrypting the private key ensures that nobody will know the private key without the password, not even this extension.
