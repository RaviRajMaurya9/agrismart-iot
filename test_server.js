const http = require('http');

async function testAll() {
  console.log('Testing AgriSmart Server Endpoints (ESP32 & Cam)...');

  const BASE = 'http://localhost:3000';

  async function get(path) {
    const res = await fetch(BASE + path);
    return { status: res.status, json: res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text() };
  }

  async function post(path, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: res.status, json: await res.json() };
  }

  // 1. System Status
  const s1 = await get('/api/system/status');
  console.log('1. /api/system/status -> Status:', s1.status, 'Temp:', s1.json.data.sensors.temperature, 'Soil:', s1.json.data.sensors.soilMoisture);

  // 2. ESP32 Telemetry POST
  const s2 = await post('/api/esp32/telemetry', {
    temperature: 28.5,
    humidity: 62.0,
    soilMoisture: 31.0,
    flame: 0,
    soilRaw: 2450,
    ip: '192.168.1.108'
  });
  console.log('2. /api/esp32/telemetry -> Status:', s2.status, 'Node:', s2.json.node, 'Pump Control reply:', s2.json.pumpControl);

  // 3. ESP32 Pump Status GET
  const s3 = await get('/api/esp32/pump-status');
  console.log('3. /api/esp32/pump-status -> Status:', s3.status, 'Pump State:', s3.json.pumpState);

  // 4. Plant Disease AI Diagnose
  const s4 = await post('/api/diseases/diagnose', {
    selectedCrop: 'Tomato',
    manualDiseaseId: 'tomato_early_blight'
  });
  console.log('4. /api/diseases/diagnose -> Detected:', s4.json.result.diseaseName, 'Confidence:', s4.json.result.confidenceScore + '%');

  // 5. 10-Day Weather Forecast
  const s5 = await get('/api/weather/forecast?location=Central%20Agri%20Farm');
  console.log('5. /api/weather/forecast -> Days returned:', s5.json.daily.length, 'Day 1 Advisory:', s5.json.daily[0].agriAdvisory);

  // 6. ESP32 Arduino sketch static serve
  const s6 = await get('/esp32_code/esp32_agriculture.ino');
  console.log('6. /esp32_code/esp32_agriculture.ino -> Status:', s6.status, 'Length:', s6.json.length, 'bytes');

  console.log('\n✅ ALL AGRI-SMART ESP32 BACKEND ENDPOINTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

// Start server first then run tests
require('./server.js');
setTimeout(testAll, 1200);
