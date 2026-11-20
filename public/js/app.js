/**
 * AgriSmart IoT Application Core
 * Handles Authentication, Navigation, Live ESP32 Polling,
 * Pump Control, Audio Siren Synthesizer, and Hardware Simulation.
 */

const AppState = {
  user: null,
  activeView: 'dashboard',
  pollingInterval: null,
  audioSirenEnabled: true,
  sirenOscillator: null,
  audioCtx: null,
  cachedArduinoCode: ''
};

// --------------------------------------------------------------------------
// 1. AUTHENTICATION & SESSION MANAGEMENT
// --------------------------------------------------------------------------

function initAuth() {
  const authModal = document.getElementById('authModal');
  const loginForm = document.getElementById('loginForm');
  const tabFarmer = document.getElementById('tabFarmer');
  const tabGuest = document.getElementById('tabGuest');
  const quickBypassBtn = document.getElementById('quickBypassBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginEmail = document.getElementById('loginEmail');
  const loginPass = document.getElementById('loginPass');
  const togglePassBtn = document.getElementById('togglePassVisibility');

  // Check saved session in localStorage
  const savedUser = localStorage.getItem('agrismart_user');
  if (savedUser) {
    try {
      AppState.user = JSON.parse(savedUser);
      applyUserSession(AppState.user);
      authModal.classList.add('hidden');
    } catch (e) {
      localStorage.removeItem('agrismart_user');
    }
  }

  // Quick preset tabs
  tabFarmer?.addEventListener('click', () => {
    tabFarmer.className = 'flex-1 py-1.5 rounded-lg font-medium text-center transition bg-brand-600 text-white shadow';
    tabGuest.className = 'flex-1 py-1.5 rounded-lg font-medium text-center transition text-slate-400 hover:text-white';
    loginEmail.value = 'farmer@agrismart.com';
    loginPass.value = 'esp32farm';
  });

  tabGuest?.addEventListener('click', () => {
    tabGuest.className = 'flex-1 py-1.5 rounded-lg font-medium text-center transition bg-brand-600 text-white shadow';
    tabFarmer.className = 'flex-1 py-1.5 rounded-lg font-medium text-center transition text-slate-400 hover:text-white';
    loginEmail.value = 'field.operator@agrismart.com';
    loginPass.value = 'operator123';
  });

  // Toggle Password
  togglePassBtn?.addEventListener('click', () => {
    if (loginPass.type === 'password') {
      loginPass.type = 'text';
      togglePassBtn.innerHTML = '<i class="fa-regular fa-eye-slash text-sm"></i>';
    } else {
      loginPass.type = 'password';
      togglePassBtn.innerHTML = '<i class="fa-regular fa-eye text-sm"></i>';
    }
  });

  // Submit Login
  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const role = email.includes('admin') || email.includes('farmer') ? 'Farmer Admin' : 'Field Operator';
    const name = email.split('@')[0].replace('.', ' ').toUpperCase();

    AppState.user = { email, name, role };
    localStorage.setItem('agrismart_user', JSON.stringify(AppState.user));
    applyUserSession(AppState.user);
    authModal.classList.add('hidden');
    initAudioContext();
  });

  // Instant 1-Click Access
  quickBypassBtn?.addEventListener('click', () => {
    AppState.user = { email: 'farmer@agrismart.com', name: 'Farmer Ramesh', role: 'Chief Agronomist' };
    localStorage.setItem('agrismart_user', JSON.stringify(AppState.user));
    applyUserSession(AppState.user);
    authModal.classList.add('hidden');
    initAudioContext();
  });

  // Logout
  logoutBtn?.addEventListener('click', () => {
    if (confirm('Logout from AgriSmart Station?')) {
      localStorage.removeItem('agrismart_user');
      AppState.user = null;
      authModal.classList.remove('hidden');
    }
  });
}

