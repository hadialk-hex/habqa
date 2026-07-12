const net = require('net');

const client = new net.Socket();
client.setTimeout(2000);

client.connect(5432, '127.0.0.1', () => {
    console.log('SUCCESS: Connected to port 5432 on 127.0.0.1!');
    client.destroy();
    process.exit(0);
});

client.on('error', (err) => {
    console.error('ERROR: Could not connect to port 5432:', err.message);
    process.exit(1);
});

client.on('timeout', () => {
    console.error('ERROR: Connection timed out.');
    client.destroy();
    process.exit(1);
});
