const fs = require('fs');

const logPath = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\491683b3-7386-4433-a1e7-a8d83c467eff\\.system_generated\\tasks\\task-27.log';
if (!fs.existsSync(logPath)) {
  console.error("Log file does not exist at " + logPath);
  process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split(/\r?\n/);

console.log("Total lines in log: " + lines.length);

const results = [];
let jestSummaryStarted = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Look for Jest test summary patterns or failures
  if (line.includes('FAIL') || line.includes('Test Suites:') || line.includes('Tests:') || line.includes('Snapshots:') || line.includes('Time:')) {
    results.push(`Line ${i+1}: ${line}`);
  }
  // If there's an error stack trace or fail expectation
  if (line.includes('●') || line.includes('Error:') || line.includes('expect(')) {
    // grab a few surrounding lines
    results.push(`--- Context near line ${i+1} ---`);
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 8); j++) {
      results.push(`[${j+1}] ${lines[j]}`);
    }
    results.push(`---------------------------`);
    // skip forward to avoid too many duplicate overlaps
    i += 5;
  }
}

fs.writeFileSync('failures_summary.txt', results.join('\n'), 'utf8');
console.log("Wrote summary to failures_summary.txt");
