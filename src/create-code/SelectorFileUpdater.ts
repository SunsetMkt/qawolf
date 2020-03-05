// import { CONTEXT as REPL_CONTEXT } from '@qawolf/repl';
// import { Selector, Step } from '@qawolf/types';
import { outputJson, remove, pathExists, readJson } from 'fs-extra';
import { concat } from 'lodash';
import { Step } from '../types';

type ConstructorOptions = {
  initialSelectors: string[];
  path: string;
};

type UpdateOptions = {
  steps: Step[];
};

const loadSelectors = async (path: string): Promise<string[]> => {
  const codeExists = await pathExists(path);
  if (!codeExists) return [];

  const selectors = await readJson(path);
  return selectors;
};

export class SelectorFileUpdater {
  public static async create(path: string): Promise<SelectorFileUpdater> {
    const initialSelectors = await loadSelectors(path);
    return new SelectorFileUpdater({ path, initialSelectors });
  }

  private _initialSelectors: string[] = [];
  private _steps: Step[] = [];
  private _path: string;

  private _lock: boolean;

  protected constructor(options: ConstructorOptions) {
    this._initialSelectors = options.initialSelectors;
    this._path = options.path;
  }

  public async finalize(): Promise<void> {
    // remove the selectors file if all are inlined css selectors
    if (
      !this._initialSelectors.length &&
      this._steps.every(step => step.cssSelector)
    ) {
      await remove(this._path);
    }
  }

  public selectors(): string[] {
    // we do not support editing of the selectors file
    // just replace the new selectors
    const newSelectors = this._steps.map(
      step => step.cssSelector || step.htmlSelector,
    );
    return concat(this._initialSelectors, newSelectors);
  }

  public async update(options: UpdateOptions): Promise<void> {
    this._steps = options.steps;

    if (this._lock) return;
    this._lock = true;

    await outputJson(this._path, this.selectors(), { spaces: ' ' });

    this._lock = false;
  }
}
