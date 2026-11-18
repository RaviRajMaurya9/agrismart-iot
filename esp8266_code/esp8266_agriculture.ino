/*
 * =========================================================================
 *  AgriSmart IoT - ESP8266 Agriculture Monitoring & Automated Irrigation
 * =========================================================================
 *  Microcontroller: ESP8266 (NodeMCU v1.0 / Wemos D1 Mini)
 *  
 *  Sensors & Actuators Connected:
 *  1. DHT11 Sensor            -> Data Pin: GPIO 4 (D2)
 *  2. Capacitive Soil Sensor  -> Analog Out: A0
 *  3. Flame Sensor            -> Digital Out: GPIO 14 (D5)
 *  4. Water Pump 5V Relay     -> IN: GPIO 12 (D6)
 *  5. Status / Heartbeat LED  -> Builtin LED GPIO 2 (D4)
 *  
 *  Libraries Required (install via Arduino Library Manager):
 *  - "DHT sensor library" by Adafruit
 *  - "Adafruit Unified Sensor"
 *  - "ArduinoJson" (v6 or v7)
 * =========================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------------------- 1. WIFI & SERVER CONFIG -------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";         // Replace with your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // Replace with your WiFi password

// Server IP address and port where the AgriSmart webpage backend is running
// (If running on your laptop/PC on the same WiFi network, use PC's local IP e.g. 192.168.1.50)
const char* SERVER_HOST   = "192.168.1.100";
const int   SERVER_PORT   = 3000;
const char* TELEMETRY_URL = "/api/esp8266/telemetry";

// ---------------------- 2. PIN DEFINITIONS ------------------------------
#define DHTPIN        4     // D2 on NodeMCU (GPIO 4)
#define DHTTYPE       DHT11 // DHT 11 sensor model

#define SOIL_PIN      A0    // Analog Input A0 for Capacitive Soil Moisture
#define FLAME_PIN     14    // D5 on NodeMCU (GPIO 14)
#define RELAY_PUMP    12    // D6 on NodeMCU (GPIO 12) - Active LOW / HIGH Relay
#define STATUS_LED    2     // D4 (Builtin Blue LED, Active LOW)

// Soil Calibration Values (Tune these according to your sensor dry vs water immersion)
const int AIR_VALUE   = 790;  // Raw ADC in completely dry air (~0% moisture)
const int WATER_VALUE = 360;  // Raw ADC submerged in water (~100% moisture)

// ---------------------- 3. OBJECTS & GLOBALS ----------------------------
DHT dht(DHTPIN, DHTTYPE);
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 3000; // Send telemetry every 3 seconds

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n========================================");
  Serial.println("  AgriSmart IoT - ESP8266 Node Initializing");
  Serial.println("========================================");

  // Initialize Pins
  pinMode(FLAME_PIN, INPUT);
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);

  // Default pump state = OFF (Relay OFF: HIGH for Active-LOW relays)
  digitalWrite(RELAY_PUMP, HIGH);
  digitalWrite(STATUS_LED, HIGH); // LED OFF

  // Start DHT
  dht.begin();

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  // Check WiFi status and reconnect if dropped
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Periodic Telemetry Send
  unsigned long currentMillis = millis();
  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;
    readSensorsAndSync();
  }

  // Immediate Flame Detection Interrupt / Safety Check
  int flameState = digitalRead(FLAME_PIN);
  if (flameState == LOW) { // Most flame sensor modules pull LOW on flame detection
    Serial.println("⚠️ [FIRE WARNING] Flame detected locally by sensor!");
  }
}

// ----------------- WIFI CONNECTION HELPER -------------------------------
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
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
    digitalWrite(STATUS_LED, LOW); // Solid ON when connected
    Serial.println("\n✅ WiFi Connected Successfully!");
    Serial.print("ESP8266 IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n❌ Failed to connect to WiFi. Retrying in background...");
  }
}

// ----------------- SENSOR READING & HTTP POST ---------------------------
void readSensorsAndSync() {
  // 1. Read DHT11 Temperature & Humidity
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  // Fallback if sensor fails
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("⚠️ Failed to read from DHT sensor!");
    temperature = 25.0;
    humidity = 60.0;
  }

  // 2. Read Capacitive Soil Moisture Sensor (A0)
  int rawSoil = analogRead(SOIL_PIN);
  // Map raw analog value to 0-100% moisture
  float soilMoisturePercent = map(rawSoil, AIR_VALUE, WATER_VALUE, 0, 100);
  soilMoisturePercent = constrain(soilMoisturePercent, 0.0, 100.0);

  // 3. Read Flame Sensor (D5) - active LOW on common modules
  int flameRaw = digitalRead(FLAME_PIN);
  bool flameDetected = (flameRaw == LOW);

  // 4. Print to Serial Monitor
  Serial.println("----------------------------------------------");
  Serial.printf("Temp: %.1f °C | Humidity: %.1f %% | Soil: %.1f %% (Raw: %d) | Flame: %s\n",
                temperature, humidity, soilMoisturePercent, rawSoil, flameDetected ? "🔥 YES!" : "Normal");

  // 5. Build JSON Payload
  StaticJsonDocument<256> doc;
  doc["temperature"]   = temperature;
  doc["humidity"]      = humidity;
  doc["soilMoisture"]  = soilMoisturePercent;
  doc["soilRaw"]       = rawSoil;
  doc["flame"]         = flameDetected ? 1 : 0;
  doc["ip"]            = WiFi.localIP().toString();

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // 6. Send HTTP POST to AgriSmart Backend
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;

    String endpoint = String("http://") + SERVER_HOST + ":" + SERVER_PORT + TELEMETRY_URL;
    http.begin(client, endpoint);
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.POST(jsonPayload);

    if (httpCode > 0) {
      String response = http.getString();
      Serial.printf("📡 HTTP Response [%d]: %s\n", httpCode, response.c_str());

      // Parse Server Response to control Pump Relay!
      StaticJsonDocument<300> respDoc;
      DeserializationError error = deserializeJson(respDoc, response);

      if (!error && respDoc.containsKey("pumpControl")) {
        int relayState = respDoc["pumpControl"]["relayState"]; // 1 = ON, 0 = OFF
        const char* stateText = respDoc["pumpControl"]["pumpStateText"];

        // Control Relay Pin (Active LOW relay: LOW = ON, HIGH = OFF)
        if (relayState == 1) {
          digitalWrite(RELAY_PUMP, LOW);  // Turn Water Pump ON
          Serial.println("💧 WATER PUMP IS: [ ON ]");
        } else {
          digitalWrite(RELAY_PUMP, HIGH); // Turn Water Pump OFF
          Serial.println("⛔ WATER PUMP IS: [ OFF ]");
        }
      }
    } else {
      Serial.printf("❌ HTTP POST failed, error: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
  }
}
