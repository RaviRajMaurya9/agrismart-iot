# AgriSmart IoT - ESP32 Agriculture Node & Automated Irrigation

This folder contains the complete, battle-tested Arduino C++ firmware for the **ESP32 DevKit V1** (ESP32-WROOM-32 / NodeMCU-32S) sensor node.

---

## 🌟 Why ESP32 for Smart Agriculture?

| Feature | ESP8266 (Legacy) | ESP32 (Upgraded) |
| :--- | :--- | :--- |
| **Processor** | Single-Core 80MHz | **Dual-Core Tensilica Xtensa @ 240MHz** |
| **ADC Resolution** | 10-bit (0–1023) | **12-bit (0–4095)** for ultra-precise soil moisture |
| **ADC Channels** | 1 Analog Pin (A0, 0–1.0V) | **18 Channels across 2 SAR ADCs (0–3.3V)** |
| **WiFi & Bluetooth** | 2.4GHz b/g/n only | **2.4GHz b/g/n + Bluetooth 4.2 / BLE** |
| **GPIOs** | Limited usable GPIOs | **30+ GPIOs with touch, DAC, PWM & hardware interrupts** |
| **Stability** | Occasional watchdog resets under heavy HTTP | **Independent Core 0 (WiFi/Networking) + Core 1 (Sensors/Actuators)** |

---

## ⚡ Circuit Wiring & Pinout Guide

| Sensor / Module | Sensor Pin | ESP32 DevKit Pin | ESP32 GPIO | Description / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **DHT11 Sensor** | VCC | 3V3 or 5V | — | Power (+3.3V recommended) |
| | GND | GND | — | Ground |
| | DATA | **D4** | **GPIO 4** | Digital single-bus data communication |
| **Capacitive Soil Sensor v1.2** | VCC | 3V3 | — | Power (+3.3V for reliable analog range) |
| | GND | GND | — | Ground |
| | AOUT | **D34** | **GPIO 34 (ADC1_CH6)** | **ADC1 Input Only pin (Immune to WiFi conflicts!)** |
| **Flame / Fire Sensor** | VCC | 3V3 or 5V | — | Power supply |
| | GND | GND | — | Ground |
| | DO (Digital Out) | **D15** | **GPIO 15** | Digital active LOW signal when fire is sensed |
| **5V Single-Channel Relay (Water Pump)** | VCC | 5V (VIN) | — | Powered from 5V VIN pin |
| | GND | GND | — | Ground |
| | IN (Trigger) | **D23** | **GPIO 23** | Active LOW relay trigger (LOW = ON, HIGH = OFF) |
| **Built-in Status LED** | Onboard | **D2** | **GPIO 2** | Flashes on WiFi search, solid ON when connected |

> ⚠️ **CRITICAL ESP32 HARDWARE NOTE ON ADC1 vs ADC2**:
> On the ESP32, **ADC2** pins (GPIO 0, 2, 4, 12, 13, 14, 15, 25, 26, 27) are multiplexed with the internal WiFi driver. If you attempt to read an analog sensor on ADC2 while WiFi is active, `analogRead()` will return erroneous or zero values.
> In this design, the capacitive soil sensor is connected to **GPIO 34**, which is part of **ADC1** (`ADC1_CH6`). ADC1 operates 100% independently of the WiFi modem, ensuring flawless 24/7 analog telemetry!

---

## 🛠️ Arduino IDE Setup

### 1. Install ESP32 Board Package
1. Open **Arduino IDE** $\rightarrow$ **File** $\rightarrow$ **Preferences**.
2. In **Additional Boards Manager URLs**, paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Open **Tools** $\rightarrow$ **Board** $\rightarrow$ **Boards Manager**, search for `esp32`, and install **esp32 by Espressif Systems**.
4. Select board: **Tools** $\rightarrow$ **Board** $\rightarrow$ **ESP32 Arduino** $\rightarrow$ **ESP32 Dev Module** (or **DOIT ESP32 DEVKIT V1**).

### 2. Required Libraries
Install the following via **Sketch** $\rightarrow$ **Include Library** $\rightarrow$ **Manage Libraries**:
1. `DHT sensor library` by Adafruit
2. `Adafruit Unified Sensor` by Adafruit
3. `ArduinoJson` (v6 or v7) by Benoit Blanchon

---

## 🧪 Soil Moisture Sensor Calibration (12-bit ADC)

Because soil probes vary slightly in manufacturing, perform a quick 1-minute calibration:

1. Flash the sketch to your ESP32 and open the Serial Monitor at **115200 baud**.
2. **Dry Air Test**: Hold the capacitive probe completely in air. Note the raw ADC value printed in Serial (typically `~3200` to `~3500`). Set this as `AIR_VALUE` in the code:
   ```cpp
   const int AIR_VALUE = 3200;
   ```
3. **Water Test**: Dip the capacitive probe up to the white indicator line into a cup of water (do not wet the top electronics!). Note the raw ADC value (typically `~1400` to `~1600`). Set this as `WATER_VALUE` in the code:
   ```cpp
   const int WATER_VALUE = 1500;
   ```

---

## 🌐 Connecting to AgriSmart Web Server

### Local Network Connection
In `esp32_agriculture.ino`:
```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASS";

const bool  USE_CLOUD_SERVER = false;
const char* LOCAL_SERVER_HOST = "192.168.1.100"; // IP of PC running `node server.js`
const int   LOCAL_SERVER_PORT = 3000;
```

### Cloud Deployed Connection (Render / AWS)
```cpp
const bool  USE_CLOUD_SERVER = true;
const char* CLOUD_SERVER_URL = "https://your-agrismart-app.onrender.com/api/esp32/telemetry";
```
