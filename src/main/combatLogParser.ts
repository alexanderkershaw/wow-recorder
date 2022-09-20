import { glob } from "glob";
import path from "path";
import fs from "fs";
import { EventEmitter } from "stream";
import { setInterval, clearInterval } from 'timers';

const tail = require('tail').Tail;

/**
 * Type that defines the structure of a combat log file handler,
 * which is used to monitor a specific log directory.
 */
type CombatLogMonitorHandlerType = {
    path: string,
    wowFlavour: string, // Read from the '.flavor.info' file from WoW
    currentLogFile?: string,
    watchInterval?: any,
    tail?: any,
};

type CombatLogParserOptionsType = {
    dataTimeout: number,
};

/**
 * A just-in-time parsed line from the WoW combat log
 *
 * The object is constructed from the original combat log line and will
 * parse log line arguments incrementally as they are requested, that is,
 * a log line like CHALLENGE_MODE_START which has few arguments won't see
 * much performance gain over parsing everything, but COMBATANT_INFO will
 * due to its absurdly long list of arguments that we most often won't use.
 */
class LogLine {
    // Current parsing position in the original line
    private _linePosition = 0;
    // Length of the original line to avoid reevaluating it
    // many times.
    private _lineLength = 0;

    // Multi-dimensional array of arguments
    // Example: 'ARENA_MATCH_START', '2547', '33', '2v2', '1'
    private _args: any[] = [];

    // Length of this.args to avoid evaluating this.args.length
    // may times.
    private _argsListLen = 0;

    // Timestamp in string format, as-is, from the log
    // Example: '8/3 22:09:58.548'
    public timestamp: string = '';

    constructor (
        // Original line as it came from the log
        public original: string
    ) {
        this._lineLength = this.original.length;

        // Combat log line always has '<timestamp>  <line>' format,
        // that is, two spaces between ts and line.
        this._linePosition = this.original.indexOf('  ') + 2;
        this.timestamp = this.original.substring(0, this._linePosition - 2);

        // Parse the first argument, which is the event type and will always
        // be needed.
        this.parseLogArg(1);
    }

    arg(index: number): any {
        if (!this._args || index >= this._argsListLen) {
            const maxsplit = Math.max(index + 1, this._argsListLen);
            this.parseLogArg(maxsplit);
        }

        return this._args[index];
    }

    /**
     * Parse the timestamp from a log line and create a Date value from it
     */
    date(): Date {
        // Split the line by any delimiter that isn't a number,
        // convert them to actual numbers and reverse the array.
        const timeParts = this.timestamp
            .split(/[^0-9]/, 6)
            .map(v => parseInt(v, 10))
            .reverse();
        const [msec, secs, mins, hours, day, month] = timeParts;
        const dateObj = new Date();

        if (month) dateObj.setMonth(month - 1);
        if (day) dateObj.setDate(day);
        dateObj.setHours(hours);
        dateObj.setMinutes(mins);
        dateObj.setSeconds(secs);
        dateObj.setMilliseconds(msec);

        return dateObj;
    }

    /**
     * Returns the combat log event type of the log line
     * E.g. `ENCOUNTER_START`.
     */
    type(): string {
        return this.arg(0);
    }

