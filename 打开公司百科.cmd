@echo off
chcp 65001 >nul
call "%~dp0检查数据.cmd"
start "" "%~dp0companies.html"
