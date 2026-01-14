#!/bin/bash
# Startup wrapper for Chat Bridge Web
# Delegates to the main orchestration script

# Ensure main script is executable
if [ ! -x "./dev_start.sh" ]; then
    chmod +x ./dev_start.sh
fi

# Run the development start script
./dev_start.sh
