@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "V3_PY=C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%V3_PY%" ("%V3_PY%" -B version_history.py --force) else (python -B version_history.py --force)
if errorlevel 1 (echo 数据更新失败，请查看上方错误。) else (echo 数据更新完成。请刷新百科页面。)
pause
