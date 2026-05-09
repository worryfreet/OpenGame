/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';

type CourseArchetype = 'course_ui' | 'course_grid' | 'course_td';

interface CourseContentForSmoke {
  lessonUnits: Array<{ id: string }>;
  interactions: Array<{ id: string }>;
  assessments: Array<{ id: string; correctIndex: number }>;
  workflow?: {
    nodes: Array<{ id: string; playletId: string }>;
  };
}

interface CourseRuntimeStatus {
  stage?: string;
  scene?: string;
  playletId?: string;
  detail?: string;
}

interface BrowserSmokeOptions {
  packageDir: string;
  repoRoot: string;
  archetype: CourseArchetype;
}

export type BrowserSmokeResult =
  | {
      status: 'passed';
      url: string;
      finalStatus: CourseRuntimeStatus;
      consoleErrors: string[];
    }
  | {
      status: 'skipped';
      reason: string;
    }
  | {
      status: 'failed';
      reason: string;
      consoleErrors: string[];
    };

interface DevtoolsTarget {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

interface CdpMessage {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
}

interface RuntimeEvaluateResult {
  result?: {
    value?: unknown;
    description?: string;
  };
}

class CdpClient {
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private listeners = new Map<string, Array<(params: unknown) => void>>();

  constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) {
          pending.reject(new Error(message.error.message ?? 'CDP 调用失败。'));
        } else {
          pending.resolve(message.result);
        }
        return;
      }
      if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) {
          listener(message.params);
        }
      }
    });
    this.socket.addEventListener('close', () => {
      this.rejectPending('Chrome DevTools WebSocket 已关闭。');
    });
    this.socket.addEventListener('error', () => {
      this.rejectPending('Chrome DevTools WebSocket 出错。');
    });
  }

  static connect(url: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => resolve(new CdpClient(socket)));
      socket.addEventListener('error', () => {
        reject(new Error('无法连接 Chrome DevTools WebSocket。'));
      });
    });
  }

  send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 调用超时：${method}`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
    });
  }

  on(method: string, listener: (params: unknown) => void): void {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close(): void {
    this.socket.close();
  }

  private rejectPending(message: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
      this.pending.delete(id);
    }
  }
}

export async function runCourseBrowserSmoke(
  options: BrowserSmokeOptions,
): Promise<BrowserSmokeResult> {
  const chromePath = await findChromeExecutable();
  if (!chromePath) {
    return { status: 'skipped', reason: '未发现可用的 Chrome/Chromium。' };
  }

  await ensureNodeModulesLink(options.packageDir, options.repoRoot);
  const chromePort = await getFreePort();
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'opengame-course-chrome-'),
  );
  const chrome = launchChrome(chromePath, chromePort, userDataDir);
  const chromeExit = waitForExit(chrome);

  try {
    const targetResult = await waitForDevtoolsTarget(chromePort, chromeExit);
    if (targetResult.status === 'skipped') {
      return targetResult;
    }

    const client = await CdpClient.connect(targetResult.webSocketDebuggerUrl);
    const consoleErrors = collectConsoleErrors(client);
    const vite = await startVite(options.packageDir, options.repoRoot);
    try {
      const url = `http://127.0.0.1:${vite.port}/`;
      const courseContent = await readCourseContent(options.packageDir);
      const result = await driveCourseFlow(client, {
        url,
        archetype: options.archetype,
        courseContent,
        consoleErrors,
      });
      return result;
    } finally {
      client.close();
      stopProcess(vite.process);
    }
  } finally {
    stopProcess(chrome);
    await removeTempDir(userDataDir);
  }
}

