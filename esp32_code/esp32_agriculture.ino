/*
 * =========================================================================
 *  AgriSmart IoT - ESP32 Agriculture Station (Production Rock-Solid Firmware)
 * =========================================================================
 *  Target Cloud: https://agrismart-iot-1.onrender.com
 *  Microcontroller: ESP32 DevKit V1 (30-pin or 38-pin)
 * =========================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>  // Required for HTTPS on ESP32
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------------------- 1. WIFI & SERVER CONFIG -------------------------
const char* WIFI_SSID     = "ravi";         // Your Wi-Fi / Hotspot SSID
const char* WIFI_PASSWORD = "23712371";     // Your Wi-Fi Password

// CLOUD SERVER SWITCH:
// Set true to stream directly to your Render Cloud:
const bool  USE_CLOUD_SERVER = true;
const char* CLOUD_SERVER_URL = "https://agrismart-iot-1.onrender.com/api/esp32/telemetry";

// Local Server Fallback (if testing on local network):
const char* LOCAL_SERVER_HOST = "10.58.24.12";
const int   LOCAL_SERVER_PORT = 3000;
const char* LOCAL_TELEMETRY_PATH = "/api/esp32/telemetry";

// ---------------------- 2. PIN DEFINITIONS -------------------------------
#define DHTPIN        4     // GPIO 4  -> DHT11 Data Pin
#define DHTTYPE       DHT11 // Sensor Model

#define SOIL_PIN      34    // GPIO 34 -> Capacitive Soil Sensor (ADC1 Channel 6)
#define FLAME_PIN     15    // GPIO 15 -> Flame Sensor Digital Output (DO)
#define RELAY_PUMP    23    // GPIO 23 -> Water Pump 5V Relay Control IN
#define STATUS_LED    2     // GPIO 2  -> Builtin Blue LED on ESP32

// ---------------------- 3. RELAY POLARITY CONFIGURATION -----------------
// Standard 5V relay modules are Active LOW (LOW turns relay ON, HIGH turns OFF).
// If your relay module is Active HIGH (HIGH turns relay ON), change this to false:
const bool RELAY_ACTIVE_LOW = true;

// ---------------------- 4. SENSOR CALIBRATION ---------------------------
const int AIR_VALUE   = 3200;  // Dry air reading (0% moisture)
const int WATER_VALUE = 1500;  // Submerged in water (100% moisture)

// ---------------------- 5. GLOBAL CLIENTS (PREVENTS STACK OVERFLOW) -----
// Declaring secureClient globally ensures ESP32 will NOT crash from loop stack overflow:
WiFiClientSecure secureClient;
WiFiClient       plainClient;
DHT              dht(DHTPIN, DHTTYPE);

unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 3000; // Send telemetry every 3 seconds

void setRelay(bool turnOn) {
  if (turnOn) {
    digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? LOW : HIGH);
  } else {
    digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================================");
  Serial.println("  🌱 AgriSmart IoT - ESP32 Agriculture Station Starting");
  Serial.println("  Target Cloud: https://agrismart-iot-1.onrender.com");
  Serial.println("========================================================");

  // Configure GPIO Pins
  pinMode(FLAME_PIN, INPUT);
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);

  // Set default pump state: OFF
  setRelay(false);
  digitalWrite(STATUS_LED, LOW);

  // -------------------------------------------------------------------
  // HARDWARE RELAY CLICK TEST (Clicks 2 times on startup)
  // Listen for the mechanical "CLICK" sound to confirm wiring!
  // -------------------------------------------------------------------
  Serial.println("\n🔊 [RELAY TEST] Clicks relay on GPIO 23 to verify wiring...");
  Serial.println("   (Make sure Relay VCC is connected to VIN / 5V, not 3.3V!)");
  
  setRelay(true);  // CLICK 1: ON
  Serial.println("   -> Relay CLICK ON");
  delay(700);
  
  setRelay(false); // CLICK 2: OFF
  Serial.println("   -> Relay CLICK OFF");
  delay(500);
  Serial.println("✅ Relay hardware self-test finished!\n");

  // Configure ADC for GPIO 34 (12-bit: 0 - 4095, 11dB attenuation)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Initialize DHT11 Sensor
  dht.begin();
  Serial.println("✅ DHT11 initialized on GPIO 4");
  Serial.println("✅ Soil Sensor configured on ADC1 GPIO 34");
  Serial.println("✅ Flame Sensor configured on GPIO 15");
  Serial.println("✅ Pump Relay configured on GPIO 23");

  // Configure Global SSL Client (Bypass cert validation for Render)
  secureClient.setInsecure();
  secureClient.setTimeout(6000);

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  // Auto-reconnect if WiFi disconnects
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Periodic Telemetry Send (every 3 seconds)
  unsigned long currentMillis = millis();
  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;
    readSensorsAndSync();
  }

  // Instant emergency flame check
  int flameState = digitalRead(FLAME_PIN);
  if (flameState == LOW) { // Flame modules pull LOW when fire detected
    setRelay(false);       // Immediately stop pump
    Serial.println("🔥 [SAFETY ALERT] Flame detected on GPIO 15! Pump cutoff engaged.");
  }
}

// ----------------- WIFI CONNECTION HELPER -------------------------------
void connectWiFi() {
  Serial.print("Connecting to WiFi SSID: '");
  Serial.print(WIFI_SSID);
  Serial.println("'...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); // Blink while connecting
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED, HIGH); // Steady ON when connected
    Serial.println("\n✅ WiFi Connected Successfully!");
    Serial.print("   ESP32 Local IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Signal (RSSI):  ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n❌ WiFi connection timed out!");
    Serial.println("👉 IMPORTANT FOR MOBILE HOTSPOTS:");
    Serial.println("   ESP32 ONLY SUPPORTS 2.4 GHz WI-FI!");
    Serial.println("   In your phone's Hotspot Settings, change 'AP Band' to 2.4 GHz");
    Serial.println("   (or on iPhone, turn on 'Maximize Compatibility').");
    digitalWrite(STATUS_LED, LOW);
  }
}

// ----------------- SENSOR READING & HTTP POST ---------------------------
void readSensorsAndSync() {
  // 1. Read DHT11 Temperature & Humidity
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  bool dhtOk = true;
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("⚠️ DHT11 Read Warning: Sensor returned NaN. Check GPIO 4 data wire, VCC (3.3V or 5V) and GND.");
    dhtOk = false;
    temperature = 26.5; // Baseline fallback
    humidity = 62.0;
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
  Serial.printf("📊 ESP32 Telemetry -> Temp: %.1f °C %s | Hum: %.1f %% | Soil: %.1f %% (ADC: %d) | Flame: %s\n",
                temperature, dhtOk ? "(Live)" : "(Check Wire)", humidity, soilMoisturePercent, rawSoil,
                flameDetected ? "🔥 FIRE DETECTED!" : "SECURE");

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

  // 6. Send HTTPS POST to Render Cloud (or Local Server)
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    if (USE_CLOUD_SERVER) {
      Serial.print("📡 Sending HTTPS POST to Render Cloud: ");
      Serial.println(CLOUD_SERVER_URL);
      http.begin(secureClient, CLOUD_SERVER_URL);
    } else {
      String localUrl = String("http://") + LOCAL_SERVER_HOST + ":" + LOCAL_SERVER_PORT + LOCAL_TELEMETRY_PATH;
      Serial.print("📡 Sending HTTP POST to Local Server: ");
      Serial.println(localUrl);
      http.begin(plainClient, LOCAL_SERVER_HOST, LOCAL_SERVER_PORT, LOCAL_TELEMETRY_PATH);
    }

    http.addHeader("Content-Type", "application/json");
    http.setTimeout(5000);

    int httpCode = http.POST(jsonPayload);

    if (httpCode > 0) {
      String response = http.getString();
      Serial.printf("✅ Server Response [%d]: %s\n", httpCode, response.c_str());

      // Parse JSON response to receive pump commands
      StaticJsonDocument<384> respDoc;
      DeserializationError error = deserializeJson(respDoc, response);

      if (!error && respDoc.containsKey("pumpControl")) {
        int relayState = respDoc["pumpControl"]["relayState"]; // 1 = ON, 0 = OFF
        const char* mode = respDoc["pumpControl"]["mode"];

        if (relayState == 1) {
          setRelay(true);  // Turn Pump Relay ON
          Serial.printf("💧 [WATER PUMP ACTIVATED - ON] Relay GPIO 23 set to %s (Mode: %s)\n",
                        RELAY_ACTIVE_LOW ? "LOW" : "HIGH", mode);
        } else {
          setRelay(false); // Turn Pump Relay OFF
          Serial.printf("⛔ [WATER PUMP DEACTIVATED - OFF] Relay GPIO 23 set to %s (Mode: %s)\n",
                        RELAY_ACTIVE_LOW ? "HIGH" : "LOW", mode);
        }
      }
    } else {
      Serial.printf("❌ HTTP POST failed, error code: %d (%s)\n", httpCode, http.errorToString(httpCode).c_str());
      Serial.println("👉 If error is -1, open https://agrismart-iot-1.onrender.com in your PC browser to ensure Render is awake.");
    }

    http.end();
  } else {
    Serial.println("⚠️ Wi-Fi not connected. Skipping telemetry sync.");
  }
}