function applyUserSession(user) {
  const userDisplayName = document.getElementById('userDisplayName');
  const userAvatarText = document.getElementById('userAvatarText');
  if (userDisplayName) userDisplayName.textContent = user.name || 'Farmer Ramesh';
  if (userAvatarText) {
    const initials = (user.name || 'FR').split(' ').map(n => n[0]).join('').slice(0, 2);
    userAvatarText.textContent = initials;
  }
}

// --------------------------------------------------------------------------
// 2. NAVIGATION MENU (VIEW SWITCHING)
// --------------------------------------------------------------------------

function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const views = {
    dashboard: document.getElementById('view-dashboard'),
    disease: document.getElementById('view-disease'),
    surveillance: document.getElementById('view-surveillance'),
    weather: document.getElementById('view-weather'),
    hardware: document.getElementById('view-hardware')
  };

  const titles = {
    dashboard: { title: 'Agriculture Field Dashboard', subtitle: 'Real-time ESP32 telemetry, soil condition & water pump automation', icon: 'fa-chart-pie', color: 'text-brand-400' },
    disease: { title: 'Plant Disease AI Diagnostic Monitor', subtitle: 'Leaf disease identification, pathogen analysis & chemical/organic treatments', icon: 'fa-microscope', color: 'text-emerald-400' },
    surveillance: { title: 'Field Video & Surveillance System', subtitle: 'Live agricultural video feed, PTZ controls and snapshot captures', icon: 'fa-video', color: 'text-blue-400' },
    weather: { title: '10-Day Detailed Agriculture Weather', subtitle: 'High/Low temperatures, precipitation probability, humidity & irrigation advisories', icon: 'fa-cloud-sun-rain', color: 'text-amber-400' },
    hardware: { title: 'ESP32 Circuit & Firmware Guide', subtitle: 'Wiring schematics, pinout assignments and complete Arduino sketch', icon: 'fa-microchip', color: 'text-purple-400' }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav');
      switchView(target);
      
      // Close sidebar on mobile
      document.getElementById('sidebar')?.classList.add('-translate-x-full');
    });
  });

  // Mobile sidebar controls
  const openSidebarBtn = document.getElementById('openSidebarBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const sidebar = document.getElementById('sidebar');

  openSidebarBtn?.addEventListener('click', () => {
    sidebar.classList.remove('-translate-x-full');
  });

  closeSidebarBtn?.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
  });

  function switchView(viewName) {
    if (!views[viewName]) return;
    AppState.activeView = viewName;

    // Update active nav button
    navButtons.forEach(btn => {
      if (btn.getAttribute('data-nav') === viewName) {
        btn.classList.add('active');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('active');
        btn.classList.add('text-slate-400');
      }
    });

    // Toggle views visibility
    Object.keys(views).forEach(key => {
      if (key === viewName) {
        views[key].classList.remove('hidden');
      } else {
        views[key].classList.add('hidden');
      }
    });

    // Update page title & subtitle in header
    const info = titles[viewName];
    if (info) {
      const pageTitle = document.getElementById('currentPageTitle');
      const pageSub = document.getElementById('currentPageSubtitle');
      if (pageTitle) {
        pageTitle.innerHTML = `<i class="fa-solid ${info.icon} ${info.color}"></i> <span>${info.title}</span>`;
      }
      if (pageSub) {
        pageSub.textContent = info.subtitle;
      }
    }

    // Trigger subview initialization if needed
    if (viewName === 'weather' && window.WeatherModule) {
      window.WeatherModule.loadForecast();
    }
    if (viewName === 'surveillance' && window.SurveillanceModule) {
      window.SurveillanceModule.startStream();
    }
    if (viewName === 'hardware') {
      loadArduinoCode();
    }
  }

  window.switchView = switchView;
}

// --------------------------------------------------------------------------
// 3. REAL-TIME ESP32 SENSOR POLLING & DASHBOARD UI UPDATE
// --------------------------------------------------------------------------

