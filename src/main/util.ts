/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import { VideoCategory, categories, months, zones, instanceNamesByZoneId, dungeonsByMapId }  from './constants';
import { Metadata }  from './logutils';
import ElectronStore from 'electron-store';
const chalk = require('chalk');

/**
 * When packaged, we need to fix some paths
 */
 const fixPathWhenPackaged = (path: string) => {
    return path.replace("app.asar", "app.asar.unpacked");
}

type VideoInfo = {
    name: string;
    size: number;
    mtime: number;
};

const { exec } = require('child_process');
const ffmpegPath = fixPathWhenPackaged(require('@ffmpeg-installer/ffmpeg').path);
const ffprobePath = fixPathWhenPackaged(require('@ffprobe-installer/ffprobe').path);
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
import util from 'util';
import { promises as fspromise } from 'fs';
import glob from 'glob';
import fs from 'fs';
const globPromise = util.promisify(glob)

let videoIndex: { [category: string]: number } = {};

export let resolveHtmlPath: (htmlFileName: string) => string;

if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 1212;
  resolveHtmlPath = (htmlFileName: string) => {
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  };
} else {
  resolveHtmlPath = (htmlFileName: string) => {
    return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
  };
}

/**
 * Empty video state. 
 */
const getEmptyState = () => {
    let videoState: { [category: string]: [] } = {};
    for (const category of categories) {
        videoState[category] = [];
    }

    return videoState;
}

/**
 * Load videos from category folders in reverse chronological order.  
 */
const loadAllVideos = (storageDir: any, videoState: any) => {
    const videos = glob.sync(storageDir + "*.mp4")        
        .map(getVideoInfo)
        .sort((A: VideoInfo, B: VideoInfo) => B.mtime - A.mtime);

    for (const category of categories) {
        videoIndex[category] = 0;
    }

    for (const video of videos) {            
        loadVideoDetails(video, videoState);
    }        
}

/**
 * Load video details from the metadata and add it to videoState. 
 */
 const loadVideoDetails = (video: VideoInfo, videoState: any) => {
    const today = new Date();
    const videoDate = new Date(video.mtime)
    const isVideoFromToday = (today.toDateString() === videoDate.toDateString());

    const metadata = getMetadataForVideo(video.name)
    if (metadata === undefined) return;

    // Hilariously 5v5 is still a war game mode that will break things without this.
    if (!categories.includes(metadata.category)) return;

    videoState[metadata.category].push({
        index: videoIndex[metadata.category]++,
        fullPath: video.name,
        ...metadata,
        zone: getVideoZone(metadata),
        encounter: getVideoEncounter(metadata),
        date: getVideoDate(videoDate),
        isFromToday: isVideoFromToday,
        time: getVideoTime(videoDate),
        protected: Boolean(metadata.protected),
        playerSpecID: getPlayerSpec(metadata),
        playerName: getPlayerName(metadata),
        playerRealm: getPlayerRealm(metadata),
    });

}

/**
 * Get the date a video was recorded from the date object.
 */
const getMetadataForVideo = (video: string) => {
    const metadataFile = getMetadataFileForVideo(video)

    if (!fs.existsSync(metadataFile)) {
        console.error(`Metadata file does not exist: ${metadataFile}`);
        return undefined;
    }

    try {
        const metadataJSON = fs.readFileSync(metadataFile);
        return JSON.parse(metadataJSON.toString());
    } catch (e) {
        console.error(`Unable to read and/or parse JSON from metadata file: ${metadataFile}`);
    }
}

/**
 * Writes video metadata asynchronously and returns a Promise
 */
 const writeMetadataFile = async (videoPath: string, metadata: any) => {
    const metadataFileName = getMetadataFileForVideo(videoPath);
    const jsonString = JSON.stringify(metadata, null, 2);

    return await fspromise.writeFile(metadataFileName, jsonString);
}

/**
 * Get the filename for the metadata file associated with the given video file
 */
 const getMetadataFileForVideo = (video: string) => {
    const videoFileName = path.basename(video, '.mp4');
    const videoDirName = path.dirname(video);

    return path.join(videoDirName, videoFileName + '.json');
}

/**
 * Get the date a video was recorded from the date object.
 */