async function removeTempDir(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 3 });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(
          `Chrome 临时目录清理失败，已忽略：${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }
      await delay(100 * (attempt + 1));
    }
  }
}

async function findChromeExecutable(): Promise<string | undefined> {
  const candidates = [
    process.env['CHROME_PATH'],
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // 继续尝试下一个候选浏览器。
    }
  }
  return undefined;
}

function launchChrome(
  chromePath: string,
  port: number,
  userDataDir: string,
): ChildProcessWithoutNullStreams {
  return spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-extensions',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1024,768',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

async function waitForDevtoolsTarget(
  port: number,
  exitPromise: Promise<{ code: number | null; signal: NodeJS.Signals | null }>,
): Promise<
  | { status: 'ready'; webSocketDebuggerUrl: string }
  | { status: 'skipped'; reason: string }
> {
  const endpoint = `http://127.0.0.1:${port}/json`;
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const exit = await Promise.race([exitPromise, delay(100).then(() => null)]);
    if (exit) {
      return {
        status: 'skipped',
        reason: `Chrome 无法在当前环境启动：code=${exit.code ?? 'null'} signal=${
          exit.signal ?? 'null'
        }。`,
      };
    }

    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const targets = (await response.json()) as DevtoolsTarget[];
        const target =
          targets.find(
            (item) => item.type === 'page' && item.webSocketDebuggerUrl,
          ) ?? targets.find((item) => item.webSocketDebuggerUrl);
        if (target?.webSocketDebuggerUrl) {
          return {
            status: 'ready',
            webSocketDebuggerUrl: target.webSocketDebuggerUrl,
          };
        }
      }
    } catch {
      // Chrome 还没完成 DevTools HTTP 服务启动，继续轮询。
    }
  }
  return { status: 'skipped', reason: 'Chrome DevTools 端口启动超时。' };
}

