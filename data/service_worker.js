/**
 * service-worker.js
 * Copyright (c) 2025 Michael Hannes
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the MIT license.
 *
 *  Background script for Chrome extension
 */

// Currently unused but required by manifest
chrome.runtime.onInstalled.addListener(() => {
  console.log("Auroracoin Browser Wallet installed.");
});
