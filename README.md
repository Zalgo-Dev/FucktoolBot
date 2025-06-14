﻿# Fucktool Bot
    A Minecraft server scanner and vulnerability detector for BungeeHack and plugin channel enumeration.

---

## Features

- Server Brand Detection: Identifies server software (Spigot, Paper, BungeeCord, etc.)
- Plugin Channel Enumeration: Discovers available plugin messaging channels
- BungeeHack Vulnerability Detection: Automatically detects BungeeHack vulnerabilities
- Dual Mode Scanning: Normal and fakehost modes for bypassing protections
JSON Output: Machine-readable results for integration

---

## Installation

```bash
git clone https://github.com/Zalgo-Dev/FucktoolBot.git
cd FucktoolBot
npm install minecraft-protocol
```

---

## Usage

### Basic Scan

```bash
node bot.js <ip> <port>
```

### Advanced Options

```bash
# With fakehost mode (bypasses some protections)
node bot.js 127.0.0.1 25565 fakehost

# Specify Minecraft version
node bot.js 127.0.0.1 25565 none 1.21.4

# Full example
node bot.js example.com 25565 fakehost 1.20.1
```

### Example Output (fake infos)

```bash
=== SCAN RESULTS ===
Server: play.hypixel.net:25565
Brand: BungeeCord (git:BungeeCord-Bootstrap:1.21-R0.3-SNAPSHOT:5348aad:1971)
Channels (3): bungeecord:main, sr:messagechannel, authme:main
BungeeHack: VULNERABLE
Mode: FAKEHOST

JSON Result:
{
  "ip": "play.hypixel.net",
  "port": 25565,
  "brand": "BungeeCord (git:BungeeCord-Bootstrap:1.21-R0.3-SNAPSHOT:5348aad:1971)",
  "channels": ["bungeecord:main", "sr:messagechannel", "authme:main"],
  "channelCount": 3,
  "bungeeHackVulnerable": true,
  "mode": "fakehost"
}
```

---

## Vulnerability Detection

### BungeeHack

The scanner automatically detects servers vulnerable to BungeeHack by:

- Identifying BungeeCord instances
- Checking for exposed bungeecord:main channel
- Testing fakehost bypass techniques
- Analyzing kick messages for forwarding errors

### Common Vulnerable Configurations

- BungeeCord with bungeecord:main channel exposed
- Misconfigured IP forwarding
- Servers accepting connections without proper authentication

---

## Detected Channels

The scanner identifies various plugin channels including:

- bungeecord:main - BungeeCord proxy channel
- authme:* - AuthMe authentication
- sr:* - SkinsRestorer channels
- luckperms:* - LuckPerms permission system
- essentials:* - EssentialsX plugin
- Custom plugin channels

---

## Modes

### Normal Mode (none)

- Standard Minecraft client connection
- Basic vulnerability detection
- Compatible with most servers

### Fakehost Mode (fakehost)

- Uses spoofed host headers
- Automatically retried if normal mode fails

---

## Adding Custom Exploits

To add custom exploit payloads, modify the sendExploit() function:

```javascript
sendExploit() {
    // Example: Send custom payload to BungeeCord
    if (this.channels.includes('bungeecord:main')) {
        this.sendPluginPayload('bungeecord:main', {
            type: 'Connect',
            server: 'lobby'
        });
    }
    
    // Example: Test AuthMe bypass
    if (this.channels.some(ch => ch.includes('authme'))) {
        this.sendPluginPayload('authme:main', {
            action: 'bypass_attempt'
        });
    }
}
```

---

## Requirements

- Node.js 14+
- minecraft-protocol package

---

## Legal Disclaimer
    This tool is for educational and authorized testing purposes only. Users are responsible for ensuring they have proper authorization before scanning any servers. Unauthorized scanning or exploitation of servers you don't own may violate laws and terms of service.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## License
This project is provided as-is for educational purposes. Use responsibly.

## Credits

Built with minecraft-protocol
BungeeHack research and techniques
