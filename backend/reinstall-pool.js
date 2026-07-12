const { execSync } = require('child_process');

console.log('Offline package installation repair started...');

try {
  execSync('npm install --offline --legacy-peer-deps --include=dev', { stdio: 'inherit', cwd: __dirname });
  console.log('Offline package repair complete!');
} catch (err) {
  console.error('Offline package repair failed:', err.message);
  process.exit(1);
}
