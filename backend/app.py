from flask import Flask, request, jsonify
from flask_cors import CORS
from collections import deque
import datetime

app = Flask(__name__)
# Allow your GitHub Pages frontend to access this API
CORS(app) 

# Use a deque to store the last known sensor data, more robust than a simple dict
# It will be None if no data has been received yet.
latest_sensor_data = deque(maxlen=1)

# --- Control State (now managed by the server) ---
control_state = {
    "fan": False,
    "light": False,
    "mode": "Auto" # Start in Auto mode by default
}

@app.route('/')
def root():
    return "Environment Control API is running."

# Endpoint for the ESP32 to send data to
@app.route('/data', methods=['POST'])
def receive_data():
    # Improvement: Use POST with JSON for more structured data
    payload = request.get_json()
    if not payload:
        return "Invalid JSON", 400
    
    # Store the received data
    payload['timestamp'] = datetime.datetime.utcnow().isoformat()
    latest_sensor_data.append(payload)
    print(f"Received data: {payload}")
    
    # Run automation logic since we have new data
    run_automation(payload)
    
    return "OK", 200

# Endpoint for the frontend to get the latest data and control status
@app.route('/latest')
def get_latest_data():
    if not latest_sensor_data:
        return jsonify({"error": "No data received yet."}), 404
        
    # Combine sensor data and control state into one response
    response = latest_sensor_data[0].copy()
    response["controls"] = control_state
    
    return jsonify(response)
    
# Endpoint for the frontend to send control commands
@app.route('/control', methods=['POST'])
def handle_control():
    payload = request.get_json()
    action = payload.get('action')

    if action == 'mode-toggle':
        control_state['mode'] = 'Manual' if control_state['mode'] == 'Auto' else 'Auto'
    
    # Only allow toggling in manual mode
    if control_state['mode'] == 'Manual':
        if action == 'fan-toggle':
            control_state['fan'] = not control_state['fan']
        elif action == 'light-toggle':
            control_state['light'] = not control_state['light']
            
    return jsonify(control_state)

# --- Automation Logic (moved from ESP32 to server) ---
def run_automation(data):
    if control_state['mode'] != 'Auto':
        return # Do nothing if we are in manual mode

    # Fan logic
    if data.get('insideTemp', 0) > 28 or data.get('insideHum', 0) > 60:
        control_state['fan'] = True
    else:
        control_state['fan'] = False
        
    # Light logic (Persistent ON)
    if not control_state['light'] and data.get('lightLux', 100) < 30:
        control_state['light'] = True

if __name__ == '__main__':
    # For local testing
    app.run(host='0.0.0.0', port=5001, debug=True)
