# 🚀 Load Testing Guide for Elysia + Bun Server

## 📋 Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Types](#test-types)
- [Performance Metrics](#performance-metrics)
- [Commands Reference](#commands-reference)
- [Results Analysis](#results-analysis)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## 🎯 Overview

This guide covers comprehensive load testing for the **Notification System** built with:
- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: SQLite with Prisma
- **Testing Tool**: Artillery

### Key Features Tested:
- ✅ REST API endpoints
- ✅ WebSocket connections
- ✅ Database operations
- ✅ Real-time notifications
- ✅ CronJob management

## ⚡ Quick Start

### 1. Prerequisites
```bash
# Ensure server is running
curl http://localhost:3001
# Expected: JSON response with server info

# Install Artillery (already done)
bunx artillery --version
```

### 2. Basic Test Commands
```bash
# Quick health check (5 users, 10 requests)
bunx artillery quick -c 5 -n 10 http://localhost:3001

# Simple load test (5 users for 60 seconds)
bunx artillery run simple-load-test.yml

# Comprehensive benchmark
./auto-benchmark.sh
```

## 🎮 Test Types

### 🚀 Quick Tests
Fast, immediate feedback tests using Artillery's quick command.

```bash
# Light load (5 users)
bunx artillery quick -c 5 -n 10 http://localhost:3001

# Medium load (20 users)
bunx artillery quick -c 20 -n 15 http://localhost:3001

# Heavy load (50 users)
bunx artillery quick -c 50 -n 10 http://localhost:3001

# Stress test (100 users)
bunx artillery quick -c 100 -n 5 http://localhost:3001
```

### 📊 Configuration-Based Tests
Detailed scenario tests using YAML configurations.

#### Simple Load Test (`simple-load-test.yml`)
- **Duration**: 60 seconds
- **Users**: 5 concurrent
- **Scenarios**: Health check, CronJobs, Notifications
- **Purpose**: Baseline performance

```bash
bunx artillery run simple-load-test.yml
```

#### Full Load Test (`load-test.yml`)
- **Phases**: 4 (Warm-up → Normal → Peak → Stress)
- **Duration**: 210 seconds total
- **Max Users**: 50 concurrent
- **Scenarios**: Complete API coverage + WebSocket

```bash
bunx artillery run load-test.yml
```

### 🤖 Automated Benchmark
Complete performance analysis across multiple load levels.

```bash
./auto-benchmark.sh
# Generates comprehensive report with:
# - 6 different test scenarios
# - Performance comparison
# - Bottleneck identification
# - Recommendations
```

## 📈 Performance Metrics

### 🎯 Key Metrics to Monitor

| Metric | Description | Good | Acceptable | Poor |
|--------|-------------|------|------------|------|
| **p95 Response Time** | 95% of requests complete within | <50ms | <100ms | >500ms |
| **p99 Response Time** | 99% of requests complete within | <100ms | <300ms | >1000ms |
| **Success Rate** | Percentage of successful requests | 100% | >95% | <95% |
| **Request Rate** | Requests handled per second | Variable | Stable | Dropping |
| **Error Rate** | Failed requests percentage | 0% | <5% | >5% |

### 📊 Bun-Specific Metrics
```bash
# Memory usage (Bun is memory-efficient)
ps -p $(pgrep -f "bun.*server.ts") -o pid,rss,vsz

# CPU usage
top -pid $(pgrep -f "bun.*server.ts")

# Real-time monitoring
./monitor-performance.sh
```

## 📝 Commands Reference

### Quick Tests
```bash
# Basic health check
bunx artillery quick -c 5 -n 10 http://localhost:3001

# Progressive load testing
bunx artillery quick -c 10 -n 20 http://localhost:3001
bunx artillery quick -c 25 -n 15 http://localhost:3001
bunx artillery quick -c 50 -n 10 http://localhost:3001
bunx artillery quick -c 100 -n 5 http://localhost:3001
```

### Config-Based Tests
```bash
# Simple load test
bunx artillery run simple-load-test.yml

# Full load test with all phases
bunx artillery run load-test.yml

# Save results to file
bunx artillery run simple-load-test.yml -o results.json

# Quiet mode (minimal output)
bunx artillery run simple-load-test.yml -q
```

### Monitoring
```bash
# Real-time server monitoring
./monitor-performance.sh

# Check server health
curl -I http://localhost:3001

# View active connections
netstat -an | grep :3001

# Database record count
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Notification;"
```

### Automated Testing
```bash
# Complete benchmark suite
./auto-benchmark.sh

# Run all test scripts
./run-load-tests.sh

# Custom monitoring during test
./monitor-performance.sh & bunx artillery run load-test.yml; kill %1
```

## 🔍 Results Analysis

### ✅ Excellent Performance Indicators
```
http.response_time:
  p95: 10-50ms
  p99: 20-100ms
http.codes.200: >95%
vusers.failed: 0
```

### ⚠️ Warning Signs
```
http.response_time:
  p95: >500ms
  p99: >1000ms
vusers.failed: >0
Error rates: >5%
```

### 📊 Sample Good Results
```
--------------------------------
Summary report @ 08:57:46(+0700)
--------------------------------
http.codes.200: ................................ 226
http.codes.201: ................................ 74
http.request_rate: .............................. 5/sec
http.requests: .................................. 300
http.response_time:
  p95: .......................................... 6ms
  p99: .......................................... 10.9ms
vusers.failed: .................................. 0
```

### 🎯 Performance Benchmarks

#### Expected Results for Bun + Elysia:
- **Baseline (5 users)**: p95 < 10ms
- **Light Load (10 users)**: p95 < 20ms
- **Medium Load (25 users)**: p95 < 50ms
- **Heavy Load (50 users)**: p95 < 100ms
- **Stress Test (100 users)**: p95 < 200ms

## 🛠️ Troubleshooting

### Common Issues

#### 1. Server Not Responding
```bash
# Check if server is running
curl -I http://localhost:3001

# If not running, start server
bun run dev

# Check for port conflicts
lsof -i :3001
```

#### 2. High Response Times
```bash
# Check server resources
./monitor-performance.sh

# Look for database bottlenecks
sqlite3 prisma/dev.db ".timeout 5000"

# Reduce concurrent users
bunx artillery quick -c 5 -n 10 http://localhost:3001
```

#### 3. Artillery Stuck/Hanging
```bash
# Kill artillery processes
pkill -f artillery

# Restart with lower load
bunx artillery quick -c 1 -n 5 http://localhost:3001
```

#### 4. Database Errors
```bash
# Check database file
ls -la prisma/dev.db

# Clear test data
sqlite3 prisma/dev.db "DELETE FROM Notification WHERE title LIKE '%Test%';"

# Regenerate database
bunx prisma db push
```

### Error Codes Meaning
- **Connection refused**: Server not running
- **Timeout errors**: Server overloaded
- **500 errors**: Server-side issues
- **Database locked**: SQLite concurrency limits

## ✨ Best Practices

### 🎯 Testing Strategy
1. **Start Small**: Begin with 5-10 users
2. **Progressive Load**: Gradually increase concurrent users
3. **Monitor Resources**: Watch CPU, memory, and database
4. **Test Different Scenarios**: Mix of GET, POST, WebSocket
5. **Document Baselines**: Record normal performance metrics

### 📊 Monitoring Strategy
```bash
# Always monitor during heavy tests
./monitor-performance.sh &
TEST_MONITOR_PID=$!

# Run your load test
bunx artillery run load-test.yml

# Stop monitoring
kill $TEST_MONITOR_PID
```

### 🔄 Continuous Testing
```bash
# Daily performance check
bunx artillery run simple-load-test.yml > "daily-$(date +%Y%m%d).log"

# Weekly comprehensive test
./auto-benchmark.sh

# Before deployment
bunx artillery run load-test.yml
```

### 🎨 Custom Test Creation
```yaml
# Create custom-test.yml
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 30
      arrivalRate: 10
scenarios:
  - name: "Custom Scenario"
    flow:
      - get:
          url: "/your-endpoint"
      - think: 1
      - post:
          url: "/api/notifications"
          json:
            title: "Custom Test"
            message: "Testing custom scenario"
            type: "info"
            category: "system"
```

### 📈 Performance Optimization Tips
1. **Database**: Consider connection pooling for high loads
2. **Caching**: Implement response caching for frequent requests
3. **Rate Limiting**: Protect against abuse
4. **Monitoring**: Set up alerts for performance degradation
5. **Scaling**: Plan horizontal scaling strategies

## 📚 Additional Resources

### Files in This Project
- `simple-load-test.yml` - Basic load testing config
- `load-test.yml` - Comprehensive testing config
- `auto-benchmark.sh` - Automated benchmark suite
- `monitor-performance.sh` - Real-time monitoring
- `test-commands.md` - Detailed command reference
- `QUICK_COMMANDS.md` - Quick reference guide

### Artillery Documentation
- [Artillery.io Documentation](https://artillery.io/docs/)
- [Load Testing Best Practices](https://artillery.io/docs/guides/guides/load-testing-best-practices.html)
- [Performance Testing Guide](https://artillery.io/docs/guides/guides/getting-started.html)

### Bun Performance
- [Bun Performance Benchmarks](https://bun.sh/docs/runtime/performance)
- [Elysia Performance Guide](https://elysiajs.com/concept/life-cycle.html)

---

## 🎉 Quick Test Commands

Copy and paste these commands to get started immediately:

```bash
# 🚀 Quick health check
bunx artillery quick -c 5 -n 10 http://localhost:3001

# ⚡ Medium load test
bunx artillery quick -c 20 -n 15 http://localhost:3001

# 📊 Simple config test
bunx artillery run simple-load-test.yml

# 🤖 Full automated benchmark
./auto-benchmark.sh

# 📈 Monitor while testing
./monitor-performance.sh
```

**Happy Load Testing! 🚀**