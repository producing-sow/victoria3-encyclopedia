@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "V3_PY=C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
echo 正在检查游戏数据变化；首次采集可能需要几分钟。
if exist "%V3_PY%" ("%V3_PY%" -B version_history.py) else (python -B version_history.py)
if errorlevel 1 (
echo 本次更新未完成，保留原有百科数据。可运行更新数据查看错误。
pause
)
