# 🌐 AgriSmart IoT - Global Cloud Hosting & Public Access Guide

This guide details two simple ways to host and open your **AgriSmart Agriculture Monitoring System** from any device anywhere in the world.

---

## 🏆 Option 1: Permanent 24/7 Free Cloud Hosting on Render (Recommended)

Render ([render.com](https://render.com)) provides free, always-on cloud hosting with automatic SSL (HTTPS), zero server maintenance, and automatic deployments.

### Step 1: Create a GitHub Repository
1. Go to [https://github.com/new](https://github.com/new) and log in.
2. Repository name: `agrismart-iot`
3. Choose **Public** (or **Private**).
4. Click **Create repository**.

### Step 2: Push Your Project Code to GitHub
Open a terminal in `e:\AI project\agri-nov` (or VS Code terminal) and run:
```bash
git remote add origin https://github.com/<YOUR-GITHUB-USERNAME>/agrismart-iot.git
git branch -M main
git push -u origin main
```
*(Replace `<YOUR-GITHUB-USERNAME>` with your actual GitHub username)*

### Step 3: Deploy on Render
1. Go to [https://dashboard.render.com](https://dashboard.render.com) (sign up with GitHub).
2. Click **New +** (top right) and select **Web Service**.
3. Choose your repository: `agrismart-iot`.
4. Render will automatically detect the pre-configured `render.yaml` file:
   - **Name**: `agrismart-iot` (or your chosen name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Click **Deploy Web Service** (or **Create Web Service**).

🚀 **Within 1–2 minutes, your live global link will be ready:**
👉 **`https://agrismart-iot.onrender.com`**

You can now open this link on your smartphone, share it with colleagues, or view it from anywhere in the world!

---

## ⚡ Option 2: Instant Live Public URL (1-Click, No GitHub Required)

If you want a live public HTTPS link **right this second** to open on your smartphone or test immediately:

1. Make sure your local server is running:
   Double-click `start.bat` (or run `npm start`).
2. Double-click **`public_tunnel.bat`** (or run `npm run tunnel`).
3. You will immediately get a live public HTTPS link in your terminal:
   ```
   your url is: https://funny-farm-42.loca.lt
   ```
4. Open that link on your smartphone or send it to anyone!
   *(Note: The first time you open a loca.lt link, click "Click to Submit" to view the dashboard).*

---

## 📡 Connecting ESP32 & ESP32-CAM to Your Cloud Link

Once your app is live on Render (`https://your-app-name.onrender.com`):

### In ESP32 Firmware (`esp32_code/esp32_agriculture.ino`):
Change:
```cpp
const bool  USE_CLOUD_SERVER = true;
const char* CLOUD_SERVER_URL = "https://your-app-name.onrender.com/api/esp32/telemetry";
```
Your ESP32 will stream DHT11 temperature, humidity, 12-bit capacitive soil moisture, and flame data to your public cloud webpage from anywhere in the world!

### In Web Dashboard for ESP32-CAM:
1. Open your live cloud URL.
2. Go to **ESP32-CAM Live View**.
3. Enter your camera's local IP or DDNS / port-forwarded IP and click **Connect**.
4. The live video stream will render directly on your cloud dashboard!
