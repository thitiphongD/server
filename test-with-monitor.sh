#!/bin/bash

# 🚀 Load Test with Real-time Monitoring
# Usage: ./test-with-monitor.sh [test-type]

echo "🚀 Load Test with Real-time Monitoring"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if server is running
echo "🔍 Checking server status..."
if ! curl -s http://localhost:3001 > /dev/null; then
    echo -e "${RED}❌ Server is not running on localhost:3001${NC}"
    echo "Please start server first: bun run dev"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"

# Get test type parameter
TEST_TYPE=${1:-"simple"}

case $TEST_TYPE in
    "quick")
        TEST_NAME="Quick Test (5 users)"
        TEST_CMD="bunx artillery quick -c 5 -n 10 http://localhost:3001"
        DURATION="30 seconds"
        ;;
    "medium")
        TEST_NAME="Medium Load Test (20 users)"
        TEST_CMD="bunx artillery quick -c 20 -n 15 http://localhost:3001"
        DURATION="60 seconds"
        ;;
    "heavy")
        TEST_NAME="Heavy Load Test (50 users)"
        TEST_CMD="bunx artillery quick -c 50 -n 10 http://localhost:3001"
        DURATION="90 seconds"
        ;;
    "simple")
        TEST_NAME="Simple Config Test (5 users, 60s)"
        TEST_CMD="bunx artillery run simple-load-test.yml"
        DURATION="60 seconds"
        ;;
    "full")
        TEST_NAME="Full Load Test (4 phases)"
        TEST_CMD="bunx artillery run load-test.yml"
        DURATION="210 seconds"
        ;;
    "benchmark")
        TEST_NAME="Automated Benchmark"
        TEST_CMD="./auto-benchmark.sh"
        DURATION="300+ seconds"
        ;;
    *)
        echo "❌ Unknown test type: $TEST_TYPE"
        echo "Available test types:"
        echo "  quick    - Quick test (5 users)"
        echo "  medium   - Medium load (20 users)"
        echo "  heavy    - Heavy load (50 users)"
        echo "  simple   - Simple config test (default)"
        echo "  full     - Full load test"
        echo "  benchmark- Complete benchmark"
        echo ""
        echo "Usage: ./test-with-monitor.sh [test-type]"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}📊 Test Configuration:${NC}"
echo "  Test: $TEST_NAME"
echo "  Duration: ~$DURATION"
echo "  Command: $TEST_CMD"
echo ""

# Create results directory
RESULTS_DIR="test-results-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"
echo "📁 Results will be saved to: $RESULTS_DIR"

echo ""
echo -e "${YELLOW}🔥 Starting Load Test with Monitoring...${NC}"
echo "================================================="

# Start monitoring in background
echo "📈 Starting performance monitor..."
./monitor-performance.sh > "$RESULTS_DIR/monitor.log" 2>&1 &
MONITOR_PID=$!
echo "Monitor PID: $MONITOR_PID"

# Give monitor time to start
sleep 2

# Start the load test
echo ""
echo -e "${YELLOW}⚡ Starting load test...${NC}"
echo "Command: $TEST_CMD"
echo ""

# Run the test and save output
$TEST_CMD > "$RESULTS_DIR/test.log" 2>&1 &
TEST_PID=$!

# Show real-time progress
echo "Test PID: $TEST_PID"
echo ""
echo "📊 Real-time Monitoring (Press Ctrl+C to stop early)"
echo "===================================================="

# Display monitor output in real-time
tail -f "$RESULTS_DIR/monitor.log" &
TAIL_PID=$!

# Wait for test to complete
wait $TEST_PID
TEST_EXIT_CODE=$?

# Stop monitoring
echo ""
echo -e "${GREEN}🏁 Test completed! Stopping monitor...${NC}"
kill $MONITOR_PID 2>/dev/null
kill $TAIL_PID 2>/dev/null

# Wait a moment for processes to clean up
sleep 2

echo ""
echo "📋 RESULTS SUMMARY"
echo "=================="

# Display test results
echo ""
echo -e "${BLUE}🎯 Load Test Results:${NC}"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Test completed successfully${NC}"
else
    echo -e "${RED}❌ Test failed with exit code: $TEST_EXIT_CODE${NC}"
fi

