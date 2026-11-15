@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "V3_COMPANY_PY=C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%V3_COMPANY_PY%" ("%V3_COMPANY_PY%" -B build_mod_companies.py) else (python -B build_mod_companies.py)
if errorlevel 1 (echo 更多公司图鉴更新失败，请检查 MOD 本体及汉化路径。) else (echo 更多公司图鉴已更新。请刷新 03 公司百科。)
pause