async function pollSystemStatus() {
  try {
    const res = await fetch('/api/system/status');
    if (!res.ok) return;
    const json = await res.json();
    if (json.success && json.data) {
      updateDashboardUI(json.data);
    }
  } catch (err) {
    console.warn('System status poll failed (Server unreachable):', err.message);
  }
}

function updateDashboardUI(data) {
  const { sensors, pump, esp32, history, alerts } = data;
  const espNode = esp32 || {};

  // 1. Temperature Card
  const tempVal = document.getElementById('tempValue');
  const tempF = document.getElementById('tempValueFahrenheit');
  const tempBar = document.getElementById('tempBar');
  const tempBadge = document.getElementById('tempStatusBadge');
  if (tempVal) tempVal.textContent = sensors.temperature.toFixed(1);
  if (tempF) tempF.textContent = `${(sensors.temperature * 9 / 5 + 32).toFixed(1)} °F`;
  if (tempBar) {
    const pct = Math.min(100, Math.max(0, (sensors.temperature / 50) * 100));
    tempBar.style.width = `${pct}%`;
  }
  if (tempBadge) {
    if (sensors.temperature > 35) {
      tempBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i> Heat Stress Warning (>35°C)';
      tempBadge.className = 'inline-flex items-center gap-1 text-amber-400 font-medium';
    } else if (sensors.temperature < 15) {
      tempBadge.innerHTML = '<i class="fa-solid fa-snowflake text-blue-400"></i> Cold Warning (<15°C)';
      tempBadge.className = 'inline-flex items-center gap-1 text-blue-400 font-medium';
    } else {
      tempBadge.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> Optimal (20-30°C)';
      tempBadge.className = 'inline-flex items-center gap-1 text-emerald-400 font-medium';
    }
  }

  // 2. Humidity Card
  const humVal = document.getElementById('humidityValue');
  const humBar = document.getElementById('humidityBar');
  const dewDisplay = document.getElementById('dewPointDisplay');
  const humBadge = document.getElementById('humidityStatusBadge');
  if (humVal) humVal.textContent = sensors.humidity.toFixed(1);
  if (humBar) humBar.style.width = `${sensors.humidity}%`;
  if (dewDisplay) {
    // Magnus-Tetens approximation for dew point
    const T = sensors.temperature;
    const RH = sensors.humidity;
    const a = 17.27, b = 237.7;
    const alpha = ((a * T) / (b + T)) + Math.log(RH / 100);
    const dew = (b * alpha) / (a - alpha);
    dewDisplay.textContent = `Dew: ${dew.toFixed(1)}°C`;
  }
  if (humBadge) {
    if (sensors.humidity > 80) {
      humBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-rose-400"></i> High Spore Risk (>80%)';
      humBadge.className = 'inline-flex items-center gap-1 text-rose-400 font-medium';
    } else {
      humBadge.innerHTML = '<i class="fa-solid fa-cloud text-blue-400"></i> Balanced Moisture';
      humBadge.className = 'inline-flex items-center gap-1 text-blue-400 font-medium';
    }
  }

  // 3. Capacitive Soil Moisture Card
  const soilVal = document.getElementById('soilValue');
  const soilBar = document.getElementById('soilBar');
  const soilRaw = document.getElementById('soilRawDisplay');
  const soilBadge = document.getElementById('soilStatusBadge');
  if (soilVal) soilVal.textContent = sensors.soilMoisture.toFixed(1);
  if (soilBar) soilBar.style.width = `${sensors.soilMoisture}%`;
  if (soilRaw) soilRaw.textContent = `Raw ADC: ${sensors.soilRawValue || 560}`;
  if (soilBadge) {
    if (sensors.soilMoisture < pump.autoThresholdMin) {
      soilBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation text-amber-400"></i> Dry Soil - Irrigation Needed';
      soilBadge.className = 'inline-flex items-center gap-1 text-amber-400 font-medium';
    } else if (sensors.soilMoisture > pump.autoThresholdMax) {
      soilBadge.innerHTML = '<i class="fa-solid fa-water text-blue-400"></i> Saturated / Waterlogged';
      soilBadge.className = 'inline-flex items-center gap-1 text-blue-400 font-medium';
    } else {
      soilBadge.innerHTML = '<i class="fa-solid fa-check-double text-emerald-400"></i> Optimal Root Zone';
      soilBadge.className = 'inline-flex items-center gap-1 text-emerald-400 font-medium';
    }
  }

  // 4. Flame / Fire Hazard Card & Alarm Banner
  const flameCard = document.getElementById('flameStatusCard');
  const flameText = document.getElementById('flameText');
  const flameIcon = document.getElementById('flameIconContainer');
  const flameDesc = document.getElementById('flameDescBadge');
  const emergencyBanner = document.getElementById('flameEmergencyBanner');

  if (sensors.flameDetected) {
    flameCard?.classList.add('flame-alarm-card');
    if (flameText) {
      flameText.textContent = '🔥 FLAME DETECTED!';
      flameText.className = 'text-2xl font-extrabold text-red-500 font-mono animate-pulse';
    }
    if (flameIcon) {
      flameIcon.className = 'w-10 h-10 rounded-xl bg-red-600/30 text-red-400 flex items-center justify-center text-lg border border-red-500 animate-bounce';
      flameIcon.innerHTML = '<i class="fa-solid fa-fire text-amber-300"></i>';
    }
    if (flameDesc) flameDesc.textContent = 'Fire Alert in Sector A1';
    emergencyBanner?.classList.remove('hidden');

    // Trigger audio siren
    playAudioAlarm();
  } else {
    flameCard?.classList.remove('flame-alarm-card');
    if (flameText) {
      flameText.textContent = 'SECURE';
      flameText.className = 'text-2xl font-extrabold text-emerald-400 font-mono';
    }
    if (flameIcon) {
      flameIcon.className = 'w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center text-lg border border-slate-700';
      flameIcon.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
    }
    if (flameDesc) flameDesc.textContent = 'No Flame Detected';
    emergencyBanner?.classList.add('hidden');

    stopAudioAlarm();
  }

  // 5. Pump Controls & Status
  const pumpOrb = document.getElementById('pumpVisualOrb');
  const pumpStateText = document.getElementById('pumpVisualState');
  const pumpWaterToday = document.getElementById('pumpWaterToday');
  const pumpRuntime = document.getElementById('pumpRuntime');
  const pumpModeAutoBtn = document.getElementById('pumpModeAuto');
  const pumpModeManualBtn = document.getElementById('pumpModeManual');

  if (pump.state) {
    pumpOrb?.classList.add('active');
    if (pumpStateText) pumpStateText.textContent = 'PUMP RUNNING (ON)';
  } else {
    pumpOrb?.classList.remove('active');
    if (pumpStateText) pumpStateText.textContent = 'PUMP STOPPED (OFF)';
  }

  if (pumpWaterToday) pumpWaterToday.textContent = `${pump.todayWaterDeliveredLiters.toFixed(1)} Liters`;
  if (pumpRuntime) pumpRuntime.textContent = `${pump.totalRuntimeMinutes} Mins`;

  if (pump.mode === 'auto') {
    pumpModeAutoBtn?.classList.add('bg-brand-600', 'text-white', 'shadow');
    pumpModeAutoBtn?.classList.remove('text-slate-400');
    pumpModeManualBtn?.classList.remove('bg-brand-600', 'text-white', 'shadow');
    pumpModeManualBtn?.classList.add('text-slate-400');
  } else {
    pumpModeManualBtn?.classList.add('bg-brand-600', 'text-white', 'shadow');
    pumpModeManualBtn?.classList.remove('text-slate-400');
    pumpModeAutoBtn?.classList.remove('bg-brand-600', 'text-white', 'shadow');
    pumpModeAutoBtn?.classList.add('text-slate-400');
  }

  // 6. ESP32 Hardware Status Widget
  const espStatusBadge = document.getElementById('espStatusBadge');
  const espIpDisplay = document.getElementById('espIpDisplay');
  const espRssiDisplay = document.getElementById('espRssiDisplay');
  if (espStatusBadge) {
    if (espNode.connected) {
      espStatusBadge.className = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      espStatusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> ONLINE';
    } else {
      espStatusBadge.className = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
      espStatusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> STANDBY';
    }
  }
  if (espIpDisplay) espIpDisplay.textContent = espNode.ipAddress || '192.168.1.105';
  if (espRssiDisplay) espRssiDisplay.textContent = `${espNode.rssi || -54} dBm`;

  // 7. Render Alerts Log
  renderAlerts(alerts);

  // 8. Update Chart if loaded
  if (window.SensorChartModule && history) {
    window.SensorChartModule.updateData(history);
  }

  // 9. Update Video HUD Overlay
  if (window.SurveillanceModule) {
    window.SurveillanceModule.updateHUD(sensors, pump);
  }
}