async function startVite(
  packageDir: string,
  repoRoot: string,
): Promise<{ port: number; process: ChildProcessWithoutNullStreams }> {
  const port = await getFreePort();
  const viteBin = path.join(repoRoot, 'node_modules/vite/bin/vite.js');
  const child = spawn(
    process.execPath,
    [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: packageDir,
      env: {
        ...process.env,
        npm_config_cache: path.join(os.tmpdir(), 'opengame-npm-cache'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const output: string[] = [];
  child.stdout.on('data', (chunk) => {
    output.push(String(chunk));
  });
  child.stderr.on('data', (chunk) => {
    output.push(String(chunk));
  });

  const exitPromise = waitForExit(child);
  const url = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const exit = await Promise.race([exitPromise, delay(100).then(() => null)]);
    if (exit) {
      throw new Error(
        `Vite dev server 提前退出：code=${exit.code ?? 'null'} signal=${
          exit.signal ?? 'null'
        }。`,
      );
    }
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return { port, process: child };
    } catch {
      // 服务尚未监听，继续等待。
    }
  }
  stopProcess(child);
  throw new Error(
    `Vite dev server 启动超时。\n${output.join('').trim() || '无输出'}`,
  );
}

async function driveCourseFlow(
  client: CdpClient,
  params: {
    url: string;
    archetype: CourseArchetype;
    courseContent: CourseContentForSmoke;
    consoleErrors: string[];
  },
): Promise<BrowserSmokeResult> {
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Page.navigate', { url: params.url });
  await waitForExpressionWithDiagnostics(
    client,
    "Boolean(document.querySelector('#press-enter-text'))",
    params.consoleErrors,
  );
  await pressKey(client, 'Enter');
  await click(client, 512, 520);
  await dispatchDomStartEvent(client);
  await delay(900);

  if (params.courseContent.workflow) {
    await driveWorkflowCourse(client, params.courseContent);
    const finalStatus = await waitForRuntimeStage(client, 'report');
    return finishBrowserSmoke(client, params, finalStatus);
  }

  if (params.archetype === 'course_grid') {
    await click(client, 512, 520);
    await waitForRuntimeStage(client, 'practice');
    for (let i = 0; i < params.courseContent.interactions.length; i++) {
      await click(client, 620, 181 + i * 86);
      await delay(120);
    }
    for (let i = 0; i < params.courseContent.assessments.length; i++) {
      await click(client, 620, 390 + i * 58);
      await delay(180);
    }
  } else if (params.archetype === 'course_td') {
    await click(client, 512, 520);
    await waitForRuntimeStage(client, 'practice');
    for (const assessment of params.courseContent.assessments) {
      await click(client, 512, 225 + assessment.correctIndex * 64);
      await delay(500);
    }
  } else {
    for (let i = 0; i < params.courseContent.lessonUnits.length * 4; i++) {
      await pressKey(client, 'Enter');
      await delay(80);
    }
    await waitForRuntimeStage(client, 'practice');
    for (const _interaction of params.courseContent.interactions) {
      await pressKey(client, 'Enter');
      await delay(160);
    }
    await waitForRuntimeStage(client, 'assessment');
    for (const assessment of params.courseContent.assessments) {
      for (let i = 0; i < assessment.correctIndex; i++) {
        await pressKey(client, 'ArrowDown');
        await delay(40);
      }
      await pressKey(client, 'Enter');
      await delay(160);
    }
  }

  const finalStatus = await waitForRuntimeStage(client, 'report');
  return finishBrowserSmoke(client, params, finalStatus);
}

async function driveWorkflowCourse(
  client: CdpClient,
  courseContent: CourseContentForSmoke,
): Promise<void> {
  await waitForRuntimeStage(client, 'playlet');
  const nodeCount = courseContent.workflow?.nodes.length ?? 0;
  for (let i = 0; i < nodeCount; i++) {
    await waitForRuntimeStage(client, 'playlet');
    await completeCurrentWorkflowPlaylet(client);
    await delay(250);
  }
}

async function finishBrowserSmoke(
  client: CdpClient,
  params: {
    url: string;
    consoleErrors: string[];
  },
  finalStatus: CourseRuntimeStatus,
): Promise<BrowserSmokeResult> {
  const canvasReady = await evaluateBoolean(
    client,
    `(() => {
      const canvas = document.querySelector('canvas');
      return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
    })()`,
  );
  if (!canvasReady) {
    return {
      status: 'failed',
      reason: '浏览器未渲染有效 canvas。',
      consoleErrors: params.consoleErrors,
    };
  }
  const fatalErrors = params.consoleErrors.filter(
    (message) => !/Failed to load resource/.test(message),
  );
  if (fatalErrors.length > 0) {
    return {
      status: 'failed',
      reason: fatalErrors.join('\n'),
      consoleErrors: params.consoleErrors,
    };
  }
  return {
    status: 'passed',
    url: params.url,
    finalStatus,
    consoleErrors: params.consoleErrors,
  };
}

function collectConsoleErrors(client: CdpClient): string[] {
  const errors: string[] = [];
  client.on('Runtime.exceptionThrown', (params) => {
    errors.push(JSON.stringify(params));
  });
  client.on('Runtime.consoleAPICalled', (params) => {
    if (isConsoleError(params)) {
      errors.push(JSON.stringify(params));
    }
  });
  client.on('Log.entryAdded', (params) => {
    if (isLogError(params)) {
      errors.push(JSON.stringify(params));
    }
  });
  return errors;
}

function isConsoleError(value: unknown): boolean {
  return isRecord(value) && value['type'] === 'error';
}

function isLogError(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const entry = value['entry'];
  return isRecord(entry) && entry['level'] === 'error';
}

async function waitForRuntimeStage(
  client: CdpClient,
  stage: string,
): Promise<CourseRuntimeStatus> {
  const expression = `document.querySelector('[data-course-runtime-status]')?.getAttribute('data-stage') === ${JSON.stringify(
    stage,
  )}`;
  try {
    await waitForExpression(client, expression);
  } catch (error) {
    const status = await getRuntimeStatus(client);
    const diagnostic = await evaluateValue(
      client,
      `(() => ({
        href: location.href,
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 500) ?? '',
        html: document.body?.innerHTML?.slice(0, 500) ?? '',
        hasCanvas: Boolean(document.querySelector('canvas')),
        activeElement: document.activeElement?.tagName
      }))()`,
    );
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n当前状态：${JSON.stringify(
        status,
      )}\n页面诊断：${JSON.stringify(diagnostic)}`,
    );
  }
  return getRuntimeStatus(client);
}

async function getRuntimeStatus(
  client: CdpClient,
): Promise<CourseRuntimeStatus> {
  const value = await evaluateValue(
    client,
    `(() => {
      const node = document.querySelector('[data-course-runtime-status]');
      if (!node) return {};
      return {
        stage: node.getAttribute('data-stage') ?? undefined,
        scene: node.getAttribute('data-scene') ?? undefined,
        playletId: node.getAttribute('data-playlet-id') ?? undefined,
        detail: node.textContent ?? undefined,
      };
    })()`,
  );
  return isRecord(value)
    ? {
        stage: typeof value['stage'] === 'string' ? value['stage'] : undefined,
        scene: typeof value['scene'] === 'string' ? value['scene'] : undefined,
        playletId:
          typeof value['playletId'] === 'string'
            ? value['playletId']
            : undefined,
        detail:
          typeof value['detail'] === 'string' ? value['detail'] : undefined,
      }
    : {};
}

async function waitForExpressionWithDiagnostics(
  client: CdpClient,
  expression: string,
  consoleErrors: string[],
): Promise<void> {
  try {
    await waitForExpression(client, expression);
  } catch (error) {
    const diagnostic = await evaluateValue(
      client,
      `(() => ({
        href: location.href,
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 500) ?? '',
        html: document.body?.innerHTML?.slice(0, 500) ?? ''
      }))()`,
    );
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n页面诊断：${JSON.stringify(
        diagnostic,
      )}\nConsole errors：${consoleErrors.join('\n') || '无'}`,
    );
  }
}

