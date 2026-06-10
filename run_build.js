const { execSync } = require('child_process');
const fs = require('fs');

console.log('Starting Next.js build check...');
try {
  const output = execSync('npx next build', { encoding: 'utf8', stdio: 'pipe' });
  fs.writeFileSync('build_output.txt', 'BUILD SUCCESSFUL:\n' + output);
  console.log('Build succeeded!');
} catch (error) {
  const errorDetails = error.stdout + '\n' + error.stderr;
  fs.writeFileSync('build_output.txt', 'BUILD FAILED:\n' + errorDetails);
  console.log('Build failed! Logs saved to build_output.txt');
}
