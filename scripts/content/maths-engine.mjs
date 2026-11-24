// Sends maths checks to the Python maths engine (services/maths, `python -m app.content_check`).
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../services/maths');

export function createPythonChecker({
  python = 'python3',
  cwd = ENGINE_DIR,
  args = ['-m', 'app.content_check'],
} = {}) {
  return (checks) =>
    new Promise((resolve, reject) => {
      if (checks.length === 0) return resolve([]);
      const child = spawn(python, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d));
      child.stderr.on('data', (d) => (stderr += d));
      child.on('error', (err) =>
        reject(new Error(`could not run the maths engine with ${python}: ${err.message}`)),
      );
      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`maths engine exited with code ${code}: ${stderr.trim()}`));
        }
        resolve(JSON.parse(stdout).results);
      });
      child.stdin.on('error', () => {}); // reported through 'error' or 'close' instead
      child.stdin.end(JSON.stringify({ checks }));
    });
}
