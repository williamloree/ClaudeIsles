@echo off
rem Lance Claude Isles : compile l'interface si besoin, démarre le serveur et ouvre le navigateur.
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
if not exist dist\index.html call npm run build
start "" http://localhost:4317
node server\index.mjs
