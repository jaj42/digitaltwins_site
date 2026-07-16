/* Hero signature: an arterial pressure trace (measured) with a model-driven
   twin converging onto it.
 *
 * This is a schematic, not patient data. The waveform comes from a pulse model
 * — percussion wave, tidal wave, dicrotic notch, diastolic runoff. Every so
 * often the patient's state steps (a vasopressor or a hypnotic takes effect);
 * the twin is left holding the old parameters and has to re-fit, which is the
 * "continuous real-time recalibration" the team's own monitor prototype does.
 * The agreement figure is computed from the two traces actually on screen, so
 * it is honest about the animation while claiming nothing about a real patient.
 * The markup labels the panel as a schematic; keep that label if you edit this.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("twin-wave");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var readout = document.getElementById("twin-agreement");

  var css = getComputedStyle(document.documentElement);
  function token(name, fallback) {
    return (css.getPropertyValue(name) || "").trim() || fallback;
  }
  var COL_MEASURED = token("--color-trace-measured", "#ff5347");
  var COL_MODELLED = token("--color-trace-modelled", "#cb79c2");
  var COL_GRID = token("--color-instrument-rule", "#2e2739");

  var HR = 62 / 60; // beats per second — a calm anaesthetised adult
  var PX_PER_SEC = 78;
  var PAD = 0.14; // vertical padding, fraction of panel height

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function gauss(x, mu, sigma) {
    var d = (x - mu) / sigma;
    return Math.exp(-0.5 * d * d);
  }

  /* One cardiac cycle. contractility scales the percussion wave; resistance
     lifts the diastolic runoff and deepens the dicrotic wave. */
  function pulse(phase, p) {
    var x = phase - Math.floor(phase);
    return (
      p.contractility * gauss(x, 0.15, 0.048) + // percussion (systolic peak)
      0.44 * gauss(x, 0.29, 0.062) - // tidal wave
      0.14 * gauss(x, 0.4, 0.022) + // dicrotic notch (incisura)
      p.resistance * 0.34 * gauss(x, 0.47, 0.055) + // dicrotic wave
      0.42 * Math.exp(-1.35 * x) * p.resistance // diastolic runoff
    );
  }

  /* Physiological states the patient steps between — roughly baseline, then
     under a vasopressor, then under a deepening hypnotic. */
  var STATES = [
    { contractility: 1.0, resistance: 1.0 },
    { contractility: 1.2, resistance: 1.34 },
    { contractility: 0.84, resistance: 0.78 },
  ];
  /* The twin's parameter error at the moment each state changes. */
  var ERRORS = [
    { contractility: -0.4, resistance: 0.5, dt: 0.075 },
    { contractility: 0.34, resistance: -0.46, dt: -0.06 },
    { contractility: -0.3, resistance: 0.42, dt: 0.07 },
  ];

  var CYCLE = 9.5; // seconds between state changes
  var TAU = 1.9; // convergence time constant
  var SETTLE = 0.35; // the twin notices the change this late

  function stateIndex(t) {
    return Math.floor(t / CYCLE);
  }

  function trueAt(t) {
    var s = STATES[((stateIndex(t) % STATES.length) + STATES.length) % STATES.length];
    return { contractility: s.contractility, resistance: s.resistance, dt: 0 };
  }

  function twinAt(t) {
    var k = stateIndex(t);
    var s = trueAt(t);
    var e = ERRORS[((k % ERRORS.length) + ERRORS.length) % ERRORS.length];
    var phase = t - k * CYCLE;
    var remaining =
      phase <= SETTLE ? 1 : Math.exp(-(phase - SETTLE) / TAU);
    return {
      contractility: s.contractility + e.contractility * remaining,
      resistance: s.resistance + e.resistance * remaining,
      dt: e.dt * remaining,
    };
  }

  /* Normalise against the true pulse's own range so the trace fills the panel
     rather than hugging the floor. Sampled across every state. */
  var LO = Infinity,
    HI = -Infinity;
  (function () {
    for (var s = 0; s < STATES.length; s++) {
      var p = { contractility: STATES[s].contractility, resistance: STATES[s].resistance };
      for (var x = 0; x < 1; x += 0.002) {
        var v = pulse(x, p);
        if (v < LO) LO = v;
        if (v > HI) HI = v;
      }
    }
    var span = HI - LO;
    LO -= span * 0.04;
    HI += span * 0.04;
  })();

  function norm(v) {
    return (v - LO) / (HI - LO);
  }

  var w = 0,
    h = 0,
    dpr = 1,
    windowSec = 12;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    w = Math.max(rect.width, 1);
    h = Math.max(rect.height, 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    windowSec = w / PX_PER_SEC;
  }

  function yOf(v) {
    var top = h * PAD;
    var bot = h * (1 - PAD);
    return bot - norm(v) * (bot - top);
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = COL_GRID;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gy = 1; gy <= 3; gy++) {
      var y = Math.round((h / 4) * gy) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function trace(tNow, paramsAt, color, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    var moved = false;
    for (var x = 0; x <= w; x += 1) {
      var t = tNow - (w - x) / PX_PER_SEC;
      if (t < 0) continue;
      var p = paramsAt(t);
      var y = yOf(pulse((t + p.dt) * HR, p));
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /* Agreement across the visible window: 1 - normalised RMS error. */
  function agreement(tNow) {
    var n = 0,
      se = 0;
    for (var x = 0; x <= w; x += 3) {
      var t = tNow - (w - x) / PX_PER_SEC;
      if (t < 0) continue;
      var tp = twinAt(t);
      var sp = trueAt(t);
      var a = norm(pulse(t * HR, sp));
      var b = norm(pulse((t + tp.dt) * HR, tp));
      se += (a - b) * (a - b);
      n++;
    }
    if (!n) return 0;
    return Math.max(0, 1 - Math.sqrt(se / n) * 2.2);
  }

  function render(tNow) {
    ctx.clearRect(0, 0, w, h);
    drawGrid();
    trace(tNow, twinAt, COL_MODELLED, 1.5);
    trace(tNow, trueAt, COL_MEASURED, 1.9);
    if (readout) readout.textContent = (agreement(tNow) * 100).toFixed(1) + "%";
  }

  var t0 = null;
  var raf = null;
  var running = false;

  /* Start with the window already full of history, so the panel never shows a
     half-drawn trace waiting for time to pass. */
  function clock(ts) {
    return windowSec + (ts - t0) / 1000;
  }

  function frame(ts) {
    if (t0 === null) t0 = ts;
    render(clock(ts));
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced.matches) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    t0 = null; // resume from a full window rather than mid-sweep
  }

  /* Reduced motion, or paused: a full window, caught just after the twin has
     re-converged — the same story the animation tells, held still. */
  function still() {
    stop();
    resize();
    render(windowSec + CYCLE - 0.5);
  }

  resize();

  function onResize() {
    resize();
    if (!running) still();
  }
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(canvas);
  else window.addEventListener("resize", onResize);

  if (reduced.matches) {
    still();
  } else {
    still(); // paint a full window immediately, before the first frame lands
    if (window.IntersectionObserver) {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) start();
            else stop();
          });
        },
        { threshold: 0.05 }
      ).observe(canvas);
    } else {
      start();
    }
  }

  if (reduced.addEventListener) {
    reduced.addEventListener("change", function () {
      if (reduced.matches) still();
      else start();
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (!reduced.matches) start();
  });
})();
