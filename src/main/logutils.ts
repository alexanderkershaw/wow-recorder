/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { recorder, retailHandler, classicHandler }  from './main';
import { categoryRecordingSettings, VideoCategory, wowExecutableFlavours }  from './constants';
import { IWoWProcessResult, UnitFlags } from './types';
import { CombatLogParser } from './combatLogParser';
import { getSortedFiles } from './util';
import ConfigService from './configService';
import RetailLogHandler from '../log_handling/RetailLogHandler'
import ClassicLogHandler from '../log_handling/ClassicLogHandler'
import { Recorder } from './recorder';

const cfg = ConfigService.getInstance();
const tasklist = require('tasklist');
let testRunning: boolean = false;


/**
 * Setup retail log handler.
 */
const makeRetailHandler = (recorder: Recorder, logPath: string): RetailLogHandler => {
    const parser = new CombatLogParser({
        dataTimeout: 2 * 60 * 1000,
        fileFinderFn: getSortedFiles,
    });

    parser.watchPath(logPath);
    return RetailLogHandler.getInstance(recorder, parser);
}

/**
 * Setup classic log handler.
 */
const makeClassicHandler = (recorder: Recorder, logPath: string): ClassicLogHandler => {
    const parser = new CombatLogParser({
        dataTimeout: 2 * 60 * 1000,
        fileFinderFn: getSortedFiles,
    });

    parser.watchPath(logPath);
    return ClassicLogHandler.getInstance(recorder, parser);
}

/**
 * Is wow running? Starts null but we'll check immediately on start-up.
 */
let wowProcessRunning: IWoWProcessResult | null = null;

const resetProcessTracking = () => {
    wowProcessRunning = null;
}

/**
 * Timers for poll
 */
let pollWowProcessInterval: NodeJS.Timer;

/**
 * Handle WoW process starting.
 */
const wowProcessStarted = (process: IWoWProcessResult) => {
    wowProcessRunning = process;
    console.log(`[Logutils] Detected ${process.exe} (${process.flavour}) running`);
    recorder.startBuffer();
};

/**
 * Handle WoW process stopping.
 */
const wowProcessStopped = () => {
    if (!wowProcessRunning) {
        return;
    }

    console.log(`[Logutils] Detected ${wowProcessRunning.exe} (${wowProcessRunning.flavour}) not running`);
    wowProcessRunning = null;

    if (retailHandler && retailHandler.activity) {
        retailHandler.forceEndActivity(0, true);
    } else if (classicHandler && classicHandler.activity) {
        classicHandler.forceEndActivity(0, true);
    } else {
        recorder.stopBuffer();
    }
};

/**
 * Check Windows task list and find any WoW process.
 */
const checkWoWProcess = async (): Promise<IWoWProcessResult[]> => {
    const wowProcessRx = new RegExp(/(wow(T|B|classic)?)\.exe/, 'i');
    const taskList = await tasklist();

    return taskList
        // Map all processes found to check if they match `wowProcessRx`
        .map((p: any) => p.imageName.match(wowProcessRx))
        // Remove those that result in `null` (didn't match)
        .filter((p: any) => p)
        // Return an object suitable for `IWoWProcessResult`
        .map((match: any): IWoWProcessResult => ({
            exe: match[0],
            flavour: wowExecutableFlavours[match[1].toLowerCase()]
        }))
    ;
}

/**
 * pollWoWProcessLogic
 */
const pollWoWProcessLogic = async () => {
    const wowProcesses = await checkWoWProcess();
    const processesToRecord = wowProcesses.filter(filterFlavoursByConfig);
    const firstProcessToRecord = processesToRecord.pop();

    if ((wowProcessRunning === null) && firstProcessToRecord) {
        wowProcessStarted(firstProcessToRecord);
    } else if (wowProcessRunning !== null && !firstProcessToRecord) {
        wowProcessStopped();
    }
}

/**
 * pollWoWProcess
 */
const pollWowProcess = () => {
    // If we've re-called this we need to reset the current state of process 
    // tracking. This is important for settings updates. 
    resetProcessTracking();

    // Run a check without waiting for the timeout. 
    pollWoWProcessLogic();

    if (pollWowProcessInterval) {
        clearInterval(pollWowProcessInterval);
    }

    pollWowProcessInterval = setInterval(pollWoWProcessLogic, 5000);
}

/**
 * Filter out flavours that we are not configured to record. 
 */
const filterFlavoursByConfig = (wowProcess: IWoWProcessResult) => {
    const wowFlavour = wowProcess.flavour;

    const recordClassic = cfg.get<boolean>("recordClassic");
    const recordRetail = cfg.get<boolean>("recordRetail");

    // Any non classic flavour is considered a retail flavour (i.e. retail, beta, ptr)
    const validRetailProcess = (wowFlavour !== "Classic" && recordRetail);
    const validClassicProcess = (wowFlavour === "Classic" && recordClassic);

    if (validRetailProcess || validClassicProcess) {
        return true;
    }
    
    return false;
}

