@echo off
echo Starting KeyVibe Touch Typing Studio on Local Network...
echo.
echo Local Access:        http://localhost:3000/
echo Network Access:      http://192.168.31.68:3000/
echo.
if exist server.py (
    python server.py 3000
) else (
    python -m http.server 3000 --bind 0.0.0.0
)
pause