function renderAlerts(alerts) {
  const container = document.getElementById('alertsContainer');
  if (!container || !alerts) return;

  if (alerts.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-500 italic py-2">No active system alerts. All nodes running nominally.</div>';
    return;
  }

  container.innerHTML = alerts.slice(0, 8).map(a => {
    let icon = 'fa-circle-info text-blue-400';
    let border = 'border-slate-800';
    let bg = 'bg-slate-950/60';

    if (a.type === 'danger') {
      icon = 'fa-triangle-exclamation text-red-400 animate-bounce';
      border = 'border-red-500/40';
      bg = 'bg-red-950/30';
    } else if (a.type === 'warning') {
      icon = 'fa-triangle-exclamation text-amber-400';
      border = 'border-amber-500/30';
      bg = 'bg-amber-950/20';
    } else if (a.type === 'success') {
      icon = 'fa-circle-check text-emerald-400';
    }

    return `
      <div class="p-2.5 rounded-xl border ${border} ${bg} flex items-start space-x-3 text-xs">
        <i class="fa-solid ${icon} mt-0.5"></i>
        <div class="flex-1">
          <div class="text-slate-200 leading-snug">${a.message}</div>
          <span class="text-[10px] text-slate-400 font-mono mt-0.5 inline-block">${a.timestamp}</span>
        </div>
      </div>
    `;
  }).join('');
}

