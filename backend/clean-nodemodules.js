const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'node_modules');

if (fs.existsSync(dir)) {
  console.log('Deleting node_modules...');
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('Successfully deleted node_modules!');
  } catch (err) {
    console.error('Failed to delete node_modules:', err.message);
  }
} else {
  console.log('node_modules does not exist.');
}
