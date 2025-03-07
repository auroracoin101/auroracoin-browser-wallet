/**
 * currency-manager.js
 * Copyright (c) 2014 Andrew Toth
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Currency manager handles the exchange rate of the currency
 * and the proper formatting of the currency value
 */

(function (window) {
    var currencyInstance;

    var currencyManager = function () {};
    currencyManager.prototype = {
        updateExchangeRate: async function () {
            try {
                // Get the AUR price from API1
                const aurResponse = await util.getJSON('https://api-two.ewm-cx.net/api/v1/price/getPriceByCoin?symbol=AUR');
                if (!aurResponse || !aurResponse.success) throw new Error("Failed to fetch AUR price");

                // Get the user's preferred currency
                const currency = await preferences.getCurrency();
                
                // Get BTC price from API2 (Blockchain.info)
                const currencyTicker = await util.getJSON('https://blockchain.info/ticker');
                
                if (currency != 'BTC') 
                    if (!currencyTicker || !currencyTicker[currency]) throw new Error("Failed to fetch BTC price");

                let exchangeRate = 0;

                switch (currency) {
                    case 'BTC': 
                        exchangeRate = aurResponse.data.priceBTC; 
                        break;
                    case 'USD': 
                        exchangeRate = aurResponse.data.priceUSD; 
                        break;
                    default: 
                        // Use currencyTicker to get the fiat price of BTC and calculate the AUR price
                        const btcToFiat = currencyTicker[currency].last; // Get Bitcoin price in selected currency
                        exchangeRate = aurResponse.data.priceBTC * btcToFiat;
                        console.log(`BTC to ${currency}: ${btcToFiat}, AUR to ${currency}: ${exchangeRate}`);
                        break;
                }

                // Save the exchange rate
                await preferences.setExchangeRate(exchangeRate);
                console.log(`Exchange rate updated: 1 AUR = ${exchangeRate} ${currency}`);

            } catch (error) {
                console.error("Error updating exchange rate:", error);
                await preferences.setExchangeRate(0.00);
            }
        },

        getSymbol: async function () {
            const currency = await preferences.getCurrency();

            // Currency symbol & placement map with decimal precision
            const currencyFormats = {
                'AUD': { symbol: '$ ', placement: 'before', decimals: 2 },
                'CAD': { symbol: '$ ', placement: 'before', decimals: 2 },
                'NZD': { symbol: '$ ', placement: 'before', decimals: 2 },
                'SGD': { symbol: '$ ', placement: 'before', decimals: 2 },
                'USD': { symbol: '$ ', placement: 'before', decimals: 2 },
                'BTC': { symbol: '\u20BF ', placement: 'before', decimals: 8 },
                'CHF': { symbol: ' Fr.', placement: 'after', decimals: 2 },
                'CNY': { symbol: '¥ ', placement: 'before', decimals: 2 },
                'JPY': { symbol: '¥ ', placement: 'before', decimals: 0 },
                'EUR': { symbol: '€ ', placement: 'before', decimals: 2 },
                'GBP': { symbol: '£ ', placement: 'before', decimals: 2 },
                'SEK': { symbol: ' kr', placement: 'after', decimals: 2 },
                'ISK': { symbol: ' ISK', placement: 'after', decimals: 0 }, // ISK has no decimals
                'PLN': { symbol: ' zł', placement: 'after', decimals: 2 },
                'RUB': { symbol: ' RUB', placement: 'after', decimals: 2 },
                'DEFAULT': { symbol: '$ ', placement: 'before', decimals: 2 }
            };

            return currencyFormats[currency] || currencyFormats['DEFAULT'];
        },



        getAvailableCurrencies: function () {
            return ['BTC', 'ISK', 'CAD', 'EUR', 'GBP', 'JPY', 'USD', 'CHF', 'CNY', 'AUD', 'NZD', 'PLN', 'RUB', 'SEK', 'SGD']; 
        },

        formatAmount: async function (value) {
            try {
                // Fetch necessary values asynchronously
                const rate = await preferences.getExchangeRate();
                const currencyFormat = await this.getSymbol(); // Now returns an object
                // const currency = await preferences.getCurrency();

                const SATOSHIS = 100000000;
                let convAmount = (value * rate) / SATOSHIS;

                // Use the decimalPlaces property from the returned object
                let text = convAmount.toFixed(currencyFormat.decimals);

                // Add the symbol before or after
                text = currencyFormat.placement === 'before' 
                    ? `${currencyFormat.symbol}${text}` 
                    : `${text}${currencyFormat.symbol}`;

                return text;
            } catch (err) {
                console.error('Error formatting amount:', err);
                return 'N/A';
            }
        }

    Number.prototype.formatMoney = function(c, d, t){
        var n = this,
            c = isNaN(c = Math.abs(c)) ? 3 : c,
            d = d == undefined ? "." : d,
            t = t == undefined ? "," : t,
            s = n < 0 ? "-" : "",
            i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "",
            j = (j = i.length) > 3 ? j % 3 : 0;
        return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
    };

    var ret = new currencyManager();
    ret.updateExchangeRate();
    window.currencyManager = ret;

})(window);
