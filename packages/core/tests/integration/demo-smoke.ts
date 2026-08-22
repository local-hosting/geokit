/**
 * Smoke-test every page in the demo app (demo/) via Playwright.
 * Starts the Vite demo server, loads each HTML page, and fails on HTTP or runtime errors.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { DEMO_PAGES } from '../../demo/shared/pages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 3001;
const BASE = `http://127.0.0.1:${PORT}`;

const IGNORED_CONSOLE_PATTERNS = [
  /Failed to register Mapbox API provider/i,
  /No Mapbox token found/i,
  /\[gk-demo\] MAPTILER_KEY missing/i,
  /favicon\.ico/i,
];

function shouldIgnoreConsole(text: string): boolean {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}

async function waitForServer(url: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Vite demo server did not become ready at ${url}`);
}

function startDemoServer(): ChildProcess {
  return spawn(
    'yarn',
    ['vite', '--config', 'config/vite.demo.config.js', '--port', String(PORT), '--strictPort'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );
}

async function collectPageErrors(page: Page, path: string): Promise<string[]> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!shouldIgnoreConsole(text)) consoleErrors.push(text);
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60_000 });
  if (!response || !response.ok()) {
    throw new Error(`${path}: HTTP ${response?.status() ?? 'no response'}`);
  }

  // Let maps finish initial async work.
  await page.waitForTimeout(5_000);

  if (path === '/maps/layers-test.html') {
    const status = await page.locator('#status .error').count();
    if (status > 0) {
      const text = await page.locator('#status').innerText();
      pageErrors.push(`layers-test status errors:\n${text}`);
    }
  }

  return [...pageErrors, ...consoleErrors];
}

async function main(): Promise<void> {
  let server: ChildProcess | null = null;
  const failures: string[] = [];

  try {
    try {
      await waitForServer(`${BASE}/index.html`, 3_000);
      process.stdout.write('Using existing Vite demo server on port 3001\n');
    } catch {
      server = startDemoServer();
      const logServer = (chunk: Buffer) => {
        const line = chunk.toString();
        if (/error/i.test(line) && !/deprecation/i.test(line)) {
          process.stderr.write(`[vite] ${line}`);
        }
      };
      server.stdout?.on('data', logServer);
      server.stderr?.on('data', logServer);
      await waitForServer(`${BASE}/index.html`);
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    for (const demoPath of DEMO_PAGES) {
      process.stdout.write(`  • ${demoPath} ... `);
      try {
        const errors = await collectPageErrors(page, demoPath);
        if (errors.length > 0) {
          failures.push(`${demoPath}:\n  - ${errors.join('\n  - ')}`);
          process.stdout.write('FAIL\n');
        } else {
          process.stdout.write('ok\n');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push(`${demoPath}: ${message}`);
        process.stdout.write('FAIL\n');
      }
    }

    await browser.close();
  } finally {
    server?.kill('SIGTERM');
  }

  if (failures.length > 0) {
    console.error('\nDemo smoke tests failed:\n');
    for (const failure of failures) {
      console.error(`• ${failure}\n`);
    }
    process.exit(1);
  }

  console.log(`\nAll ${DEMO_PAGES.length} demo pages passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
