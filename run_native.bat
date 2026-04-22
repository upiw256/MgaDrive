@echo off
title MyCloud - Native Runner
echo ======================================================
echo     MYCLOUD STORAGE - NATIVE RUNNER
echo ======================================================
echo.

:: Menjalankan Backend
echo [1/2] Menyiapkan Backend (FastAPI)...
:: Menambahkan logika install requirements agar selalu memeriksa dependensi terbaru
start "Backend - FastAPI" cmd /k "cd backend && if not exist venv (echo Membuat venv... && python -m venv venv) else (echo Venv sudah ada.) && echo Memeriksa dependencies... && venv\Scripts\python -m pip install -r requirements.txt && echo Menjalankan server... && venv\Scripts\python -m uvicorn main:app --reload --port 9000 --host 0.0.0.0"

:: Menjalankan Frontend
echo [2/2] Menyiapkan Frontend (Vite)...
start "Frontend - Vite" cmd /k "cd frontend && npm install && npm run dev -- --host --port 9001"

echo.
echo Semua layanan sedang dijalankan di jendela terpisah.
echo Pastikan MongoDB sudah menyala secara lokal.
echo.
pause