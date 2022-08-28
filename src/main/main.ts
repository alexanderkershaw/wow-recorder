/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * Application entrypoint point.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog, Tray, Menu } from 'electron';
import { resolveHtmlPath, getVideoState, isConfigReady, deleteVideo, openSystemExplorer, toggleVideoProtected, fixPathWhenPackaged } from './util';
import { watchLogs, getLatestLog, pollWowProcess } from './logutils';
import Store from 'electron-store';
const obsRecorder = require('./obsRecorder');
import { Recorder } from './recorder';
let recorder: Recorder;

/**
 * Setup logging. We override console log methods. All console log method will go to 
 * both the console if it exists, and a file on disk. 
 * TODO: Currently only main process logs go here. Fix so react component logs go here as well. 
 */
const log = require('electron-log');
const date = new Date().toISOString().slice(0, 10);
const logRelativePath = `logs/WarcraftRecorder-${date}.log`;
log.transports.file.resolvePath = () => fixPathWhenPackaged(path.join(__dirname, logRelativePath));
Object.assign(console, log.functions);
console.log("App starting");

/**
 * Create a settings store to handle the config.
 * This defaults to a path like: 
 *   - (prod) "C:\Users\alexa\AppData\Roaming\WarcraftRecorder\config.json"
 *   - (dev)  "C:\Users\alexa\AppData\Roaming\Electron\config.json"
 */
const cfg = new Store();
let storageDir: any = cfg.get('storage-path') + "/";
let baseLogPath: any = cfg.get('log-path') + "/";
let maxStorage: any = cfg.get('max-storage');

/**
 * Getter and setter config listeners. 
 */
ipcMain.on('cfg-get', async (event, field) => {
  const value = cfg.get(field);
  console.log("Got from config store: ", field, value);
  event.returnValue = value;
});

ipcMain.on('cfg-set', async (_event, key, val) => {
  console.log("Setting in config store: ", key, val);
  cfg.set(key, val);
});

/**
 * Define renderer windows.
 */
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const RESOURCES_PATH = app.isPackaged
? path.join(process.resourcesPath, 'assets')
: path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

/**
 * Setup tray icon, menu and even listeners. 
 */
const setupTray = () => {
  tray = new Tray(getAssetPath("./icon/small-icon.png"));

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open', click() {
        console.log("User clicked open on tray icon");
        if (mainWindow) mainWindow.show();
      }
    },
    { 
      label: 'Quit', click() { 
        console.log("User clicked close on tray icon");
        if (mainWindow) mainWindow.close();
      } 
    },
  ])

  tray.setToolTip('Warcraft Recorder')
  tray.setContextMenu(contextMenu)

  tray.on("double-click", () => {
    console.log("User double clicked tray icon");
    if (mainWindow) mainWindow.show();
  }) 
}

/**
 * Creates the main window.
 */
const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    height: 1020 * 0.75,
    width: 1980 * 0.65,
    icon: getAssetPath('./icon/small-icon.png'),
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      //devTools: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('mainWindow.index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');

    // Check we have all config, and at least one log is in the log directory. 
    if (isConfigReady(cfg) && (getLatestLog(baseLogPath))) {
      mainWindow.webContents.send('updateStatus', 0);
    } else {
      mainWindow.webContents.send('updateStatus', 2);
    }

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupTray();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
};

/**
 * Creates the settings window, called on clicking the settings cog.
 */
const createSettingsWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  settingsWindow = new BrowserWindow({
    show: false,
    width: 380,
    height: 450,
    resizable: true,
    icon: getAssetPath('./icon/settings-icon.svg'),
    frame: false,
    webPreferences: {
      webSecurity: false,
      //devTools: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  settingsWindow.loadURL(resolveHtmlPath("settings.index.html"));

  settingsWindow.on('ready-to-show', () => {
    if (!settingsWindow) {
      throw new Error('"settingsWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      settingsWindow.minimize();
    } else {
      settingsWindow.show();
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // Open urls in the user's browser
  settingsWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
};

const openPathDialog = (event: any, args: any) => {
  if (!settingsWindow) return;
  const setting = args[1];
  
  dialog.showOpenDialog(settingsWindow, { properties: ['openDirectory'] }).then(result => {
    if (!result.canceled) {
      event.reply('settingsWindow', ['pathSelected', setting, result.filePaths[0]]);
    }
  })
  .catch(err => {
    console.log(err);
  })
} 


/**
 * mainWindow event listeners.
 */
ipcMain.on('mainWindow', (_event, args) => {
  if (mainWindow === null) return; 

  if (args[0] === "minimize") {
    console.log("User clicked minimize");
    //mainWindow.minimize();
    mainWindow.hide();
  }

  if (args[0] === "resize") {
    console.log("User clicked resize");
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }

  if (args[0] === "quit"){
    console.log("User clicked quit");
    mainWindow.close();
  }
})

/**
 * settingsWindow event listeners.
 */
ipcMain.on('settingsWindow', (event, args) => {

  if (args[0] === "create") {
    console.log("User opened settings");
    createSettingsWindow();
  }

  if (args[0] === "startup") {
    const isStartUp = (args[1] === "true");
    console.log("OS level set start-up behaviour: ", isStartUp);

    app.setLoginItemSettings({
      openAtLogin: isStartUp    
    })
  }
    
  if (settingsWindow === null) return; 

  if (args[0] === "quit") {
    console.log("User closed settings");
    settingsWindow.close();
  }

  if (args[0] === "openPathDialog") openPathDialog(event, args);
})

/**
 * contextMenu event listeners.
 */
ipcMain.on('contextMenu', (event, args) => {
  if (args[0] === "delete") {
    const videoForDeletion = args[1];
    deleteVideo(videoForDeletion);
    if (mainWindow) mainWindow.webContents.send('refreshState');
  }

  if (args[0] === "open") {
    const fileToOpen = args[1];
    openSystemExplorer(fileToOpen);
  }

  if (args[0] === "save") {
    const videoToToggle = args[1];
    toggleVideoProtected(videoToToggle);
    if (mainWindow) mainWindow.webContents.send('refreshState');
  }
})

/**
 * Get the list of video files and their state.
 */
ipcMain.on('getVideoState', (event) => {
  const videoState = getVideoState(storageDir);
  event.returnValue = videoState;
});

/**
 * Shutdown the app if all windows closed. 
 */
app.on('window-all-closed', () => {
  console.log("User closed app");
  recorder.cleanupBuffer();
  obsRecorder.shutdown();
  app.quit();
});

/**
 * App start-up.
 */
app
  .whenReady()
  .then(() => {
    console.log("App ready");
    createWindow();
    if (!isConfigReady(cfg) || !getLatestLog(baseLogPath)) return;
    recorder = new Recorder(storageDir, maxStorage);  
    recorder.init();
    pollWowProcess();
    watchLogs(baseLogPath);
  })
  .catch(console.log);

export {
  mainWindow,
  recorder
};





