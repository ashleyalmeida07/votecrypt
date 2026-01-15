@echo off
REM BALLOT Face Verification Backend Startup Script for Windows

echo ==================================================
echo BALLOT Face Verification Backend
echo ==================================================

REM Navigate to backend directory
cd /d "%~dp0"

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt --quiet

REM Download YOLO model if not exists
echo Checking AI models...
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" 2>nul

echo.
echo Starting server...
echo API: http://localhost:8000
echo Docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo ==================================================
echo.

REM Start the server
python main.py
