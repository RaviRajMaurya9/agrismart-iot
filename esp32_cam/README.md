# ESP32-CAM AI-Thinker Module - Agriculture Field Surveillance Setup

This firmware transforms your **AI-Thinker ESP32-CAM** into a high-performance, real-time wireless agricultural camera directly integrated into the **AgriSmart Dashboard**.

---

## 📌 Wiring Diagram for FTDI USB Programmer to ESP32-CAM

Because the AI-Thinker ESP32-CAM lacks a built-in USB port, you use a **USB-to-UART FTDI programmer**:

| FTDI Programmer Pin | ESP32-CAM Pin | Description |
| :--- | :--- | :--- |
| **VCC (5V)** | **5V** | Power (Set FTDI jumper to 5V, ESP32-CAM needs 5V for camera stability) |
| **GND** | **GND** | Common Ground |
| **TX** | **U0R (GPIO 3)** | Serial RX |
| **RX** | **U0T (GPIO 1)** | Serial TX |
| **GND** | **GPIO 0** | ⚠️ **Connect GPIO 0 to GND ONLY while flashing!** (Disconnect after upload) |

---

## ⚙️ Arduino IDE Board Configuration

1. In Arduino IDE, open **Tools -> Board -> ESP32 Arduino -> AI Thinker ESP32-CAM**.
2. **CPU Frequency**: 240MHz (WiFi/BT)
3. **Flash Frequency**: 80MHz
4. **Flash Mode**: QIO
5. **Partition Scheme**: Huge APP (3MB No OTA/1MB SPIFFS)
6. **Upload Speed**: 115200 or 921600

---

## 🚀 Upload Steps

1. In `esp32_cam_firmware.ino`, edit your WiFi credentials:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Name";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   ```
2. Short **GPIO 0 to GND**.
3. Press the tiny **RST (Reset)** button on the back of ESP32-CAM.
4. Click **Upload** in Arduino IDE.
5. When upload finishes:
   - **Disconnect GPIO 0 from GND**.
   - Press the **RST** button once again.
6. Open **Serial Monitor** at **115200 baud** to see your ESP32-CAM IP address:
   ```
   📸 ESP32-CAM Live Stream : http://192.168.1.150:81/stream
   ```
7. In the AgriSmart Webpage, navigate to **Live Field Camera -> Connect ESP32-CAM** and paste this IP address. You will instantly see your live camera feed, control the onboard ultra-bright flashlight, and capture high-resolution snapshots!

---

## ⚡ How Lag Was Eliminated (Anti-Lag Optimization Guide)

If your ESP32-CAM was experiencing high latency, stutter, or delayed video:

1. **`CAMERA_GRAB_LATEST` Enabled in Firmware**:
   By default, the camera driver buffers old frames in memory. `CAMERA_GRAB_LATEST` forces the hardware to immediately drop backlogged frames and always deliver the instantaneous current frame.
2. **`WiFi.setSleep(false)`**:
   Disables the ESP32 WiFi radio sleep mode, which eliminates 150–300ms random ping spikes.
3. **Turbo Zero-Lag Engine in Webpage**:
   The web dashboard includes a **⚡ Turbo (Zero-Lag)** stream engine that directly renders frames without browser buffer congestion.
4. **Resolution Tuning**:
   - For ultra-smooth **25–30 FPS with <50ms latency**, choose **`⚡ 320x240 (Fastest 30 FPS)`** in the dropdown.
   - For crisp farm inspection, choose **`⚖️ 640x480 (VGA 20 FPS)`**.
5. **Instant Lag Flush Button**:
   Click the **⚡ Flush Lag** button anytime to instantly clear network buffers and re-synchronize the stream.