// --------------------------------------------------------------------------
// 4. WATER PUMP INTERACTIONS & THRESHOLD CONFIGURATION
// --------------------------------------------------------------------------

function initPumpControls() {
  const pumpOrb = document.getElementById('pumpVisualOrb');
  const pumpModeAuto = document.getElementById('pumpModeAuto');
  const pumpModeManual = document.getElementById('pumpModeManual');
  const topEmergencyStop = document.getElementById('topEmergencyStopBtn');
  const threshMinSlider = document.getElementById('threshMinSlider');
  const threshMaxSlider = document.getElementById('threshMaxSlider');
  const threshMinLabel = document.getElementById('threshMinLabel');
  const threshMaxLabel = document.getElementById('threshMaxLabel');
  const clearAlertsBtn = document.getElementById('clearAlertsBtn');

  // Big Orb Click (Manual Toggle)
  pumpOrb?.addEventListener('click', async () => {
    const isRunning = pumpOrb.classList.contains('active');
    await fetch('/api/pump/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: !isRunning, mode: 'manual' })
    });
    pollSystemStatus();
  });

  // Switch Mode to AUTO
  pumpModeAuto?.addEventListener('click', async () => {
    await fetch('/api/pump/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'auto' })
    });
    pollSystemStatus();
  });

  // Switch Mode to MANUAL
  pumpModeManual?.addEventListener('click', async () => {
    await fetch('/api/pump/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'manual' })
    });
    pollSystemStatus();
  });

  // Top Emergency Stop Button
  topEmergencyStop?.addEventListener('click', async () => {
    await fetch('/api/pump/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: false, mode: 'manual' })
    });
    alert('⚠️ Emergency Pump Cutoff Triggered. Pump powered down immediately.');
    pollSystemStatus();
  });

  // Sliders for thresholds
  threshMinSlider?.addEventListener('input', (e) => {
    if (threshMinLabel) threshMinLabel.textContent = e.target.value;
  });

  threshMaxSlider?.addEventListener('input', (e) => {
    if (threshMaxLabel) threshMaxLabel.textContent = e.target.value;
  });

  const saveThresholds = async () => {
    await fetch('/api/pump/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        minThreshold: threshMinSlider.value,
        maxThreshold: threshMaxSlider.value
      })
    });
  };

  threshMinSlider?.addEventListener('change', saveThresholds);
  threshMaxSlider?.addEventListener('change', saveThresholds);

  // Clear Alerts
  clearAlertsBtn?.addEventListener('click', async () => {
    await fetch('/api/alerts/clear', { method: 'POST' });
    pollSystemStatus();
  });

  // Dismiss Flame Emergency
  document.getElementById('dismissFlameAlertBtn')?.addEventListener('click', async () => {
    await fetch('/api/system/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flameDetected: false })
    });
    pollSystemStatus();
  });
}

