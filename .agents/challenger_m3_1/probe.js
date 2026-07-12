const net = require('net');

function checkPort(port, host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function main() {
  const ports = [5432, 5433, 6379];
  for (const port of ports) {
    const isOpen = await checkPort(port, '127.0.0.1');
    console.log(`Port ${port}: ${isOpen ? 'OPEN' : 'CLOSED'}`);
  }
}

main();
