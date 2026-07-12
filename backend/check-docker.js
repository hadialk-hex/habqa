const http = require('http');

function queryPipe(pipeName, callback) {
  console.log(`Querying named pipe: ${pipeName}...`);
  const req = http.request({
    socketPath: pipeName,
    path: '/containers/json?all=1',
    method: 'GET'
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      callback(null, data);
    });
  });

  req.on('error', (err) => {
    callback(err, null);
  });

  req.end();
}

queryPipe('//./pipe/docker_engine', (err1, data1) => {
  if (err1 || !data1) {
    console.log(`Failed or empty on docker_engine. Error: ${err1 ? err1.message : 'none'}. Data length: ${data1 ? data1.length : 0}`);
    queryPipe('//./pipe/dockerDesktopLinuxEngine', (err2, data2) => {
      if (err2 || !data2) {
        console.log(`Failed or empty on dockerDesktopLinuxEngine. Error: ${err2 ? err2.message : 'none'}. Data length: ${data2 ? data2.length : 0}`);
        process.exit(1);
      } else {
        showContainers('dockerDesktopLinuxEngine', data2);
      }
    });
  } else {
    showContainers('docker_engine', data1);
  }
});

function showContainers(pipe, data) {
  try {
    const containers = JSON.parse(data);
    console.log(`SUCCESS: Fetched from ${pipe}!`);
    containers.forEach((c) => {
      console.log(`Container: ${c.Names.join(', ')} | Status: ${c.Status} | State: ${c.State}`);
    });
    process.exit(0);
  } catch (e) {
    console.error(`ERROR parsing JSON from ${pipe}:`, e.message);
    console.log('Raw output:', data);
    process.exit(1);
  }
}
