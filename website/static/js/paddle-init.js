(function () {
  var TOKEN = 'test_d6223301dd42e130437c8632d68';
  var ENV = 'sandbox';

  function init() {
    if (!window.Paddle) { setTimeout(init, 200); return; }
    try {
      if (ENV !== 'production') {
        window.Paddle.Environment.set(ENV);
      }
    } catch (e) {
      console.warn('[paddle-init] Environment.set failed:', e);
    }
    try {
      window.Paddle.Initialize({ token: TOKEN, environment: ENV });
    } catch (e1) {
      try {
        window.Paddle.Initialize({ clientToken: TOKEN, environment: ENV });
      } catch (e2) {
        console.error('[paddle-init] Initialize failed:', e2);
        return;
      }
    }
    window.__paddleReady = true;
    console.log('[paddle-init] ready');
  }
  init();
})();
