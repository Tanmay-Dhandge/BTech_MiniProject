// IMPORTANT: Update this with your Render URL after you deploy the backend
const BACKEND_URL = "https://btech-miniproject.onrender.com";

// --- Data Fetching ---
async function updateSensorReadings() {
    try {
        const response = await fetch(`${BACKEND_URL}/latest`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Update the sensor values on the page
        document.getElementById('insideTemp').textContent = data.insideTemp?.toFixed(1) ?? '--';
        document.getElementById('insideHum').textContent = data.insideHum?.toFixed(1) ?? '--';
        document.getElementById('outsideTemp').textContent = data.outsideTemp?.toFixed(1) ?? '--';
        document.getElementById('outsideHum').textContent = data.outsideHum?.toFixed(1) ?? '--';
        document.getElementById('outsidePress').textContent = data.outsidePress?.toFixed(0) ?? '--';
        document.getElementById('lightLux').textContent = data.lightLux?.toFixed(1) ?? '--';

        // Update the control states
        updateControlsUI(data.controls);

    } catch (error) {
        console.error("Failed to fetch sensor data:", error);
        document.getElementById('status').textContent = 'Error';
        document.querySelector('.status-dot').style.background = '#ef4444';
    }
}

// --- UI Control Updates ---
function updateControlsUI(controls) {
    if (!controls) return;

    const modeToggle = document.getElementById("mode-toggle");
    const fanControl = document.getElementById("fan-control");
    const lightControl = document.getElementById("light-control");
    const fanStatus = document.getElementById("fan-status");
    const lightStatus = document.getElementById("light-status");

    // Update mode toggle and control states
    modeToggle.checked = (controls.mode === "Manual");
    fanControl.classList.toggle('active', controls.fan);
    fanStatus.textContent = controls.fan ? "ON" : "OFF";
    lightControl.classList.toggle('active', controls.light);
    lightStatus.textContent = controls.light ? "ON" : "OFF";
    
    // Disable buttons in Auto mode
    fanControl.classList.toggle('disabled', controls.mode !== "Manual");
    lightControl.classList.toggle('disabled', controls.mode !== "Manual");
}

// --- Sending Commands to Backend ---
async function sendCommand(command) {
    try {
        await fetch(`${BACKEND_URL}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: command })
        });
        // After sending a command, immediately fetch the latest state
        updateSensorReadings();
    } catch (error) {
        console.error("Failed to send command:", error);
    }
}

function toggleFan() { if (!document.getElementById("fan-control").classList.contains('disabled')) sendCommand('fan-toggle'); }
function toggleLight() { if (!document.getElementById("light-control").classList.contains('disabled')) sendCommand('light-toggle'); }
function toggleMode() { sendCommand('mode-toggle'); }

// --- Initialization ---
window.addEventListener('load', () => {
    document.getElementById("mode-toggle").addEventListener("change", toggleMode);
    document.getElementById("fan-control").addEventListener("click", toggleFan);
    document.getElementById("light-control").addEventListener("click", toggleLight);

    updateSensorReadings(); // Initial fetch
    setInterval(updateSensorReadings, 3000); // Fetch every 3 seconds
});