// --------------------------------------------------------------------------
// 5. WEB AUDIO FLAME SIREN SYNTHESIZER
// --------------------------------------------------------------------------

function initAudioContext() {
  if (!AppState.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      AppState.audioCtx = new AudioContext();
    }
  }
}

function playAudioAlarm() {
  if (!AppState.audioSirenEnabled) return;
  initAudioContext();
  if (!AppState.audioCtx) return;

  if (AppState.audioCtx.state === 'suspended') {
    AppState.audioCtx.resume();
  }

  if (AppState.sirenOscillator) return; // Already running

  try {
    const osc = AppState.audioCtx.createOscillator();
    const gain = AppState.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, AppState.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, AppState.audioCtx.currentTime + 0.3);

    // LFO modulation for wailing siren
    const lfo = AppState.audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 3; // 3 Hz modulation
    const lfoGain = AppState.audioCtx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.12, AppState.audioCtx.currentTime);

    osc.connect(gain);
    gain.connect(AppState.audioCtx.destination);

    osc.start();
    lfo.start();

    AppState.sirenOscillator = { osc, lfo, gain };
  } catch (e) {
    console.warn('Audio siren start failed:', e);
  }
}

function stopAudioAlarm() {
  if (AppState.sirenOscillator) {
    try {
      AppState.sirenOscillator.osc.stop();
      AppState.sirenOscillator.lfo.stop();
      AppState.sirenOscillator.osc.disconnect();
    } catch (e) {}
    AppState.sirenOscillator = null;
  }
}

// Audio mute button
document.getElementById('audioAlarmToggle')?.addEventListener('click', () => {
  AppState.audioSirenEnabled = !AppState.audioSirenEnabled;
  const status = document.getElementById('audioStatusText');
  if (status) {
    status.textContent = AppState.audioSirenEnabled ? 'ON' : 'MUTED';
    status.className = AppState.audioSirenEnabled ? 'text-emerald-400' : 'text-slate-500';
  }
  if (!AppState.audioSirenEnabled) {
    stopAudioAlarm();
  }
});

document.getElementById('silenceAlarmBtn')?.addEventListener('click', () => {
  stopAudioAlarm();
  AppState.audioSirenEnabled = false;
  const status = document.getElementById('audioStatusText');
  if (status) {
    status.textContent = 'MUTED';
    status.className = 'text-slate-500';
  }
});

