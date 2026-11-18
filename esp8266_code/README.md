# ESP8266 NodeMCU Agriculture Monitoring Wiring & Setup Guide

This folder contains the complete, battle-tested Arduino firmware (`esp8266_agriculture.ino`) for connecting an ESP8266 module to the **AgriSmart Webpage Monitoring System**.

---

## 📌 Pinout & Circuit Connection Table

| Sensor / Component | Pin on Component | ESP8266 NodeMCU Pin | GPIO | Description / Power |
| :--- | :--- | :--- | :--- | :--- |
| **DHT11 (Temp & Humidity)** | VCC | 3.3V or Vin | - | 3.3V or 5V Power |
| | GND | GND | - | Ground |
| | DATA | **D2** | **GPIO 4** | 10k pull-up resistor optional |
| **Capacitive Soil Sensor** | VCC | 3.3V (Recommended) | - | 3.3V to minimize corrosion |
| | GND | GND | - | Ground |
| | AOUT | **A0** | **ADC0** | Analog Voltage (0 - 1.0V/3.3V) |
| **Flame Sensor** | VCC | 3.3V or Vin | - | 3.3V - 5V Power |
| | GND | GND | - | Ground |
| | DO (Digital Out) | **D5** | **GPIO 14** | Active LOW when flame detected |
| **5V Relay (Water Pump)** | VCC | Vin (5V) | - | Relay coils need 5V |
| | GND | GND | - | Common Ground |
| | IN | **D6** | **GPIO 12** | Active LOW Relay trigger |
| **Water Pump (12V / 5V DC)**| (+) Wire | Relay COM -> NO | - | Switched through Relay |
| | (-) Wire | Power Supply (-) | - | Direct Ground |

---

## 🛠️ Required Arduino Libraries
In Arduino IDE, open **Tools -> Manage Libraries...** and install:
1. **DHT sensor library** by Adafruit
2. **Adafruit Unified Sensor** by Adafruit
3. **ArduinoJson** (v6 or v7) by Benoit Blanchon

---

## 🚀 How to Run
1. Start your AgriSmart web server:
   ```bash
   npm start
   ```
   Web server will start on `http://localhost:3000`.

2. Find your computer's local IP address:
   - On Windows: Run `ipconfig` (look for IPv4 Address, e.g. `192.168.1.100`).
   - On Mac/Linux: Run `ifconfig` or `ip a`.

3. In `esp8266_agriculture.ino`, update:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Name";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   const char* SERVER_HOST   = "192.168.1.100"; // Your PC IP
   const int   SERVER_PORT   = 3000;
   ```

4. Select Board: **NodeMCU 1.0 (ESP-12E Module)** and select your COM Port.
5. Click **Upload** and open **Serial Monitor** at **115200 baud**.
6. Open your browser at `http://localhost:3000` to watch live data stream and control the water pump!
