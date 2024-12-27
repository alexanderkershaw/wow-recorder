import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

import EventEmitter from 'events';
import { FlavourConfig } from '../main/types';
import { PollerImplementation } from 'types/Poller';
import { PollerMac } from './PollerMac';
import { PollerWindows } from './PollerWindows';
import { app } from 'electron';
import os from 'os';
import path from 'path';

export default class Poller extends EventEmitter {
  private static _instance: Poller;
  private implementation: PollerImplementation;

  private constructor(flavourConfig: FlavourConfig) {
    super();
    const platform = os.platform();

    if (platform === 'win32') {
      this.implementation = new PollerWindows(flavourConfig);
    } else if (platform === 'darwin') {
      this.implementation = new PollerMac(flavourConfig);
    } else {
      throw new Error('Unsupported platform');
    }
  }

  static getInstance(flavourConfig: FlavourConfig) {
    if (!this._instance) {
      this._instance = new Poller(flavourConfig);
    }
    return this._instance;
  }

  static getInstanceLazy() {
    if (!this._instance) {
      throw new Error('[Poller] Must create poller first');
    }
    return this._instance;
  }

  get isWowRunning() {
    return this.implementation.isWowRunning;
  }

  get pollInterval() {
    return this.implementation.pollInterval;
  }

  start() {
    this.implementation.start();
  }

  reset() {
    this.implementation.reset();
  }

  reconfigureFlavour(flavourConfig: FlavourConfig) {
    this.implementation.reconfigureFlavour(flavourConfig);
  }
}

/**
 * The Poller singleton periodically checks the list of WoW active processes.
 * If the state changes, it emits either a 'wowProcessStart' or
 * 'wowProcessStop' event.
 */
// export default class Poller extends EventEmitter {
//   private _isWowRunning = false;

//   private _pollInterval: NodeJS.Timer | undefined;

//   private child: ChildProcessWithoutNullStreams | undefined;

//   private static _instance: Poller;

//   private flavourConfig: FlavourConfig;

//   private binary = 'rust-ps.exe';

//   private binaryPath = app.isPackaged
//     ? path.join(process.resourcesPath, 'binaries', this.binary)
//     : path.join(__dirname, '../../binaries', this.binary);

//   static getInstance(flavourConfig: FlavourConfig) {
//     if (!Poller._instance) {
//       Poller._instance = new Poller(flavourConfig);
//     }

//     return Poller._instance;
//   }

//   static getInstanceLazy() {
//     if (!Poller._instance) {
//       throw new Error('[Poller] Must create poller first');
//     }

//     return Poller._instance;
//   }

//   private constructor(flavourConfig: FlavourConfig) {
//     super();
//     this.flavourConfig = flavourConfig;
//   }

//   get isWowRunning() {
//     return this._isWowRunning;
//   }

//   set isWowRunning(value) {
//     this._isWowRunning = value;
//   }

//   get pollInterval() {
//     return this._pollInterval;
//   }

//   set pollInterval(value) {
//     this._pollInterval = value;
//   }

//   reconfigureFlavour(flavourConfig: FlavourConfig) {
//     this.flavourConfig = flavourConfig;
//   }

//   reset() {
//     this.isWowRunning = false;

//     if (this.child) {
//       this.child.kill();
//       this.child = undefined;
//     }
//   }

//   start() {
//     this.reset();
//     this.poll();
//   }

//   private poll = async () => {
//     this.child = spawn(this.binaryPath);
//     this.child.stdout.on('data', this.handleStdout);
//     this.child.stderr.on('data', this.handleStderr);
//   };

//   private handleStdout = (data: any) => {
//     try {
//       const json = JSON.parse(data);

//       const { Retail, Classic } = json;
//       const { recordRetail, recordClassic, recordEra } = this.flavourConfig;

//       const retailCheck = Retail && recordRetail;
//       const classicCheck = Classic && recordClassic;
//       const eraCheck = Classic && recordEra;

//       // We don't care to do anything better in the scenario of multiple
//       // processes running. We don't support users multi-boxing.
//       if (!this.isWowRunning && (retailCheck || classicCheck || eraCheck)) {
//         this.isWowRunning = true;
//         this.emit('wowProcessStart');
//       } else if (
//         this.isWowRunning &&
//         !retailCheck &&
//         !classicCheck &&
//         !eraCheck
//       ) {
//         this.isWowRunning = false;
//         this.emit('wowProcessStop');
//       }
//     } catch (error) {
//       // Think we can hit this on sleeping/resuming from sleep.
//       console.warn('Failed parsing JSON from rust-ps:', data);
//     }
//   };

//   private handleStderr = (data: any) => {
//     console.warn('stderr returned from rust-ps');
//     console.error(data);
//   };
// }
