import { spawn, ChildProcess } from 'child_process';
import { readFile, readJson, pathExists } from 'fs-extra';
import { join } from 'path';
import { BrowserServer } from 'playwright';
import { launchServer } from '../browser';
import { CDPSession } from './CDPSession';
import { KEYS } from '../../src/create-code/createPrompt';
import { waitFor } from '../../src/utils';
import { sleep } from '../utils';

const testPath = join(__dirname, '../.qawolf/example.test.ts');
const selectorsPath = join(testPath, '../selectors/example.json');

const loadCode = (): Promise<string> => readFile(testPath, 'utf8');

describe('npx qawolf create', () => {
  let child: ChildProcess;
  let stdout = '';

  let server: BrowserServer;

  beforeAll(async () => {
    server = await launchServer();

    child = spawn('node', ['node_modules/qawolf/build/index.js', 'create'], {
      env: { ...process.env },
    });

    child.stdout.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it('creates the code file with the custom template', async () => {
    await waitFor(() => pathExists(testPath));
    const code = await loadCode();
    expect(code).toMatchSnapshot();
  });

  it('creates the selectors file', async () => {
    await waitFor(() => pathExists(selectorsPath));
    expect(await readJson(selectorsPath)).toEqual({});
  });

  it('opens the cli prompt', async () => {
    await waitFor(() => stdout.includes('Save'));
    expect(stdout).toContain('Save and exit');
    expect(stdout).toContain('Discard and exit');
  });

  it('converts actions to code', async () => {
    // give a little time for event collector to connect
    await sleep(2000);

    const targetId = stdout.match(/(?<=targetId=").*?(?=")/)[0];
    const session = await CDPSession.connect(server.wsEndpoint(), targetId);

    await session.send({
      method: 'Input.dispatchMouseEvent',
      params: {
        type: 'mouseWheel',
        deltaX: 0,
        deltaY: 2000,
        x: 0,
        y: 0,
      },
    });

    await waitFor(async () => (await loadCode()).includes('qawolf.scroll'));

    const code = await loadCode();
    expect(code).toContain('qawolf.scroll');
  });

  describe('discard', () => {
    it('exits the process', async () => {
      const exitPromise = new Promise((resolve) =>
        child.on('exit', (code) => resolve(code)),
      );

      child.stdin.write(KEYS.down);
      child.stdin.write(KEYS.down);
      child.stdin.write(KEYS.enter);

      const code = await exitPromise;
      expect(code).toEqual(0);
    });

    it('deletes the files', async () => {
      await waitFor(async () => !(await pathExists(testPath)));
      await waitFor(async () => !(await pathExists(selectorsPath)));
      expect(await pathExists(testPath)).toEqual(false);
      expect(await pathExists(selectorsPath)).toEqual(false);
    });
  });
});
