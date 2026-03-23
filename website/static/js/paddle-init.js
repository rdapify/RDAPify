(function () {
  function init() {
    // انتظر تحميل Paddle.js وإعداد __paddleConfig من React
    if (!window.Paddle || !window.__paddleConfig) {
      setTimeout(init, 200);
      return;
    }
    var cfg = window.__paddleConfig;
    var env = cfg.environment || 'production';
    var token = cfg.token || '';
    if (!token) return;
    if (env !== 'production') window.Paddle.Environment.set(env);
    window.Paddle.Initialize({ token: token });
    window.__paddleReady = true;
  }
  init();
})();
