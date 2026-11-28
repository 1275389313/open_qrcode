var MENU_ID = 'open-qrcode-decode';
var TAG = '[网页二维码识别]';
var requestSeq = 0;
var menuChain = Promise.resolve();

globalThis.handleMenuClick = handleMenuClick;

installMenu();
chrome.runtime.onInstalled.addListener(installMenu);
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  handleMenuClick(info, tab).catch(function (error) {
    console.error(TAG, error);
  });
});
chrome.runtime.onMessage.addListener(onRuntimeMessage);

function installMenu() {
  menuChain = menuChain.then(createMenu).catch(function (error) {
    console.error(TAG, error);
  });
  return menuChain;
}

async function createMenu() {
  try {
    await chrome.contextMenus.remove(MENU_ID);
  } catch (error) {
    // 第一次安装时菜单还不存在。
  }
  try {
    await chrome.contextMenus.create({
      id: MENU_ID,
      title: '识别二维码',
      contexts: ['image', 'video'],
      documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*']
    });
  } catch (error) {
    console.error(TAG, error);
  }
}

async function handleMenuClick(info, tab) {
  if (!info || info.menuItemId !== MENU_ID || !tab || tab.id == null) return;
  var requestId = Date.now() * 1000 + (requestSeq = (requestSeq + 1) % 1000);
  var base = {
    requestId: requestId,
    mediaType: info.mediaType === 'video' ? 'video' : 'image',
    srcUrl: info.srcUrl || '',
    pageUrl: info.pageUrl || tab.url || ''
  };
  await deliver(tab, info, Object.assign({ phase: 'loading', dataUrl: '', fetchError: '' }, base));
  var payload = Object.assign({ phase: 'decode', dataUrl: '', fetchError: '' }, base);
  if (base.mediaType === 'image' && base.srcUrl) {
    if (base.srcUrl.indexOf('data:') === 0) {
      payload.dataUrl = base.srcUrl;
    } else if (/^(https?|file):/i.test(base.srcUrl)) {
      try {
        payload.dataUrl = await loadAsDataUrl(base.srcUrl, base.pageUrl);
      } catch (error) {
        payload.fetchError = error && error.isUserFacing ? error.message : '图片下载失败';
      }
    }
  }
  var delivered = await deliver(tab, info, payload);
  if (!delivered) await openResultWindow(payload);
}

async function deliver(tab, info, payload) {
  var frameId = info.frameId;
  var options = typeof frameId === 'number' && frameId >= 0 ? { frameId: frameId } : undefined;
  if (await send(tab.id, payload, options)) return true;
  try {
    await chrome.scripting.executeScript({
      target: frameTarget(tab.id, frameId),
      files: ['vendor/jsQR.js', 'src/inject.js']
    });
  } catch (error) {
    console.error(TAG, error);
    return false;
  }
  return send(tab.id, payload, options);
}

function frameTarget(tabId, frameId) {
  var target = { tabId: tabId };
  if (typeof frameId === 'number' && frameId >= 0) target.frameIds = [frameId];
  return target;
}

async function send(tabId, payload, options) {
  try {
    var response = await chrome.tabs.sendMessage(tabId, { type: 'open-qrcode', payload: payload }, options);
    return !!(response && response.ok);
  } catch (error) {
    return false;
  }
}

async function openResultWindow(payload) {
  await chrome.storage.session.set({ openQrcodePayload: payload });
  await chrome.windows.create({
    url: chrome.runtime.getURL('src/result.html'),
    type: 'popup',
    width: 460,
    height: 420,
    focused: true
  });
}

function onRuntimeMessage(message, sender, sendResponse) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'open-url') {
    if (isHttpUrl(message.url)) chrome.tabs.create({ url: message.url });
    return;
  }
  if (message.type === 'fetch-image') {
    if (!isHttpUrl(message.url)) {
      sendResponse({ error: '找不到图片地址' });
      return;
    }
    var pageUrl = sender && sender.tab && sender.tab.url;
    loadAsDataUrl(message.url, pageUrl).then(function (dataUrl) {
      sendResponse({ dataUrl: dataUrl });
    }, function (error) {
      sendResponse({ error: error && error.isUserFacing ? error.message : '图片下载失败' });
    });
    return true;
  }
}

async function loadAsDataUrl(url, pageUrl) {
  var attempts = [];
  if (pageUrl && /^https?:/i.test(pageUrl)) {
    attempts.push({ credentials: 'include', headers: { Referer: pageUrl }, signal: AbortSignal.timeout(20000) });
  }
  attempts.push({ credentials: 'include', signal: AbortSignal.timeout(20000) });
  attempts.push({ credentials: 'omit', signal: AbortSignal.timeout(20000) });
  var lastStatus = 0;
  for (var i = 0; i < attempts.length; i++) {
    try {
      var response = await fetch(url, attempts[i]);
      if (!response.ok) {
        lastStatus = response.status || lastStatus;
        continue;
      }
      var blob = await response.blob();
      if (!blob.size) continue;
      if (blob.size > 25000000) throw userError('图片太大，没法读取');
      return await blobToDataUrl(blob);
    } catch (error) {
      if (error && error.isUserFacing) throw error;
    }
  }
  throw userError(lastStatus ? '图片下载失败（' + lastStatus + '）' : '图片下载失败');
}

async function blobToDataUrl(blob) {
  var bytes = new Uint8Array(await blob.arrayBuffer());
  var type = blob.type || sniffType(bytes);
  var binary = '';
  var chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return 'data:' + type + ';base64,' + btoa(binary);
}

function sniffType(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
  if (bytes[0] === 0x3c) return 'image/svg+xml';
  return 'image/png';
}

function isHttpUrl(url) {
  try {
    var protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function userError(message) {
  var error = new Error(message);
  error.isUserFacing = true;
  return error;
}
