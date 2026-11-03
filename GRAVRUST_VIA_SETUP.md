# Gravrust Via Relay Setup

## Overview
The **Gravrust Via Relay** enables connecting to servers of any version using ViaVersion/ViaRewind protocol translation.

## Requirements
- Java 17 or 21 (NOT Java 25+ due to ASM library compatibility)
- 2-4 GB RAM
- Port 25566 (TCP proxy), 8080 (HTTP/WebSocket)

## Quick Start

### 1. Install Java 17 or 21
```bash
# Check version
java -version
# Use Java 17 or 21, NOT Java 25+
```

### 2. Download ViaProxy
```bash
mkdir -p lib/via
curl -L -o lib/via/ViaProxy-3.3.2.jar \
  https://github.com/ViaVersion/ViaProxy/releases/download/v3.3.2/ViaProxy-3.3.2.jar
```

### 3. Configure
Copy `via-proxy-config.yml` and edit upstream server:
```yaml
server:
  address: "0.0.0.0"
  port: 25566
  viaversion: true
  viarewind: true
  viabackwards: true

upstream:
  - address: "your-server.com"
    port: 25565
    protocol: 762
    translate: true
```

### 4. Run
```bash
java -jar lib/via/ViaProxy-3.3.2.jar config via-proxy-config.yml
```

### 5. Configure Client
In Gravrust client, add proxy:
- Type: `Gravrust Via`
- URL: `ws://your-proxy-host:25566/via`

## Protocol Support
| Client | Server Versions |
|--------|-----------------|
| 1.21.x | 1.20.x, 1.19.x, ..., 1.7.x |
| 1.20.x | 1.21.x, 1.19.x, ..., 1.7.x |
| 1.19.x | 1.21.x, 1.20.x, ..., 1.7.x |
| 1.18.x | 1.21.x, 1.20.x, ..., 1.7.x |
| 1.17.x | 1.21.x, 1.20.x, ..., 1.7.x |
| 1.16.x | 1.21.x, 1.20.x, ..., 1.7.x |
| 1.15.x | 1.21.x, 1.20.x, ..., 1.7.x |
| 1.14.x | 1.21.x, 1.20.x, ..., 1.7.x |
| 1.13.x | 1.21.x, 1.20.x, ..., 1.7.x |
| 1.12.x | 1.21.x, 1.20.x, ..., 1.7.x |
| 1.7.x-1.11.x | 1.21.x, 1.20.x, ..., 1.7.x |