async function waitForExpression(
  client: CdpClient,
  expression: string,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluateBoolean(client, expression)) return;
    await delay(100);
  }
  throw new Error(`等待浏览器条件超时：${expression}`);
}

async function evaluateBoolean(
  client: CdpClient,
  expression: string,
): Promise<boolean> {
  return (await evaluateValue(client, expression)) === true;
}

async function evaluateValue(
  client: CdpClient,
  expression: string,
): Promise<unknown> {
  const result = await client.send<RuntimeEvaluateResult>('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result?.value;
}

async function pressKey(
  client: CdpClient,
  key: 'Enter' | 'ArrowDown',
): Promise<void> {
  const code = key === 'Enter' ? 'Enter' : 'ArrowDown';
  const keyCode = key === 'Enter' ? 13 : 40;
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

async function click(client: CdpClient, x: number, y: number): Promise<void> {
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
}

async function clickGameCoordinate(
  client: CdpClient,
  gameX: number,
  gameY: number,
): Promise<void> {
  const value = await evaluateValue(
    client,
    `(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + (${gameX} / canvas.width) * rect.width,
        y: rect.top + (${gameY} / canvas.height) * rect.height
      };
    })()`,
  );
  if (!isRecord(value)) {
    throw new Error('无法定位 Phaser canvas，不能执行玩法点击。');
  }
  const x = Number(value['x']);
  const y = Number(value['y']);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Phaser canvas 点击坐标无效：${JSON.stringify(value)}`);
  }
  await click(client, x, y);
}

async function completeCurrentWorkflowPlaylet(client: CdpClient): Promise<void> {
  const status = await getRuntimeStatus(client);
  if (
    status.playletId === 'playlet-单选判断' ||
    status.scene === '单选判断PlayletScene'
  ) {
    await clickSingleChoiceJudgementPlaylet(client);
    return;
  }
  await dispatchSmokeCompletePlayletEvent(client);
}

async function clickWorkflowCompleteButton(client: CdpClient): Promise<void> {
  const value = await evaluateValue(
    client,
    `(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      return {
        x: canvas.width / 2 - 150,
        y: canvas.height - 120
      };
    })()`,
  );
  if (!isRecord(value)) {
    throw new Error('无法定位 Phaser canvas，不能点击玩法完成按钮。');
  }
  await clickGameCoordinate(client, Number(value['x']), Number(value['y']));
}

async function dispatchSmokeCompletePlayletEvent(
  client: CdpClient,
): Promise<void> {
  await evaluateValue(
    client,
    `(() => {
      document.dispatchEvent(
        new Event('opengame:browser-smoke-complete-playlet')
      );
      return true;
    })()`,
  );
}

async function clickSingleChoiceJudgementPlaylet(
  client: CdpClient,
): Promise<void> {
  await clickGameCoordinate(client, 692, 142);
  await delay(120);
  await clickGameCoordinate(client, 812, 234);
}

async function dispatchDomStartEvent(client: CdpClient): Promise<void> {
  await evaluateValue(
    client,
    `(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true
      }));
      document.querySelector('#title-screen-container')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
      return true;
    })()`,
  );
}

async function ensureNodeModulesLink(
  packageDir: string,
  repoRoot: string,
): Promise<void> {
  const target = path.join(packageDir, 'node_modules');
  try {
    await fs.lstat(target);
    return;
  } catch {
    // 课程包是临时装配目录，使用仓库依赖软链避免每次 smoke 都 npm install。
  }
  await fs.symlink(path.join(repoRoot, 'node_modules'), target, 'dir');
}

async function readCourseContent(
  packageDir: string,
): Promise<CourseContentForSmoke> {
  const raw = await fs.readFile(
    path.join(packageDir, 'src/courseContent.json'),
    'utf-8',
  );
  const parsed = JSON.parse(raw) as CourseContentForSmoke;
  return parsed;
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('无法分配本地端口。')));
      }
    });
    server.on('error', reject);
  });
}

function waitForExit(
  child: ChildProcessWithoutNullStreams,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

function stopProcess(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.killed) return;
  child.kill('SIGTERM');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
