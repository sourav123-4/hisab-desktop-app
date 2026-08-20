const { spawn } = require('child_process');
const electronPath = require('electron');

const args = process.argv.slice(2);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.', ...args], {
  stdio: 'inherit',
  env
});

child.on('close', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code || 0);
});
