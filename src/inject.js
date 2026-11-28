(function () {
  'use strict';

  var HOST_ID = 'open-qrcode-result';
  var currentRequest = 0;
  var host = null;
  var shadow = null;
  var panelOpen = false;
  var observer = null;
  var sharedCanvas = null;

  resolveJsQR();

  if (!globalThis.openQrcodeInstalled && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    globalThis.openQrcodeInstalled = true;
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (!message || message.type !== 'open-qrcode') return;
      Promise.resolve(globalThis.openQrcodeStart(message.payload)).then(function () {
        sendResponse({ ok: true });
      }, function (error) {
        sendResponse({ ok: false, error: String(error && error.message || error) });
      });
      return true;
    });
  }

  globalThis.openQrcodeStart = function (message) {
    if (!message || typeof message.requestId !== 'number') return Promise.resolve();
    if (message.requestId < currentRequest) return Promise.resolve();
    currentRequest = message.requestId;
    var requestId = message.requestId;
    ensurePanel();
    setTitle(message.phase === 'decode' ? '正在识别' : '正在识别');
    setStatus('正在识别…');
    clearResults();
    hideNote();
    if (message.phase === 'loading') return Promise.resolve();
    return decodePayload(message, function () {
      return requestId === currentRequest;
    }, function (step, total) {
      if (requestId !== currentRequest || total <= 1) return;
      setStatus('正在仔细查找（' + step + '/' + total + '）…');
    }).then(function (text) {
      if (requestId !== currentRequest) return;
      if (text) showResult(text);
      else showEmpty();
    }, function (error) {
      if (requestId !== currentRequest) return;
      showError(error && error.isUserFacing ? error.message : '识别时出了点问题，请重试。');
      if (!error || !error.isUserFacing) console.error('[网页二维码识别]', error);
    });
  };

  function resolveJsQR() {
    var fn = null;
    try { if (typeof jsQR === 'function') fn = jsQR; } catch (error) {}
    try { if (!fn && typeof globalThis.jsQR === 'function') fn = globalThis.jsQR; } catch (error) {}
    try {
      if (!fn && typeof module !== 'undefined' && typeof module.exports === 'function') fn = module.exports;
    } catch (error) {}
    if (fn && typeof fn.default === 'function') fn = fn.default;
    if (typeof fn === 'function') globalThis.jsQR = fn;
  }

  function ensurePanel() {
    panelOpen = true;
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.lang = 'zh-CN';
    [
      ['position', 'fixed'],
      ['inset', '0'],
      ['z-index', '2147483647'],
      ['pointer-events', 'none'],
      ['display', 'block'],
      ['margin', '0'],
      ['padding', '0'],
      ['border', '0'],
      ['background', 'transparent']
    ].forEach(function (pair) {
      host.style.setProperty(pair[0], pair[1], 'important');
    });
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = panelHtml();
    shadow.querySelector('.backdrop').addEventListener('click', function (event) {
      if (event.target === event.currentTarget) closePanel();
    });
    shadow.querySelector('[data-action="close"]').addEventListener('click', closePanel);
    shadow.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
    document.addEventListener('keydown', onKeyDown, true);
    if (document.documentElement) document.documentElement.appendChild(host);
    if (observer) observer.disconnect();
    observer = new MutationObserver(function () {
      if (!panelOpen || !host || host.isConnected || !document.documentElement) return;
      document.documentElement.appendChild(host);
    });
    if (document.documentElement) observer.observe(document.documentElement, { childList: true });
    var dialog = shadow.querySelector('.panel');
    dialog.focus({ preventScroll: true });
  }

  function closePanel() {
    panelOpen = false;
    document.removeEventListener('keydown', onKeyDown, true);
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (host) {
      host.remove();
      host = null;
      shadow = null;
    }
  }

  function onKeyDown(event) {
    if (!panelOpen || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closePanel();
  }

  function setTitle(text) {
    var title = shadow && shadow.querySelector('#open-qrcode-title');
    if (title) title.textContent = text;
  }

  function setStatus(text) {
    var status = shadow && shadow.querySelector('.status');
    if (!status) return;
    status.textContent = text || '';
    status.hidden = !text;
  }

  function clearResults() {
    var results = shadow && shadow.querySelector('.results');
    if (results) results.textContent = '';
  }

  function hideNote() {
    var note = shadow && shadow.querySelector('.note');
    if (!note) return;
    note.hidden = true;
    note.textContent = '';
  }

  function showResult(text) {
    setTitle('识别结果');
    setStatus('');
    clearResults();
    var results = shadow.querySelector('.results');
    var box = document.createElement('div');
    box.className = 'result';
    var pre = document.createElement('pre');
    pre.className = 'text';
    pre.textContent = text;
    box.appendChild(pre);
    var actions = document.createElement('div');
    actions.className = 'actions';
    var copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'btn';
    copyButton.textContent = '复制';
    copyButton.setAttribute('aria-label', '复制识别内容');
    copyButton.addEventListener('click', function () {
      copyText(text).then(function (ok) {
        copyButton.textContent = ok ? '已复制' : '请手选复制';
        if (!ok) selectElement(pre);
        setTimeout(function () {
          if (copyButton.isConnected) copyButton.textContent = '复制';
        }, 1600);
      });
    });
    actions.appendChild(copyButton);
    var href = httpUrlFromPayload(text);
    if (href) {
      var openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'btn btn-primary';
      openButton.textContent = '打开链接';
      openButton.addEventListener('click', function () { openUrl(href); });
      actions.appendChild(openButton);
    }
    box.appendChild(actions);
    results.appendChild(box);
    copyButton.focus({ preventScroll: true });
  }

  function showEmpty() {
    setTitle('没有识别到二维码');
    clearResults();
    setStatus('没有识别到二维码。请确认图片完整、清晰，然后再试一次。');
  }

  function showError(message) {
    setTitle('没法完成识别');
    clearResults();
    setStatus(message || '识别时出了点问题，请重试。');
  }

  async function decodePayload(message, isCurrent, onProgress) {
    if (message.dataUrl) {
      var loaded = await loadImage(message.dataUrl);
      return decodeDrawable(loaded, loaded.naturalWidth, loaded.naturalHeight, onProgress, isCurrent);
    }
    if (message.mediaType === 'video') return decodeVideo(message.srcUrl, isCurrent, onProgress);
    var image = findBySrc(message.srcUrl);
    if (image && String(image.tagName).toLowerCase() !== 'video') {
      return decodeImageElement(image, isCurrent, onProgress);
    }
    throw userError(message.fetchError || '没法读取这张图片');
  }

  async function decodeVideo(srcUrl, isCurrent, onProgress) {
    var video = findBySrc(srcUrl);
    if (!video || String(video.tagName).toLowerCase() !== 'video') throw userError('没法读取这段视频画面');
    if (video.readyState >= 2 && video.videoWidth >= 21 && canDraw(function (ctx) { ctx.drawImage(video, 0, 0, 1, 1); })) {
      var text = await decodeDrawable(video, video.videoWidth, video.videoHeight, onProgress, isCurrent);
      if (text || !video.poster) return text;
    }
    if (!video.poster) throw userError('没法读取这段视频画面');
    var poster = new URL(video.poster, document.baseURI).href;
    if (poster.indexOf('data:') === 0 || poster.indexOf('blob:') === 0) {
      var direct = await loadImage(poster);
      return decodeDrawable(direct, direct.naturalWidth, direct.naturalHeight, onProgress, isCurrent);
    }
    var response = await chrome.runtime.sendMessage({ type: 'fetch-image', url: poster });
    if (!response || !response.dataUrl) throw userError((response && response.error) || '没法读取这段视频画面');
    var posterImage = await loadImage(response.dataUrl);
    return decodeDrawable(posterImage, posterImage.naturalWidth, posterImage.naturalHeight, onProgress, isCurrent);
  }

  async function decodeImageElement(img, isCurrent, onProgress) {
    if (!img.complete) {
      try { await whenImageReady(img); } catch (error) {}
    }
    var width = img.naturalWidth || img.videoWidth || 0;
    var height = img.naturalHeight || img.videoHeight || 0;
    if (width >= 21 && height >= 21 && canDraw(function (ctx) { ctx.drawImage(img, 0, 0, 1, 1); })) {
      return decodeDrawable(img, width, height, onProgress, isCurrent);
    }
    throw userError('没法读取这张图片');
  }

  async function decodeDrawable(source, width, height, onProgress, isCurrent) {
    var jsQRFn = globalThis.jsQR;
    if (typeof jsQRFn !== 'function') throw userError('识别组件没有加载');
    if (!(width >= 21) || !(height >= 21)) throw userError('图片太小，读不出二维码');
    var attempts = planAttempts(width, height);
    for (var i = 0; i < attempts.length; i++) {
      if (!isCurrent()) return '';
      if (onProgress) onProgress(i + 1, attempts.length);
      await yieldToBrowser();
      if (!isCurrent()) return '';
      var imageData;
      try {
        imageData = renderRegion(source, attempts[i]);
      } catch (error) {
        throw userError('没法读取这张图片');
      }
      var text = '';
      try {
        var code = jsQRFn(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        text = code && typeof code.data === 'string' ? code.data : '';
      } catch (error) {
        console.error('[网页二维码识别]', error);
      }
      if (text) return text;
    }
    return '';
  }

  function planAttempts(width, height) {
    var attempts = [];
    var seen = {};
    var full = { sx: 0, sy: 0, sw: width, sh: height };
    function add(region, maxSide, smooth, pad) {
      var dest = fitSize(region.sw, region.sh, maxSide);
      var key = [region.sx, region.sy, region.sw, region.sh, dest.width, dest.height, smooth ? 1 : 0, pad].join(',');
      if (seen[key]) return;
      seen[key] = true;
      attempts.push({
        sx: region.sx, sy: region.sy, sw: region.sw, sh: region.sh,
        dw: dest.width, dh: dest.height, smooth: smooth, pad: pad
      });
    }
    add(full, 720, false, 0);
    if (Math.max(width, height) > 860) add(full, 720, true, 0);
    add(full, 1200, false, 0);
    add(full, 720, true, 0);
    add(full, 720, false, 0.12);
    if (Math.max(width, height) >= 480) {
      var count = Math.max(width, height) >= 1100 ? 3 : 2;
      buildTiles(width, height, count).forEach(function (tile) {
        add(tile, 560, false, 0);
      });
    }
    return attempts;
  }

  function buildTiles(width, height, count) {
    var tiles = [];
    var overlap = 0.22;
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        var sw = Math.ceil(width / count * (1 + overlap));
        var sh = Math.ceil(height / count * (1 + overlap));
        var sx = Math.floor((col * width) / count - (sw - width / count) / 2);
        var sy = Math.floor((row * height) / count - (sh - height / count) / 2);
        if (sx < 0) sx = 0;
        if (sy < 0) sy = 0;
        var tileW = Math.min(sw, width - sx);
        var tileH = Math.min(sh, height - sy);
        if (tileW < 21 || tileH < 21) continue;
        tiles.push({ sx: sx, sy: sy, sw: tileW, sh: tileH });
      }
    }
    return tiles;
  }

  function fitSize(width, height, maxSide) {
    var longest = Math.max(width, height);
    var scale = longest > maxSide ? maxSide / longest : 1;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function renderRegion(source, attempt) {
    var padX = Math.round(attempt.dw * attempt.pad);
    var padY = Math.round(attempt.dh * attempt.pad);
    var canvasW = attempt.dw + padX * 2;
    var canvasH = attempt.dh + padY * 2;
    if (!sharedCanvas) sharedCanvas = document.createElement('canvas');
    if (sharedCanvas.width !== canvasW) sharedCanvas.width = canvasW;
    if (sharedCanvas.height !== canvasH) sharedCanvas.height = canvasH;
    var ctx = sharedCanvas.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = !!attempt.smooth;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, attempt.sx, attempt.sy, attempt.sw, attempt.sh, padX, padY, attempt.dw, attempt.dh);
    return ctx.getImageData(0, 0, canvasW, canvasH);
  }

  function findBySrc(srcUrl) {
    if (!srcUrl) return null;
    var found = [];
    function visit(root) {
      if (!root || !root.querySelectorAll) return;
      root.querySelectorAll('img, video, input[type="image"]').forEach(function (el) {
        if (el.currentSrc === srcUrl || el.src === srcUrl) found.push(el);
      });
      root.querySelectorAll('*').forEach(function (el) {
        if (el.shadowRoot) visit(el.shadowRoot);
      });
    }
    visit(document);
    for (var i = 0; i < found.length; i++) {
      var rect = found[i].getBoundingClientRect();
      if (rect.width >= 8 && rect.height >= 8) return found[i];
    }
    return found[0] || null;
  }

  function canDraw(draw) {
    try {
      var canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      draw(ctx);
      ctx.getImageData(0, 0, 1, 1);
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var timer = setTimeout(function () {
        reject(userError('图片加载超时'));
      }, 15000);
      image.onload = function () {
        clearTimeout(timer);
        if (!image.naturalWidth || !image.naturalHeight) reject(userError('图片尺寸无效'));
        else resolve(image);
      };
      image.onerror = function () {
        clearTimeout(timer);
        reject(userError('图片加载失败'));
      };
      image.src = src;
    });
  }

  function whenImageReady(img) {
    if (img.complete) return Promise.resolve(img);
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(userError('图片还在加载，请稍后再试')); }, 4000);
      img.addEventListener('load', function () { clearTimeout(timer); resolve(img); }, { once: true });
      img.addEventListener('error', function () { clearTimeout(timer); reject(userError('图片加载失败')); }, { once: true });
    });
  }

  function httpUrlFromPayload(text) {
    var trimmed = String(text || '').trim();
    if (!/^https?:\/\//i.test(trimmed)) return '';
    try {
      var url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.href;
    } catch (error) {
      return '';
    }
  }

  function openUrl(url) {
    var href = httpUrlFromPayload(url);
    if (!href) return;
    try {
      chrome.runtime.sendMessage({ type: 'open-url', url: href });
    } catch (error) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
    area.remove();
    return ok;
  }

  function selectElement(el) {
    var selection = window.getSelection && window.getSelection();
    if (!selection || !el) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function yieldToBrowser() {
    return new Promise(function (resolve) { setTimeout(resolve, 0); });
  }

  function userError(message) {
    var error = new Error(message);
    error.isUserFacing = true;
    return error;
  }

  function panelHtml() {
    return [
      '<style>',
      ':host { all: initial; }',
      '* { box-sizing: border-box; }',
      '[hidden] { display: none !important; }',
      '.ui { font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; color: #1f2328; font-size: 14px; line-height: 1.5; }',
      'button { font: inherit; cursor: pointer; touch-action: manipulation; }',
      'button:focus-visible { outline: 2px solid #1f6feb; outline-offset: 2px; }',
      '.backdrop { position: fixed; inset: 0; pointer-events: auto; background: rgba(15, 18, 22, 0.28); display: flex; align-items: center; justify-content: center; padding: 16px; }',
      '.panel { width: min(440px, calc(100vw - 32px)); max-height: min(80vh, 640px); overflow: auto; background: #fff; color: #1f2328; border-radius: 14px; box-shadow: 0 16px 50px rgba(0, 0, 0, 0.24); padding: 14px 14px 12px; outline: none; pointer-events: auto; }',
      '.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }',
      '.panel h2 { margin: 0; font-size: 16px; line-height: 1.4; font-weight: 650; }',
      '.icon-btn { border: 0; background: transparent; color: inherit; width: 28px; height: 28px; border-radius: 8px; font-size: 20px; line-height: 1; padding: 0; }',
      '.icon-btn:hover { background: #f3f6f9; }',
      '.status { margin: 0; color: #656d76; }',
      '.text { margin: 0; padding: 10px 12px; background: #f6f8fa; border-radius: 8px; white-space: pre-wrap; word-break: break-word; user-select: text; max-height: 220px; overflow: auto; }',
      '.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }',
      '.btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; padding: 6px 12px; border: 0; background: #f3f4f6; color: #1f2328; }',
      '.btn:hover { background: #e7ebf0; }',
      '.btn-primary { background: #1f6feb; color: #fff; }',
      '.btn-primary:hover { background: #1a61d4; }',
      '@media (prefers-color-scheme: dark) {',
      '  .ui, .panel { color: #e8eaed; }',
      '  .panel { background: #1c2128; }',
      '  .status { color: #9aa3ad; }',
      '  .text { background: #15191e; }',
      '  .btn { background: #2b3340; color: #e8eaed; }',
      '  .btn:hover { background: #364154; }',
      '  .btn-primary, .btn-primary:hover { background: #1f6feb; color: #fff; }',
      '  .icon-btn:hover { background: rgba(255, 255, 255, 0.06); }',
      '}',
      '</style>',
      '<div class="ui">',
      '  <div class="backdrop">',
      '    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="open-qrcode-title" tabindex="-1">',
      '      <div class="panel-head">',
      '        <h2 id="open-qrcode-title">正在识别</h2>',
      '        <button type="button" class="icon-btn" data-action="close" aria-label="关闭">×</button>',
      '      </div>',
      '      <p class="status">正在识别…</p>',
      '      <div class="results"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }
})();