const sendTestCombatLogLine = (parser: CombatLogParser, line: string): void => {
    console.debug('[Logutils] Sending test combat log line to the Combat Log Parser', line);
    parser.handleLogLine('retail', line);
};

/**
 * Return a combatlog formatted timestamp representing the current date/time
 * adjusted acording to `seconds` (which can be negative).
 */
const getAdjustedDate = (seconds: number = 0): string => {
    const now = new Date(new Date().getTime() + (seconds * 1000));
    return `${now.getMonth() + 1}/${now.getDate()} ${now.toLocaleTimeString('en-GB')}.000`
};

/**
 * Function to invoke if the user clicks the "run a test" button
 * in the GUI. Uses some sample log lines from 2v2.txt.
 */
const runRetailRecordingTest = (endTest: boolean = true) => {
    console.log("[Logutils] User pressed the test button!");

    const parser = retailHandler.combatLogParser;

    if (!endTest) {
        console.log("[Logutils] The test will NOT end on its own and needs to be stopped manually.");
    }

    if (testRunning) {
        console.info("[Logutils] Test already running, not starting test.");
        return;
    }

    if (wowProcessRunning === null) {
        console.info("[Logutils] WoW isn't running, not starting test.");
        return;
    }

    console.info("[Logutils] WoW is running, starting test.");
    testRunning = true;

    // This inserts a test date so that the recorder doesn't confuse itself with
    // dates too far in the past. This happens when a recording doesn't end on its own
    // and we forcibly stop it using `new Date()` instead of the date from a log line
    // that ends an activity.
    const startDate = getAdjustedDate();
    const endDate = getAdjustedDate(10);

    const testLines = [
        startDate + "  ARENA_MATCH_START,2547,33,2v2,1",
        startDate + "  COMBATANT_INFO,Player-1084-08A89569,0,194,452,3670,2353,0,0,0,111,111,111,0,0,632,632,632,0,345,1193,1193,1193,779,256,(102351,102401,197491,5211,158478,203651,155675),(0,203553,203399,353114),[(188847,265,(),(7578,8151,7899,1472,6646),()),(186787,265,(),(7578,7893,1524,6646),()),(172319,291,(),(7098,7882,8156,6649,6650,1588),()),(44693,1,(),(),()),(188849,265,(),(8153,7899,1472,6646),()),(186819,265,(),(8136,8137,7578,7896,1524,6646),()),(188848,265,(),(8155,7899,1472,6646),()),(186809,265,(),(8136,8137,7896,1524,6646),()),(186820,265,(),(8136,8138,7578,7893,1524,6646),()),(188853,265,(),(8154,7896,1472,6646),()),(178926,291,(),(8121,7882,8156,6649,6650,1588,6935),()),(186786,265,(),(7579,7893,1524,6646),()),(185304,233,(),(7305,1492,6646),()),(186868,262,(),(7534,1521,6646),()),(186782,265,(),(8136,8138,7893,1524,6646),()),(186865,275,(),(7548,6652,1534,6646),()),(0,0,(),(),()),(147336,37,(),(),())],[Player-1084-08A89569,768,Player-1084-08A89569,5225],327,33,767,1",
        startDate + "  COMBATANT_INFO,Player-1084-08A89570,0,194,452,3670,2353,0,0,0,111,111,111,0,0,632,632,632,0,345,1193,1193,1193,779,256,(102351,102401,197491,5211,158478,203651,155675),(0,203553,203399,353114),[(188847,265,(),(7578,8151,7899,1472,6646),()),(186787,265,(),(7578,7893,1524,6646),()),(172319,291,(),(7098,7882,8156,6649,6650,1588),()),(44693,1,(),(),()),(188849,265,(),(8153,7899,1472,6646),()),(186819,265,(),(8136,8137,7578,7896,1524,6646),()),(188848,265,(),(8155,7899,1472,6646),()),(186809,265,(),(8136,8137,7896,1524,6646),()),(186820,265,(),(8136,8138,7578,7893,1524,6646),()),(188853,265,(),(8154,7896,1472,6646),()),(178926,291,(),(8121,7882,8156,6649,6650,1588,6935),()),(186786,265,(),(7579,7893,1524,6646),()),(185304,233,(),(7305,1492,6646),()),(186868,262,(),(7534,1521,6646),()),(186782,265,(),(8136,8138,7893,1524,6646),()),(186865,275,(),(7548,6652,1534,6646),()),(0,0,(),(),()),(147336,37,(),(),())],[Player-1084-08A89569,768,Player-1084-08A89569,5225],327,33,767,1",
        startDate + "  COMBATANT_INFO,Player-1084-08A89571,0,194,452,3670,2353,0,0,0,111,111,111,0,0,632,632,632,0,345,1193,1193,1193,779,256,(102351,102401,197491,5211,158478,203651,155675),(0,203553,203399,353114),[(188847,265,(),(7578,8151,7899,1472,6646),()),(186787,265,(),(7578,7893,1524,6646),()),(172319,291,(),(7098,7882,8156,6649,6650,1588),()),(44693,1,(),(),()),(188849,265,(),(8153,7899,1472,6646),()),(186819,265,(),(8136,8137,7578,7896,1524,6646),()),(188848,265,(),(8155,7899,1472,6646),()),(186809,265,(),(8136,8137,7896,1524,6646),()),(186820,265,(),(8136,8138,7578,7893,1524,6646),()),(188853,265,(),(8154,7896,1472,6646),()),(178926,291,(),(8121,7882,8156,6649,6650,1588,6935),()),(186786,265,(),(7579,7893,1524,6646),()),(185304,233,(),(7305,1492,6646),()),(186868,262,(),(7534,1521,6646),()),(186782,265,(),(8136,8138,7893,1524,6646),()),(186865,275,(),(7548,6652,1534,6646),()),(0,0,(),(),()),(147336,37,(),(),())],[Player-1084-08A89569,768,Player-1084-08A89569,5225],327,33,767,1",
        startDate + "  COMBATANT_INFO,Player-1084-08A89572,0,194,452,3670,2353,0,0,0,111,111,111,0,0,632,632,632,0,345,1193,1193,1193,779,256,(102351,102401,197491,5211,158478,203651,155675),(0,203553,203399,353114),[(188847,265,(),(7578,8151,7899,1472,6646),()),(186787,265,(),(7578,7893,1524,6646),()),(172319,291,(),(7098,7882,8156,6649,6650,1588),()),(44693,1,(),(),()),(188849,265,(),(8153,7899,1472,6646),()),(186819,265,(),(8136,8137,7578,7896,1524,6646),()),(188848,265,(),(8155,7899,1472,6646),()),(186809,265,(),(8136,8137,7896,1524,6646),()),(186820,265,(),(8136,8138,7578,7893,1524,6646),()),(188853,265,(),(8154,7896,1472,6646),()),(178926,291,(),(8121,7882,8156,6649,6650,1588,6935),()),(186786,265,(),(7579,7893,1524,6646),()),(185304,233,(),(7305,1492,6646),()),(186868,262,(),(7534,1521,6646),()),(186782,265,(),(8136,8138,7893,1524,6646),()),(186865,275,(),(7548,6652,1534,6646),()),(0,0,(),(),()),(147336,37,(),(),())],[Player-1084-08A89569,768,Player-1084-08A89569,5225],327,33,767,1",
        startDate + "  SPELL_AURA_APPLIED,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,110310,\"Dampening\",0x1,DEBUFF\n",
        startDate + "  SPELL_AURA_APPLIED,Player-1084-08A89570,\"Alexsmite-TarrenMill\",0x511,0x0,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,110310,\"Dampening\",0x1,DEBUFF\n",
        startDate + "  SPELL_AURA_APPLIED,Player-1084-08A89571,\"Alexsmite-TarrenMill\",0x511,0x0,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,110310,\"Dampening\",0x1,DEBUFF\n",
        startDate + "  SPELL_AURA_APPLIED,Player-1084-08A89572,\"Alexsmite-TarrenMill\",0x511,0x0,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,110310,\"Dampening\",0x1,DEBUFF\n",
        startDate + "  UNIT_DIED,Player-1084-08A89572,\"Alexsmite-TarrenMill\",0x80000000,0x80000000,Player-1084-08A89572,\"Alexsmite-TarrenMill\",0x2111,0x0,0"
    ];
    
    for (const line of testLines) {
        sendTestCombatLogLine(parser, line);
    }

    if (!endTest) {
        return;
    }

    const testArenaEndLine = endDate + "  ARENA_MATCH_END,0,8,1673,1668\n";

    setTimeout(() => {
        sendTestCombatLogLine(parser, testArenaEndLine);
        testRunning = false;
    }, 10 * 1000);
}

