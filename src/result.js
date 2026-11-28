(async function () {
  var stored = await chrome.storage.session.get('openQrcodePayload');
  var payload = stored && stored.openQrcodePayload;
  if (!payload) {
    payload = {
      requestId: Date.now(),
      phase: 'decode',
      mediaType: 'image',
      srcUrl: '',
      dataUrl: '',
      fetchError: '没有可识别的图片'
    };
  }
  if (typeof openQrcodeStart === 'function') await openQrcodeStart(payload);
})();