const getVideoDate = (date: Date) => {
    const day = date.getDate();
    const month = months[date.getMonth()].slice(0, 3);
    const dateAsString = day + " " + month;
    return dateAsString;
}

/**
 * Get the time a video was recorded from the date object.
 */
const getVideoTime = (date: Date) => {
    const hours = date.getHours().toLocaleString('en-US', { minimumIntegerDigits: 2});
    const mins = date.getMinutes().toLocaleString('en-US', { minimumIntegerDigits: 2});
    const timeAsString = hours + ":" + mins;
    return timeAsString;
}

/**
 * Get the zone name.
 */
const getVideoZone = (metadata: Metadata) => {
    const zoneID = metadata.zoneID;
    const category = metadata.category;

    if (zoneID) {
        if (category === VideoCategory.Raids || category === VideoCategory.MythicPlus) {
            return getInstanceName(zoneID);
        }

        return zones[zoneID];
    }

    return "Unknown";
}

/**
 * Get the raid name from the encounter ID.
 */
 const getInstanceName = (zoneID: number) => {
    if (instanceNamesByZoneId.hasOwnProperty(zoneID)) {
        return instanceNamesByZoneId[zoneID]
    }

    return 'Unknown Instance';
}

/**
 * Get the encounter name.
 */
const getVideoEncounter = (metadata: Metadata) => {
    if (metadata.challengeMode !== undefined) {
        return dungeonsByMapId[metadata.challengeMode.mapId];
    }

    if (metadata.encounterID) { 
        return zones[metadata.encounterID]; 
    }

    return metadata.category;
}

/**
 * Get the player spec ID.
 */
 const getPlayerSpec = (metadata: Metadata) => {
    if (metadata.playerSpecID) { 
        return metadata.playerSpecID; 
    } else {
        return undefined; 
    }
}

/**
 * Get the player name.
 */
 const getPlayerName = (metadata: Metadata) => {
    if (metadata.playerName) { 
        return metadata.playerName; 
    } else {
        return undefined; 
    }
}

/**
 * Get the player realm.
 */
 const getPlayerRealm = (metadata: Metadata) => {
    if (metadata.playerRealm) { 
        return metadata.playerRealm; 
    } else {
        return undefined; 
    }
}

/**
 * Get the state of all videos. 
 * Returns an empty array if storageDir is undefined. 
 */
const getVideoState = (storageDir: unknown) => {
    let videoState = getEmptyState();
    if (!storageDir) return videoState;
    loadAllVideos(storageDir, videoState);
    return videoState;
}    

/**
 * Return information about a video needed for various parts of the application
 */
const getVideoInfo = (videoPath: string): VideoInfo => {
    const fstats = fs.statSync(videoPath);
    const mtime = fstats.mtime.getTime();
    const size = fstats.size;

    return { name: videoPath, size, mtime };
};

/**
 * Asynchronously find and return a list of video files in the given directory,
 * sorted by modification time (newest to oldest)
 */
const getSortedVideos = async (storageDir: string): Promise<VideoInfo[]> => {
    const files = await globPromise(path.join(storageDir, "*.mp4"));
    return files
        .map(getVideoInfo)
        .sort((A: VideoInfo, B: VideoInfo) => B.mtime - A.mtime);
};

/**
 * Asynchronously delete the oldest, unprotected videos to ensure we don't store
 * more material than the user has allowed us.
 */
const runSizeMonitor = async (storageDir: string, maxStorageGB: number): Promise<void> => {
    const maxStorageBytes = maxStorageGB * Math.pow(1024, 3);

    let files = await getSortedVideos(storageDir);
    console.debug(`[Size Monitor] Running (max size = ${maxStorageGB} GB)`);

    files = files.map((file: any) => {
        const metadata = getMetadataForVideo(file);
        return { ...file, metadata, };
    });

    // Consider files with NO metadata (dangling video files)
    // and files that ARE NOT protected
    files = files.filter((file: any) => !file.hasOwnProperty('metadata') || !Boolean(file.metadata.protected));

    // Filter files that doesn't cause the total video file size to exceed the maximum
    // as given by `maxStorageBytes`
    let totalVideoFileSize = 0;
    files = files.filter((file: any) => {
        totalVideoFileSize += file.size;
        return totalVideoFileSize > maxStorageBytes;
    });

    if (files.length == 0) {
        return;
    }

    console.log(`[Size Monitor] Deleting ${files.length} old video(s)`)
    let videoToDelete;

    while (videoToDelete = files.pop()) {
        console.log(`[Size Monitor] Delete oldest video: ${videoToDelete.name}`)
        deleteVideo(videoToDelete.name);
    }

    return Promise.resolve();
};

