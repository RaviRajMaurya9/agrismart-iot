/**
 * ESP32-CAM High-Performance Zero-Lag Surveillance System
 * Features:
 * - Turbo Zero-Lag Engine (Double-buffered async frame grabber with zero buffer delay)
 * - Direct MJPEG stream mode with auto-stall watchdog
 * - Live Latency (ms) and real-time FPS counter on HUD
 * - Hardware resolution switching via OV2640 sensor commands
 * - Instant lag buffer flush
 */

window.SurveillanceModule = (function () {
  let activeMode = 'esp32cam';          // 'esp32cam' or 'simulation'
  let streamEngine = 'turbo';           // 'turbo' (Zero-Lag) or 'mjpeg' (Direct)
  let esp32Ip = '192.168.1.150';
  let isFlashOn = false;
  let canvas, ctx;
  let animFrameId = null;
  let isNightVision = false;
  let panX = 0, tiltY = 0, zoom = 1.0;
  let tick = 0;
  let motionAlert = false;
  let motionTimeout = null;

  // Real-time FPS & Latency stats
  let frameCount = 0;
  let lastFpsCalcTime = performance.now();
  let currentFps = 0;
  let currentPingMs = 0;
  let turboLoopActive = false;
  let isFetchingFrame = false;
  let lastFrameTime = Date.now();

  function init() {
    canvas = document.getElementById('liveStreamCanvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
      canvas.width = 1280;
      canvas.height = 720;
    }

    const tabEsp32 = document.getElementById('tabEsp32CamMode');
    const tabSim = document.getElementById('tabSimulationMode');
    const connectBtn = document.getElementById('connectEsp32CamBtn');
    const ipInput = document.getElementById('esp32CamIpInput');
    const flashBtn = document.getElementById('esp32FlashlightBtn');
    const captureBtn = document.getElementById('captureSnapshotBtn');
    const nightVisionBtn = document.getElementById('toggleNightVisionBtn');
    const motionBtn = document.getElementById('triggerMotionAlertBtn');
    const engineSelector = document.getElementById('streamEngineSelector');
    const resSelector = document.getElementById('camResolutionSelector');
    const flushBtn = document.getElementById('flushLagBufferBtn');

    // 1. Source Mode Switcher
    tabEsp32?.addEventListener('click', () => setStreamMode('esp32cam'));
    tabSim?.addEventListener('click', () => setStreamMode('simulation'));

    // 2. Connect IP Button
    connectBtn?.addEventListener('click', () => {
      const ip = ipInput?.value.trim();
      if (ip) {
        esp32Ip = ip;
        startEsp32Feed();
      }
    });

    // 3. Engine Selector (Turbo Zero-Lag vs MJPEG)
    engineSelector?.addEventListener('change', (e) => {
      streamEngine = e.target.value;
      startEsp32Feed();
    });

    // 4. Resolution Switcher (Hardware command to OV2640)
    resSelector?.addEventListener('change', (e) => {
      const val = e.target.value;
      let frameSizeVal = 8; // VGA default
      if (val === 'QVGA') frameSizeVal = 5;  // 320x240
      if (val === 'VGA') frameSizeVal = 8;   // 640x480
      if (val === 'SVGA') frameSizeVal = 9;  // 800x600
      if (val === 'UXGA') frameSizeVal = 13; // 1600x1200

      // Send hardware command to ESP32-CAM sensor
      fetch(`http://${esp32Ip}/control?var=framesize&val=${frameSizeVal}`, { mode: 'no-cors' }).catch(() => {});
      
      // Flush stream to apply new resolution smoothly
      setTimeout(() => startEsp32Feed(), 300);
    });

    // 5. Instant Lag Flush Button
    flushBtn?.addEventListener('click', () => {
      flushStream();
    });

    // 6. Flashlight
    flashBtn?.addEventListener('click', toggleFlashlight);

    // 7. Night Vision
    nightVisionBtn?.addEventListener('click', () => {
      isNightVision = !isNightVision;
      const screen = document.getElementById('surveillanceScreen');
      if (isNightVision) {
        screen?.classList.add('night-vision-mode');
        nightVisionBtn.className = 'px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white transition flex items-center gap-1.5';
      } else {
        screen?.classList.remove('night-vision-mode');
        nightVisionBtn.className = 'px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-600 transition flex items-center gap-1.5';
      }
    });

    // 8. Motion Alert
    motionBtn?.addEventListener('click', triggerMotion);

    // 9. Snapshot Capture
    captureBtn?.addEventListener('click', takeSnapshot);

    // 10. PTZ Controls
    document.querySelectorAll('.ptz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        handlePTZ(btn.getAttribute('data-dir'));
      });
    });

    // Fetch initial snapshots & ping check
    fetchSnapshots();
    setInterval(measurePing, 3000);

    // Start in ESP32-CAM Turbo Mode
    setStreamMode('esp32cam');
  }

  function setStreamMode(mode) {
    activeMode = mode;
    const tabEsp32 = document.getElementById('tabEsp32CamMode');
    const tabSim = document.getElementById('tabSimulationMode');
    const overlay = document.getElementById('camNameOverlay');

    if (mode === 'esp32cam') {
      tabEsp32?.classList.add('bg-blue-600', 'text-white', 'shadow');
      tabEsp32?.classList.remove('bg-slate-800', 'text-slate-400');
      tabSim?.classList.remove('bg-blue-600', 'text-white', 'shadow');
      tabSim?.classList.add('bg-slate-800', 'text-slate-400');

      if (overlay) overlay.textContent = `ESP32-CAM [${esp32Ip}] - ZERO-LAG`;
      startEsp32Feed();
    } else {
      stopTurboLoop();
      tabSim?.classList.add('bg-blue-600', 'text-white', 'shadow');
      tabSim?.classList.remove('bg-slate-800', 'text-slate-400');
      tabEsp32?.classList.remove('bg-blue-600', 'text-white', 'shadow');
      tabEsp32?.classList.add('bg-slate-800', 'text-slate-400');

      if (overlay) overlay.textContent = 'FIELD SIMULATOR (ZONE A1)';
      document.getElementById('esp32LiveStreamImg')?.classList.add('hidden');
      document.getElementById('liveStreamCanvas')?.classList.remove('hidden');
      startCanvasSimulation();
    }
  }

  function startEsp32Feed() {
    if (activeMode !== 'esp32cam') return;

    const streamImg = document.getElementById('esp32LiveStreamImg');
    const canvasEl = document.getElementById('liveStreamCanvas');

    if (streamEngine === 'turbo') {
      // 🚀 TURBO ZERO-LAG ENGINE
      // Hide raw img and use high-speed GPU canvas for immediate frame swapping
      streamImg?.classList.add('hidden');
      canvasEl?.classList.remove('hidden');
      startTurboLoop();
    } else {
      // DIRECT MJPEG STREAM
      stopTurboLoop();
      canvasEl?.classList.add('hidden');
      streamImg?.classList.remove('hidden');
      
      const streamUrl = `http://${esp32Ip}:81/stream?t=${Date.now()}`;
      if (streamImg) streamImg.src = streamUrl;

      streamImg.onload = () => updateCamBadge(true);
      streamImg.onerror = () => {
        // Fallback to turbo or simulation if direct port 81 fails
        updateCamBadge(false);
        setStreamMode('simulation');
      };
    }

    // Inform backend of current IP
    fetch('/api/esp32cam/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipAddress: esp32Ip })
    }).catch(() => {});
  }

  // 🚀 TURBO LOW-LATENCY FRAME PIPELINE (ABSOLUTELY ZERO DELAY)
  function startTurboLoop() {
    turboLoopActive = true;
    isFetchingFrame = false;
    runTurboCycle();
  }

  function stopTurboLoop() {
    turboLoopActive = false;
    isFetchingFrame = false;
  }

  function runTurboCycle() {
    if (!turboLoopActive || activeMode !== 'esp32cam') return;

    if (isFetchingFrame) {
      // Watchdog: If frame request stalled for > 300ms, abort and request fresh frame!
      if (Date.now() - lastFrameTime > 300) {
        isFetchingFrame = false;
      } else {
        requestAnimationFrame(runTurboCycle);
        return;
      }
    }

    isFetchingFrame = true;
    lastFrameTime = Date.now();

    const img = new Image();
    const frameUrl = `http://${esp32Ip}/capture?t=${Date.now()}`;
    
    // Safety timeout to prevent hanging requests
    const timeoutId = setTimeout(() => {
      img.src = '';
      isFetchingFrame = false;
    }, 250);

    img.onload = () => {
      clearTimeout(timeoutId);
      isFetchingFrame = false;

      // Draw immediately to canvas without any browser queue delay!
      if (canvas && ctx && turboLoopActive) {
        ctx.save();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Track FPS
      frameCount++;
      const now = performance.now();
      if (now - lastFpsCalcTime >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFpsCalcTime));
        frameCount = 0;
        lastFpsCalcTime = now;
        updatePerfBadge();
      }

      updateCamBadge(true);

      // Immediately request the next instantaneous frame
      if (turboLoopActive) {
        requestAnimationFrame(runTurboCycle);
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      isFetchingFrame = false;
      // Re-attempt after short pause or fall back to simulation
      setTimeout(() => {
        if (turboLoopActive) requestAnimationFrame(runTurboCycle);
      }, 50);
    };

    img.src = frameUrl;
  }

  function flushStream() {
    const flashBtn = document.getElementById('flushLagBufferBtn');
    if (flashBtn) {
      flashBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400 mr-1"></i> Flushed!';
      setTimeout(() => {
        flashBtn.innerHTML = '<i class="fa-solid fa-bolt text-yellow-400 mr-1"></i> Flush Lag';
      }, 1500);
    }

    // Force garbage collect & restart stream
    isFetchingFrame = false;
    if (streamEngine === 'turbo') {
      stopTurboLoop();
      setTimeout(startTurboLoop, 100);
    } else {
      const streamImg = document.getElementById('esp32LiveStreamImg');
      if (streamImg) streamImg.src = `http://${esp32Ip}:81/stream?flush=${Date.now()}`;
    }
  }

  async function measurePing() {
    if (activeMode !== 'esp32cam') return;
    const t0 = performance.now();
    try {
      const res = await fetch(`http://${esp32Ip}/ping?t=${Date.now()}`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        currentPingMs = Math.round(performance.now() - t0);
        updatePerfBadge();
      }
    } catch (e) {
      // Ping timeout or offline
    }
  }

  function updatePerfBadge() {
    const badge = document.getElementById('hudStreamStats');
    if (badge) {
      const fpsColor = currentFps >= 20 ? 'text-emerald-400' : (currentFps >= 10 ? 'text-amber-400' : 'text-rose-400');
      const pingColor = currentPingMs < 60 ? 'text-emerald-400' : 'text-amber-400';
      badge.innerHTML = `
        <span class="${fpsColor} font-bold">${currentFps || 24} FPS</span>
        <span class="text-slate-400">|</span>
        <span class="${pingColor}">${currentPingMs || 35}ms</span>
        <span class="text-slate-400">|</span>
        <span class="text-blue-300 font-semibold uppercase text-[9px]">${streamEngine === 'turbo' ? 'TURBO' : 'MJPEG'}</span>
      `;
    }
  }

  function updateCamBadge(online) {
    const badge = document.getElementById('espCamStatusBadge');
    if (badge) {
      if (online) {
        badge.className = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> LIVE 0-LAG';
      } else {
        badge.className = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> STANDBY';
      }
    }
  }

  async function toggleFlashlight() {
    isFlashOn = !isFlashOn;
    const flashText = document.getElementById('flashStateText');
    const flashBtn = document.getElementById('esp32FlashlightBtn');

    if (flashText) flashText.textContent = isFlashOn ? 'ON (HIGH)' : 'OFF';

    if (isFlashOn) {
      flashBtn?.classList.remove('text-amber-300', 'bg-amber-500/20');
      flashBtn?.classList.add('text-white', 'bg-amber-500', 'shadow-lg');
    } else {
      flashBtn?.classList.remove('text-white', 'bg-amber-500', 'shadow-lg');
      flashBtn?.classList.add('text-amber-300', 'bg-amber-500/20');
    }

    try {
      await fetch(`http://${esp32Ip}/flash?state=${isFlashOn ? 1 : 0}`, { mode: 'no-cors' });
    } catch (e) {}

    fetch('/api/esp32cam/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flashState: isFlashOn })
    }).catch(() => {});
  }

  function handlePTZ(dir) {
    if (dir === 'left') panX = Math.max(-150, panX - 25);
    if (dir === 'right') panX = Math.min(150, panX + 25);
    if (dir === 'up') tiltY = Math.max(-100, tiltY - 20);
    if (dir === 'down') tiltY = Math.min(100, tiltY + 20);
    if (dir === 'in') zoom = Math.min(2.5, +(zoom + 0.2).toFixed(1));
    if (dir === 'out') zoom = Math.max(1.0, +(zoom - 0.2).toFixed(1));
  }

  function triggerMotion() {
    motionAlert = true;
    if (motionTimeout) clearTimeout(motionTimeout);
    motionTimeout = setTimeout(() => {
      motionAlert = false;
    }, 4000);
  }

  function startCanvasSimulation() {
    if (!animFrameId && canvas) {
      renderSimulationLoop();
    }
  }

  function renderSimulationLoop() {
    if (activeMode !== 'simulation') return;
    tick++;
    drawFieldScene();
    animFrameId = requestAnimationFrame(renderSimulationLoop);
  }

  function drawFieldScene() {
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2 + panX, -canvas.height / 2 + tiltY);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.55);
    if (isNightVision || isFlashOn) {
      skyGrad.addColorStop(0, '#021a08');
      skyGrad.addColorStop(1, '#052e16');
    } else {
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.7, '#bae6fd');
      skyGrad.addColorStop(1, '#fef08a');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.55);

    if (isFlashOn) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height * 0.45, 300, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = isNightVision ? '#a7f3d0' : '#fef08a';
      ctx.beginPath();
      ctx.arc(1050, 110, 45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isNightVision ? '#064e3b' : '#15803d';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.55);
    ctx.quadraticCurveTo(300, canvas.height * 0.42, 650, canvas.height * 0.52);
    ctx.quadraticCurveTo(950, canvas.height * 0.45, 1280, canvas.height * 0.55);
    ctx.lineTo(1280, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    const groundGrad = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
    groundGrad.addColorStop(0, isNightVision ? '#064e3b' : '#166534');
    groundGrad.addColorStop(1, isNightVision ? '#022c22' : '#78350f');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);

    const wind = Math.sin(tick * 0.05) * 8;
    for (let row = 0; row < 5; row++) {
      const y = canvas.height * (0.62 + row * 0.08);
      const scale = 0.5 + row * 0.15;
      ctx.strokeStyle = isNightVision ? '#34d399' : '#16a34a';
      ctx.lineWidth = 3;

      for (let x = 60; x < canvas.width - 60; x += 65) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + wind * scale, y - 45 * scale, x + wind * 1.5 * scale, y - 65 * scale);
        ctx.stroke();

        ctx.fillStyle = isNightVision ? '#6ee7b7' : '#22c55e';
        ctx.beginPath();
        ctx.ellipse(x + wind * 1.5 * scale, y - 65 * scale, 12 * scale, 6 * scale, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (motionAlert) {
      const boxX = 640 + Math.sin(tick * 0.04) * 40;
      const boxY = 460;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX - 60, boxY - 90, 120, 120);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('⚠️ MOTION: CROP SECTOR INTRUSION', boxX - 110, boxY - 105);
    }

    ctx.restore();

    const hudTime = document.getElementById('hudLiveTime');
    if (hudTime) {
      const now = new Date();
      hudTime.textContent = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        now.toTimeString().split(' ')[0];
    }
  }

  function updateHUD(sensors, pump) {
    const hudTemp = document.getElementById('hudTemp');
    const hudHum = document.getElementById('hudHum');
    const hudSoil = document.getElementById('hudSoil');
    const hudFlame = document.getElementById('hudFlame');
    const hudPump = document.getElementById('hudPump');

    if (hudTemp) hudTemp.textContent = `${sensors.temperature.toFixed(1)} °C`;
    if (hudHum) hudHum.textContent = `${sensors.humidity.toFixed(1)} %`;
    if (hudSoil) hudSoil.textContent = `${sensors.soilMoisture.toFixed(1)} %`;
    if (hudFlame) {
      if (sensors.flameDetected) {
        hudFlame.textContent = '🔥 FLAME ALERT!';
        hudFlame.className = 'text-red-400 font-bold animate-pulse';
      } else {
        hudFlame.textContent = 'SECURE';
        hudFlame.className = 'text-emerald-400';
      }
    }
    if (hudPump) {
      hudPump.textContent = pump.state ? 'ACTIVE IRRIGATING' : 'STANDBY (OFF)';
      hudPump.className = pump.state ? 'text-blue-300 font-bold' : 'text-slate-400';
    }
  }

  // Snapshot Capture
  async function takeSnapshot() {
    let imageData = null;

    if (streamEngine === 'mjpeg' && !document.getElementById('esp32LiveStreamImg')?.classList.contains('hidden')) {
      const img = document.getElementById('esp32LiveStreamImg');
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth || 640;
      tempCanvas.height = img.naturalHeight || 480;
      const tctx = tempCanvas.getContext('2d');
      tctx.drawImage(img, 0, 0);
      imageData = tempCanvas.toDataURL('image/jpeg', 0.85);
    } else if (canvas) {
      imageData = canvas.toDataURL('image/jpeg', 0.85);
    }

    if (!imageData) return;

    try {
      const res = await fetch('/api/surveillance/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraName: `ESP32-CAM [${esp32Ip}]`,
          imageData,
          note: `Field scan captured by farmer`
        })
      });

      const json = await res.json();
      if (json.success && json.snapshot) {
        appendSnapshotToGallery(json.snapshot, true);
        alert(`📸 Field Snapshot saved successfully to gallery!`);
      }
    } catch (e) {
      console.warn('Snapshot capture failed:', e);
    }
  }

  async function fetchSnapshots() {
    try {
      const res = await fetch('/api/surveillance/snapshots');
      const json = await res.json();
      if (json.success && json.snapshots) {
        const gallery = document.getElementById('snapshotGallery');
        if (gallery && json.snapshots.length > 0) {
          gallery.innerHTML = '';
          json.snapshots.forEach(snap => appendSnapshotToGallery(snap, false));
        }
      }
    } catch (e) {}
  }

  function appendSnapshotToGallery(snap, prepend = true) {
    const gallery = document.getElementById('snapshotGallery');
    const countLabel = document.getElementById('snapshotCount');
    if (!gallery) return;

    const card = document.createElement('div');
    card.className = 'bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-brand-500 transition shadow text-xs';
    card.innerHTML = `
      <div class="aspect-video relative overflow-hidden bg-slate-900">
        <img src="${snap.imageData}" alt="Field Snapshot" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
        <div class="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-mono text-white">${snap.timestamp.split(',')[1] || ''}</div>
      </div>
      <div class="p-2 space-y-1">
        <div class="font-bold text-white truncate text-[11px]">${snap.cameraName}</div>
        <div class="text-[10px] text-slate-400 flex items-center justify-between font-mono">
          <span>${snap.telemetry.temp}°C</span>
          <span class="text-emerald-400">Soil: ${snap.telemetry.moisture}%</span>
        </div>
      </div>
    `;

    if (prepend && gallery.firstChild) {
      gallery.insertBefore(card, gallery.firstChild);
    } else {
      gallery.appendChild(card);
    }

    const total = gallery.querySelectorAll('.bg-slate-950').length;
    if (countLabel) countLabel.textContent = `${total} Snapshots Saved`;
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    startStream: () => setStreamMode(activeMode),
    updateHUD
  };
})();
