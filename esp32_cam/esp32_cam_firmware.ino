/**
 * =======================================================================================
 *  AgriSmart IoT - ESP32-CAM High-Performance Zero-Lag Surveillance Firmware
 * =======================================================================================
 *  Hardware Module: AI-Thinker ESP32-CAM (OV2640 Camera Sensor)
 *  
 *  Performance & Anti-Lag Optimizations Applied:
 *  - CAMERA_GRAB_LATEST: Drops stale backlog frames so video is always real-time!
 *  - Dual PSRAM frame buffers (fb_count = 2) for smooth DMA pipelining.
 *  - WiFi Sleep Disabled (WiFi.setSleep(false)) to eliminate 200ms latency spikes.
 *  - Dynamic hardware resolution control (/control?var=framesize&val=X).
 *  - Fast Turbo Snapshot engine (/capture) with zero browser buffer buildup.
 *  - Onboard High-Power Flashlight / Torch LED Control via GPIO 4 (/flash?state=1).
 * =======================================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <esp_timer.h>
#include <img_converters.h>
#include <fb_gfx.h>
#include <soc/soc.h>
#include <soc/rtc_cntl_reg.h>
#include "esp_http_server.h"

// ------------------------ 1. WIFI CREDENTIALS ------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";     // Enter your WiFi Name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // Enter your WiFi Password

// ------------------------ 2. CAMERA PIN DEFINITIONS ------------------
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Built-in Flashlight LED (Ultra-Bright White LED)
#define FLASH_LED_PIN      4

// ------------------------ 3. GLOBALS & SERVERS -----------------------
httpd_handle_t stream_httpd = NULL;
httpd_handle_t camera_httpd = NULL;
bool flashState = false;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// ------------------------ 4. HIGH-SPEED MJPEG STREAM HANDLER ---------
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char * part_buf[64];

  // Send High-Performance Low-Latency Headers
  httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
  httpd_resp_set_hdr(req, "Pragma", "no-cache");
  httpd_resp_set_hdr(req, "X-Accel-Buffering", "no");

  while(true) {
    // CAMERA_GRAB_LATEST guarantees we always get the instantaneous fresh frame!
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
      break;
    }

    _jpg_buf_len = fb->len;
    _jpg_buf = fb->buf;

    if(res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if(res == ESP_OK) {
      size_t hlen = snprintf((char *)part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    }
    if(res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }

    // Immediately return the frame buffer to hardware DMA pipeline
    if(fb) {
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    }

    if(res != ESP_OK) {
      break;
    }

    // Tiny 5ms yield keeps WiFi task responsive and prevents packet congestion
    vTaskDelay(pdMS_TO_TICKS(5));
  }
  return res;
}

// ------------------------ 5. TURBO SNAPSHOT CAPTURE HANDLER ----------
static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");

  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

// ------------------------ 6. FLASHLIGHT TOGGLE HANDLER ---------------
static esp_err_t flash_handler(httpd_req_t *req) {
  char buf[32];
  if (httpd_req_get_url_query_str(req, buf, sizeof(buf)) == ESP_OK) {
    char param[16];
    if (httpd_query_key_value(buf, "state", param, sizeof(param)) == ESP_OK) {
      flashState = (strcmp(param, "1") == 0 || strcmp(param, "on") == 0);
      digitalWrite(FLASH_LED_PIN, flashState ? HIGH : LOW);
    }
  } else {
    flashState = !flashState;
    digitalWrite(FLASH_LED_PIN, flashState ? HIGH : LOW);
  }

  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  char resp[64];
  snprintf(resp, sizeof(resp), "{\"flash\": %s}", flashState ? "true" : "false");
  return httpd_resp_send(req, resp, strlen(resp));
}

// ------------------------ 7. HARDWARE RESOLUTION / SENSOR CONTROL ----
static esp_err_t control_handler(httpd_req_t *req) {
  char buf[64];
  if (httpd_req_get_url_query_str(req, buf, sizeof(buf)) == ESP_OK) {
    char var[32];
    char val[32];
    if (httpd_query_key_value(buf, "var", var, sizeof(var)) == ESP_OK &&
        httpd_query_key_value(buf, "val", val, sizeof(val)) == ESP_OK) {
      
      sensor_t * s = esp_camera_sensor_get();
      if (!s) {
        httpd_resp_send_500(req);
        return ESP_FAIL;
      }

      int val_int = atoi(val);
      if (strcmp(var, "framesize") == 0) {
        if (s->pixformat == PIXFORMAT_JPEG) {
          s->set_framesize(s, (framesize_t)val_int);
          Serial.printf("Sensor framesize updated to %d\n", val_int);
        }
      } else if (strcmp(var, "quality") == 0) {
        s->set_quality(s, val_int);
      }
    }
  }

  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, "{\"status\":\"ok\"}", 15);
}

// ------------------------ 8. PING LATENCY & STATUS HANDLER -----------
static esp_err_t ping_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  char resp[128];
  snprintf(resp, sizeof(resp), "{\"pong\":true,\"t\":%lu,\"rssi\":%d}", millis(), WiFi.RSSI());
  return httpd_resp_send(req, resp, strlen(resp));
}

// ------------------------ 9. SERVER INITIALIZATION -------------------
void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.max_uri_handlers = 8;

  httpd_uri_t capture_uri = { .uri = "/capture", .method = HTTP_GET, .handler = capture_handler, .user_ctx = NULL };
  httpd_uri_t flash_uri   = { .uri = "/flash",   .method = HTTP_GET, .handler = flash_handler,   .user_ctx = NULL };
  httpd_uri_t control_uri = { .uri = "/control", .method = HTTP_GET, .handler = control_handler, .user_ctx = NULL };
  httpd_uri_t ping_uri    = { .uri = "/ping",    .method = HTTP_GET, .handler = ping_handler,    .user_ctx = NULL };
  httpd_uri_t stream_uri  = { .uri = "/stream",  .method = HTTP_GET, .handler = stream_handler,  .user_ctx = NULL };

  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &capture_uri);
    httpd_register_uri_handler(camera_httpd, &flash_uri);
    httpd_register_uri_handler(camera_httpd, &control_uri);
    httpd_register_uri_handler(camera_httpd, &ping_uri);
    httpd_register_uri_handler(camera_httpd, &stream_uri);
  }

  // Dedicated high-throughput stream server on port 81
  config.server_port = 81;
  config.ctrl_port = 32769;
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
  }
}

// ------------------------ 10. SETUP & OPTIMIZATIONS ------------------
void setup() {
  // Disable brownout detector
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  Serial.println("\n\n========================================");
  Serial.println("  AgriSmart ESP32-CAM Zero-Lag Booting  ");
  Serial.println("========================================");

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  // Camera Configuration with Anti-Lag Settings
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // KEY LAG FIX 1: Always grab the instantaneous freshest frame!
  config.grab_mode = CAMERA_GRAB_LATEST;

  // KEY LAG FIX 2: Fast JPEG quality & Dual Buffering in PSRAM
  if(psramFound()){
    config.frame_size   = FRAMESIZE_VGA; // 640x480 standard
    config.jpeg_quality = 14;            // 14 provides great detail with small ~20KB payload
    config.fb_count     = 2;             // Double buffer for zero stutter
    config.fb_location  = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size   = FRAMESIZE_QVGA; // 320x240 for non-PSRAM boards
    config.jpeg_quality = 16;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ Camera init failed: 0x%x\n", err);
    return;
  }
  Serial.println("✅ OV2640 Sensor Initialized with CAMERA_GRAB_LATEST");

  // Connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  
  // KEY LAG FIX 3: Disable WiFi modem sleep to eliminate latency spikes!
  WiFi.setSleep(false);

  Serial.println("\n✅ WiFi Connected Successfully!");
  Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());

  // Start HTTP Services
  startCameraServer();

  Serial.println("\n=======================================================");
  Serial.printf("⚡ Zero-Lag Live Stream : http://%s:81/stream\n", WiFi.localIP().toString().c_str());
  Serial.printf("📸 Turbo Capture API    : http://%s/capture\n", WiFi.localIP().toString().c_str());
  Serial.printf("🔦 Flashlight Control   : http://%s/flash?state=1\n", WiFi.localIP().toString().c_str());
  Serial.println("=======================================================");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(3000);
  }
  delay(1000);
}
