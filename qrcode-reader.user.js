// ==UserScript==
// @name            网页二维码识别
// @name:zh-CN      网页二维码识别
// @namespace       https://github.com/1275389313/open_qrcode
// @version         1.0.0
// @description     在网页图片上右键识别二维码，显示文字或链接，并可复制。
// @description:zh-CN 在网页图片上右键识别二维码，显示文字或链接，并可复制。
// @author          1275389313
// @license         MIT
// @match           *://*/*
// @icon            data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect fill='%231f2328' width='32' height='32' rx='7'/%3E%3Cpath fill='%23fff' d='M6 6h8v8H6zm2 2v4h4V8zm10-2h8v8h-8zm2 2v4h4V8zM6 18h8v8H6zm2 2v4h4v-4zm12 0h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 4h2v2h-2zM18 18h2v2h-2zm4 4h4v2h-4z'/%3E%3C/svg%3E
// @grant           GM_xmlhttpRequest
// @grant           GM_setClipboard
// @grant           GM_registerMenuCommand
// @connect         *
// @run-at          document-idle
// @require         https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js
// @homepageURL     https://github.com/1275389313/open_qrcode
// @supportURL      https://github.com/1275389313/open_qrcode/issues
// @downloadURL     https://raw.githubusercontent.com/1275389313/open_qrcode/main/qrcode-reader.user.js
// @updateURL       https://raw.githubusercontent.com/1275389313/open_qrcode/main/qrcode-reader.user.js
// ==/UserScript==

