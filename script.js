// --- ⚠️ 1. CONFIGURE YOUR MQTT BROKER ⚠️ ---
const MQTT_BROKER_URL = "afc8a0ac2ccf462c8f92b932403518df.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884; // Your WebSocket port (usually 8884 for HiveMQ)
const MQTT_USER = "hivemq.webclient.1761751067946";
const MQTT_PASS = "wy.b7f8cB*0GTUW&4Ha:";
// ---

// Create a client instance with a random client ID
var client = new Paho.MQTT.Client(MQTT_BROKER_URL, MQTT_PORT, "web-client-" + parseInt(Math.random() * 100));

// Set callback handlers
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// --- DOM Elements ---
let statusText = document.getElementById('status');
let statusDot = document.getElementById('status-dot');

// Check if we are on the dashboard page
let onDashboard = (document.getElementById('control-panel') !== null);
let fanControl, lightControl, fanStatus, lightStatus, modeToggle;

if (onDashboard) {
    fanControl = document.getElementById("fan-control");
    lightControl = document.getElementById("light-control");
    fanStatus = document.getElementById("fan-status");
    lightStatus = document.getElementById("light-status");
    modeToggle = document.getElementById("mode-toggle");
}

// Function to connect to MQTT
function connectMqtt() {
    console.log("Connecting to MQTT broker...");
    statusText.textContent = "Connecting...";
    statusDot.style.background = "#f59e0b"; // Yellow

    client.connect({
        userName: MQTT_USER,
        password: MQTT_PASS,
        useSSL: true,
        onSuccess: onConnect,
        onFailure: onConnectionLost
    });
}

// Called when the client connects
function onConnect() {
    console.log("✅ Connected to MQTT");
    statusText.textContent = "Connected";
    statusDot.style.background = "#10b981"; // Green

    // Subscribe to topics
    client.subscribe("project/status");
    client.subscribe("project/sensors");
}

// Called when the client loses its connection
function onConnectionLost(responseObject) {
    console.log("❌ Connection lost: " + responseObject.errorMessage);
    statusText.textContent = "Disconnected";
    statusDot.style.background = "#ef4444"; // Red
    
    // Attempt to reconnect every 3 seconds
    setTimeout(connectMqtt, 3000);
}

// Called when a message arrives
function onMessageArrived(message) {
    console.log("📨 Message arrived on topic: " + message.destinationName);
    
    try {
        const data = JSON.parse(message.payloadString);

        // Route message based on topic
        if (message.destinationName === "project/sensors" && onDashboard) {
            updateSensorReadings(data);
        } else if (message.destinationName === "project/status" && onDashboard) {
            updateControls(data);
        }
    } catch (e) {
        console.error("Error parsing JSON message:", e);
    }
}

// --- Dashboard Specific Functions ---

// Update the sensor values on the dashboard
function updateSensorReadings(data) {
    document.getElementById('insideTemp').textContent = data.insideTemp.toFixed(1);
    document.getElementById('insideHum').textContent = data.insideHum.toFixed(1);
    document.getElementById('outsideTemp').textContent = data.outsideTemp.toFixed(1);
    document.getElementById('outsideHum').textContent = data.outsideHum.toFixed(1);
    document.getElementById('outsidePress').textContent = data.outsidePress.toFixed(0);
    document.getElementById('lightLux').textContent = data.lightLux.toFixed(1);
}

// Update the control buttons/toggles based on ESP32 status
function updateControls(data) {
    console.log("Updating controls with data:", data);

    // Update mode toggle
    modeToggle.checked = (data.mode === "Manual");
    
    // Update fan state
    if (data.fan) {
        fanControl.classList.add('active');
        fanStatus.textContent = "ON";
    } else {
        fanControl.classList.remove('active');
        fanStatus.textContent = "OFF";
    }
    
    // Update light state
    if (data.light) {
        lightControl.classList.add('active');
        lightStatus.textContent = "ON";
    } else {
        lightControl.classList.remove('active');
        lightStatus.textContent = "OFF";
    }
    
    // Enable/disable controls based on mode
    if (data.mode === "Manual") {
        fanControl.classList.remove('disabled');
        lightControl.classList.remove('disabled');
    } else {
        fanControl.classList.add('disabled');
        lightControl.classList.add('disabled');
    }
}

// --- Control Publishing Functions ---

function toggleFan() {
    if (modeToggle.checked) {
        console.log("🌀 Publishing 'fan-toggle'");
        var message = new Paho.MQTT.Message("fan-toggle");
        message.destinationName = "project/control";
        client.send(message);
    } else {
        alert("Switch to Manual mode to control the fan.");
    }
}

function toggleLight() {
    if (modeToggle.checked) {
        console.log("💡 Publishing 'light-toggle'");
        var message = new Paho.MQTT.Message("light-toggle");
        message.destinationName = "project/control";
        client.send(message);
    } else {
        alert("Switch to Manual mode to control the light.");
    }
}

function toggleMode() {
    console.log("⚙️ Publishing 'mode-toggle'");
    var message = new Paho.MQTT.Message("mode-toggle");
    message.destinationName = "project/control";
    client.send(message);
}

// --- Page Load ---

window.addEventListener('load', () => {
    // Connect to MQTT
    connectMqtt();

    // Add listener for the mode toggle *only* if on the dashboard
    if (onDashboard) {
        modeToggle.addEventListener("change", toggleMode);
    }
});
