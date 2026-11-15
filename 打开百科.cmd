@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "V3_PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if exist "%V3_PY%" goto run
set "V3_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%V3_PY%" goto run
set "V3_PY=python"
:run
"%V3_PY%" -c "import sys; assert sys.version_info >= (3,10); import PIL, numpy"
if errorlevel 1 (
 echo 需要 Python 3.10 或以上版本，以及 Pillow 和 NumPy。
 echo 安装 Python 后运行：python -m pip install Pillow numpy
 pause
 exit /b 1
)
"%V3_PY%" -B update_server.py --register-protocol --page index.html
if errorlevel 1 pause
