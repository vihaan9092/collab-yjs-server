#!/bin/sh

# Docker entrypoint script for Node.js development with optional debugging

set -e

echo "Starting Node.js application..."
echo "ENABLE_NODE_DEBUG: ${ENABLE_NODE_DEBUG:-0}"

if [ "${ENABLE_NODE_DEBUG:-0}" = "1" ]; then
    echo "🐛 Debug mode enabled - Node.js inspector listening on 0.0.0.0:9229"
    echo "📝 Attach your VS Code debugger to localhost:9229"
    echo "🔄 Hot reloading enabled with debug support"

    # Use nodemon with debug flags for hot reloading + debugging
    exec npx nodemon --inspect=0.0.0.0:9229 src/index.js
else
    echo "🚀 Development mode with hot reloading"

    # Use nodemon for hot reloading in normal development
    exec npx nodemon src/index.js
fi
