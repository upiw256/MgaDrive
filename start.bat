@echo off
title MyCloud Storage - Starter
echo ======================================================
echo           MYCLOUD STORAGE - DOCKER RUNNER
echo ======================================================
echo.
echo Sedang menyiapkan container backend, frontend, dan database...
echo.
docker-compose up --build
echo.
echo Aplikasi telah berhenti.
pause
