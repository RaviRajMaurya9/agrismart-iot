# 🌾 AgriSmart IoT - Intelligent Agriculture Monitoring & ESP32-CAM Surveillance System

A complete full-stack IoT web application designed for modern smart farming. The system connects with an **ESP8266 (NodeMCU)** microcontroller for environmental sensors (DHT11, Capacitive Soil, Flame, Relay Pump) and an **AI-Thinker ESP32-CAM** module for real-time live field video streaming, night vision, and flashlight control.

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
- **Onboard Flashlight / Torch Control**: Remotely toggles the ultra-bright GPIO 4 white LED on the ESP32-CAM for night inspections.
- **Resolution Switcher**: Toggle between VGA (640x480), SVGA (800x600), and UXGA (1600x1200).
- **Field Snapshot Capture**: High-resolution snapshots saved directly to the **Snapshot Gallery** with sensor stamps.
- **Field Simulation Fallback**: Animated backup simulation when the physical camera is in transit.
- **Night Vision IR Mode**: Infrared matrix filter for night crop viewing.
- **Live Telemetry HUD**: Overlays ESP8266 Temperature, Humidity, Soil, Flame, Pump, and GPS data directly over the video stream.

### 3. 📊 IoT Field Monitoring & Pump Control Dashboard
- **DHT11**: Temperature (°C/°F) and Humidity (%) with heat stress & fungal risk indicators.
- **Capacitive Soil Sensor**: 0–100% moisture gauge and raw analog ADC reading.
- **Flame / Fire Sensor**: Fire hazard alarm banner + synthesized audio siren alarm + automatic pump safety cutoff.
- **Water Pump Controller**: Manual tactile toggle + Auto-Irrigation mode based on soil moisture thresholds.
- **Live Historical Graph**: Real-time line chart plotting trends over time.

### 4. 🌦️ 10-Day Agricultural Weather Forecast
- High-resolution agrometeorological forecast via **Open-Meteo API**.
- Daily High/Low temperatures, rain probability (%), wind speed, relative humidity, UV index, and **FAO-56 Evapotranspiration (ET0)**.
- Tailored spray & irrigation advisories.

### 5. 🔌 Hardware Wiring & Firmware Guides
- `esp8266_code/esp8266_agriculture.ino`: Complete sketch for DHT11, Capacitive Soil, Flame, and 5V Relay.
- `esp32_cam/esp32_cam_firmware.ino`: Complete firmware for AI-Thinker ESP32-CAM with MJPEG stream, snapshot capture, and flashlight control.

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

---

© 2026 AgriSmart IoT - Intelligent Agriculture Monitoring System.