// --------------------------------------------------------------------------
// 6. HARDWARE SIMULATOR DRAWER (TEST BENCH)
// --------------------------------------------------------------------------

function initSimulatorDrawer() {
  const drawer = document.getElementById('simulatorDrawer');
  const toggleBtn = document.getElementById('toggleSimulatorDrawerBtn');
  const closeBtn = document.getElementById('closeSimulatorDrawerBtn');

  const simTempSlider = document.getElementById('simTempSlider');
  const simTempLabel = document.getElementById('simTempLabel');
  const simHumiditySlider = document.getElementById('simHumiditySlider');
  const simHumidityLabel = document.getElementById('simHumidityLabel');
  const simSoilSlider = document.getElementById('simSoilSlider');
  const simSoilLabel = document.getElementById('simSoilLabel');
  const simFlameToggle = document.getElementById('simFlameToggle');

  const scenarioDroughtBtn = document.getElementById('scenarioDroughtBtn');
  const scenarioHeavyRainBtn = document.getElementById('scenarioHeavyRainBtn');
  const resetSimulatorBtn = document.getElementById('resetSimulatorBtn');

  toggleBtn?.addEventListener('click', () => {
    drawer?.classList.toggle('translate-x-full');
  });

  closeBtn?.addEventListener('click', () => {
    drawer?.classList.add('translate-x-full');
  });

  // Slider change handlers with live POST to backend
  simTempSlider?.addEventListener('input', (e) => {
    simTempLabel.textContent = `${e.target.value} °C`;
  });
  simTempSlider?.addEventListener('change', async (e) => {
    await pushSimulatedData({ temperature: e.target.value });
  });

  simHumiditySlider?.addEventListener('input', (e) => {
    simHumidityLabel.textContent = `${e.target.value} %`;
  });
  simHumiditySlider?.addEventListener('change', async (e) => {
    await pushSimulatedData({ humidity: e.target.value });
  });

  simSoilSlider?.addEventListener('input', (e) => {
    simSoilLabel.textContent = `${e.target.value} %`;
  });
  simSoilSlider?.addEventListener('change', async (e) => {
    await pushSimulatedData({ soilMoisture: e.target.value });
  });

  simFlameToggle?.addEventListener('change', async (e) => {
    initAudioContext();
    await pushSimulatedData({ flameDetected: e.target.checked });
  });

  // Scenario Buttons
  scenarioDroughtBtn?.addEventListener('click', async () => {
    simTempSlider.value = 36;
    simTempLabel.textContent = '36 °C';
    simHumiditySlider.value = 32;
    simHumidityLabel.textContent = '32 %';
    simSoilSlider.value = 22;
    simSoilLabel.textContent = '22 %';
    await pushSimulatedData({ temperature: 36, humidity: 32, soilMoisture: 22 });
  });

  scenarioHeavyRainBtn?.addEventListener('click', async () => {
    simTempSlider.value = 21;
    simTempLabel.textContent = '21 °C';
    simHumiditySlider.value = 92;
    simHumidityLabel.textContent = '92 %';
    simSoilSlider.value = 85;
    simSoilLabel.textContent = '85 %';
    await pushSimulatedData({ temperature: 21, humidity: 92, soilMoisture: 85 });
  });

  resetSimulatorBtn?.addEventListener('click', async () => {
    simTempSlider.value = 26.8;
    simTempLabel.textContent = '26.8 °C';
    simHumiditySlider.value = 64;
    simHumidityLabel.textContent = '64 %';
    simSoilSlider.value = 42;
    simSoilLabel.textContent = '42 %';
    simFlameToggle.checked = false;
    await pushSimulatedData({ temperature: 26.8, humidity: 64, soilMoisture: 42, flameDetected: false });
  });

  async function pushSimulatedData(payload) {
    try {
      await fetch('/api/system/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      pollSystemStatus();
    } catch (e) {
      console.warn('Simulation update failed', e);
    }
  }
}

// --------------------------------------------------------------------------
// 7. ARDUINO FIRMWARE VIEWER & COPY (ESP32 & ESP32-CAM)
// --------------------------------------------------------------------------

let currentFirmwareType = 'esp32';
const cachedCode = { esp32: '', esp32cam: '' };

async function loadArduinoCode(type = 'esp32') {
  currentFirmwareType = type;
  const codeBlock = document.getElementById('arduinoCodeBlock');
  const copyBtn = document.getElementById('copyArduinoCodeBtn');
  const titleDisplay = document.getElementById('codeFileNameDisplay');
  const downloadLink = document.getElementById('downloadCodeLink');
  const tab32Node = document.getElementById('tabCodeEsp32');
  const tabCam = document.getElementById('tabCodeEsp32Cam');

  if (type === 'esp32') {
    tab32Node?.classList.add('bg-purple-600', 'text-white');
    tab32Node?.classList.remove('bg-slate-800', 'text-slate-400');
    tabCam?.classList.remove('bg-purple-600', 'text-white');
    tabCam?.classList.add('bg-slate-800', 'text-slate-400');
    if (titleDisplay) titleDisplay.textContent = 'esp32_agriculture.ino (Sensors & Pump)';
    if (downloadLink) {
      downloadLink.href = '/esp32_code/esp32_agriculture.ino';
      downloadLink.download = 'esp32_agriculture.ino';
    }
  } else {
    tabCam?.classList.add('bg-purple-600', 'text-white');
    tabCam?.classList.remove('bg-slate-800', 'text-slate-400');
    tab32Node?.classList.remove('bg-purple-600', 'text-white');
    tab32Node?.classList.add('bg-slate-800', 'text-slate-400');
    if (titleDisplay) titleDisplay.textContent = 'esp32_cam_firmware.ino (AI-Thinker Video Stream)';
    if (downloadLink) {
      downloadLink.href = '/esp32_cam/esp32_cam_firmware.ino';
      downloadLink.download = 'esp32_cam_firmware.ino';
    }
  }

  const cacheKey = type === 'esp32cam' ? 'esp32cam' : 'esp32';
  if (cachedCode[cacheKey]) {
    if (codeBlock) codeBlock.textContent = cachedCode[cacheKey];
    return;
  }

  const url = type === 'esp32' ? '/esp32_code/esp32_agriculture.ino' : '/esp32_cam/esp32_cam_firmware.ino';

  try {
    const res = await fetch(url);
    if (res.ok) {
      const code = await res.text();
      cachedCode[cacheKey] = code;
      if (codeBlock) codeBlock.textContent = code;
    }
  } catch (e) {
    if (codeBlock) codeBlock.textContent = `// File available at ${url}`;
  }
}

function initFirmwareTabs() {
  document.getElementById('tabCodeEsp32')?.addEventListener('click', () => loadArduinoCode('esp32'));
  document.getElementById('tabCodeEsp32Cam')?.addEventListener('click', () => loadArduinoCode('esp32cam'));

  const copyBtn = document.getElementById('copyArduinoCodeBtn');
  copyBtn?.addEventListener('click', () => {
    const cacheKey = currentFirmwareType === 'esp32cam' ? 'esp32cam' : 'esp32';
    const code = cachedCode[cacheKey] || document.getElementById('arduinoCodeBlock')?.textContent;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i> Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Code';
        }, 2000);
      });
    }
  });
}

// --------------------------------------------------------------------------
// INITIALIZE ON DOM LOAD
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavigation();
  initPumpControls();
  initSimulatorDrawer();
  initFirmwareTabs();

  // Initial poll and recurring poll every 2.5 seconds
  pollSystemStatus();
  AppState.pollingInterval = setInterval(pollSystemStatus, 2500);
});
