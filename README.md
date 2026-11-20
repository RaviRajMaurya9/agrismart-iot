# 🌾 AgriSmart IoT - Intelligent Agriculture Monitoring & ESP32 Dual-Station System

A complete full-stack IoT web application designed for modern smart farming. The system connects with an **ESP32 DevKit V1 (Dual-Core 240MHz)** microcontroller for environmental telemetry (DHT11, 12-Bit ADC1 Capacitive Soil, Flame, Relay Pump) and an **AI-Thinker ESP32-CAM** module for real-time live field video streaming, night vision, and flashlight control.

---

## 🚀 Key Features

### 1. 🌿 Farmer-Accurate Plant Disease AI Diagnostic Center
- **High-Accuracy Agricultural Pathologies**: Covers 25+ diseases across major agricultural crops (Tomato, Potato, Rice/Paddy, Wheat, Cotton, Chilli, Corn/Maize, Apple, Cucumber, and Healthy specimens).
- **Interactive Lesion Reticle Overlay**: Highlights detected infected spots directly on top of the farmer's leaf photo.
- **Farmer-Friendly Plain Language (Bilingual Terms)**:
  - Regional & Hindi names: *टमाटर अगेती झुलसा, धान का झोंका रोग, गेहूं का पीला रतुआ, कपास का पत्ती मरोड़*.
  - **What is happening to your plant?**: Clear, non-technical explanation.
  - **Estimated Harvest Loss Risk**: Quantitative percentage risk (e.g. 20%–35% yield loss if untreated).
  - **Immediate 15-Liter Sprayer Pump Tank Recipe**: Exact chemical name and measuring ratio (e.g., *Mix 30g Mancozeb 75% WP in a 15-Liter sprayer tank*).
  - **Low-Cost Zero-Budget Organic Remedy**: Farm-ready natural preparations (*sour buttermilk + copper sulfate, neem seed kernel extract*).
  - **3-Day Farmer Recovery Plan**: Day 1 (Chemical spray), Day 3 (Bio-fungicide), Day 7 (Micronutrient canopy recovery).
- **🔊 Farmer Voice Assistant (Audio Speech Readout)**: Click **"Listen to Advice"** to have the diagnosis and spray remedy read aloud in clear speech!
- **Live Sensor Correlation**: Automatically warns if current DHT11 humidity or temperature creates an active breeding ground for spores.

### 2. 📹 AI-Thinker ESP32-CAM Live Field Surveillance
- **Direct WiFi MJPEG Live Stream**: Connects to the physical ESP32-CAM stream URL (`http://[IP]:81/stream`).
- **Turbo Zero-Lag Acceleration Engine**: Double-buffered HTML5 Canvas engine eliminates video lag and frame delays.
- **Onboard Flashlight / Torch Control**: Remotely toggles the ultra-bright GPIO 4 white LED on the ESP32-CAM for night inspections.
- **Resolution Switcher**: Toggle between QVGA (320x240 @ 30fps), VGA (640x480), and SVGA (800x600).
- **Field Snapshot Capture**: High-resolution snapshots saved directly to the **Snapshot Gallery** with sensor stamps.
- **Field Simulation Fallback**: Animated backup simulation when the physical camera is in transit.
- **Night Vision IR Mode**: Infrared matrix filter for night crop viewing.
- **Live Telemetry HUD**: Overlays ESP32 Temperature, Humidity, Soil, Flame, Pump, and GPS data directly over the video stream.

### 3. 📊 IoT Field Monitoring & Pump Control Dashboard
- **DHT11**: Temperature (°C/°F) and Humidity (%) on GPIO 4 with heat stress & fungal risk indicators.
- **Capacitive Soil Sensor (GPIO 34 ADC1)**: 0–100% moisture gauge and raw 12-bit analog ADC reading (0–4095).
- **Flame / Fire Sensor (GPIO 15)**: Fire hazard alarm banner + synthesized audio siren alarm + automatic pump safety cutoff.
- **Water Pump Controller (GPIO 23)**: Manual tactile toggle + Auto-Irrigation mode based on soil moisture thresholds.
- **Live Historical Graph**: Real-time line chart plotting dynamic trends over time.

### 4. 🌦️ 10-Day Agricultural Weather Forecast
- High-resolution agrometeorological forecast via **Open-Meteo API**.
- Daily High/Low temperatures, rain probability (%), wind speed, relative humidity, UV index, and **FAO-56 Evapotranspiration (ET0)**.
- Tailored spray & irrigation advisories.

### 5. 🔌 Hardware Wiring & Firmware Guides
- `esp32_code/esp32_agriculture.ino`: Complete firmware for ESP32 DevKit V1 with 12-bit ADC mapping on GPIO 34, DHT11 on GPIO 4, Flame on GPIO 15, and Relay on GPIO 23.
- `esp32_cam/esp32_cam_firmware.ino`: Complete firmware for AI-Thinker ESP32-CAM with zero-lag MJPEG stream, snapshot capture, and flashlight control.

---

## 🏃 How to Run

1. **Start the Web Server**:
   ```bash
   npm start
   ```
   *(Or double-click `start.bat`)*
2. **Open in Browser**:
   Visit **`http://localhost:3000`**
3. Navigate to:
   - **Crop Disease Monitor**: To click/upload leaf photos, see detected lesions, and listen to the voice doctor.
   - **ESP32-CAM Live View**: Enter your ESP32-CAM IP (default: `192.168.1.150`), view the live stream, toggle the flashlight, or take snapshots!
   - **Hardware & Code**: View schematics, pinout connections, and download the ready-to-flash Arduino `.ino` files.

---

© 2026 AgriSmart IoT - Intelligent Agriculture Monitoring System.
