(function () {
  function init() {
    if (!window.Paddle) { setTimeout(init, 200); return; }
    window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({ token: 'test_d6223301dd42e130437c8632d68' });
    window.__paddleReady = true;
  }
  init();
})();
