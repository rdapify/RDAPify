(function () {
  function init() {
    if (!window.Paddle) { setTimeout(init, 200); return; }
    // Read config from Docusaurus-injected global (set by inline script in pricing page)
    var cfg = window.__paddleConfig || {};
    var env = cfg.environment || 'production';
    var token = cfg.token || '';
    if (!token) return;
    if (env !== 'production') window.Paddle.Environment.set(env);
    window.Paddle.Initialize({ token: token });
    window.__paddleReady = true;
  }
  init();
})();
