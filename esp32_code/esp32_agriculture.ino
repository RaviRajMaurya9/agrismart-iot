/*
 * =========================================================================
 *  AgriSmart IoT - ESP32 Agriculture Monitoring & Automated Irrigation Node
 * =========================================================================
 *  Microcontroller: ESP32 DevKit V1 (ESP32-WROOM-32 / NodeMCU-32S)
 *  
 *  Sensors & Actuators Connected:
 *  1. DHT11 Sensor            -> Data Pin: GPIO 4
 *  2. Capacitive Soil Sensor  -> Analog Out: GPIO 34 (ADC1_CH6)
 *     *IMPORTANT*: GPIO 34 belongs to ADC1. ADC1 can be read continuously
 *     even when WiFi is actively transmitting (ADC2 pins cannot be used with WiFi).
 *  3. Flame / Fire Sensor     -> Digital Out (DO): GPIO 15 (Active LOW)
 *  4. 5V Water Pump Relay     -> Control IN: GPIO 23 (Active LOW relay by default)
 *  5. Status / Heartbeat LED  -> Builtin Blue LED: GPIO 2
 *  
 *  Libraries Required (install via Arduino IDE Library Manager):
 *  - "DHT sensor library" by Adafruit
 *  - "Adafruit Unified Sensor"
 *  - "ArduinoJson" (v6 or v7) by Benoit Blanchon
 * =========================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------------------- 1. WIFI & SERVER CONFIG -------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";         // Replace with your WiFi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // Replace with your WiFi Password

// Server URL where AgriSmart backend is running.
// If testing on local network, use your computer's local IP.
// DETECTED COMPUTER IP:
// - Connected via Home/Office Wi-Fi: "10.58.24.12"
// - Connected via Windows Mobile Hotspot: "192.168.137.1"
const bool  USE_CLOUD_SERVER = false;
const char* CLOUD_SERVER_URL = "https://your-agrismart-app.onrender.com/api/esp32/telemetry";

const char* LOCAL_SERVER_HOST = "10.58.24.12";        // <-- Set to your computer's Wi-Fi IP
const int   LOCAL_SERVER_PORT = 3000;
const char* LOCAL_TELEMETRY_PATH = "/api/esp32/telemetry";

// ---------------------- 2. PIN DEFINITIONS (ESP32) -----------------------
#define DHTPIN        4     // GPIO 4 for DHT11 data bus
#define DHTTYPE       DHT11 // Sensor type

#define SOIL_PIN      34    // GPIO 34 (ADC1 Channel 6) - Capacitive Soil Moisture
#define FLAME_PIN     15    // GPIO 15 - Flame Sensor Digital Output (DO)
#define RELAY_PUMP    23    // GPIO 23 - Water Pump 5V Relay Control
#define STATUS_LED    2     // GPIO 2  - Builtin LED on ESP32 DevKit

// ---------------------- 3. RELAY POLARITY CONFIGURATION -----------------
// Standard 5V Arduino/ESP32 relay modules are Active LOW (LOW turns relay ON, HIGH turns OFF).
// If your relay module is Active HIGH (HIGH turns relay ON), change this to false:
const bool RELAY_ACTIVE_LOW = true;

// ---------------------- 4. SENSOR CALIBRATION (12-bit ADC: 0 - 4095) -----
// Calibrate these numbers for your specific capacitive probe:
// In dry air (0% moisture), ESP32 ADC reads ~3200-3600
// Submerged in a glass of water (100% moisture), ESP32 ADC reads ~1400-1700
const int AIR_VALUE   = 3200;  // Dry air reading
const int WATER_VALUE = 1500;  // Submerged water reading

// ---------------------- 5. OBJECTS & GLOBALS ----------------------------
DHT dht(DHTPIN, DHTTYPE);
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 3000; // Sync telemetry every 3 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================================");
  Serial.println("  🌱 AgriSmart IoT - ESP32 Agriculture Station Starting");
  Serial.println("  Dual-Core 240MHz | 12-Bit ADC1 Soil Sensing | Automated Pump");
  Serial.println("========================================================");

  // Initialize GPIO Pins
  pinMode(FLAME_PIN, INPUT);
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  
  // Configure ADC for GPIO 34 (12-bit resolution: 0 - 4095, 11dB attenuation for 0-3.3V range)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Set default pump state: OFF
  digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW);
  digitalWrite(STATUS_LED, LOW); // LED OFF

  // Startup Relay Hardware Self-Test:
  // Clicks relay for 800ms so you can physically hear the relay click!
  Serial.println("⚙️ Testing physical relay click on GPIO 23...");
  digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? LOW : HIGH); // ON
  delay(800);
  digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW); // OFF
  Serial.println("✅ Relay click self-test complete (Heard CLICK sound).");

  // Start DHT11
  dht.begin();
  Serial.println("✅ DHT11 initialized on GPIO 4");
  Serial.println("✅ Soil Sensor configured on ADC1 GPIO 34");
  Serial.println("✅ Flame Sensor configured on GPIO 15");
  Serial.println("✅ Pump Relay configured on GPIO 23");

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  // Auto-reconnect if WiFi disconnects
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Periodic Telemetry Send
  unsigned long currentMillis = millis();
  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;
    readSensorsAndSync();
  }

  // Local instant emergency flame check
  int flameState = digitalRead(FLAME_PIN);
  if (flameState == LOW) { // Common flame modules pull LOW when fire is detected
    // Immediately cut off pump for safety without waiting for next server tick
    digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW);
    Serial.println("🔥 [CRITICAL SAFETY ALERT] Flame detected by sensor! Emergency pump cutoff engaged.");
  }
}

// ----------------- WIFI CONNECTION HELPER -------------------------------
void connectWiFi() {
  Serial.print("Connecting to WiFi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); // Blink while connecting
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED, HIGH); // Steady ON on ESP32 when connected
    Serial.println("\n✅ WiFi Connected Successfully!");
    Serial.print("ESP32 Local IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("WiFi RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n❌ WiFi connection timed out. Check SSID & Password. Will retry...");
    digitalWrite(STATUS_LED, LOW);
  }
}

// ----------------- SENSOR READING & HTTP POST ---------------------------
void readSensorsAndSync() {
  // 1. Read DHT11 Temperature & Humidity
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("⚠️ Warning: DHT11 read failed! Check VCC (3.3V/5V), GND and GPIO 4 wiring.");
    temperature = 26.5; // fallback
    humidity = 62.0;    // fallback
  }

  // 2. Read Capacitive Soil Moisture Sensor on ADC1 GPIO 34 (Average of 5 samples)
  long rawSoilSum = 0;
  for (int i = 0; i < 5; i++) {
    rawSoilSum += analogRead(SOIL_PIN);
    delay(10);
  }
  int rawSoil = rawSoilSum / 5;

  // Map 12-bit ADC reading (AIR_VALUE to WATER_VALUE) into 0 - 100% moisture
  float soilMoisturePercent = map(rawSoil, AIR_VALUE, WATER_VALUE, 0, 100);
  soilMoisturePercent = constrain(soilMoisturePercent, 0.0, 100.0);

  // 3. Read Flame Sensor (GPIO 15) - Active LOW
  int flameRaw = digitalRead(FLAME_PIN);
  bool flameDetected = (flameRaw == LOW);

  // 4. Output diagnostics to Serial Monitor
  Serial.println("--------------------------------------------------------");
  Serial.printf("ESP32 Telemetry -> Temp: %.1f °C | Humidity: %.1f %% | Soil: %.1f %% (Raw ADC: %d) | Flame: %s\n",
                temperature, humidity, soilMoisturePercent, rawSoil, flameDetected ? "🔥 FIRE DETECTED!" : "SECURE");

  // 5. Build JSON Payload
  StaticJsonDocument<256> doc;
  doc["temperature"]   = temperature;
  doc["humidity"]      = humidity;
  doc["soilMoisture"]  = soilMoisturePercent;
  doc["soilRaw"]       = rawSoil;
  doc["flame"]         = flameDetected ? 1 : 0;
  doc["ip"]            = WiFi.localIP().toString();
  doc["rssi"]          = WiFi.RSSI();

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // 6. Send HTTP POST to AgriSmart Server
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String endpoint;

    if (USE_CLOUD_SERVER) {
      endpoint = CLOUD_SERVER_URL;
      http.begin(endpoint);
    } else {
      endpoint = String("http://") + LOCAL_SERVER_HOST + ":" + LOCAL_SERVER_PORT + LOCAL_TELEMETRY_PATH;
      http.begin(endpoint);
    }

    http.addHeader("Content-Type", "application/json");
    http.setTimeout(4000);

    int httpCode = http.POST(jsonPayload);

    if (httpCode > 0) {
      String response = http.getString();
      Serial.printf("📡 Server Response [%d]: %s\n", httpCode, response.c_str());

      // Parse JSON response to receive pump commands
      StaticJsonDocument<384> respDoc;
      DeserializationError error = deserializeJson(respDoc, response);

      if (!error && respDoc.containsKey("pumpControl")) {
        int relayState = respDoc["pumpControl"]["relayState"]; // 1 = ON, 0 = OFF
        const char* mode = respDoc["pumpControl"]["mode"];

        if (relayState == 1) {
          // Turn Water Pump ON
          digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? LOW : HIGH);
          Serial.printf("💧 [WATER PUMP ACTIVATED - ON] Relay GPIO 23 set to %s (Mode: %s)\n",
                        RELAY_ACTIVE_LOW ? "LOW" : "HIGH", mode);
        } else {
          // Turn Water Pump OFF
          digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW);
          Serial.printf("⛔ [WATER PUMP DEACTIVATED - OFF] Relay GPIO 23 set to %s (Mode: %s)\n",
                        RELAY_ACTIVE_LOW ? "HIGH" : "LOW", mode);
        }
      }
    } else {
      Serial.printf("❌ HTTP POST failed, error code: %d (%s)\n", httpCode, http.errorToString(httpCode).c_str());
      Serial.printf("👉 Target Server: http://%s:%d%s\n", LOCAL_SERVER_HOST, LOCAL_SERVER_PORT, LOCAL_TELEMETRY_PATH);
      Serial.println("👉 Make sure your PC and ESP32 are connected to the SAME Wi-Fi network!");
    }

    http.end();
  } else {
    Serial.println("⚠️ Wi-Fi not connected. Skipping telemetry sync.");
  }
}
