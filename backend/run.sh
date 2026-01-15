#!/bin/bash

# BALLOT Face Verification Backend Startup Script
# Run this script to start the FastAPI backend server

echo "=================================================="
echo "≡ƒù│∩╕Å  BALLOT Face Verification Backend"
echo "=================================================="

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "≡ƒôª Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "≡ƒöº Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "≡ƒôÑ Installing dependencies..."
pip install -r requirements.txt --quiet

# Download YOLO model if not exists
echo "≡ƒñû Checking AI models..."
python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" 2>/dev/null

echo ""
echo "≡ƒÜÇ Starting server..."
echo "≡ƒôì API: http://localhost:8000"
echo "≡ƒôÜ Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

# Start the server
python3 main.py