/**
 * Function to invoke if the user clicks the "run a test" button
 * in the GUI. Uses some sample log lines from 2v2.txt.
 */
 const runClassicRecordingTest = (endTest: boolean = true) => {
    console.log("[Logutils] User pressed the test button!");

    const parser = classicHandler.combatLogParser;

    if (!endTest) {
        console.log("[Logutils] The test will NOT end on its own and needs to be stopped manually.");
    }

    if (testRunning) {
        console.info("[Logutils] Test already running, not starting test.");
        return;
    }

    if (wowProcessRunning === null) {
        console.info("[Logutils] WoW isn't running, not starting test.");
        return;
    }

    console.info("[Logutils] WoW is running, starting test.");
    testRunning = true;

    // This inserts a test date so that the recorder doesn't confuse itself with
    // dates too far in the past. This happens when a recording doesn't end on its own
    // and we forcibly stop it using `new Date()` instead of the date from a log line
    // that ends an activity.
    const startDate = getAdjustedDate();
    const endDate = getAdjustedDate(10);

    const testLines = [ 
        startDate + "  ZONE_CHANGE,562,\"Blade's Edge Arena\",0",
        startDate + "  SPELL_AURA_APPLIED,Player-4811-0381F1C0,\"Sperge-Giantstalker\",0x512,0x0,Player-4811-0381F1C0,\"Sperge-Giantstalker\",0x512,0x0,47436,\"Battle Shout\",0x1,BUFF",
        startDate + "  SPELL_AURA_APPLIED,Player-4811-036B0F06,\"Alexpals-Giantstalker\",0x511,0x0,Player-4811-0381F1C0,\"Sperge-Giantstalker\",0x10512,0x0,53563,\"Beacon of Light\",0x2,BUFF",
        startDate + "  SPELL_AURA_APPLIED,Player-4476-043F3626,\"Jungledck-Gehennas\",0x548,0x0,Player-4476-043F3626,\"Jungledck-Gehennas\",0x548,0x0,43308,\"Find Fish\",0x1,BUFF",
        startDate + "  SPELL_AURA_APPLIED,Player-4476-045C7252,\"Notyourlock-Gehennas\",0x548,0x0,Player-4476-045C7252,\"Notyourlock-Gehennas\",0x548,0x0,47893,\"Fel Armor\",0x20,BUFF",
        startDate + "  SPELL_CAST_SUCCESS,Player-4811-036B0F06,\"Alexpals-Giantstalker\",0x511,0x0,Player-4811-0381F1C0,\"Sperge-Giantstalker\",0x10512,0x0,48825,\"Holy Shock\",0x2,Player-4811-036B0F06,0000000000000000,100,100,1102,1538,19409,0,15978,18109,790,6243.86,265.41,0,2.3130,200",
        startDate + "  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Player-4476-043F3626,\"Jungledck-Gehennas\",0x548,0x0",
    ];

    for (const line of testLines) {
        sendTestCombatLogLine(parser, line);
    }    

    if (!endTest) {
        return;
    }

    const testArenaEndLine = endDate + "  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Player-4476-045C7252,\"Notyourlock-Gehennas\",0x10548,0x0";

    setTimeout(() => {
        sendTestCombatLogLine(parser, testArenaEndLine);
        testRunning = false;
    }, 10 * 1000);
}

