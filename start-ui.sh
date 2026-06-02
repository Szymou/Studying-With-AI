#!/bin/bash
echo "Starting Java Eight Part System Web UI..."
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:7778
elif command -v open &> /dev/null; then
    open http://localhost:7778
else
    echo "Please open http://localhost:7778 in your browser"
fi
node ui-server.js