/**
 * Asynchronously get the newest video.
 */
 const getNewestVideo = async (storageDir: any): Promise<string> => {
    const files = await getSortedVideos(storageDir);

    if (files.length > 0) {
        //@ts-ignore 'object is possibly undefined'
        // but it can't, due to the 'if' above.
        return files.shift().name;
     }

     return Promise.reject('No video files were found while looking for the most recent video.');
}  

/**
 * Try to unlink a file and return a boolean indicating the success
 * Logs any errors to the console, if the file couldn't be deleted for some reason.
 */
 const tryUnlinkSync = (file: string): boolean => {
    try {
        console.log("Deleting: " + file);
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        console.error(`Unable to delete file: ${file}.`)
        console.error((e as Error).message);
        return false;
    }
 }

/**
 * Delete a video and its metadata file if it exists. 
 */
 const deleteVideo = (videoPath: string) => {
    // If we can't delete the video file, make sure we don't delete the metadata
    // file either, which would leave the video file dangling.
    if (!tryUnlinkSync(videoPath)) {
        return;
    }

    const metadataPath = getMetadataFileForVideo(videoPath);
    if (fs.existsSync(metadataPath)) {
        tryUnlinkSync(metadataPath);
    }
}  

/**
 * isConfigReady
 */
 const isConfigReady = (cfg: ElectronStore) => {

    if (!cfg.get('storage-path')) {
        return false;
    }

    if (!cfg.get('log-path')) {
        return false;
    }

    const maxStorage = getNumberConfigSafe(cfg, 'max-storage');

    if ((!maxStorage) && (maxStorage > 0)) { 
        return false;
    }

    const monitorIndex = getNumberConfigSafe(cfg, 'monitor-index');

    if ((!monitorIndex) || (monitorIndex < 1) || (monitorIndex > 3)) {
        return false;
    }

    return true;
}  