(function () {
  'use strict';

  var HOST_ID = 'open-qrcode-userscript-root';
  var TAG = '[网页二维码识别]';
  var PAGE_SCAN_LIMIT = 30;
  var RIGHT_CLICK_MIN = 30;
  var PAGE_SCAN_MIN = 36;

  if (document.getElementById(HOST_ID)) return;

  var jsQRFn = resolveJsQR();
  var host = document.createElement('div');
  var shadow = host.attachShadow({ mode: 'open' });
  var scanId = 0;
  var currentPicture = null;
  var pointer = { x: 0, y: 0 };

  host.id = HOST_ID;
  host.lang = 'zh-CN';
  host.setAttribute('data-open-qrcode', '1');
  [
    ['position', 'fixed'],
    ['left', '0'],
    ['top', '0'],
    ['width', '0'],
    ['height', '0'],
    ['overflow', 'visible'],
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

  shadow.innerHTML = [
    '<style>',
    ':host { all: initial; }',
    '* { box-sizing: border-box; }',
    '[hidden] { display: none !important; }',
    '.ui { font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; color: #1f2328; font-size: 14px; line-height: 1.5; }',
    'button, a { font: inherit; }',
    'button { cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }',
    'button:focus-visible, a:focus-visible { outline: 2px solid #1f6feb; outline-offset: 2px; }',
    '.fab-wrap { position: fixed; right: 16px; bottom: 16px; z-index: 1; pointer-events: auto; width: 48px; height: 48px; }',
    '.fab { width: 44px; height: 44px; margin: 2px; border-radius: 999px; border: 1px solid rgba(31, 35, 40, 0.16); background: #fff; color: #1f2328; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18); display: flex; align-items: center; justify-content: center; opacity: 0.82; padding: 0; }',
    '.fab:hover, .fab:focus-visible, .fab.is-busy { opacity: 1; }',
    '.fab.is-busy { animation: qrspin 0.9s linear infinite; }',
    '.hide { position: absolute; top: -4px; right: -4px; width: 18px; height: 18px; border: 0; border-radius: 999px; background: #1f2328; color: #fff; font-size: 12px; line-height: 18px; padding: 0; opacity: 0; }',
    '.fab-wrap:hover .hide, .fab-wrap:focus-within .hide { opacity: 0.92; }',
    '@media (hover: none) { .hide { opacity: 0.85; } }',
    '.menu { position: fixed; z-index: 3; pointer-events: auto; min-width: 232px; max-width: min(320px, calc(100vw - 16px)); background: #fff; color: #1f2328; border: 1px solid rgba(31, 35, 40, 0.12); border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18); padding: 6px; }',
    '.menu-title { padding: 4px 10px 6px; font-size: 12px; color: #656d76; }',
    '.sep { height: 1px; margin: 4px 6px; background: rgba(31, 35, 40, 0.1); }',
    '.item { width: 100%; text-align: left; border: 0; background: transparent; color: inherit; border-radius: 7px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }',
    '.item:hover, .item:focus-visible { background: #f3f6f9; }',
    '.item.primary { font-weight: 650; }',
    '.hint { margin: 2px 6px 4px; padding: 4px 6px 2px; font-size: 12px; line-height: 1.45; color: #656d76; }',
    '.backdrop { position: fixed; inset: 0; z-index: 2; pointer-events: auto; background: rgba(15, 18, 22, 0.28); display: flex; align-items: center; justify-content: center; padding: 16px; }',
    '.panel { width: min(440px, calc(100vw - 32px)); max-height: min(80vh, 640px); overflow: auto; background: #fff; color: #1f2328; border-radius: 14px; box-shadow: 0 16px 50px rgba(0, 0, 0, 0.24); padding: 14px 14px 12px; outline: none; }',
    '.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }',
    '.panel h2 { margin: 0; font-size: 16px; line-height: 1.4; font-weight: 650; }',
    '.icon-btn { border: 0; background: transparent; color: inherit; width: 28px; height: 28px; border-radius: 8px; font-size: 20px; line-height: 1; padding: 0; }',
    '.icon-btn:hover { background: #f3f6f9; }',
    '.status { margin: 0 0 8px; color: #656d76; }',
    '.result { padding: 10px 0; border-top: 1px solid rgba(31, 35, 40, 0.08); }',
    '.result:first-child { border-top: 0; padding-top: 0; }',
    '.result-label { margin: 0 0 6px; font-size: 12px; color: #656d76; }',
    '.text { margin: 0; padding: 10px 12px; background: #f6f8fa; border-radius: 8px; white-space: pre-wrap; word-break: break-word; user-select: text; max-height: 220px; overflow: auto; }',
    '.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }',
    '.btn, .btn-link { display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; padding: 6px 12px; text-decoration: none; border: 0; background: #f3f4f6; color: #1f2328; }',
    '.btn:hover, .btn-link:hover { background: #e7ebf0; }',
    '.btn-primary { background: #1f6feb; color: #fff; }',
    '.btn-primary:hover { background: #1a61d4; color: #fff; }',
    '.note { margin: 8px 0 0; color: #9a3412; }',
    '@keyframes qrspin { to { transform: rotate(360deg); } }',
    '@media (prefers-color-scheme: dark) {',
    '  .ui { color: #e8eaed; }',
    '  .fab { background: #20262e; color: #e8eaed; border-color: rgba(255, 255, 255, 0.14); }',
    '  .hide { background: #e8eaed; color: #1f2328; }',
    '  .menu, .panel { background: #1c2128; color: #e8eaed; border-color: rgba(255, 255, 255, 0.1); }',
    '  .menu-title, .hint, .status, .result-label { color: #9aa3ad; }',
    '  .item:hover, .item:focus-visible, .icon-btn:hover { background: rgba(255, 255, 255, 0.06); }',
    '  .sep, .result { border-color: rgba(255, 255, 255, 0.08); }',
    '  .text { background: #15191e; }',
    '  .btn, .btn-link { background: #2b3340; color: #e8eaed; }',
    '  .btn:hover, .btn-link:hover { background: #364154; }',
    '  .btn-primary { background: #1f6feb; color: #fff; }',
    '}',
    '@media (prefers-reduced-motion: reduce) { .fab.is-busy { animation: none; } }',
    '@media print { .fab-wrap, .menu, .backdrop { display: none !important; } }',
    '</style>',
    '<div class="ui">',
    '  <div class="fab-wrap">',
    '    <button type="button" class="fab" aria-label="扫描此页面上的二维码" title="扫描此页面上的二维码">',
    '      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10 0h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zM13 13h2v2h-2z"/></svg>',
    '    </button>',
    '    <button type="button" class="hide" aria-label="隐藏扫描按钮" title="隐藏到刷新页面">×</button>',
    '  </div>',
    '  <div class="menu" role="menu" aria-label="网页二维码识别" hidden>',
    '    <div class="menu-title">网页二维码识别</div>',
    '    <button type="button" class="item primary" role="menuitem" data-action="scan-one">识别二维码</button>',
    '    <button type="button" class="item" role="menuitem" data-action="scan-page">扫描整个页面</button>',
    '    <div class="sep extra-sep" hidden></div>',
    '    <button type="button" class="item" role="menuitem" data-action="open-image" hidden>在新标签页打开图片</button>',
    '    <button type="button" class="item" role="menuitem" data-action="copy-image" hidden>复制图片地址</button>',
    '    <button type="button" class="item" role="menuitem" data-action="open-link" hidden>打开所在链接</button>',
    '    <div class="sep"></div>',
    '    <p class="hint">按住 Shift 再右键，使用浏览器原来的菜单</p>',
    '  </div>',
    '  <div class="backdrop" hidden>',
    '    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="open-qrcode-title" tabindex="-1">',
    '      <div class="panel-head">',
    '        <h2 id="open-qrcode-title">识别结果</h2>',
    '        <button type="button" class="icon-btn" data-action="close" aria-label="关闭">×</button>',
    '      </div>',
    '      <p class="status"></p>',
    '      <div class="results"></div>',
    '      <p class="note" hidden></p>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  var ui = shadow.querySelector('.ui');
  var fabWrap = shadow.querySelector('.fab-wrap');
  var fab = shadow.querySelector('.fab');
  var hideButton = shadow.querySelector('.hide');
  var menu = shadow.querySelector('.menu');
  var extraSep = shadow.querySelector('.extra-sep');
  var backdrop = shadow.querySelector('.backdrop');
  var panel = shadow.querySelector('.panel');
  var titleEl = shadow.querySelector('#open-qrcode-title');
  var statusEl = shadow.querySelector('.status');
  var resultsEl = shadow.querySelector('.results');
  var noteEl = shadow.querySelector('.note');

  if (!inTopWindow()) fabWrap.hidden = true;

  ui.addEventListener('pointerdown', function (event) {
    event.stopPropagation();
  });
  ui.addEventListener('click', function (event) {
    event.stopPropagation();
  });

  fab.addEventListener('click', function () {
    hideMenu();
    scanPage();
  });
  hideButton.addEventListener('click', function (event) {
    event.stopPropagation();
    fabWrap.hidden = true;
  });
  menu.addEventListener('click', onMenuClick);
  menu.addEventListener('auxclick', function (event) {
    event.preventDefault();
    event.stopPropagation();
  });
  backdrop.addEventListener('click', function (event) {
    if (event.target === backdrop) hidePanel();
  });
  shadow.querySelector('[data-action="close"]').addEventListener('click', hidePanel);

  document.addEventListener('contextmenu', onContextMenu, true);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('mousemove', function (event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }, true);
  window.addEventListener('scroll', hideMenu, true);
  window.addEventListener('resize', hideMenu, true);
  window.addEventListener('blur', hideMenu);

  if (document.documentElement) {
    document.documentElement.appendChild(host);
    var observer = new MutationObserver(function () {
      if (document.documentElement && !host.isConnected) {
        document.documentElement.appendChild(host);
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }

  if (inTopWindow() && typeof GM_registerMenuCommand === 'function') {
    try {
      GM_registerMenuCommand('扫描页面二维码', scanPage, { title: '识别当前页面上的二维码图片' });
    } catch (error) {
      console.error(TAG, error);
    }
  }

  function onContextMenu(event) {
    if (eventFromOurUI(event)) {
      hideMenu();
      return;
    }
    if (event.shiftKey) {
      hideMenu();
      return;
    }
    var picture = pictureFromEvent(event, RIGHT_CLICK_MIN);
    if (!picture) {
      hideMenu();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openMenu(event.clientX, event.clientY, picture);
  }

  function onDocumentPointerDown(event) {
    if (menu.hidden) return;
    if (eventFromOurUI(event)) return;
    hideMenu();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      if (!menu.hidden) {
        hideMenu();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!backdrop.hidden) {
        hidePanel();
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'q' && event.key !== 'Q') return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    var picture = pictureFromPoint(pointer.x, pointer.y, RIGHT_CLICK_MIN);
    if (picture) runScan([picture], 'one');
    else scanPage();
  }

  function onMenuClick(event) {
    var button = event.target.closest('button[data-action]');
    if (!button || button.hidden) return;
    var action = button.getAttribute('data-action');
    var picture = currentPicture;
    if (action === 'scan-one' && picture) {
      hideMenu();
      runScan([picture], 'one');
      return;
    }
    if (action === 'scan-page') {
      hideMenu();
      scanPage();
      return;
    }
    if (action === 'open-image' && picture && isHttpUrl(picture.url)) {
      hideMenu();
      window.open(picture.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action === 'copy-image' && picture && isHttpUrl(picture.url)) {
      copyText(picture.url).then(function (ok) {
        button.textContent = ok ? '已复制图片地址' : '复制失败';
        setTimeout(function () {
          button.textContent = '复制图片地址';
        }, 1400);
      });
      return;
    }
    if (action === 'open-link' && picture && picture.link) {
      hideMenu();
      window.open(picture.link, '_blank', 'noopener,noreferrer');
    }
  }

  function openMenu(x, y, picture) {
    currentPicture = picture;
    var showImage = isHttpUrl(picture.url);
    var showLink = !!picture.link;
    setHidden(shadow.querySelector('[data-action="open-image"]'), !showImage);
    setHidden(shadow.querySelector('[data-action="copy-image"]'), !showImage);
    setHidden(shadow.querySelector('[data-action="open-link"]'), !showLink);
    setHidden(extraSep, !showImage && !showLink);
    menu.hidden = false;
    menu.style.left = '0px';
    menu.style.top = '0px';
    var rect = menu.getBoundingClientRect();
    var left = x;
    var top = y;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
  }

  function hideMenu() {
    menu.hidden = true;
    currentPicture = null;
  }

  function scanPage() {
    var targets = collectPageTargets();
    runScan(targets, 'page');
  }

  function runScan(targets, mode) {
    var id = ++scanId;
    var isCurrent = function () { return id === scanId; };
    hideMenu();
    showPanel();
    resultsEl.textContent = '';
    noteEl.hidden = true;
    noteEl.textContent = '';
    setBusy(true);
    if (!jsQRFn) {
      titleEl.textContent = '没法开始识别';
      setStatus('二维码识别组件没有加载。请重新安装脚本，并确认安装时能访问 cdn.jsdelivr.net。');
      setBusy(false);
      return;
    }
    if (!targets.length) {
      titleEl.textContent = '没有找到图片';
      setStatus('这一页没有找到可以扫描的图片。请让二维码图片完整显示出来，或直接在图片上右键。');
      setBusy(false);
      return;
    }
    titleEl.textContent = '正在识别';
    setStatus(targets.length === 1 ? '正在识别…' : '正在识别（1/' + targets.length + '）…');
    var thorough = targets.length === 1;
    var found = [];
    var errors = [];
    var chain = Promise.resolve();
    targets.forEach(function (target, index) {
      chain = chain.then(function () {
        if (!isCurrent()) return;
        if (targets.length > 1) setStatus('正在识别（' + (index + 1) + '/' + targets.length + '）…');
        return yieldToBrowser().then(function () {
          if (!isCurrent()) return null;
          return decodeTarget(target, thorough, isCurrent, function (step, total) {
            if (!isCurrent()) return;
            if (thorough && total > 1) setStatus('正在仔细查找（' + step + '/' + total + '）…');
          });
        }).then(function (texts) {
          if (!isCurrent() || texts == null) return;
          texts.forEach(function (text) {
            if (found.indexOf(text) === -1) found.push(text);
          });
        }, function (error) {
          if (!isCurrent()) return;
          errors.push(error && error.isUserFacing ? error.message : '有一张图片没法读取');
          if (!error || !error.isUserFacing) console.error(TAG, error);
        });
      });
    });
    chain.then(function () {
      if (!isCurrent()) return;
      setBusy(false);
      renderResults(found, errors, mode);
    }, function (error) {
      if (!isCurrent()) return;
      setBusy(false);
      console.error(TAG, error);
      titleEl.textContent = '识别失败';
      setStatus('识别时出了点问题，请重试。');
    });
  }

  function renderResults(texts, errors, mode) {
    resultsEl.textContent = '';
    if (!texts.length) {
      titleEl.textContent = '没有识别到二维码';
      if (errors.length) {
        setStatus(errors.length === 1 ? errors[0] : errors[0] + '（另有 ' + (errors.length - 1) + ' 张图片未能读取）');
      } else if (mode === 'page') {
        setStatus('没有识别到二维码。可以对着二维码图片右键，再点「识别二维码」，脚本会更仔细地扫描这一张。');
      } else {
        setStatus('没有识别到二维码。请确认图片完整、清晰，然后再试一次。');
      }
      return;
    }
    titleEl.textContent = texts.length === 1 ? '识别结果' : '识别到 ' + texts.length + ' 个二维码';
    setStatus('');
    texts.forEach(function (text, index) {
      var box = document.createElement('div');
      box.className = 'result';
      if (texts.length > 1) {
        var label = document.createElement('p');
        label.className = 'result-label';
        label.textContent = '结果 ' + (index + 1);
        box.appendChild(label);
      }
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
        var link = document.createElement('a');
        link.className = 'btn-link btn-primary';
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '打开链接';
        actions.appendChild(link);
      }
      box.appendChild(actions);
      resultsEl.appendChild(box);
    });
    if (errors.length) {
      noteEl.hidden = false;
      noteEl.textContent = '另外有 ' + errors.length + ' 张图片没法读取。';
    }
    var focusTarget = resultsEl.querySelector('.btn-primary') || resultsEl.querySelector('.btn') || panel;
    focusTarget.focus({ preventScroll: true });
  }

  function showPanel() {
    ensureHost();
    backdrop.hidden = false;
  }

  function hidePanel() {
    backdrop.hidden = true;
    setBusy(false);
    scanId += 1;
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
    statusEl.hidden = !text;
  }

  function setBusy(busy) {
    fab.classList.toggle('is-busy', busy);
    fab.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function setHidden(el, hidden) {
    if (el) el.hidden = hidden;
  }

  function ensureHost() {
    if (document.documentElement && !host.isConnected) {
      document.documentElement.appendChild(host);
    }
  }

  function eventFromOurUI(event) {
    var path = event.composedPath ? event.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      if (path[i] === host) return true;
    }
    return false;
  }

  function pictureFromEvent(event, min) {
    var path = event.composedPath ? event.composedPath() : [];
    var elements = [];
    for (var i = 0; i < path.length; i++) {
      if (path[i] instanceof Element) elements.push(path[i]);
    }
    if (!elements.length && event.target instanceof Element) elements.push(event.target);
    return pictureFromElements(elements, min);
  }

  function pictureFromPoint(x, y, min) {
    var stack = [];
    try {
      stack = document.elementsFromPoint(x, y) || [];
    } catch (error) {
      stack = [];
    }
    return pictureFromElements(stack, min);
  }

  function pictureFromElements(elements, min) {
    var i;
    var direct;
    for (i = 0; i < elements.length; i++) {
      if (isOurUIElement(elements[i])) return null;
      direct = directMedia(elements[i], min);
      if (direct) return direct;
    }
    for (i = 0; i < elements.length; i++) {
      if (elements[i] === document.body || elements[i] === document.documentElement) break;
      var background = backgroundTarget(elements[i], min) || pseudoBackgroundTarget(elements[i], min);
      if (background) return background;
    }
    return null;
  }

  function directMedia(el, min) {
    if (!(el instanceof Element) || isOurUIElement(el)) return null;
    if (el instanceof HTMLImageElement) return imageTarget(el, min);
    if (el instanceof HTMLCanvasElement) return canvasTarget(el, min);
    if (el instanceof HTMLVideoElement) return videoTarget(el, min);
    if (el instanceof SVGImageElement) return svgImageTarget(el, min);
    if (el instanceof SVGSVGElement) return svgTarget(el, min);
    if (el instanceof SVGElement && el.ownerSVGElement) return svgTarget(el.ownerSVGElement, min);
    if (el instanceof HTMLInputElement && String(el.type).toLowerCase() === 'image') return inputImageTarget(el, min);
    if (el instanceof HTMLObjectElement || el instanceof HTMLEmbedElement) return objectTarget(el, min);
    return null;
  }

  function imageTarget(img, min) {
    if (!boxOk(img, min)) return null;
    var lazy = lazyUrlOf(img);
    var src = absUrl(img.currentSrc || img.src || '');
    var naturalW = img.naturalWidth || 0;
    var naturalH = img.naturalHeight || 0;
    if (img.complete && naturalW > 0 && naturalW <= 3 && naturalH <= 3 && !lazy) return null;
    return {
      kind: 'image',
      element: img,
      url: isHttpUrl(src) ? src : '',
      fetchUrl: isReadableUrl(src) ? src : '',
      lazy: lazy,
      link: ancestorHref(img)
    };
  }

  function canvasTarget(canvas, min) {
    if (!boxOk(canvas, min)) return null;
    if (canvas.width < 21 || canvas.height < 21) return null;
    return { kind: 'canvas', element: canvas, url: '', link: ancestorHref(canvas) };
  }

  function videoTarget(video, min) {
    if (!boxOk(video, min)) return null;
    var poster = absUrl(video.poster || '');
    if ((video.videoWidth || 0) < 21 && !poster) return null;
    return {
      kind: 'video',
      element: video,
      url: isHttpUrl(poster) ? poster : '',
      fetchUrl: isReadableUrl(poster) ? poster : '',
      link: ancestorHref(video)
    };
  }

  function svgTarget(svg, min) {
    if (!(svg instanceof SVGSVGElement) || isOurUIElement(svg)) return null;
    if (!boxOk(svg, min)) return null;
    return { kind: 'svg', element: svg, url: '', link: ancestorHref(svg) };
  }

function svgImageTarget(image, min) {
  var href = '';
  if (image.href && image.href.baseVal) href = image.href.baseVal;
  if (!href) href = image.getAttribute('href') || image.getAttribute('xlink:href') || '';
  var url = absUrl(href);
  var box = boxOk(image, min) || (image.ownerSVGElement && boxOk(image.ownerSVGElement, min));
  if (isReadableUrl(url) && box) {
    return { kind: 'url', element: image, url: isHttpUrl(url) ? url : '', urls: [url], link: ancestorHref(image) };
  }
  if (image.ownerSVGElement) return svgTarget(image.ownerSVGElement, min);
  return null;
}

  function inputImageTarget(input, min) {
    if (!boxOk(input, min)) return null;
    var url = absUrl(input.src || '');
    if (!isReadableUrl(url)) return null;
    return { kind: 'url', element: input, url: isHttpUrl(url) ? url : '', urls: [url], link: ancestorHref(input) };
  }

  function objectTarget(el, min) {
    if (!boxOk(el, min)) return null;
    var raw = el instanceof HTMLObjectElement ? (el.data || '') : (el.src || '');
    var url = absUrl(raw);
    var type = String(el.type || '').toLowerCase();
    var looksImage = type.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp|bmp|avif|svg)(\?|#|$)/i.test(url);
    if (!looksImage || !isReadableUrl(url)) return null;
    return { kind: 'url', element: el, url: isHttpUrl(url) ? url : '', urls: [url], link: ancestorHref(el) };
  }

  function backgroundTarget(el, min) {
    if (!(el instanceof Element) || isOurUIElement(el)) return null;
    if (el === document.body || el === document.documentElement) return null;
    if (!boxOk(el, min) || coversViewport(el)) return null;
    var urls = parseCssUrls(getComputedStyle(el).backgroundImage).map(absUrl).filter(isReadableUrl);
    if (!urls.length) return null;
    return { kind: 'url', element: el, url: isHttpUrl(urls[0]) ? urls[0] : '', urls: urls, link: ancestorHref(el) };
  }

  function pseudoBackgroundTarget(el, min) {
    if (!(el instanceof Element) || isOurUIElement(el)) return null;
    if (el === document.body || el === document.documentElement || coversViewport(el)) return null;
    var pseudos = ['::before', '::after'];
    for (var i = 0; i < pseudos.length; i++) {
      var style = getComputedStyle(el, pseudos[i]);
      var urls = parseCssUrls(style.backgroundImage).map(absUrl).filter(isReadableUrl);
      if (!urls.length) continue;
      var width = parseFloat(style.width);
      var height = parseFloat(style.height);
      if (width >= min && height >= min) {
        return { kind: 'url', element: el, url: isHttpUrl(urls[0]) ? urls[0] : '', urls: urls, link: ancestorHref(el) };
      }
    }
    return null;
  }

  function collectPageTargets() {
    var list = [];
    var seenElements = new Set();
    var seenUrls = new Set();
    function add(target) {
      if (!target || !target.element || isOurUIElement(target.element)) return;
      if (seenElements.has(target.element)) return;
      var urlKey = target.lazy && (target.element.naturalWidth || 0) <= 3 ? target.lazy : (target.url || '');
      if (urlKey && (target.kind === 'image' || target.kind === 'url') && seenUrls.has(urlKey)) {
        seenElements.add(target.element);
        return;
      }
      seenElements.add(target.element);
      if (urlKey) seenUrls.add(urlKey);
      list.push(target);
    }

    queryAllDeep('img, canvas, video, input[type="image"]').forEach(function (el) {
      add(directMedia(el, PAGE_SCAN_MIN));
    });
    queryAllDeep('svg').forEach(function (svg) {
      if (!(svg instanceof SVGSVGElement)) return;
      var rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var ratio = rect.width / rect.height;
      if (ratio < 0.75 || ratio > 1.35) return;
      if (rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.9) return;
      add(svgTarget(svg, 64));
    });

    var step = 140;
    try {
      for (var y = step / 2; y < window.innerHeight && list.length < 40; y += step) {
        for (var x = step / 2; x < window.innerWidth && list.length < 40; x += step) {
          var stack = document.elementsFromPoint(x, y) || [];
          for (var i = 0; i < stack.length; i++) {
            if (isOurUIElement(stack[i])) break;
            var background = backgroundTarget(stack[i], 48) || pseudoBackgroundTarget(stack[i], 48);
            if (background) {
              add(background);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error(TAG, error);
    }

    list.sort(function (a, b) { return viewportScore(b.element) - viewportScore(a.element); });
    return list.slice(0, PAGE_SCAN_LIMIT);
  }

  function decodeTarget(target, thorough, isCurrent, onProgress) {
    if (target.kind === 'image') return decodeImageElement(target, thorough, isCurrent, onProgress);
    if (target.kind === 'canvas') return decodeCanvasElement(target.element, thorough, isCurrent, onProgress);
    if (target.kind === 'video') return decodeVideoElement(target, thorough, isCurrent, onProgress);
    if (target.kind === 'svg') return decodeSvgElement(target.element, thorough, isCurrent, onProgress);
    if (target.kind === 'url') return decodeUrlList(target.urls || [target.fetchUrl || target.url], thorough, isCurrent, onProgress);
    return Promise.resolve([]);
  }

  function decodeImageElement(target, thorough, isCurrent, onProgress) {
    var img = target.element;
    var tiny = img.complete && (img.naturalWidth || 0) > 0 && img.naturalWidth <= 3 && (img.naturalHeight || 0) <= 3;
    var ready = tiny ? Promise.resolve() : whenImageReady(img).catch(function () { return null; });
    return ready.then(function () {
      if (!isCurrent()) return null;
      if (!tiny && img.naturalWidth >= 21 && img.naturalHeight >= 21 && canReadImage(img)) {
        return decodeDrawable(img, img.naturalWidth, img.naturalHeight, thorough, isCurrent, onProgress).then(function (texts) {
          if (texts == null) return null;
          if (texts.length) return texts;
          if (thorough && target.lazy && target.lazy !== target.fetchUrl) {
            return decodeUrlList([target.lazy], thorough, isCurrent, onProgress);
          }
          return texts;
        });
      }
      var urls = [];
      if (tiny && target.lazy) urls.push(target.lazy);
      else if (target.lazy && target.lazy !== target.fetchUrl) urls.push(target.lazy);
      if (target.fetchUrl) urls.push(target.fetchUrl);
      if (target.lazy && urls.indexOf(target.lazy) === -1) urls.push(target.lazy);
      if (!urls.length) throw userError('没法读取这张图片');
      return decodeUrlList(urls, thorough, isCurrent, onProgress);
    });
  }

  function decodeCanvasElement(canvas, thorough, isCurrent, onProgress) {
    if (!canReadCanvas(canvas)) return Promise.reject(userError('网站不允许读取这块画布'));
    return decodeDrawable(canvas, canvas.width, canvas.height, thorough, isCurrent, onProgress);
  }

  function decodeVideoElement(target, thorough, isCurrent, onProgress) {
    var video = target.element;
    if (video.readyState >= 2 && video.videoWidth >= 21 && canReadVideo(video)) {
      return decodeDrawable(video, video.videoWidth, video.videoHeight, thorough, isCurrent, onProgress).then(function (texts) {
        if (texts == null || texts.length || !target.fetchUrl) return texts;
        return decodeUrlList([target.fetchUrl], thorough, isCurrent, onProgress);
      });
    }
    if (target.fetchUrl) return decodeUrlList([target.fetchUrl], thorough, isCurrent, onProgress);
    return Promise.reject(userError('没法读取这段视频画面'));
  }

  function decodeSvgElement(svg, thorough, isCurrent, onProgress) {
    return rasterizeSvg(svg).then(function (image) {
      if (!isCurrent()) return null;
      return decodeDrawable(image, image.naturalWidth, image.naturalHeight, thorough, isCurrent, onProgress);
    });
  }

  function decodeUrlList(urls, thorough, isCurrent, onProgress) {
    var unique = [];
    (urls || []).forEach(function (url) {
      if (url && isReadableUrl(url) && unique.indexOf(url) === -1) unique.push(url);
    });
    if (!unique.length) return Promise.reject(userError('找不到图片地址'));
    var index = 0;
    var lastError = null;
    function next() {
      if (!isCurrent()) return null;
      if (index >= unique.length) {
        if (lastError) throw lastError;
        return [];
      }
      var url = unique[index++];
      return fetchImage(url).then(function (image) {
        if (!isCurrent()) return null;
        return decodeDrawable(image, image.naturalWidth, image.naturalHeight, thorough, isCurrent, onProgress);
      }).then(function (texts) {
        if (texts == null) return null;
        if (texts.length) return texts;
        return next();
      }, function (error) {
        lastError = error && error.isUserFacing ? error : userError('图片加载失败');
        return next();
      });
    }
    return next();
  }

  function decodeDrawable(source, width, height, thorough, isCurrent, onProgress) {
    if (!jsQRFn) return Promise.reject(userError('二维码识别组件没有加载。请重新安装脚本，并确认安装时能访问 cdn.jsdelivr.net。'));
    if (!(width >= 21) || !(height >= 21)) return Promise.reject(userError('图片太小，读不出二维码'));
    var attempts = planAttempts(width, height, thorough);
    var index = 0;
    function next() {
      if (!isCurrent()) return null;
      if (index >= attempts.length) return [];
      var attempt = attempts[index++];
      if (onProgress) onProgress(index, attempts.length);
      return yieldToBrowser().then(function () {
        if (!isCurrent()) return null;
        var imageData;
        try {
          imageData = renderRegion(source, attempt);
        } catch (error) {
          throw userError('没法读取这张图片');
        }
        var text = '';
        try {
          text = payloadOf(jsQRFn(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' }));
        } catch (error) {
          console.error(TAG, error);
          text = '';
        }
        if (text) return [text];
        return next();
      });
    }
    return next();
  }

  function planAttempts(width, height, thorough) {
    var attempts = [];
    var seen = {};
    var full = { sx: 0, sy: 0, sw: width, sh: height };
    function add(region, maxSide, smooth, pad) {
      var dest = fitSize(region.sw, region.sh, maxSide);
      var key = [region.sx, region.sy, region.sw, region.sh, dest.width, dest.height, smooth ? 1 : 0, pad].join(',');
      if (seen[key]) return;
      seen[key] = true;
      attempts.push({
        sx: region.sx,
        sy: region.sy,
        sw: region.sw,
        sh: region.sh,
        dw: dest.width,
        dh: dest.height,
        smooth: smooth,
        pad: pad
      });
    }
    add(full, 720, false, 0);
    if (thorough || Math.max(width, height) > 860) add(full, 720, true, 0);
    if (thorough) {
      add(full, 1200, false, 0);
      add(full, 720, false, 0.12);
      if (Math.max(width, height) >= 480) {
        var count = Math.max(width, height) >= 1100 ? 3 : 2;
        buildTiles(width, height, count).forEach(function (tile) {
          add(tile, 560, false, 0);
        });
      }
    }
    return attempts;
  }

  function buildTiles(width, height, count) {
    var tiles = [];
    var overlap = 0.22;
    var index = 0;
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
        tiles.push({ sx: sx, sy: sy, sw: tileW, sh: tileH, i: index++ });
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

  var sharedCanvas = null;
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

  function fetchImage(url) {
    if (!isReadableUrl(url)) return Promise.reject(userError('找不到图片地址'));
    if (url.indexOf('data:') === 0 || url.indexOf('blob:') === 0) return loadImage(url);
    return gmFetchBlob(url).then(blobToDataUrl).then(loadImage).then(function (image) {
      if (!image.naturalWidth || !image.naturalHeight) throw userError('图片尺寸无效');
      return image;
    });
  }

  function gmFetchBlob(url) {
    var requester = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;
    if (!requester && typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function') requester = GM.xmlHttpRequest;
    if (!requester) {
      return fetch(url, { credentials: 'include' }).then(function (response) {
        if (!response.ok) throw userError('图片下载失败（' + response.status + '）');
        return response.blob();
      }, function () {
        throw userError('图片下载失败');
      });
    }
    return new Promise(function (resolve, reject) {
      try {
        requester({
          method: 'GET',
          url: url,
          responseType: 'blob',
          timeout: 20000,
          headers: { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
          onload: function (response) {
            var status = Number(response.status) || 0;
            if (status >= 400 || (status && status < 200)) {
              reject(userError('图片下载失败（' + status + '）'));
              return;
            }
            var blob = normalizeBlob(response.response);
            if (!blob) reject(userError('图片下载失败'));
            else resolve(blob);
          },
          onerror: function () { reject(userError('图片下载失败')); },
          ontimeout: function () { reject(userError('图片下载超时')); },
          onabort: function () { reject(userError('图片下载已取消')); }
        });
      } catch (error) {
        reject(userError('图片下载失败'));
      }
    });
  }

  function normalizeBlob(response) {
    if (typeof Blob !== 'undefined' && response instanceof Blob) return response;
    if (response instanceof ArrayBuffer) return new Blob([response]);
    try {
      if (response && response.buffer instanceof ArrayBuffer) return new Blob([response.buffer]);
    } catch (error) {}
    return null;
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(userError('没法读取这张图片')); };
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var timer = setTimeout(function () {
        image.onload = null;
        image.onerror = null;
        reject(userError('图片加载超时'));
      }, 15000);
      image.onload = function () {
        clearTimeout(timer);
        if (!image.naturalWidth || !image.naturalHeight) {
          reject(userError('图片尺寸无效'));
          return;
        }
        resolve(image);
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
      img.addEventListener('load', function () {
        clearTimeout(timer);
        resolve(img);
      }, { once: true });
      img.addEventListener('error', function () {
        clearTimeout(timer);
        reject(userError('图片加载失败'));
      }, { once: true });
    });
  }

  function rasterizeSvg(svg) {
    var rect = svg.getBoundingClientRect();
    var scale = Math.min(2, window.devicePixelRatio || 1);
    var width = Math.max(64, Math.round((rect.width || 256) * scale));
    var height = Math.max(64, Math.round((rect.height || 256) * scale));
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    if (!clone.getAttribute('viewBox')) {
      var box = svg.viewBox && svg.viewBox.baseVal;
      if (box && box.width > 0 && box.height > 0) {
        clone.setAttribute('viewBox', box.x + ' ' + box.y + ' ' + box.width + ' ' + box.height);
      } else {
        clone.setAttribute('viewBox', '0 0 ' + Math.max(rect.width, 1) + ' ' + Math.max(rect.height, 1));
      }
    }
    var xml = new XMLSerializer().serializeToString(clone);
    var blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    return blobToDataUrl(blob).then(loadImage).catch(function () {
      throw userError('没法读取这张矢量图');
    });
  }

  function canReadImage(img) {
    return canDraw(function (ctx) { ctx.drawImage(img, 0, 0, 1, 1); });
  }

  function canReadCanvas(canvas) {
    try {
      var ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.getImageData(0, 0, 1, 1);
      return true;
    } catch (error) {
      return false;
    }
  }

  function canReadVideo(video) {
    return canDraw(function (ctx) { ctx.drawImage(video, 0, 0, 1, 1); });
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

  function queryAllDeep(selector) {
    var found = [];
    function visit(node) {
      if (!node || !node.querySelectorAll || node === host) return;
      try {
        node.querySelectorAll(selector).forEach(function (el) {
          if (!isOurUIElement(el)) found.push(el);
        });
        node.querySelectorAll('*').forEach(function (el) {
          if (el.shadowRoot && el !== host) visit(el.shadowRoot);
        });
      } catch (error) {}
    }
    visit(document);
    return found;
  }

  function ancestorHref(el) {
    if (!el || !el.closest) return '';
    var anchor = el.closest('a[href]');
    if (!anchor) return '';
    var href = absUrl(anchor.getAttribute('href') || '');
    return isHttpUrl(href) ? href : '';
  }

  function lazyUrlOf(img) {
    var names = ['data-src', 'data-original', 'data-lazy-src', 'data-echo', 'data-img'];
    for (var i = 0; i < names.length; i++) {
      var url = absUrl(img.getAttribute(names[i]) || '');
      if (isReadableUrl(url)) return url;
    }
    return '';
  }

  function parseCssUrls(value) {
    var urls = [];
    if (!value || value === 'none') return urls;
    var cursor = 0;
    while (cursor < value.length) {
      var start = value.indexOf('url(', cursor);
      if (start === -1) break;
      var i = start + 4;
      while (i < value.length && isSpace(value.charAt(i))) i++;
      var quote = value.charAt(i) === '"' || value.charAt(i) === "'" ? value.charAt(i) : '';
      var url = '';
      if (quote) {
        i++;
        while (i < value.length && value.charAt(i) !== quote) {
          url += value.charAt(i);
          i++;
        }
      } else {
        var depth = 1;
        while (i < value.length && depth > 0) {
          var ch = value.charAt(i);
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
          if (depth > 0) url += ch;
          i++;
        }
      }
      url = url.trim();
      if (url) urls.push(url);
      cursor = i + 1;
    }
    return urls;
  }

  function isSpace(ch) {
    return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f';
  }

  function boxOk(el, min) {
    if (!isShown(el)) return false;
    var rect = el.getBoundingClientRect();
    return rect.width >= min && rect.height >= min;
  }

  function isShown(el) {
    if (!el || !el.isConnected) return false;
    var style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    var opacity = Number(style.opacity);
    if (isFinite(opacity) && opacity < 0.05) return false;
    return true;
  }

  function coversViewport(el) {
    var rect = el.getBoundingClientRect();
    return rect.width > window.innerWidth * 0.92 && rect.height > window.innerHeight * 0.92;
  }

  function viewportScore(el) {
    var rect = el.getBoundingClientRect();
    var visibleW = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    var visibleH = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return visibleW * visibleH * 2 + rect.width * rect.height;
  }

  function isOurUIElement(node) {
    if (!node || node === host) return node === host;
    var root = node.getRootNode && node.getRootNode();
    return !!(root && root.host === host);
  }

  function isTypingTarget(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    if (!el || !el.closest) return false;
    var field = el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
    if (!field) return false;
    if (field instanceof HTMLInputElement) {
      var type = String(field.type || '').toLowerCase();
      if (['button', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'reset', 'submit'].indexOf(type) !== -1) return false;
    }
    return true;
  }

  function absUrl(url) {
    if (!url) return '';
    var value = String(url).trim();
    if (!value) return '';
    try {
      return new URL(value, document.baseURI).href;
    } catch (error) {
      return '';
    }
  }

  function isReadableUrl(url) {
    if (!url) return false;
    try {
      var protocol = new URL(url, document.baseURI).protocol;
      return protocol === 'http:' || protocol === 'https:' || protocol === 'data:' || protocol === 'blob:';
    } catch (error) {
      return false;
    }
  }

  function isHttpUrl(url) {
    if (!url) return false;
    try {
      var protocol = new URL(url, document.baseURI).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch (error) {
      return false;
    }
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

  function payloadOf(code) {
    if (!code || typeof code.data !== 'string') return '';
    return code.data;
  }

  function copyText(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return Promise.resolve(true);
      }
    } catch (error) {
      console.error(TAG, error);
    }
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
    area.style.top = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
    area.remove();
    return ok;
  }

  function selectElement(el) {
    if (!el) return;
    var selection = window.getSelection && window.getSelection();
    if (!selection) return;
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

  function inTopWindow() {
    try { return window.top === window; } catch (error) { return true; }
  }

  function resolveJsQR() {
    var candidates = [];
    try { if (typeof jsQR === 'function') candidates.push(jsQR); } catch (error) {}
    try { if (typeof globalThis !== 'undefined') candidates.push(globalThis.jsQR); } catch (error) {}
    try { if (typeof self !== 'undefined') candidates.push(self.jsQR); } catch (error) {}
    try { if (typeof module !== 'undefined' && module.exports) candidates.push(module.exports); } catch (error) {}
    for (var i = 0; i < candidates.length; i++) {
      var decoder = asDecoder(candidates[i]);
      if (decoder) return decoder;
    }
    return null;
  }

  function asDecoder(value) {
    if (typeof value === 'function') return value;
    if (value && typeof value.default === 'function') return value.default;
    return null;
  }
})();
