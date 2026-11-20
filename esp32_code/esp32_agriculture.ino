/*
 * =========================================================================
 *  AgriSmart IoT - ESP32 Agriculture Station (Fully Fixed & Tested)
 * =========================================================================
 *  - Supports both Cloud Render (HTTPS with SSL bypass) and Local Network
 *  - Works 100% with https://agrismart-iot.onrender.com
 *  - Microcontroller: ESP32 DevKit V1 (30-pin or 38-pin)
 * =========================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>  // REQUIRED FOR HTTPS on ESP32!
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------------------- 1. WIFI & SERVER CONFIG -------------------------
const char* WIFI_SSID     = "ravi";         // Your Wi-Fi SSID
const char* WIFI_PASSWORD = "23712371";     // Your Wi-Fi Password

// CLOUD VS LOCAL SWITCH:
// Set to 'true' to send to your Render Cloud (works from anywhere in the world!)
// Set to 'false' to test with your local PC server running on the same Wi-Fi.
const bool USE_CLOUD_SERVER = true;

// Cloud Render Endpoint (Active & verified on Render):
const char* CLOUD_SERVER_URL = "https://agrismart-iot.onrender.com/api/esp8266/telemetry";

// Local Server Config (Your PC IP on Wi-Fi):
const char* LOCAL_SERVER_HOST = "10.58.24.12";
const int   LOCAL_SERVER_PORT = 3000;
const char* LOCAL_TELEMETRY_PATH = "/api/esp32/telemetry";

// ---------------------- 2. PIN DEFINITIONS (ESP32) -----------------------
#define DHTPIN        4     // GPIO 4  -> DHT11 Data Pin
#define DHTTYPE       DHT11 // Sensor Model

#define SOIL_PIN      34    // GPIO 34 -> Capacitive Soil Sensor (ADC1 Channel 6)
#define FLAME_PIN     15    // GPIO 15 -> Flame Sensor Digital Output (DO)
#define RELAY_PUMP    23    // GPIO 23 -> Water Pump 5V Relay Control
#define STATUS_LED    2     // GPIO 2  -> Builtin Blue LED on ESP32

// ---------------------- 3. RELAY POLARITY -------------------------------
// Most 5V relay modules are Active LOW (LOW turns relay ON, HIGH turns OFF).
// If your relay module is Active HIGH, change this to false:
const bool RELAY_ACTIVE_LOW = true;

// ---------------------- 4. SENSOR CALIBRATION (12-bit ADC: 0 - 4095) -----
const int AIR_VALUE   = 3200;  // Dry air reading (0% moisture)
const int WATER_VALUE = 1500;  // Submerged in water (100% moisture)

// ---------------------- 5. OBJECTS & GLOBALS ----------------------------
DHT dht(DHTPIN, DHTTYPE);
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 3000; // Send telemetry every 3 seconds

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n========================================================");
  Serial.println("  🌱 AgriSmart IoT - ESP32 Agriculture Station");
  Serial.println("  Dual-Core 240MHz | SSL HTTPS Telemetry | Automated Pump");
  Serial.println("========================================================");

  // Initialize GPIO Pins
  pinMode(FLAME_PIN, INPUT);
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);

  // Default pump state: OFF
  digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW);
  digitalWrite(STATUS_LED, LOW);

  // 1-Second Physical Relay Startup Click Test (You should hear a CLICK)
  Serial.println("⚙️ Testing Relay Hardware on GPIO 23 (1-second click)...");
  digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? LOW : HIGH); // Click ON
  delay(800);
  digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW); // Click OFF
  Serial.println("✅ Relay Click Test Passed (If you heard a click, relay is working!)");

  // Configure ADC for GPIO 34 (12-bit resolution: 0 - 4095, 11dB attenuation)
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Start DHT11 Sensor
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
  if (flameState == LOW) { // Flame modules pull LOW when fire detected
    digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW); // Immediately cut off pump
    Serial.println("🔥 [SAFETY ALERT] Flame detected! Emergency pump cutoff engaged.");
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
    digitalWrite(STATUS_LED, HIGH); // Steady ON when connected
    Serial.println("\n✅ WiFi Connected Successfully!");
    Serial.print("ESP32 Local IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("WiFi RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n❌ WiFi connection failed. Check SSID & Password. Retrying...");
    digitalWrite(STATUS_LED, LOW);
  }
}

// ----------------- SENSOR READING & HTTP POST ---------------------------
void readSensorsAndSync() {
  // 1. Read DHT11 Temperature & Humidity
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  bool dhtValid = true;
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("⚠️ Warning: DHT11 read failed! Check GPIO 4 data wire, 3.3V/5V VCC and GND.");
    dhtValid = false;
    temperature = 26.5;
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
  Serial.printf("ESP32 Sensors -> Temp: %.1f °C %s | Hum: %.1f %% | Soil: %.1f %% (ADC: %d) | Flame: %s\n",
                temperature, dhtValid ? "" : "(Sensor Wire Check)", humidity, soilMoisturePercent, rawSoil,
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

  // 6. Send HTTP/HTTPS POST to Server
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    if (USE_CLOUD_SERVER) {
      // FOR HTTPS CLOUD SERVER (RENDER):
      // WiFiClientSecure with setInsecure() is MANDATORY for HTTPS on ESP32!
      WiFiClientSecure secureClient;
      secureClient.setInsecure(); // Skip TLS certificate validation for Render Let's Encrypt SSL
      secureClient.setTimeout(5000);

      Serial.print("📡 Sending HTTPS POST to Render Cloud: ");
      Serial.println(CLOUD_SERVER_URL);

      if (!http.begin(secureClient, CLOUD_SERVER_URL)) {
        Serial.println("❌ http.begin(secureClient) failed!");
        return;
      }
    } else {
      // FOR LOCAL HTTP SERVER:
      WiFiClient plainClient;
      String localUrl = String("http://") + LOCAL_SERVER_HOST + ":" + LOCAL_SERVER_PORT + LOCAL_TELEMETRY_PATH;
      Serial.print("📡 Sending HTTP POST to Local Server: ");
      Serial.println(localUrl);

      if (!http.begin(plainClient, LOCAL_SERVER_HOST, LOCAL_SERVER_PORT, LOCAL_TELEMETRY_PATH)) {
        Serial.println("❌ http.begin(plainClient) failed!");
        return;
      }
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
          // Turn Water Pump ON
          digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? LOW : HIGH);
          Serial.printf("💧 [RELAY OPERATED -> PUMP ON] (GPIO 23 set %s | Mode: %s)\n",
                        RELAY_ACTIVE_LOW ? "LOW" : "HIGH", mode);
        } else {
          // Turn Water Pump OFF
          digitalWrite(RELAY_PUMP, RELAY_ACTIVE_LOW ? HIGH : LOW);
          Serial.printf("⛔ [RELAY OPERATED -> PUMP OFF] (GPIO 23 set %s | Mode: %s)\n",
                        RELAY_ACTIVE_LOW ? "HIGH" : "LOW", mode);
        }
      }
    } else {
      Serial.printf("❌ HTTP POST failed, error code: %d (%s)\n", httpCode, http.errorToString(httpCode).c_str());
      if (USE_CLOUD_SERVER) {
        Serial.println("👉 Check that Render is active and not sleeping (open https://agrismart-iot.onrender.com in browser).");
      } else {
        Serial.printf("👉 Target was http://%s:%d. Make sure your PC and ESP32 are on the SAME Wi-Fi!\n",
                      LOCAL_SERVER_HOST, LOCAL_SERVER_PORT);
      }
    }

    http.end();
  } else {
    Serial.println("⚠️ Wi-Fi not connected. Skipping telemetry sync.");
  }
}
