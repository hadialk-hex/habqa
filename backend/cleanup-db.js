const { execSync } = require('child_process');

console.log('Starting database cleanup...');

try {
  console.log('Stopping and removing any conflicting container named hubqa_postgres...');
  execSync('docker rm -f hubqa_postgres', { stdio: 'inherit' });
} catch (e) {
  console.warn('hubqa_postgres container cleanup warning:', e.message);
}

try {
  console.log('Stopping and removing any conflicting container named hubqa-postgres...');
  execSync('docker rm -f hubqa-postgres', { stdio: 'inherit' });
} catch (e) {
  console.warn('hubqa-postgres container cleanup warning:', e.message);
}

try {
  console.log('Starting postgres container using backend docker-compose.yml on port 5432...');
  execSync('docker compose -f docker-compose.yml up -d postgres', { stdio: 'inherit' });
  console.log('PostgreSQL container started successfully!');
} catch (e) {
  console.error('Error starting backend database container:', e.message);
}
