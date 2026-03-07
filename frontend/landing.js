/**
 * Cortex — Scroll-Controlled Hero  (revised)
 *
 * STAGE MAP  (progress 0→1  over 700vh)
 * ─────────────────────────────────────
 *  0.00 → 0.12   Stage 0  Ambient particle cloud
 *  0.12 → 0.26   Stage 1  Particles converge → CORTEX  (canvas-text rendered, bold)
 *  0.26 → 0.56   Stage 2  CORTEX holds: energy scan pulses left→right
 *  0.56 → 0.67   Stage 3  Particles burst outward + shrink → vanish
 *  0.65 → 0.79   Stage 4  Neural rain fades in  |  Prod-grid cards fly in
 *  0.76 → 0.93   Stage 5  "Enhance Your Productivity" tagline — holds for ~3 s of scroll
 *  0.93 → 1.00   Stage 6  CTA fades in, curtain wipes, below-fold revealed
 */

(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  function rand(a, b)      { return a + Math.random() * (b - a); }
  function lerp(a, b, t)   { return a + (b - a) * t; }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function ss(lo, hi, t)   { t = clamp((t-lo)/(hi-lo),0,1); return t*t*(3-2*t); }
  function eio(t)          { return t<0.5 ? 2*t*t : -1+(4-2*t)*t; }

  /* ── stage breakpoints ───────────────────────────────────── */
  const S = {
    FORM_START   : 0.12,
    FORM_END     : 0.26,
    HOLD_END     : 0.56,
    VANISH_END   : 0.67,
    RAIN_START   : 0.65,
    GRID_START   : 0.68,
    TAG_START    : 0.77,
    TAG_HOLD_END : 0.93,
    CURTAIN      : 0.95,
  };

  /* ── GSAP ScrollTrigger ──────────────────────────────────── */
  gsap.registerPlugin(ScrollTrigger);
  const SO = { p: 0 };
  ScrollTrigger.create({
    trigger: '#scroll-container',
    start:   'top top',
    end:     'bottom bottom',
    scrub:   1.0,
    onUpdate: self => { SO.p = self.progress; },
  });

  /* ── THREE.JS renderer / scene / camera ─────────────────── */
  const threeCanvas = $('cortex-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor('#05070A', 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.01, 200);
  camera.position.z = 10;

  /* ── 2-D rain canvas ─────────────────────────────────────── */
  const rainCanvas = $('rain-canvas');
  const rainCtx    = rainCanvas.getContext('2d');
  rainCanvas.width  = innerWidth;
  rainCanvas.height = innerHeight;

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    rainCanvas.width  = innerWidth;
    rainCanvas.height = innerHeight;
  });

  /* ── glow sprite texture ─────────────────────────────────── */
  function makeGlowTex(sz) {
    const c = document.createElement('canvas');
    c.width = c.height = sz;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(sz/2,sz/2,0, sz/2,sz/2,sz/2);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.3,  'rgba(255,255,255,0.75)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.15)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, sz, sz);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = makeGlowTex(64);

  /* ── CORTEX positions via canvas-text pixel sampling ────────
     Renders bold "CORTEX" off-screen, samples lit pixels →
     perfectly formed, full-weight letters every time.
  ─────────────────────────────────────────────────────────── */
  function buildCortexTarget(N) {
    const CW = 720, CH = 140;
    const c = document.createElement('canvas');
    c.width = CW; c.height = CH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 98px Arial, Helvetica, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CORTEX', CW / 2, CH / 2);

    const px = ctx.getImageData(0, 0, CW, CH).data;
    const pts = [];
    const STEP = 4;
    for (let x = 0; x < CW; x += STEP) {
      for (let y = 0; y < CH; y += STEP) {
        if (px[(y * CW + x) * 4] > 110) {
          pts.push({
            x: (x - CW / 2) / (CW * 0.108),
            y: (CH / 2 - y) / (CH * 0.52),
          });
        }
      }
    }

    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const s = pts[i % pts.length];
      out[i*3]   = s.x + rand(-0.022, 0.022);
      out[i*3+1] = s.y + rand(-0.022, 0.022);
      out[i*3+2] = rand(-0.14, 0.14);
    }
    return out;
  }

  /* ── particle system ─────────────────────────────────────── */
  const N  = 5000;
  const CB = new THREE.Color('#00D4FF');
  const CP = new THREE.Color('#7A5CFF');

  const pos0    = new Float32Array(N * 3);
  const col0    = new Float32Array(N * 3);
  const size0   = new Float32Array(N);
  const driftPh = new Float32Array(N);
  const driftAm = new Float32Array(N);
  const driftSp = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const th = rand(0, Math.PI*2), ph = Math.acos(rand(-1,1)), r = rand(2,10);
    pos0[i*3]   = r * Math.sin(ph) * Math.cos(th);
    pos0[i*3+1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
    pos0[i*3+2] = r * Math.cos(ph) - 2;
    const t = Math.random();
    col0[i*3]   = lerp(CB.r, CP.r, t);
    col0[i*3+1] = lerp(CB.g, CP.g, t);
    col0[i*3+2] = lerp(CB.b, CP.b, t);
    size0[i]    = rand(0.05, 0.20);
    driftPh[i]  = rand(0, Math.PI*2);
    driftAm[i]  = rand(0.02, 0.10);
    driftSp[i]  = rand(0.3, 1.1);
  }

  const posC = buildCortexTarget(N);

  /* ── THREE geometry + shader material ───────────────────── */
  const geo  = new THREE.BufferGeometry();
  const aPOS = new THREE.BufferAttribute(pos0.slice(), 3);
  const aCOL = new THREE.BufferAttribute(col0.slice(), 3);
  const aSIZ = new THREE.BufferAttribute(size0.slice(), 1);
  aPOS.setUsage(THREE.DynamicDrawUsage);
  aCOL.setUsage(THREE.DynamicDrawUsage);
  aSIZ.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPOS);
  geo.setAttribute('color',    aCOL);
  geo.setAttribute('pSize',    aSIZ);

  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex:         { value: glowTex },
      uGlobalAlpha: { value: 1.0 },
    },
    vertexShader: `
      attribute float pSize;
      attribute vec3  color;
      varying   vec3  vCol;
      varying   float vA;
      uniform   float uGlobalAlpha;
      void main() {
        vCol = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(pSize * (320.0 / -mv.z), 1.5, 22.0);
        vA = uGlobalAlpha * clamp(1.0 - (-mv.z - 1.5) / 22.0, 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uTex;
      varying vec3  vCol;
      varying float vA;
      void main() {
        float a = texture2D(uTex, gl_PointCoord).r * vA;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vCol * 1.9, a);
      }`,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  const pPoints = new THREE.Points(geo, pMat);
  scene.add(pPoints);

  const wPos = pos0.slice();
  const tPos = new Float32Array(N * 3);

  /* ── position computation per stage ─────────────────────── */
  function computePos(p, time, out) {
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const x0 = pos0[i3],  y0 = pos0[i3+1], z0 = pos0[i3+2];
      const xC = posC[i3],  yC = posC[i3+1], zC = posC[i3+2];
      const drift = driftAm[i] * Math.sin(time * driftSp[i] + driftPh[i]);
      let tx, ty, tz;

      if (p < S.FORM_START) {
        tx = x0 + drift; ty = y0 + drift * 0.7; tz = z0;

      } else if (p < S.FORM_END) {
        const t = ss(S.FORM_START, S.FORM_END, p);
        tx = lerp(x0, xC, t) + drift * (1 - t);
        ty = lerp(y0, yC, t) + drift * (1 - t) * 0.7;
        tz = lerp(z0, zC, t);

      } else if (p < S.HOLD_END) {
        // CORTEX holds — subtle micro-motion keeps it alive
        const micro = 0.009 * Math.sin(time * 1.3 + driftPh[i]);
        tx = xC + micro; ty = yC + micro * 0.55; tz = zC;

      } else {
        // Burst outward from CORTEX, then shrink/vanish
        const t   = ss(S.HOLD_END, S.VANISH_END, p);
        const ang = (i / N) * Math.PI * 18 + driftPh[i];
        const spd = t * t * (2.8 + size0[i] * 5.5);
        tx = xC + Math.cos(ang) * spd * 0.5;
        ty = yC + Math.sin(ang) * spd * 0.35;
        tz = zC - t * t * 2.0;
      }

      out[i3] = tx; out[i3+1] = ty; out[i3+2] = tz;
    }
  }

  /* ── colour + size (energy scan sweeps across CORTEX) ───── */
  function updateColours(p, time) {
    const pulse  = (time * 1.4) % 1.0;
    const colArr = aCOL.array;
    const sizArr = aSIZ.array;
    const shrink = p >= S.HOLD_END
      ? Math.max(0, 1 - ss(S.HOLD_END, S.VANISH_END, p) * 1.9)
      : 1.0;

    for (let i = 0; i < N; i++) {
      const i3 = i * 3, ni = i / N;
      const t = (Math.sin(ni * 37.3 + time * 0.4) + 1) * 0.5;
      let r = lerp(CB.r, CP.r, t);
      let g = lerp(CB.g, CP.g, t);
      let b = lerp(CB.b, CP.b, t);

      if (p >= S.FORM_START && p < S.HOLD_END) {
        const intensity = p < S.FORM_END ? ss(S.FORM_START, S.FORM_END, p) : 1.0;
        const scanX = lerp(-3.6, 3.6, pulse);
        const dist  = Math.abs(posC[i3] - scanX);
        const pv    = Math.max(0, 1 - dist / 0.48) * intensity * 1.7;
        r = Math.min(1, r + pv);
        g = Math.min(1, g + pv * 0.55);
        b = Math.min(1, b + pv * 0.18);
        sizArr[i] = size0[i] * (1 + pv * 1.15) * shrink;
      } else {
        sizArr[i] = size0[i] * shrink;
      }

      colArr[i3] = r; colArr[i3+1] = g; colArr[i3+2] = b;
    }
    aCOL.needsUpdate = aSIZ.needsUpdate = true;
  }

  /* ── 2-D neural rain ─────────────────────────────────────── */
  const COL_W   = 28;
  const NUM_COL = Math.ceil(innerWidth / COL_W) + 2;
  const RAIN_CHARS = '01アイウエオカキクケコサシスセソタチツテトナニ∑∇∂∞∫ΩΔΨΦξζη⊗⊕⟶↑↓∧∨⊃⊂'.split('');
  const rainCols = Array.from({ length: NUM_COL }, (_, ci) => ({
    x:     ci * COL_W,
    y:     rand(-innerHeight * 1.5, 0),
    speed: rand(1.8, 4.5),
    len:   Math.floor(rand(5, 18)),
    chars: Array.from({ length: 25 }, () =>
           RAIN_CHARS[(Math.random() * RAIN_CHARS.length) | 0]),
  }));

  function tickRain(dt, alpha) {
    if (alpha < 0.002) { rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height); return; }
    rainCtx.fillStyle = `rgba(5,7,10,${0.18 + (1 - alpha) * 0.1})`;
    rainCtx.fillRect(0, 0, rainCanvas.width, rainCanvas.height);
    rainCtx.font = `${Math.round(COL_W * 0.72)}px monospace`;
    rainCols.forEach(col => {
      col.y += col.speed * dt * 60;
      if (col.y > rainCanvas.height + col.len * COL_W) {
        col.y     = rand(-200, -30);
        col.speed = rand(1.8, 4.5);
        col.chars[0] = RAIN_CHARS[(Math.random() * RAIN_CHARS.length) | 0];
      }
      for (let k = 0; k < col.len; k++) {
        const cy = col.y - k * COL_W;
        if (cy < -COL_W || cy > rainCanvas.height + COL_W) continue;
        const bright = k === 0 ? 1 : (1 - k / col.len) * 0.7;
        rainCtx.fillStyle = k === 0
          ? `rgba(200,240,255,${alpha * bright})`
          : `rgba(0,180,220,${alpha * bright * 0.65})`;
        rainCtx.fillText(col.chars[k % col.chars.length], col.x, cy);
      }
    });
  }

  /* ── DOM references ──────────────────────────────────────── */
  const scrollHint = $('scroll-hint');
  const heroTag    = $('hero-tagline');
  const ctaWrap    = $('cta-wrap');
  const curtain    = $('curtain');

  // Float-cards are not used in this flow — hide permanently
  ['fc-doc','fc-brain','fc-math','fc-note','fc-graph','fc-code'].forEach(id => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });

  /* ── camera ──────────────────────────────────────────────── */
  const cam = { tz: 10, cz: 10, cx: 0, cy: 0 };

  function updateCamera(p, time) {
    if      (p < S.FORM_START)  cam.tz = lerp(10,  7.5, ss(0, S.FORM_START, p));
    else if (p < S.HOLD_END)    cam.tz = lerp(7.5, 5.5, ss(S.FORM_START, S.HOLD_END, p));
    else if (p < S.VANISH_END)  cam.tz = lerp(5.5, 3.5, ss(S.HOLD_END,   S.VANISH_END, p));
    else                        cam.tz = 3.5;
    cam.cz += (cam.tz - cam.cz) * 0.04;
    cam.cx += (Math.sin(time * 0.13) * 0.07 - cam.cx) * 0.04;
    cam.cy += (Math.cos(time * 0.09) * 0.04 - cam.cy) * 0.04;
    camera.position.set(cam.cx, cam.cy, cam.cz);
    camera.lookAt(0, 0, 0);
  }

  /* ── main RAF loop ───────────────────────────────────────── */
  let time = 0;
  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    const p = SO.p;

    updateCamera(p, time);

    // particle positions
    computePos(p, time, tPos);
    const lerpSp = 0.065 + p * 0.02;
    for (let i = 0; i < N * 3; i++) wPos[i] += (tPos[i] - wPos[i]) * lerpSp;
    aPOS.array.set(wPos);
    aPOS.needsUpdate = true;
    updateColours(p, time);

    // Global alpha: fades out as particles burst/shrink after HOLD_END
    pMat.uniforms.uGlobalAlpha.value = p < S.HOLD_END
      ? 1.0
      : Math.max(0, 1 - ss(S.HOLD_END, S.VANISH_END, p) * 2.0);

    // Three.js canvas CSS opacity: fully hide WebGL canvas after vanish
    threeCanvas.style.opacity = p < S.VANISH_END
      ? 1
      : Math.max(0, 1 - ss(S.VANISH_END, S.VANISH_END + 0.05, p));

    // neural rain — keeps flowing all the way to the end
    const rainAlpha = ss(S.RAIN_START, S.RAIN_START + 0.09, p);
    rainCanvas.style.opacity = rainAlpha;
    tickRain(dt, rainAlpha);

    // scroll hint
    scrollHint.style.opacity = Math.max(0, 1 - p * 12);

    // hero tagline: fades in at TAG_START and stays visible
    const tagIn = ss(S.TAG_START, S.TAG_START + 0.055, p);
    heroTag.style.opacity   = tagIn;
    heroTag.style.transform = `translateY(${lerp(22, 0, eio(tagIn))}px)`;

    // CTA button: slight stagger after tagline, stays visible
    const ctaIn = ss(S.TAG_START + 0.04, S.TAG_START + 0.10, p);
    ctaWrap.style.opacity       = ctaIn;
    ctaWrap.style.transform     = `translateY(${lerp(16, 0, eio(ctaIn))}px)`;
    ctaWrap.style.pointerEvents = ctaIn > 0.4 ? 'auto' : 'none';

    renderer.render(scene, camera);
  }

  for (let i = 0; i < N * 3; i++) wPos[i] = pos0[i];
  tick();

  // ── CTA click: fade-to-black then launch main app ────────────────────────
  const ctaBtn = $('cta-btn');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', function () {
      curtain.style.transition    = 'opacity 0.5s ease';
      curtain.style.opacity       = '1';
      curtain.style.pointerEvents = 'auto';
      setTimeout(function () {
        if (window.electronAPI && window.electronAPI.launchApp) {
          window.electronAPI.launchApp();
        }
      }, 500);
    });
  }

})();
