var ws;
var gateway = `ws://${window.location.hostname}/ws`;
var reconnectInterval = null;

function initWebSocket() {
    console.log("Connecting to WebSocket:", gateway);
    ws = new WebSocket(gateway);
    
    ws.onopen = () => {
        console.log("✅ WebSocket connected");
        document.getElementById('status').textContent = 'Connected';
        document.querySelector('.status-dot').style.background = '#10b981';
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };
    
    ws.onclose = () => {
        console.log("❌ WebSocket disconnected");
        document.getElementById('status').textContent = 'Disconnected';
        document.querySelector('.status-dot').style.background = '#ef4444';
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                console.log("🔄 Attempting to reconnect...");
                initWebSocket();
            }, 2000);
        }
    };
    
    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
    
    ws.onmessage = (e) => {
        console.log("📨 Received message:", e.data);
        try {
            var data = JSON.parse(e.data);
            updateControls(data);
        } catch(err) {
            console.error("Error parsing message:", err);
        }
    };
}

function updateControls(data) {
    console.log("Updating controls with data:", data);
    var modeToggle = document.getElementById("mode-toggle");
    var fanControl = document.getElementById("fan-control");
    var lightControl = document.getElementById("light-control");
    var fanStatus = document.getElementById("fan-status");
    var lightStatus = document.getElementById("light-status");
    
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
        console.log("✅ Manual mode - controls enabled");
        fanControl.classList.remove('disabled');
        lightControl.classList.remove('disabled');
    } else {
        console.log("⚙️ Auto mode - controls disabled");
        fanControl.classList.add('disabled');
        lightControl.classList.add('disabled');
    }
}

function toggleFan() {
    var fanControl = document.getElementById("fan-control");
    if (fanControl.classList.contains('disabled')) {
        console.log("⚠️ Fan control is disabled (Auto mode)");
        alert("Switch to Manual mode to control the fan");
        return;
    }
    
    console.log("🌀 Fan clicked");
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("   ✅ Sending 'fan-toggle'");
        ws.send("fan-toggle");
    } else {
        console.log("   ❌ WebSocket not ready");
        alert("Connection lost. Please refresh the page.");
    }
}

function toggleLight() {
    var lightControl = document.getElementById("light-control");
    if (lightControl.classList.contains('disabled')) {
        console.log("⚠️ Light control is disabled (Auto mode)");
        alert("Switch to Manual mode to control the light");
        return;
    }
    
    console.log("💡 Light clicked");
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("   ✅ Sending 'light-toggle'");
        ws.send("light-toggle");
    } else {
        console.log("   ❌ WebSocket not ready");
        alert("Connection lost. Please refresh the page.");
    }
}

function toggleMode() {
    console.log("⚙️ Mode toggle clicked");
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("   ✅ Sending 'mode-toggle'");
        ws.send("mode-toggle");
    } else {
        console.log("   ❌ WebSocket not ready");
        alert("Connection lost. Please refresh the page.");
    }
}

function updateSensors() {
    fetch("/data")
        .then(r => r.json())
        .then(data => {
            document.getElementById('insideTemp').textContent = data.insideTemp.toFixed(1);
            document.getElementById('insideHum').textContent = data.insideHum.toFixed(1);
            document.getElementById('outsideTemp').textContent = data.outsideTemp.toFixed(1);
            document.getElementById('outsideHum').textContent = data.outsideHum.toFixed(1);
            document.getElementById('outsidePress').textContent = data.outsidePress.toFixed(0);
            document.getElementById('lightLux').textContent = data.lightLux.toFixed(1);
        });
}

document.getElementById("mode-toggle").addEventListener("change", toggleMode);

window.addEventListener('load', () => {
    initWebSocket();
    updateSensors();
    setInterval(updateSensors, 2000);
});
