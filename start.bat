@echo off
title MyCloud Storage - Starter
echo ======================================================
echo           MYCLOUD STORAGE - DOCKER RUNNER
echo ======================================================
echo.
echo [1/3] Membangun dan menjalankan container (Detached Mode)...
docker-compose up -d --build
echo.
echo [2/3] Status Running Containers:
echo ------------------------------------------------------
docker-compose ps
echo ------------------------------------------------------
echo.
echo [3/3] Menampilkan log backend (Tekan Ctrl+C untuk keluar dari log):
echo.
docker-compose logs -f backend
echo.
echo Aplikasi telah berhenti atau sesi log ditutup.
pause