    /**
     * Splits a WoW combat line intelligently with respect to quotes,
     * lists, tuples, and what have we.
     *
     * @param maxSplits Maximum number of elements to find (same as `limit` for `string.split()` )
     */
    private parseLogArg (maxSplits?: number): void {
        // Array of items that has been parsedin the current scope of the parsing.
        //
        // This can end up being multidimensional in the case of some combat events
        // that have complex data stored, like `COMBATANT_INFO`.
        const listItems: any[] = [];

        let inQuotedString = false;
        let openListCount = 0;
        let value: any = '';

        for (this._linePosition; this._linePosition < this._lineLength; this._linePosition++) {
            const char = this.original.charAt(this._linePosition);
            if (char === '\n') {
                break;
            }
            if (maxSplits && this._argsListLen >= maxSplits) {
                break;
            }

            if (inQuotedString) {
                if (char === '"') {
                    inQuotedString = false;
                    continue;
                }

            } else {
                switch (char) {
                case ',':
                    if (openListCount > 0) {
                        listItems.at(-1)?.push(value);
                    } else {
                        this.addArg(value);
                    }

                    value = '';
                    break;

                case '"':
                    inQuotedString = true;
                    break;

                case '[':
                case '(':
                    listItems.push([]);
                    openListCount++;
                    break;

                case ']':
                case ')':
                    if (!listItems.length) {
                        throw `Unexpected ${char}. No list is open.`;
                    }

                    if (value) {
                        listItems.at(-1)?.push(value);
                    }

                    value = listItems.pop();
                    openListCount--;
                    break;
                }

                continue;
            }

            value += char;
        }

        if (value) {
            this.addArg(value);
        }

        if (openListCount > 0) {
            throw `Unexpected EOL. There are ${openListCount} open list(s).`
        }
    }

    /**
     * Add an argument to the list
     */
    private addArg(value: any): void {
        this._args.push(value);
        this._argsListLen = this._args.length;
    }

    toString(): string {
        return this.original;
    }
}

/**
 * Combat log parser and monitoring class.
 *
 * Watches one or more directories for combat logs, read the new data from them
 * and emits events to act on the combat log events elsewhere.
 */
class CombatLogParser extends EventEmitter {
    private _options: CombatLogParserOptionsType;
    private _handlers: { [key: string]: CombatLogMonitorHandlerType } = {};

    /**
     * If set, any handler receiving data which _ISN'T_ the one
     * given here will be ignored. This is to avoid multiple log files receiving
     * data at the same time which shouldn't happen, but can.
     */
    private _handlerLock?: CombatLogMonitorHandlerType;
    private _handlerLockTimeout: any;

    private readonly _tailOptions = {
        flushAtEOF: true
    };

    constructor(options: CombatLogParserOptionsType) {
        super();

        this._options = options;
    };

    /**
     * Start watching a path, if it's a valid WoW logs directory.
     * This is checked via `getWowFlavour()` which looks for the file '../.flavour.info'
     * relative to the log directory, which all flavours of WoW have.
     */
    watchPath(pathSpec: string): void {
        pathSpec = path.resolve(pathSpec);
        if (pathSpec in this._handlers) {
            this.unwatchPath(pathSpec);
        }

        const wowFlavour = this.getWowFlavour(pathSpec);
        if (wowFlavour === 'unknown') {
            console.warn(`[CombatLogParser] Ignoring non-WoW combat log directory '${pathSpec}'`);
            return;
        }

        this._handlers[pathSpec] = {
            wowFlavour,
            path: pathSpec,
        };

        console.log(`[CombatLogParser] Start watching '${pathSpec}' for '${wowFlavour}'`, this._handlers[pathSpec]);
        this.watchLogDirectory(pathSpec);
    }

    /**
     * Unwatch a previously watched path.
     */
    unwatchPath(pathSpec: string): void {
        pathSpec = path.resolve(pathSpec);
        if (!(pathSpec in this._handlers)) {
            return;
        }

        clearInterval(this._handlers[pathSpec].watchInterval);

        if (this._handlers[pathSpec].tail) {
            this._handlers[pathSpec].tail.unwatch();
        }

        delete this._handlers[pathSpec];

        console.log(`[CombatLogParser] Stop watching '${pathSpec}'`);
    }

    /**
     * Unwatch all paths.
     */
    unwatch(): void {
        Object.keys(this._handlers).forEach(this.unwatchPath.bind(this));
    }

    /**
     * Handle a line from the WoW log.
     */
     handleLogLine(flavour: string, line: string) {
        const logLine = new LogLine(line)
        const logEventType = logLine.type();

        this.emit(logEventType, logLine, flavour);
    }

