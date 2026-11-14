@echo off
cd /d "%~dp0"
node --use-system-ca --env-file-if-exists=.env server.mjs
if errorlevel 1 pause
