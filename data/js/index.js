/**
 * index.js
 * Copyright (c) 2014 Andrew Toth
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 * Controls index.html, the main wallet Chrome popover/Firefox panel
 */


$(document).ready(function () {
  // Setup the wallet, page values and callbacks

  var val = '',
    address = '',
    SATOSHIS = 100000000,
    FEE = SATOSHIS * 0.0003,
    BTCUnits = 'AUR',
    BTCMultiplier = SATOSHIS;

  function setupWallet() {
    wallet
      .restoreAddress()
      .then(setQRCodes, function () {
        return wallet.generateAddress();
      })
      .then(setQRCodes, function () {
        alert('Failed to generate wallet. Refresh and try again.');
      });

    function setQRCodes() {
      $('#qrcode').html(createQRCodeCanvas(wallet.getAddress()));
      $('#textAddress').text(wallet.getAddress());
    }
  }

  wallet.setBalanceListener(function (balance) {
    setBalance(balance);
  });

  // IIFE top-level await - ensures electrumInit resolves before setupWallet
  (async () => {
    try {
      const data = await electrumxManager.electrumInit();
    } catch (err) {
      console.error('electrumInit');
      console.error(err);
    } finally {
      setupWallet();
    }
  })();

  function loadStyleSheet(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  (async () => {
    const themeToggleHandler = async () => {
      try {
        // Get the current theme
        const currentTheme = await preferences.getTheme();
        const newTheme = currentTheme === 'DARK' ? 'LIGHT' : 'DARK';

        // Save the new theme preference
        await preferences.setTheme(newTheme);

        // Remove relevant theme-related stylesheet
        const themeStylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        themeStylesheets.forEach(sheet => {
          if (sheet.href.includes('index-dark.css') || sheet.href.includes('index-light.css')) {
            sheet.parentNode.removeChild(sheet);
          }
        });

        // Load the new theme's stylesheet
        loadStyleSheet(newTheme === 'DARK' ? 'css/index-dark.css' : 'css/index-light.css');

        console.log(`Theme switched to: ${newTheme}`);
      } catch (err) {
        console.error('Error toggling theme:', err);
      }
    };

    try {
      // Initial theme setup
      const theme = await preferences.getTheme();
      console.log('Theme preference:', theme);

      loadStyleSheet(theme === 'DARK' ? 'css/index-dark.css' : 'css/index-light.css');
    } catch (err) {
        console.error('Error loading theme preference:', err);
       // Fallback to a default theme
        loadStyleSheet('css/index-light.css');
    }

    // Attach the event listener to the logo
    document.getElementById('logo').addEventListener('click', themeToggleHandler);
  })();

  $('#amount').on('keyup change', function () {
    val = Math.round(Number($(this).val() * BTCMultiplier));

    if (val > 0) {
      currencyManager.formatAmount(val).then(function (formattedMoney) {
        // console.log(formattedMoney.toString());
        var text = 'Amount: ' + formattedMoney;
        $('#amountLabel').text(text);
      });
    } else {
      $('#amountLabel').text('Amount:');
    }
  });

  function setBTCUnits(units) {
    BTCUnits = units;
    if (units === 'µAUR') {
      BTCMultiplier = SATOSHIS / 1000000;
    } else if (units === 'mAUR') {
      BTCMultiplier = SATOSHIS / 1000;
    } else {
      BTCMultiplier = SATOSHIS;
    }

    setBalance(wallet.getBalance());
    $('#sendUnit').html(BTCUnits);
    $('#amount')
      .attr(
        'placeholder',
        '(Plus ' + FEE / BTCMultiplier + ' ' + BTCUnits + ' fee)'
      )
      .attr('step', 100000 / BTCMultiplier)
      .val(null);
    $('#amountLabel').text('Amount:');
  }
  preferences.getBTCUnits().then(setBTCUnits);

  function setBalance(balance) {
    if (Number(balance) < 0 || isNaN(balance)) {
      balance = 0;
    }
    $('#balance').text(balance / BTCMultiplier + ' ' + BTCUnits);
  }

  $('#successAlertClose').click(function () {
    $('#successAlert').fadeOut();
    if (typeof chrome === 'undefined') {
      addon.port.emit('resize', 278);
    }
  });

  $('#unkownErrorAlertClose').click(function () {
    $('#unknownErrorAlert').fadeOut();
  });

  if (typeof chrome === 'undefined') {
    addon.port.on('show', setupWallet);
  }

  /*   *  Send AUR    */
  $('#sendButton').click(function () {
    val = Math.round(Number($('#amount').val() * BTCMultiplier));
    address = $('#sendAddress').val();
    var balance = wallet.getBalance();
    var validAmount = true;
    if (val <= 0) {
      validAmount = false;
    } else if (val + FEE > balance) {
      validAmount = false;
    }
    if (validAmount) {
      $('#amountAlert').slideUp();
    } else {
      $('#amountAlert').slideDown();
    }

    var regex = /^[Aa][1-9A-HJ-NP-Za-km-z]{26,33}$/;
    var validAddress = true;
    if (!regex.test(String(address))) {
      validAddress = false;
    } else {
      try {
        new bitcoinjs_aur.address.fromBase58Check(address);
      } catch (e) {
        validAddress = false;
      }
    }

    if (validAddress) {
      $('#addressAlert').slideUp();
    } else {
      $('#addressAlert').slideDown();
    }

    if (validAddress && validAmount) {
      if (wallet.isEncrypted()) {
        currencyManager.formatAmount(val).then(function (formattedMoney) {
          var text =
            // 'Are you sure you want to send<br />' +
            'Are you sure you want to send ' +
            val / BTCMultiplier +
            ' ' +
            BTCUnits +
            ' (<strong>' +
            formattedMoney +
            //'</strong>) to<br />' +
            '</strong>) to ' +
            address +
            ' ?';
          $('#sendConfirmationText').html(text);
          $('#sendConfirmationPassword').val(null);
          $('#sendConfirmationPasswordIncorrect').hide();
          $('#sendConfirmationModal').modal().show();
        });
      } else {
        confirmSend();
      }
    }
  });

  $('#confirmSendButton').click(function () {
    confirmSend();
  });

  //  "temporary" update to Balance -  will want to listen to electrum subscriptions
  $('#balance').click(function () {
    wallet.updateBal();
  });

  function confirmSend() {
    $('#cover').show();
    var password = $('#sendConfirmationPassword').val();
    wallet.send(address, val, FEE, password).then(
      function (txid) {
        $('#amount').val(null);
        $('#sendAddress').val(null);
        $('#amountLabel').text('Amount:');
        var text =
          '<br><b>Sent:</b> ' +
          val / BTCMultiplier +
          ' ' +
          BTCUnits +
          ' to <br>' +
          address +
          '.<span style="overflow-wrap:anywhere"><br><b>Transaction: </b><br>' +
          '<a href="https://chainz.cryptoid.info/aur/tx.dws?' +
          txid +
          '.htm" target="_blank">' +
          txid +
          '</a><br>(Transaction should be included in next block or two.)</span>';

        console.log(text);

        text = $.parseHTML(text);
        console.log(text);
        $('#successAlertLabel').append(text);
        $('#successAlert').slideDown();
        $('#sendConfirmationModal').modal('hide');
        $('#cover').fadeOut('slow');
        preferences.getLastBalance().then(function (result) {
          $('#balance').text(result / BTCMultiplier + ' ' + BTCUnits);
        });
      },
      function (e) {
        if (wallet.isEncrypted()) {
          $('#sendConfirmationPasswordIncorrect').text(e.message).slideDown();
        } else {
          $('#unknownErrorAlertLabel').text(e.message);
          $('#unknownErrorAlert').slideDown();
        }
        $('#cover').hide();
      }
    );
  }

  /*
   *  Settings Menu
   */

  /*
   * Set Password
   */
  $('#setPassword').click(function () {
    $('#passwordMismatch').hide();
    $('#setPasswordIncorrect').hide();
    $('#setPasswordBlank').hide();
    if (wallet.isEncrypted()) {
      $('#removePasswordDiv').show();
      $('#setPasswordPassword').show().val(null);
    } else {
      $('#removePasswordDiv').hide();
      $('#setPasswordPassword').hide().val(null);
    }
    $('#newPassword').show().val(null);
    $('#confirmNewPassword').show().val(null);
    $('#removePassword').attr('checked', false);
    $('#setPasswordModal').modal().show();
  });

  $('#removePassword').click(function () {
    if (this.checked) {
      $('#newPassword').val(null).slideUp();
      $('#confirmNewPassword').val(null).slideUp();
    } else {
      $('#newPassword').slideDown();
      $('#confirmNewPassword').slideDown();
    }
  });

  $('#confirmSetPassword').click(function () {
    var password = $('#setPasswordPassword').val(),
      newPassword = $('#newPassword').val(),
      confirmNewPassword = $('#confirmNewPassword').val();
    var validInput = true;
    //already encrypted, or want to remove password and no password
    if (
      (wallet.isEncrypted() && !password) ||
      (!$('#removePassword').is(':checked') &&
        (!newPassword || !confirmNewPassword))
    ) {
      validInput = false;
      $('#setPasswordBlank').slideDown();
    } else {
      $('#setPasswordBlank').slideUp();
    }

    if (validInput && newPassword !== confirmNewPassword) {
      validInput = false;
      $('#passwordMismatch').slideDown();
    } else {
      $('#passwordMismatch').slideUp();
    }

    if (
      validInput &&
      wallet.isEncrypted() &&
      !wallet.validatePassword(password)
    ) {
      validInput = false;
      $('#setPasswordIncorrect').slideDown();
    } else {
      $('#setPasswordIncorrect').slideUp();
    }
    if (validInput) {
      wallet
        .updatePassword(String(password), String(newPassword))
        .then(function () {
          $('#successAlertLabel').text('New password set.');
          $('#successAlert').show();
          $('#setPasswordModal').modal('hide');
        });
    }
  });

  /*
   * Currency selection
   */
  $('#setCurrency').click(function () {
    preferences.getCurrency().then(function (currency) {
      var currencies = currencyManager.getAvailableCurrencies();

      var tableBody = '';
      var columnsPerRow = 3; // Number of items per row

      for (var i = 0; i < currencies.length; i += columnsPerRow) {
          tableBody += '<tr>';

          for (var j = 0; j < columnsPerRow; j++) {
              var currencyIndex = i + j;
              if (currencyIndex < currencies.length) {
                  var curr = currencies[currencyIndex];

                  tableBody +=
                      '<td><div class="radio no-padding"><label><input type="radio" name="currency" value="' +
                      curr +
                      '"';

                  if (curr === currency) {
                      tableBody += ' checked';
                  }

                  tableBody += '>' + curr + '</label></div></td>';
              } else {
                  tableBody += '<td></td>'; // Fill empty slots if last row is incomplete
              }
          }

          tableBody += '</tr>';
      }
      /*
      var currencies = currencyManager.getAvailableCurrencies();
      console.log("number of currencies:  ",currencies.length);
      var tableBody = '';
      for (var i = 0; i < currencies.length / 3; i++) {
        tableBody += '<tr>';
        console.log(tableBody);
        for (var j = i; j <= i + 12; j += 6) {
          tableBody +=
            '<td><div class="radio no-padding"><label><input type="radio" name="' +
            currencies[j] +
            '"';
            console.log(j,currencies[j]);
          if (currencies[j] === currency) {
            tableBody += ' checked';
          }
          tableBody += '>' + currencies[j] + '</label></div></td>';
        }
        tableBody += '</tr>';
      }*/

      $('#tableBody').html(tableBody);
      $('#setCurrencyModal').modal().show();
      $('.radio').click(function () {
        var currency = $.trim($(this).text());
        $('input:radio[name=' + currency + ']').attr('checked', 'checked');
        preferences.setCurrency(currency).then(function () {
          $('#amountLabel').text('Amount:');
          $('#successAlertLabel').text('Currency set to ' + currency + '.');
          $('#successAlert').show();
          $('#setCurrencyModal').modal('hide');
        });
      });
    });
  });

  /*
   * Units selection
   */
  $('#setUnits').click(function () {
    preferences.getBTCUnits().then(function (units) {
      var availableUnits = ['AUR', 'mAUR', 'µAUR'];
      var tableBody = '<tr>';
      for (var i = 0; i < availableUnits.length; i++) {
        tableBody +=
          '<td><div class="radio no-padding"><label><input type="radio" name="' +
          availableUnits[i] +
          '"';
        if (availableUnits[i] === units) {
          tableBody += ' checked';
        }
        tableBody += '>' + availableUnits[i] + '</label></div></td>';
      }
      tableBody += '</tr>';
      $('#tableBody').html(tableBody);
      $('#setCurrencyModal').modal().show();
      $('.radio').click(function () {
        var units = $.trim($(this).text());
        $('input:radio[name=' + units + ']').attr('checked', 'checked');
        setBTCUnits(units);
        preferences.setBTCUnits(units).then(function () {
          $('#successAlertLabel').text('Units set to ' + units + '.');
          $('#successAlert').show();
          $('#setCurrencyModal').modal('hide');
        });
      });
    });
  });

  /*
   *  Show Private Key
   */
  $('#showPrivateKey').click(function () {
    $('#showPrivateKeyPasswordIncorrect').hide();
    if (wallet.isEncrypted()) {
      $('#showPrivateKeyPassword').val(null).show();
    } else {
      $('#showPrivateKeyPassword').hide();
    }
    $('#privateKey').hide();
    $('#showPrivateKeyModal').modal().show();
  });

  $('#showPrivateKeyConfirm').click(function () {
    var password = $('#showPrivateKeyPassword').val();
    if (wallet.isEncrypted() && !wallet.validatePassword(password)) {
      $('#showPrivateKeyPasswordIncorrect').slideDown();
    } else {
      $('#showPrivateKeyPasswordIncorrect').slideUp();
      var privateKey = wallet.getDecryptedPrivateKey(password);
      var privateKey2 = wallet.getWIFb0(privateKey);
      $('#privateKeyQRCode').html(createQRCodeCanvas(privateKey));
      $('#privateKeyText').text(privateKey);
      $('#privateKey2QRCode').html(createQRCodeCanvas(privateKey2));
      $('#privateKey2Text').text(privateKey2);
      $('#privateKey').slideDown(function () {
        $('#main').height(
          $('#showPrivateKeyModal').find('.modal-dialog').height()
        );
      });
      //  Also show the WIF b0 version that can be imported into the Desktop wallet
    }
  });

  /*
   *  Import Private Key
   */
  $('#importPrivateKey').click(function () {
    $('#importPrivateKeyPasswordIncorrect').hide();
    $('#importPrivateKeyBadPrivateKey').hide();
    if (wallet.isEncrypted()) {
      $('#importPrivateKeyPassword').val(null).show();
    } else {
      $('#importPrivateKeyPassword').hide();
    }
    $('#importPrivateKeyPrivateKey').val(null);
    $('#importPrivateKeyModal').modal().show();
  });

  $('#importPrivateKeyConfirm').click(function () {
    var privateKey = $('#importPrivateKeyPrivateKey').val();
    try {
      new bitcoinjs_aur.ECPair.fromWIF(privateKey);
    } catch (e) {
      $('#importPrivateKeyBadPrivateKey').slideDown();
      return;
    }
    wallet.importAddress($('#importPrivateKeyPassword').val(), privateKey).then(
      function () {
        setupWallet();
        $('#successAlertLabel').text('Private key imported successfully.');
        $('#successAlert').show();
        $('#importPrivateKeyModal').modal('hide');
      },
      function (e) {
        if (e.message === 'Incorrect password') {
          $('#importPrivateKeyBadPrivateKey').slideUp();
          $('#importPrivateKeyPasswordIncorrect').slideDown();
        } else {
          $('#importPrivateKeyPasswordIncorrect').slideUp();
          $('#importPrivateKeyBadPrivateKey').slideDown();
        }
      }
    );
  });

  /*
   *  Generate New Wallet
   */
  $('#generateNewWallet').click(function () {
    $('#generateNewWalletPasswordIncorrect').hide();
    if (wallet.isEncrypted()) {
      $('#generateNewWalletPassword').show().val(null);
    } else {
      $('#generateNewWalletPassword').hide();
    }
    $('#generateNewWalletModal').modal().show();
  });

  $('#generateNewWalletConfirm').click(function () {
    wallet.generateAddress($('#generateNewWalletPassword').val()).then(
      function () {
        setupWallet();
        $('#successAlertLabel').text('New wallet generated.');
        $('#successAlert').show();
        $('#generateNewWalletModal').modal('hide');
      },
      function () {
        $('#generateNewWalletPasswordIncorrect').slideDown();
      }
    );
  });

  /*
   * About version and version under auroracoin image
   */

  if (typeof chrome !== 'undefined') {
    $('#version').text(chrome.runtime.getManifest().version);
    $('#version2').text(chrome.runtime.getManifest().version);
  } else {
    addon.port.on('version', function (version) {
      $('#version').text(version);
      $('#version2').text(version);
    });
  }

  $('#aboutModal').on('click', 'a', function () {
    if (typeof chrome !== 'undefined') {
      chrome.tabs.create({ url: $(this).attr('href') });
    } else {
      addon.port.emit('openTab', $(this).attr('href'));
    }
    return false;
  });
  /*
   * Tutorials
   */

  $('#tutorialsModal').on('click', 'a', function () {
    if (typeof chrome !== 'undefined') {
      chrome.tabs.create({ url: $(this).attr('href') });
    } else {
      addon.port.emit('openTab', $(this).attr('href'));
    }
    return false;
  });


    function openTutorial() {
    if (typeof chrome !== 'undefined') {
      chrome.tabs.create({
        url: 'https://auroracoin101.is/auroracoin-browser-wallet-tutorial/',
      });
    } else {
      addon.port.emit('openTab', $(this).attr('href'));
    }
    return false;
  }

  /*  Resizing */

  $('.modal')
    .on('shown.bs.modal', function () {
      var $main = $('#main');
      var height = $main.height();
      var modalHeight = $(this).find('.modal-dialog').height();
      if (modalHeight > height) {
        $main.height(modalHeight);
        if (typeof chrome === 'undefined') {
          addon.port.emit('resize', modalHeight + 2);
        }
      }
    })
    .on('hidden.bs.modal', function () {
      $('#main').height('auto');
      if (typeof chrome === 'undefined') {
        if ($('#successAlert').is(':visible')) {
          var height = 350;
        } else {
          var height = 278;
        }
        addon.port.emit('resize', height);
      }
    });

  function createQRCodeCanvas(text) {
    var sizeMultiplier = 4;
    var typeNumber;
    var lengthCalculation = text.length * 8 + 12;
    if (lengthCalculation < 72) {
      typeNumber = 1;
    } else if (lengthCalculation < 128) {
      typeNumber = 2;
    } else if (lengthCalculation < 208) {
      typeNumber = 3;
    } else if (lengthCalculation < 288) {
      typeNumber = 4;
    } else if (lengthCalculation < 368) {
      typeNumber = 5;
    } else if (lengthCalculation < 480) {
      typeNumber = 6;
    } else if (lengthCalculation < 528) {
      typeNumber = 7;
    } else if (lengthCalculation < 688) {
      typeNumber = 8;
    } else if (lengthCalculation < 800) {
      typeNumber = 9;
    } else if (lengthCalculation < 976) {
      typeNumber = 10;
    }
    var qrcode = new QRCode(typeNumber, QRCode.ErrorCorrectLevel.H);
    qrcode.addData(text);
    qrcode.make();
    var width = qrcode.getModuleCount() * sizeMultiplier;
    var height = qrcode.getModuleCount() * sizeMultiplier;
    // create canvas element
    var canvas = document.createElement('canvas');
    var scale = 10.0;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    // compute tileW/tileH based on width/height
    var tileW = width / qrcode.getModuleCount();
    var tileH = height / qrcode.getModuleCount();
    // draw in the canvas
    for (var row = 0; row < qrcode.getModuleCount(); row++) {
      for (var col = 0; col < qrcode.getModuleCount(); col++) {
        ctx.fillStyle = qrcode.isDark(row, col) ? '#000000' : '#ffffff';
        ctx.fillRect(col * tileW, row * tileH, tileW, tileH);
      }
    }
    return canvas;
  }
});
