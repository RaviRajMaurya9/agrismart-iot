/**
 * Plant Disease AI Detection Module
 * Features:
 * - High-accuracy multi-crop pathogen recognition
 * - Lesion Heatmap & Reticle Visual Overlay on user photos
 * - Plain-language farmer summaries with exact 15L tank recipes
 * - Audio Voice Doctor for Farmers (Bilingual SpeechSynthesis)
 * - 3-Day recovery schedule & organic natural alternatives
 */

window.DiseaseModule = (function () {
  let selectedFileBase64 = null;
  let activeSpecimenId = null;
  let cameraStream = null;
  let lastDiagnosisData = null;
  let isSpeaking = false;

  // Rich SVG specimens for instant testing
  const SAMPLE_LEAF_SVGS = {
    tomato_early_blight: createLeafSVG('#4d7c0f', '#78350f', 'Tomato: Early Blight (Alternaria)'),
    tomato_late_blight: createLateBlightSVG('#3f6212', '#451a03', 'Tomato: Late Blight (Water-soaked)'),
    rice_leaf_blast: createRiceLeafSVG('#65a30d', '#713f12', 'Rice: Blast Spindle Lesions'),
    wheat_yellow_rust: createWheatRustSVG('#ca8a04', 'Wheat: Yellow Stripe Rust'),
    healthy_leaf: createHealthyLeafSVG('#22c55e', '100% Healthy Vibrant Leaf')
  };

  function init() {
    const dropzone = document.getElementById('dropzoneArea');
    const fileInput = document.getElementById('leafFileInput');
    const previewContainer = document.getElementById('previewContainer');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const removeImageBtn = document.getElementById('removeImageBtn');

    const modeUploadBtn = document.getElementById('modeUploadBtn');
    const modeCameraBtn = document.getElementById('modeCameraBtn');
    const cameraArea = document.getElementById('cameraViewfinderArea');
    const snapPhotoBtn = document.getElementById('snapPhotoBtn');
    const stopCameraBtn = document.getElementById('stopCameraBtn');
    const runDiagnosisBtn = document.getElementById('runDiagnosisBtn');
    const voiceBtn = document.getElementById('voiceAdvisoryBtn');

    const sampleBtns = document.querySelectorAll('.sample-leaf-btn');

    // 1. File Upload Dropzone
    dropzone?.addEventListener('click', (e) => {
      if (e.target !== removeImageBtn && !previewContainer?.contains(e.target)) {
        fileInput?.click();
      }
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-brand-500', 'bg-brand-950/20');
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-brand-500', 'bg-brand-950/20');
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-brand-500', 'bg-brand-950/20');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });

    removeImageBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearImageSelection();
    });

    // 2. Camera Controls
    modeUploadBtn?.addEventListener('click', () => {
      stopCamera();
      modeUploadBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brand-600 text-white shadow transition flex items-center gap-2';
      modeCameraBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition flex items-center gap-2';
      dropzone?.classList.remove('hidden');
      cameraArea?.classList.add('hidden');
    });

    modeCameraBtn?.addEventListener('click', async () => {
      modeCameraBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brand-600 text-white shadow transition flex items-center gap-2';
      modeUploadBtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition flex items-center gap-2';
      dropzone?.classList.add('hidden');
      cameraArea?.classList.remove('hidden');
      await startCamera();
    });

    snapPhotoBtn?.addEventListener('click', () => {
      captureCameraFrame();
    });

    stopCameraBtn?.addEventListener('click', () => {
      stopCamera();
      modeUploadBtn?.click();
    });

    // 3. Sample Leaves
    sampleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const crop = btn.getAttribute('data-crop');
        activeSpecimenId = id;

        const svg = SAMPLE_LEAF_SVGS[id] || SAMPLE_LEAF_SVGS.tomato_early_blight;
        selectedFileBase64 = svg;
        displayImagePreview(svg);

        sampleBtns.forEach(b => b.classList.remove('border-brand-500', 'bg-slate-800'));
        btn.classList.add('border-brand-500', 'bg-slate-800');

        const selector = document.getElementById('cropSelector');
        if (selector && crop) selector.value = crop;
      });
    });

    // 4. Run Diagnosis
    runDiagnosisBtn?.addEventListener('click', () => {
      executeDiagnosis();
    });

    // 5. Audio Speech Voice Assistant
    voiceBtn?.addEventListener('click', () => {
      toggleVoiceAdvisory();
    });

    // 6. Print Report
    document.getElementById('printReportBtn')?.addEventListener('click', () => {
      window.print();
    });
  }

  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedFileBase64 = e.target.result;
      activeSpecimenId = null;
      displayImagePreview(selectedFileBase64);
    };
    reader.readAsDataURL(file);
  }

  function displayImagePreview(src) {
    const previewContainer = document.getElementById('previewContainer');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const imagePreview = document.getElementById('imagePreview');
    const overlay = document.getElementById('lesionOverlayCanvas');
    const badge = document.getElementById('lesionDetectedBadge');

    if (imagePreview) imagePreview.src = src;
    previewContainer?.classList.remove('hidden');
    uploadPlaceholder?.classList.add('hidden');
    badge?.classList.add('hidden');

    // Clear previous canvas lesions
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  }

  function clearImageSelection() {
    selectedFileBase64 = null;
    activeSpecimenId = null;
    const previewContainer = document.getElementById('previewContainer');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const fileInput = document.getElementById('leafFileInput');
    const badge = document.getElementById('lesionDetectedBadge');

    if (fileInput) fileInput.value = '';
    previewContainer?.classList.add('hidden');
    uploadPlaceholder?.classList.remove('hidden');
    badge?.classList.add('hidden');
    stopSpeaking();
  }

  // Camera Management
  async function startCamera() {
    const video = document.getElementById('webcamVideo');
    if (!video) return;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = cameraStream;
      } else {
        alert('Webcam / Camera API not accessible on this browser. Using upload mode.');
        document.getElementById('modeUploadBtn')?.click();
      }
    } catch (err) {
      alert('Camera access denied or unavailable. You can use image upload or test specimens.');
      document.getElementById('modeUploadBtn')?.click();
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
  }

  function captureCameraFrame() {
    const video = document.getElementById('webcamVideo');
    const canvas = document.getElementById('cameraCanvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    selectedFileBase64 = canvas.toDataURL('image/jpeg', 0.85);
    activeSpecimenId = null;

    stopCamera();
    document.getElementById('modeUploadBtn')?.click();
    displayImagePreview(selectedFileBase64);
  }

  // AI Diagnostic Execution
  async function executeDiagnosis() {
    if (!selectedFileBase64) {
      const firstSample = document.querySelector('.sample-leaf-btn');
      if (firstSample) {
        firstSample.click();
      } else {
        alert('Please upload a leaf photo or pick one of the test specimens!');
        return;
      }
    }

    const blankState = document.getElementById('diagBlankState');
    const loadingState = document.getElementById('diagLoadingState');
    const resultContainer = document.getElementById('diagResultContainer');
    const dropzone = document.getElementById('dropzoneArea');

    // Visual laser scanning line
    let scanLine = document.createElement('div');
    scanLine.className = 'scan-line';
    dropzone?.appendChild(scanLine);

    blankState?.classList.add('hidden');
    resultContainer?.classList.add('hidden');
    loadingState?.classList.remove('hidden');

    const cropSelector = document.getElementById('cropSelector');
    const selectedCrop = cropSelector?.value || 'any';

    try {
      const res = await fetch('/api/diseases/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedFileBase64,
          selectedCrop,
          manualDiseaseId: activeSpecimenId
        })
      });

      const data = await res.json();
      
      setTimeout(() => {
        scanLine?.remove();
        loadingState?.classList.add('hidden');

        if (data.success && data.result) {
          lastDiagnosisData = data.result;
          renderDiagnosisResult(data.result);
          drawLesionReticles(data.result.lesionHeatmapPoints);
          resultContainer?.classList.remove('hidden');
        }
      }, 1000);

    } catch (err) {
      scanLine?.remove();
      loadingState?.classList.add('hidden');
      blankState?.classList.remove('hidden');
      alert('Diagnostic scan failed: ' + err.message);
    }
  }

  // Render Visual Lesion Reticles directly on image preview
  function drawLesionReticles(points) {
    const canvas = document.getElementById('lesionOverlayCanvas');
    const img = document.getElementById('imagePreview');
    const badge = document.getElementById('lesionDetectedBadge');
    if (!canvas || !img || !points) return;

    // Match canvas size to display size
    canvas.width = img.clientWidth || 360;
    canvas.height = img.clientHeight || 280;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (lastDiagnosisData && lastDiagnosisData.severity.toLowerCase().includes('none')) {
      // Healthy leaf - green halo
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.strokeRect(canvas.width * 0.15, canvas.height * 0.15, canvas.width * 0.7, canvas.height * 0.7);
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('✓ 100% VIBRANT HEALTHY CANOPY', canvas.width * 0.2, canvas.height * 0.12);
      return;
    }

    badge?.classList.remove('hidden');

    points.forEach((pt, index) => {
      const cx = (pt.x / 100) * canvas.width;
      const cy = (pt.y / 100) * canvas.height;
      const r = (pt.radius / 100) * (canvas.width * 0.4);

      // Outer targeting box
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - r - 8, cy - r - 8, (r + 8) * 2, (r + 8) * 2);

      // Glowing circular highlight
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0.15)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Crosshairs
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - r - 12, cy); ctx.lineTo(cx - r - 2, cy);
      ctx.moveTo(cx + r + 2, cy); ctx.lineTo(cx + r + 12, cy);
      ctx.moveTo(cx, cy - r - 12); ctx.lineTo(cx, cy - r - 2);
      ctx.moveTo(cx, cy + r + 2); ctx.lineTo(cx, cy + r + 12);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`ZONE ${index + 1}: ${pt.label}`, cx - r - 8, cy - r - 12);
    });
  }

  function renderDiagnosisResult(res) {
    const resRegional = document.getElementById('resRegionalName');
    const resDisease = document.getElementById('resDiseaseName');
    const resSeverity = document.getElementById('resSeverityBadge');
    const resPathogen = document.getElementById('resPathogenBadge');
    const resConfidence = document.getElementById('resConfidence');
    const resSummary = document.getElementById('resFarmerSummary');
    const resYield = document.getElementById('resYieldRisk');
    const resSpray = document.getElementById('resSprayRecipe');
    const resOrganic = document.getElementById('resOrganicRemedy');
    const plan1 = document.getElementById('planDay1');
    const plan3 = document.getElementById('planDay3');
    const plan7 = document.getElementById('planDay7');
    const resCorrelation = document.getElementById('resSensorCorrelation');

    if (resRegional) resRegional.textContent = res.regionalName || res.crop;
    if (resDisease) resDisease.textContent = res.diseaseName;
    if (resConfidence) resConfidence.textContent = `${res.confidenceScore}%`;
    if (resPathogen) resPathogen.textContent = `Pathogen: ${res.pathogen}`;
    if (resSummary) resSummary.textContent = res.farmerSummary;
    if (resYield) resYield.textContent = res.yieldLossRisk;
    if (resSpray) resSpray.textContent = res.immediateSprayRecipe;
    if (resOrganic) resOrganic.textContent = res.organicHomeRemedy;

    if (res.recoveryPlan) {
      if (plan1) plan1.textContent = res.recoveryPlan.day1;
      if (plan3) plan3.textContent = res.recoveryPlan.day3;
      if (plan7) plan7.textContent = res.recoveryPlan.day7;
    }

    if (resSeverity) {
      if (res.severity.toLowerCase().includes('critical') || res.severity.toLowerCase().includes('severe')) {
        resSeverity.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30';
      } else if (res.severity.toLowerCase().includes('moderate') || res.severity.toLowerCase().includes('high')) {
        resSeverity.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30';
      } else {
        resSeverity.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      }
      resSeverity.textContent = `Severity: ${res.severity}`;
    }

    if (resCorrelation && res.sensorCorrelation) {
      resCorrelation.textContent = `Live Telemetry: Field Temp ${res.sensorCorrelation.currentTemp}°C, Humidity ${res.sensorCorrelation.currentHumidity}%. ${res.sensorCorrelation.riskAssessment}`;
    }
  }

  // Audio Voice Assistant for Farmers
  function toggleVoiceAdvisory() {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    if (!lastDiagnosisData) return;

    const voiceBtn = document.getElementById('voiceAdvisoryBtn');
    const textToSpeak = `
      Farmer Doctor Diagnosis. Crop: ${lastDiagnosisData.crop}. 
      Disease Identified: ${lastDiagnosisData.diseaseName}.
      What happened: ${lastDiagnosisData.farmerSummary}.
      Immediate Spray Recipe for 15 Liter pump tank: ${lastDiagnosisData.immediateSprayRecipe}.
      Low cost organic remedy: ${lastDiagnosisData.organicHomeRemedy}.
    `;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      isSpeaking = true;
      if (voiceBtn) {
        voiceBtn.innerHTML = '<i class="fa-solid fa-volume-xmark mr-1"></i> Stop Audio';
        voiceBtn.className = 'mt-2 px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 transition animate-pulse';
      }
    };

    utterance.onend = utterance.onerror = () => {
      stopSpeaking();
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    const voiceBtn = document.getElementById('voiceAdvisoryBtn');
    if (voiceBtn) {
      voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high mr-1"></i> Listen to Advice';
      voiceBtn.className = 'mt-2 px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition';
    }
  }

  // SVG Generators
  function createLeafSVG(leafColor, spotColor, title) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
        <rect width="100%" height="100%" fill="#090d16" rx="16"/>
        <path d="M 200 280 Q 195 180 190 40" stroke="#15803d" stroke-width="6" fill="none"/>
        <path d="M 190 40 C 90 90 80 200 190 270 C 310 200 300 90 190 40 Z" fill="${leafColor}" stroke="#166534" stroke-width="2"/>
        <path d="M 190 100 Q 130 80 110 95" stroke="#16a34a" stroke-width="2.5" fill="none"/>
        <path d="M 190 100 Q 250 80 270 95" stroke="#16a34a" stroke-width="2.5" fill="none"/>
        <!-- Target Rings -->
        <circle cx="150" cy="130" r="16" fill="${spotColor}" opacity="0.9"/>
        <circle cx="150" cy="130" r="10" fill="#1c1917"/>
        <circle cx="150" cy="130" r="4" fill="#facc15"/>
        <circle cx="230" cy="160" r="20" fill="${spotColor}" opacity="0.9"/>
        <circle cx="230" cy="160" r="12" fill="#1c1917"/>
        <circle cx="230" cy="160" r="5" fill="#facc15"/>
        <rect x="20" y="20" width="280" height="30" rx="8" fill="#000000" opacity="0.75"/>
        <text x="30" y="40" fill="#ffffff" font-family="monospace" font-size="12" font-weight="bold">${title}</text>
      </svg>
    `;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function createLateBlightSVG(leafColor, spotColor, title) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
        <rect width="100%" height="100%" fill="#090d16" rx="16"/>
        <path d="M 190 40 C 90 90 80 200 190 270 C 310 200 300 90 190 40 Z" fill="${leafColor}" stroke="#166534" stroke-width="2"/>
        <!-- Water-soaked large dark necrotic lesions with fuzzy mold edge -->
        <path d="M 110 120 Q 150 100 180 130 Q 160 180 120 170 Z" fill="${spotColor}" opacity="0.95"/>
        <path d="M 220 110 Q 270 90 280 150 Q 240 180 210 140 Z" fill="${spotColor}" opacity="0.95"/>
        <ellipse cx="150" cy="145" rx="12" ry="8" fill="#e2e8f0" opacity="0.7"/>
        <rect x="20" y="20" width="300" height="30" rx="8" fill="#000000" opacity="0.75"/>
        <text x="30" y="40" fill="#f87171" font-family="monospace" font-size="12" font-weight="bold">${title}</text>
      </svg>
    `;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function createRiceLeafSVG(leafColor, spotColor, title) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
        <rect width="100%" height="100%" fill="#090d16" rx="16"/>
        <path d="M 170 290 Q 185 140 215 20 Q 225 140 210 290 Z" fill="${leafColor}" stroke="#4d7c0f" stroke-width="2"/>
        <ellipse cx="195" cy="110" rx="14" ry="6" fill="${spotColor}" transform="rotate(-65 195 110)"/>
        <ellipse cx="195" cy="110" rx="7" ry="3" fill="#cbd5e1" transform="rotate(-65 195 110)"/>
        <ellipse cx="190" cy="170" rx="16" ry="7" fill="${spotColor}" transform="rotate(-60 190 170)"/>
        <ellipse cx="190" cy="170" rx="8" ry="3" fill="#cbd5e1" transform="rotate(-60 190 170)"/>
        <rect x="20" y="20" width="280" height="30" rx="8" fill="#000000" opacity="0.75"/>
        <text x="30" y="40" fill="#ffffff" font-family="monospace" font-size="12" font-weight="bold">${title}</text>
      </svg>
    `;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function createWheatRustSVG(leafColor, title) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
        <rect width="100%" height="100%" fill="#090d16" rx="16"/>
        <path d="M 175 290 L 195 20 L 215 290 Z" fill="#65a30d" stroke="#4d7c0f" stroke-width="2"/>
        <!-- Parallel Yellow Pustule Stripes -->
        <line x1="190" y1="60" x2="190" y2="240" stroke="${leafColor}" stroke-width="4" stroke-dasharray="4,6"/>
        <line x1="198" y1="80" x2="198" y2="260" stroke="${leafColor}" stroke-width="4" stroke-dasharray="4,6"/>
        <line x1="205" y1="100" x2="205" y2="220" stroke="${leafColor}" stroke-width="3" stroke-dasharray="4,6"/>
        <rect x="20" y="20" width="280" height="30" rx="8" fill="#000000" opacity="0.75"/>
        <text x="30" y="40" fill="#facc15" font-family="monospace" font-size="12" font-weight="bold">${title}</text>
      </svg>
    `;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function createHealthyLeafSVG(leafColor, title) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
        <rect width="100%" height="100%" fill="#090d16" rx="16"/>
        <path d="M 200 280 Q 195 180 190 40" stroke="#15803d" stroke-width="6" fill="none"/>
        <path d="M 190 40 C 90 90 80 200 190 270 C 310 200 300 90 190 40 Z" fill="${leafColor}" stroke="#16a34a" stroke-width="3"/>
        <path d="M 190 100 Q 130 80 110 95" stroke="#86efac" stroke-width="2" fill="none"/>
        <path d="M 190 100 Q 250 80 270 95" stroke="#86efac" stroke-width="2" fill="none"/>
        <path d="M 192 150 Q 120 140 100 160" stroke="#86efac" stroke-width="2" fill="none"/>
        <path d="M 192 150 Q 260 140 280 160" stroke="#86efac" stroke-width="2" fill="none"/>
        <rect x="20" y="20" width="280" height="30" rx="8" fill="#000000" opacity="0.75"/>
        <text x="30" y="40" fill="#4ade80" font-family="monospace" font-size="12" font-weight="bold">${title}</text>
      </svg>
    `;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    executeDiagnosis
  };
})();
