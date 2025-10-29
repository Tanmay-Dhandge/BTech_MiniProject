#include <WiFiClientSecure.h> // For SSL
#include <PubSubClient.h>     // For MQTT
#include <ArduinoJson.h>      // For creating JSON
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>

// --- ⚠️ 1. CONFIGURE YOUR WIFI ⚠️ ---
const char *ssid = "Tanmay";
const char *password = "tnmy9416";
// ---

// --- ⚠️ 2. CONFIGURE YOUR MQTT BROKER ⚠️ ---
const char* mqtt_server = "afc8a0ac2ccf462c8f92b932403518df.s1.eu.hivemq.cloud";
const char* mqtt_user = "hivemq.webclient.1761751067946";
const char* mqtt_pass = "wy.b7f8cB*0GTUW&4Ha:";
const int mqtt_port = 8883; // Standard MQTT SSL Port (NOT the WebSocket port)
// ---

// WiFi and MQTT Clients
WiFiClientSecure espClient;
PubSubClient client(espClient);

// Define pins for DHT sensor and control
#define DHTPIN 23
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Define pins for light and fan control
#define FAN_PIN 26
#define LIGHT_PIN 27

// Light sensor
BH1750 lightMeter;

// BMP280 pressure and temperature sensor
Adafruit_BMP280 bmp;

// Control states for manual operation
bool fanState = false;
bool lightState = false;
bool manualMode = false;

// States when in auto mode
bool autoFan = false;
bool autoLight = false;

// Cached sensor values
float cachedInsideTemp = 0;
float cachedInsideHum = 0;
float cachedOutsideTemp = 0;
float cachedOutsideHum = 0;
float cachedOutsidePress = 0;
float cachedLux = 0;

unsigned long lastSensorUpdate = 0;
const unsigned long sensorInterval = 2000;

// Reads and updates all sensor values
void readSensors() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) {
    cachedInsideTemp = t;
    cachedInsideHum = h;
    cachedOutsideHum = h; // Use the same humidity value for both
  }

  cachedOutsideTemp = bmp.readTemperature();
  cachedOutsidePress = bmp.readPressure() / 100.0; // Convert Pa to hPa

  // Read actual BH1750 sensor
  cachedLux = lightMeter.readLightLevel();
}

// Checks and updates the state of fan and light based on sensor readings
void checkAutomation() {
  if (manualMode) return;

  // Fan automation logic
  if (cachedInsideTemp > 28 || cachedInsideHum > 60) {
    autoFan = true;
  } else {
    autoFan = false;
  }

  // Light automation logic - Persistent ON once triggered
  const float LIGHT_ON_THRESHOLD = 30.0;
  if (!autoLight) {
    if (cachedLux < LIGHT_ON_THRESHOLD) {
      autoLight = true;
      Serial.println("Light Auto-ON triggered: Lux is low.");
    }
  }
}

// Updates the digital output pins based on the current mode and state
void updateControlPins() {
  if (manualMode) {
    digitalWrite(FAN_PIN, fanState ? HIGH : LOW);
    digitalWrite(LIGHT_PIN, lightState ? HIGH : LOW);
  } else {
    digitalWrite(FAN_PIN, autoFan ? HIGH : LOW);
    digitalWrite(LIGHT_PIN, autoLight ? HIGH : LOW);
  }
}

// Publish the current control status to the "project/status" topic
void publishStatus() {
  StaticJsonDocument<200> doc;
  doc["fan"] = manualMode ? fanState : autoFan;
  doc["light"] = manualMode ? lightState : autoLight;
  doc["mode"] = manualMode ? "Manual" : "Auto";

  char buffer[200];
  serializeJson(doc, buffer);
  
  client.publish("project/status", buffer);
}

// Publish the current sensor readings to the "project/sensors" topic
void publishSensors() {
  StaticJsonDocument<300> doc;
  doc["insideTemp"] = cachedInsideTemp;
  doc["insideHum"] = cachedInsideHum;
  doc["outsideTemp"] = cachedOutsideTemp;
  doc["outsideHum"] = cachedOutsideHum;
  doc["outsidePress"] = cachedOutsidePress;
  doc["lightLux"] = cachedLux;

  char buffer[300];
  serializeJson(doc, buffer);
  
  client.publish("project/sensors", buffer);
}

// This function is called when a message arrives on a subscribed topic
void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");

  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Logic from your old WebSocket handler
  if (message == "mode-toggle") {
    manualMode = !manualMode;

    if (!manualMode) {
      // Switched from Manual to Auto
      autoLight = lightState;
    } else {
      // Switched from Auto to Manual
      lightState = autoLight;
    }
    Serial.println("Mode changed to: " + String(manualMode ? "Manual" : "Auto"));
    
  } else if (message == "fan-toggle") {
    if (manualMode) {
      fanState = !fanState;
      Serial.println("Fan toggled: " + String(fanState ? "ON" : "OFF"));
    }
  } else if (message == "light-toggle") {
    if (manualMode) {
      lightState = !lightState;
      Serial.println("Light toggled: " + String(lightState ? "ON" : "OFF"));
    }
  }

  updateControlPins();
  publishStatus(); // Immediately publish the change
}

// Reconnects to the MQTT broker
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Create a client ID
    String clientId = "esp32-client-";
    clientId += String(random(0xffff), HEX);

    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      // Subscribe to the control topic
      client.subscribe("project/control");
      // Publish initial status
      publishStatus();
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// --- SETUP ---
void setup() {
  Serial.begin(115200);
  Wire.begin(); 

  dht.begin();
  pinMode(FAN_PIN, OUTPUT);
  pinMode(LIGHT_PIN, OUTPUT);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(LIGHT_PIN, LOW);

  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("BH1750 initialization failed");
  }

  if (!bmp.begin(0x76)) {
    if (!bmp.begin(0x77)) {
      Serial.println("BMP280 initialization failed on both addresses!");
    }
  }

  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                  Adafruit_BMP280::SAMPLING_X2,
                  Adafruit_BMP280::SAMPLING_X16,
                  Adafruit_BMP280::FILTER_X16,
                  Adafruit_BMP280::STANDBY_MS_500);

  // Connect to WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Use setInsecure() for testing. 
  // For production, you should use setCACert() with HiveMQ's root cert.
  espClient.setInsecure(); 

  // Configure MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqtt_callback);
}

// --- LOOP ---
void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop(); // Handles MQTT messages

  if (millis() - lastSensorUpdate > sensorInterval) {
    readSensors();
    checkAutomation();
    updateControlPins();

    // Publish sensor data and status
    publishSensors();
    publishStatus(); 
    
    lastSensorUpdate = millis();
  }
}
