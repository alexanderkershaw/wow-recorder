import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

import { EventEmitter } from 'stream';
import { FlavourConfig } from 'main/types';
import { PollerImplementation } from 'types/Poller';
import { app } from 'electron';
import path from 'path';

export class PollerWindows
  extends EventEmitter
  implements PollerImplementation
{
  private _isWowRunning = false;
  private _pollInterval: NodeJS.Timer | undefined;
  private child: ChildProcessWithoutNullStreams | undefined;
  private flavourConfig: FlavourConfig;
  private binary = 'rust-ps.exe';
  private binaryPath = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries', this.binary)
    : path.join(__dirname, '../../binaries', this.binary);

  constructor(flavourConfig: FlavourConfig) {
    super();
    this.flavourConfig = flavourConfig;
  }

  get isWowRunning() {
    return this._isWowRunning;
  }

  set isWowRunning(value) {
    this._isWowRunning = value;
  }

  get pollInterval() {
    return this._pollInterval;
  }

  set pollInterval(value) {
    this._pollInterval = value;
  }

  reconfigureFlavour(flavourConfig: FlavourConfig) {
    this.flavourConfig = flavourConfig;
  }

  reset() {
    this.isWowRunning = false;
    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
  }

  start() {
    this.reset();
    this.poll();
  }

  private poll() {
    this.child = spawn(this.binaryPath);
    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
  }

  private handleStdout = (data: any) => {
    try {
      const json = JSON.parse(data);

      const { Retail, Classic } = json;
      const { recordRetail, recordClassic, recordEra } = this.flavourConfig;

      const retailCheck = Retail && recordRetail;
      const classicCheck = Classic && recordClassic;
      const eraCheck = Classic && recordEra;

      // We don't care to do anything better in the scenario of multiple
      // processes running. We don't support users multi-boxing.
      if (!this.isWowRunning && (retailCheck || classicCheck || eraCheck)) {
        this.isWowRunning = true;
        this.emit('wowProcessStart');
      } else if (
        this.isWowRunning &&
        !retailCheck &&
        !classicCheck &&
        !eraCheck
      ) {
        this.isWowRunning = false;
        this.emit('wowProcessStop');
      }
    } catch (error) {
      // Think we can hit this on sleeping/resuming from sleep.
      console.warn('Failed parsing JSON from rust-ps:', data);
    }
  };

  private handleStderr = (data: any) => {
    console.warn('stderr returned from rust-ps');
    console.error(data);
  };
}