# Extract key metrics from test results
if [ -f "$RESULTS_DIR/test.log" ]; then
    echo ""
    echo "Key Metrics:"
    echo "------------"

    # Response times
    P95_TIME=$(grep "p95:" "$RESULTS_DIR/test.log" | tail -1 | grep -o '[0-9.]*' | head -1)
    P99_TIME=$(grep "p99:" "$RESULTS_DIR/test.log" | tail -1 | grep -o '[0-9.]*' | head -1)

    if [ -n "$P95_TIME" ]; then
        echo "Response Time p95: ${P95_TIME}ms"
        # Color code the results
        if (( $(echo "$P95_TIME < 50" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  Status: ${GREEN}🟢 Excellent${NC}"
        elif (( $(echo "$P95_TIME < 100" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  Status: ${GREEN}✅ Good${NC}"
        elif (( $(echo "$P95_TIME < 500" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  Status: ${YELLOW}⚠️ Acceptable${NC}"
        else
            echo -e "  Status: ${RED}❌ Poor${NC}"
        fi
    fi

    if [ -n "$P99_TIME" ]; then
        echo "Response Time p99: ${P99_TIME}ms"
    fi

    # Success rate
    SUCCESS_COUNT=$(grep "http.codes.200:" "$RESULTS_DIR/test.log" | tail -1 | grep -o '[0-9]*$')
    CREATED_COUNT=$(grep "http.codes.201:" "$RESULTS_DIR/test.log" | tail -1 | grep -o '[0-9]*$' || echo "0")
    TOTAL_REQUESTS=$(grep "http.requests:" "$RESULTS_DIR/test.log" | tail -1 | grep -o '[0-9]*$')

    if [ -n "$SUCCESS_COUNT" ] && [ -n "$TOTAL_REQUESTS" ] && [ "$TOTAL_REQUESTS" -gt 0 ]; then
        SUCCESS_TOTAL=$((SUCCESS_COUNT + CREATED_COUNT))
        SUCCESS_RATE=$(echo "scale=1; $SUCCESS_TOTAL * 100 / $TOTAL_REQUESTS" | bc 2>/dev/null)
        echo "Success Rate: ${SUCCESS_RATE}% ($SUCCESS_TOTAL/$TOTAL_REQUESTS)"

        if (( $(echo "$SUCCESS_RATE >= 100" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  Status: ${GREEN}🎉 Perfect${NC}"
        elif (( $(echo "$SUCCESS_RATE >= 95" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  Status: ${GREEN}✅ Excellent${NC}"
        elif (( $(echo "$SUCCESS_RATE >= 90" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  Status: ${YELLOW}⚠️ Good${NC}"
        else
            echo -e "  Status: ${RED}❌ Poor${NC}"
        fi
    fi

    # Request rate
    REQ_RATE=$(grep "http.request_rate:" "$RESULTS_DIR/test.log" | tail -1 | grep -o '[0-9]*' | head -1)
    if [ -n "$REQ_RATE" ]; then
        echo "Request Rate: ${REQ_RATE}/sec"
    fi

    # Failed requests
    FAILED_COUNT=$(grep "vusers.failed:" "$RESULTS_DIR/test.log" | tail -1 | grep -o '[0-9]*$' || echo "0")
    if [ "$FAILED_COUNT" -gt 0 ]; then
        echo -e "${RED}Failed Requests: $FAILED_COUNT${NC}"
    else
        echo -e "${GREEN}Failed Requests: 0${NC}"
    fi
fi

echo ""
echo -e "${BLUE}🖥️ System Performance:${NC}"
if [ -f "$RESULTS_DIR/monitor.log" ]; then
    echo "Server Performance Summary:"
    echo "---------------------------"

    # Get average CPU and memory
    AVG_CPU=$(grep -E "^[0-9]{2}:" "$RESULTS_DIR/monitor.log" | awk '{print $2}' | sed 's/%//' | awk '{sum+=$1; count++} END {if(count>0) printf "%.1f", sum/count; else print "N/A"}')
    AVG_MEM=$(grep -E "^[0-9]{2}:" "$RESULTS_DIR/monitor.log" | awk '{print $3}' | sed 's/MB//' | awk '{sum+=$1; count++} END {if(count>0) printf "%.1f", sum/count; else print "N/A"}')

    if [ "$AVG_CPU" != "N/A" ]; then
        echo "Average CPU Usage: ${AVG_CPU}%"
    fi
    if [ "$AVG_MEM" != "N/A" ]; then
        echo "Average Memory Usage: ${AVG_MEM}MB"
    fi

    # Get response time stats from monitoring
    MONITOR_RESPONSE_TIMES=$(grep -E "^[0-9]{2}:" "$RESULTS_DIR/monitor.log" | awk '{print $4}' | sed 's/ms//' | grep -E '^[0-9]+$')
    if [ -n "$MONITOR_RESPONSE_TIMES" ]; then
        MIN_RESPONSE=$(echo "$MONITOR_RESPONSE_TIMES" | sort -n | head -1)
        MAX_RESPONSE=$(echo "$MONITOR_RESPONSE_TIMES" | sort -n | tail -1)
        echo "HTTP Response Time: ${MIN_RESPONSE}ms - ${MAX_RESPONSE}ms"
    fi
else
    echo "⚠️ Monitor log not found"
fi

echo ""
echo "📁 Files Generated:"
echo "-------------------"
echo "📄 $RESULTS_DIR/test.log     - Load test results"
echo "📊 $RESULTS_DIR/monitor.log  - Performance monitoring"
echo ""
echo -e "${GREEN}🎉 Test with monitoring completed!${NC}"

# Summary recommendation
echo ""
echo "💡 Recommendations:"
echo "-------------------"
if [ -n "$P95_TIME" ]; then
    if (( $(echo "$P95_TIME < 100" | bc -l 2>/dev/null || echo 0) )); then
        echo "✅ Server performance is excellent for this load"
        echo "✅ Ready for production with similar traffic patterns"
    elif (( $(echo "$P95_TIME < 500" | bc -l 2>/dev/null || echo 0) )); then
        echo "⚠️ Performance is acceptable but monitor under higher loads"
        echo "💡 Consider optimization if expecting more traffic"
    else
        echo "❌ Performance needs improvement"
        echo "💡 Investigate bottlenecks and optimize before production"
    fi
fi

if [ "$FAILED_COUNT" -gt 0 ]; then
    echo "⚠️ Some requests failed - investigate error logs"
    echo "💡 Check server logs for error details"
fi

echo ""
echo "Next steps:"
echo "- Review detailed logs in $RESULTS_DIR/"
echo "- Run different test types: quick, medium, heavy, full"
echo "- Compare results across different loads"