#!/bin/bash

echo "🔍 Monitoring Bun Server Performance"
echo "===================================="

# Function to get process info - look for the main server process
get_bun_process() {
    # Try different patterns to find the right Bun server process
    BUN_PROC=$(ps aux | grep "bun.*--watch.*server.ts" | grep -v grep | head -1)
    if [ -z "$BUN_PROC" ]; then
        BUN_PROC=$(ps aux | grep "bun.*server.ts" | grep -v grep | head -1)
    fi
    if [ -z "$BUN_PROC" ]; then
        BUN_PROC=$(ps aux | grep "bun run dev" | grep -v grep | head -1)
    fi
    echo "$BUN_PROC"
}

# Check if Bun server is running
BUN_PROCESS=$(get_bun_process)
if [ -z "$BUN_PROCESS" ]; then
    echo "❌ Bun server process not found"
    echo "Available Bun processes:"
    ps aux | grep bun | grep -v grep | head -5
    exit 1
fi

BUN_PID=$(echo $BUN_PROCESS | awk '{print $2}')
echo "✅ Found Bun server process (PID: $BUN_PID)"
echo "Process: $(echo $BUN_PROCESS | awk '{print $11, $12, $13}')"
echo ""

# Start monitoring
echo "📊 Real-time Performance Monitoring (Press Ctrl+C to stop)"
echo "--------------------------------------------------------"
echo "Time        CPU%    Memory(MB)  HTTP Response"
echo "--------------------------------------------------------"

while true; do
    # Get current time
    TIMESTAMP=$(date +"%H:%M:%S")

    # Re-find process in case PID changed (Bun --watch restarts)
    CURRENT_PROCESS=$(get_bun_process)
    if [ -z "$CURRENT_PROCESS" ]; then
        echo "❌ No Bun server process found"
        sleep 2
        continue
    fi

    CURRENT_PID=$(echo $CURRENT_PROCESS | awk '{print $2}')

    # Update PID if changed
    if [ "$CURRENT_PID" != "$BUN_PID" ]; then
        BUN_PID=$CURRENT_PID
        echo "🔄 Process PID changed to: $BUN_PID"
    fi

    # Get CPU and Memory usage (macOS compatible)
    PROCESS_INFO=$(ps -p $BUN_PID -o %cpu,%mem 2>/dev/null | tail -1)

    if [ $? -eq 0 ] && [ -n "$PROCESS_INFO" ]; then
        CPU=$(echo $PROCESS_INFO | awk '{print $1}')
        MEM_PERCENT=$(echo $PROCESS_INFO | awk '{print $2}')

        # Get memory in MB (macOS)
        MEM_RSS=$(ps -p $BUN_PID -o rss= 2>/dev/null | tr -d ' ')
        if [ -n "$MEM_RSS" ]; then
            MEM_MB=$(echo "scale=1; $MEM_RSS / 1024" | bc 2>/dev/null || echo "$MEM_RSS KB")
        else
            MEM_MB="N/A"
        fi

        # Test HTTP response time
        HTTP_TIME=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3001 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$HTTP_TIME" ]; then
            HTTP_MS=$(echo "$HTTP_TIME * 1000" | bc 2>/dev/null)
            if [ -n "$HTTP_MS" ]; then
                HTTP_STATUS="$(printf "%.0f" $HTTP_MS)ms"
            else
                HTTP_STATUS="${HTTP_TIME}s"
            fi
        else
            HTTP_STATUS="Error"
        fi

        printf "%-10s %5s%% %10s %12s\n" "$TIMESTAMP" "$CPU" "${MEM_MB}MB" "$HTTP_STATUS"
    else
        echo "❌ Cannot get process info for PID: $BUN_PID"
        sleep 2
        continue
    fi

    sleep 2
done