const { execSync } = require('child_process');

try {
  const output = execSync('node ./node_modules/vite/bin/vite.js build', { encoding: 'utf8', stdio: 'pipe' });
  console.log('SUCCESS:');
  console.log(output);
} catch (error) {
  console.log('FAILED:');
  console.log(error.stdout);
  console.error(error.stderr);
}