const isUnitFriendly = (flags: number) => {
    return hasFlag(flags, UnitFlags.REACTION_FRIENDLY);
}


const isUnitSelf = (flags: number) => {
    const isFriendly = hasFlag(flags, UnitFlags.REACTION_FRIENDLY);
    const isMine = hasFlag(flags, UnitFlags.AFFILIATION_MINE)
    return (isFriendly && isMine);
}

const isUnitPlayer = (flags: number) => {
    const isPlayerControlled = hasFlag(flags, UnitFlags.CONTROL_PLAYER);
    const isPlayerType = hasFlag(flags, UnitFlags.TYPE_PLAYER);
    return (isPlayerControlled && isPlayerType);
}

const hasFlag = (flags: number, flag: number) => {
    return (flags & flag) !== 0;
}

const ambiguate = (nameRealm: string): string[] => {
    const split = nameRealm.split("-");
    const name = split[0];
    const realm = split[1];
    return [name, realm];
}

const allowRecordCategory = (category: VideoCategory) => {
    const categoryConfig = categoryRecordingSettings[category];

    if (!categoryConfig) {
        console.info("[LogUtils] Unrecognised category", category);
        return false;
    }

    const categoryAllowed = cfg.get<boolean>(categoryConfig.configKey);

    if (!categoryAllowed) {
        console.info("[LogUtils] Configured to not record:", category);
        return false;
    };

    console.info("[LogUtils] Good to record:", category);
    return true;
};

export {
    pollWowProcess,
    runRetailRecordingTest,
    runClassicRecordingTest,
    makeRetailHandler,
    makeClassicHandler,
    isUnitFriendly,
    isUnitSelf,
    isUnitPlayer,
    hasFlag,
    ambiguate,
    allowRecordCategory
};