/**
 * Open a folder in system explorer. 
 */
 const openSystemExplorer = (filePath: string) => {
    const windowsPath = filePath.replace(/\//g,"\\");
    let cmd = 'explorer.exe /select,"' + windowsPath + '"';
    exec(cmd, () => {});
}  

/**
 * Put a save marker on a video, protecting it from the file monitor.
 */
 const toggleVideoProtected = (videoPath: string) => {
    const metadata = getMetadataForVideo(videoPath);
    if (!metadata) {
        console.error(`Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`);
        return;
    }

    if (metadata.protected === undefined) {
        metadata.protected = true;
    } else {
        metadata.protected =  !Boolean(metadata.protected);
    }

    writeMetadataFile(videoPath, metadata);
}

/**
 * Takes an input MP4 file, trims the footage from the start of the video so
 * that the output is desiredDuration seconds. Some ugly async/await stuff 
 * here. Some interesting implementation details around ffmpeg in comments 
 * below. 
 * 
 * @param {string} initialFile path to initial MP4 file
 * @param {string} finalDir path to output directory
 * @param {number} desiredDuration seconds to cut down to
 * @returns full path of the final video file
 */
const cutVideo = async (initialFile: string, finalDir: string, desiredDuration: number): Promise<string> => {
    
    const videoFileName = path.basename(initialFile, '.mp4');
    const finalVideoPath = path.join(finalDir, videoFileName + ".mp4");

    return new Promise<string> ((resolve) => {

        // Use ffprobe to check the length of the initial file.
        ffmpeg.ffprobe(initialFile, (err: any, data: any) => {
            if (err) {
                console.log("FFprobe error: ", err);
                throw new Error("FFprobe error when cutting video");
            }

            // Calculate the desired start time relative to the initial file. 
            const bufferedDuration = data.format.duration;
            let startTime = Math.round(bufferedDuration - desiredDuration);

            // Defensively avoid a negative start time error case. 
            if (startTime < 0) {
                console.log("Video start time was: ", startTime);
                console.log("Avoiding error by not cutting video");
                startTime = 0;
            }

            // This was super helpful in debugging during development so I've kept it.
            console.log("Ready to cut video.");
            console.log("Initial duration:", bufferedDuration, 
                        "Desired duration:", desiredDuration,
                        "Calculated start time:", startTime);

            // It's crucial that we don't re-encode the video here as that 
            // would spin the CPU and delay the replay being available. I 
            // did try this with re-encoding as it has compression benefits 
            // but took literally ages. My CPU was maxed out for nearly the 
            // same elapsed time as the recording. 
            //
            // We ensure that we don't re-encode by passing the "-c copy" 
            // option to ffmpeg. Read about it here:
            // https://superuser.com/questions/377343/cut-part-from-video-file-from-start-position-to-end-position-with-ffmpeg
            //
            // This thread has a brilliant summary why we need "-avoid_negative_ts make_zero":
            // https://superuser.com/questions/1167958/video-cut-with-missing-frames-in-ffmpeg?rq=1
            ffmpeg(initialFile)
                .inputOptions([ `-ss ${startTime}`, `-t ${desiredDuration}` ])
                .outputOptions([ `-t ${desiredDuration}`, "-c:v copy", "-c:a copy", "-avoid_negative_ts make_zero" ])
                .output(finalVideoPath)

                // Handle the end of the FFmpeg cutting.
                .on('end', async (err: any) => {
                    if (err) {
                        console.log('FFmpeg video cut error (1): ', err)
                        throw new Error("FFmpeg error when cutting video (1)");
                    }
                    else {
                        console.log("FFmpeg cut video succeeded");
                        resolve(finalVideoPath);
                    }
                })

                // Handle an error with the FFmpeg cutting. Not sure if we 
                // need this as well as the above but being careful.
                .on('error', (err: any) => {
                    console.log('FFmpeg video cut error (2): ', err)
                    throw new Error("FFmpeg error when cutting video (2)");
                })
                .run()    
        })
    });
}

/**
 * Gets a path (string) value from the config in a more reliable manner.
 * @param cfg the config store
 * @param key the key
 * @returns the string config
 */
const getPathConfigSafe = (cfg: ElectronStore, key: string): string => {
    return cfg.has(key) ? path.join(getStringConfigSafe(cfg, key), path.sep) : "";
}

/**
 * Gets number value from the config in a more reliable manner.
 * @param cfg the config store
 * @param preference the preference
 * @returns the number config
 */
 const getNumberConfigSafe = (cfg: ElectronStore, preference: string): number => {
    return cfg.has(preference) ? parseInt(getStringConfigSafe(cfg, preference)) : NaN;
}

/**
 * Gets a string value from the config in a more reliable manner.
 * @param cfg the config store
 * @param key the key
 * @param defaultValue default value, passed stright to `cfg.get()`
 * @returns the string value
 */
const getStringConfigSafe = (cfg: ElectronStore, key: string, defaultValue?: string): string => {
    return (cfg.get(key, defaultValue) as string);
}

/**
 *  Default the monitor index to 1. 
 */
 const defaultMonitorIndex = (cfg: ElectronStore): number => {
    console.info("Defaulting monitor index to 1");
    cfg.set('monitor-index', 1);
    return 1;
}

/**
 *  Add some escape characters to color text. Just return the string
 *  if production as don't want to litter real logs with this as it just
 *  looks messy.
 */
 const addColor = (s: string, color: string): string => {
    if (process.env.NODE_ENV === 'production') return s;

    if (color === "cyan") {
        return chalk.cyan(s);
    } else if (color === "green") {
        return chalk.green(s);
    } else {
        return s;
    }    
}

export {
    getVideoState,
    writeMetadataFile,
    runSizeMonitor, 
    isConfigReady,
    deleteVideo,
    openSystemExplorer,
    toggleVideoProtected,
    fixPathWhenPackaged,
    getNewestVideo,
    cutVideo,
    getPathConfigSafe,
    getNumberConfigSafe,
    getStringConfigSafe,
    defaultMonitorIndex, 
    addColor
};