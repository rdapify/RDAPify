(function () {
  function init() {
    if (!window.Paddle) { setTimeout(init, 100); return; }
    window.Paddle.Environment.set('sandbox');
    window.Paddle.Initialize({ clientToken: 'test_d6223301dd42e130437c8632d68' });
    window.__paddleReady = true;
  }
  init();
})();