    /**
     * Find and return the flavour of WoW that the log directory
     * belongs to by means of the '.flavor.info' file.
     */
     private getWowFlavour(pathSpec: string): string {
        const flavourInfoFile = path.normalize(
            path.join(pathSpec, '../.flavor.info')
        );

        // If this file doesn't exist, it's not a WoW combat log directory
        if (!fs.existsSync(flavourInfoFile)) {
            return 'unknown';
        }

        const content = fs.readFileSync(flavourInfoFile)
            .toString()
            .split("\n");

        return content.length > 1 ? content[1] : 'unknown';
    }

    /**
     * Ensure only a single logfile is being watched once one of them starts
     * receiving data.
     *
     * The lock will timeout after 30 seconds if no data has been received.
     */
    private lockHandler(handler: CombatLogMonitorHandlerType): boolean {
        // If it's locked, and not by 'handler', get out.
        if (this._handlerLock && this._handlerLock !== handler) {
            return false;
        }

        // Reset timeout and return
        if (this._handlerLock === handler) {
            this.resetLockTimeout();
            return true;
        }

        console.log(`[CombatLogParser] Locking path '${handler.path}' for exclusive event processing.`)

        this.emit('DataFirstEvent', handler.wowFlavour);

        this.resetLockTimeout();

        this._handlerLock = handler;
        return true;
    }

    /**
     * Reset the lock/data timeout timer such that it doesn't fire when it
     * isn't supposed to.
     */
    private resetLockTimeout(): void {
        if (this._handlerLockTimeout) {
            clearTimeout(this._handlerLockTimeout);
        }

        this._handlerLockTimeout = setTimeout(() => {
            console.log(`[CombatLogParser] Unlocking path '${this._handlerLock?.path}' for exclusive event processing since no data received in ${this._options.dataTimeout / 1000} seconds.`)
            this._handlerLock = undefined;
            this.emit('DataTimeout', this._options.dataTimeout);
        }, this._options.dataTimeout);
    }

    /**
     * Find and return the most recent file that matches the combat log filename
     * pattern.
     */
    private getLatestLog (pathSpec: string): string | undefined {
        const globPath = path.join(pathSpec, 'WoWCombatLog*.txt');
        const logs = glob.sync(globPath)
            .map((name: string) => ({name, mtime: fs.statSync(name).mtime}))
            .sort((A: any, B: any) => B.mtime.getTime() - A.mtime.getTime());

        if (logs.length === 0) {
            return;
        }

        return logs[0].name;
    }

    /**
     * Monitor a file for new content and process combat log lines accordingly
     * when they arrive.
     */
    private tailLogFile(handler: CombatLogMonitorHandlerType): void {
        // Clear any old tail handler before creating the new instance
        if (handler.tail) {
            handler.tail.unwatch();
        }

        const tailHandler = new tail(handler.currentLogFile, this._tailOptions);
        tailHandler
            .on('line', (line: string) => {
                if (!this.lockHandler(handler)) {
                    return;
                }

                this.handleLogLine(handler.wowFlavour, line);
            })
            .on('error', (error: unknown) => {
                console.error('[CombatLogParser] ERROR: ', error);
            });

        handler.tail = tailHandler;
    }

    /**
     * Watch a directory for combat logs and restart the monitoring
     * mechanism if there's a new one detected.
     */
    private watchLogDirectory(path: string): void {
        const handler = this._handlers[path];

        handler.watchInterval = setInterval(() => {
            const latestLogFile = this.getLatestLog(path);

            // Handle the case where there is no logs in the WoW log directory.
            if (!latestLogFile) {
                return;
            }

            const logFileChanged = (latestLogFile !== handler.currentLogFile);

            if (!handler.currentLogFile || logFileChanged) {
                console.log(`[CombatLogParser] Detected latest/new log file '${latestLogFile}'`);
                handler.currentLogFile = latestLogFile;
                this.tailLogFile(handler);
            }
        }, 1000);
    }
};

export {
    CombatLogParser,
    LogLine,
}