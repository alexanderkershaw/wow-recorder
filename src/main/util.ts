/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import { categories, months, zones, dungeonsByMapId }  from './constants';
import { Metadata }  from './logutils';
import ElectronStore from 'electron-store';
const byteSize = require('byte-size')
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
import { FileSortDirection } from './types';
import { getVideoZone } from './helpers';
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
    let videoState: { [category: string]: any[] } = {};
    categories.forEach(category => videoState[category] = []);

    return videoState;
}

/**
 * Load videos from category folders in reverse chronological order.  
 */
const loadAllVideos = async (storageDir: any): Promise<any> => {
    let videoState = getEmptyState();
    if (!storageDir) {
        return videoState;
    }

    const videos = await getSortedVideos(storageDir)
    if (videos.length == 0) {
        return videoState;
    }

    categories.forEach(category => videoIndex[category] = 0);

    videos.forEach(video => {
        const details = loadVideoDetails(video);
        if (!details) {
            return;
        }

        const category = (details.category as string);
        videoState[category].push({
            index: videoIndex[category]++,
            ...details,
        });
    });

    return videoState;
}

/**
 * Load video details from the metadata and add it to videoState. 
 */
 const loadVideoDetails = (video: VideoInfo): any | undefined => {
    const metadata = getMetadataForVideo(video.name);
    if (metadata === undefined) {
        return;
    }

    // Hilariously 5v5 is still a war game mode that will break things without this.
    if (!categories.includes(metadata.category)) {
        return;
    };

    const today = new Date();
    const videoDate = new Date(video.mtime);

    return {
        fullPath: video.name,
        ...metadata,
        zone: getVideoZone(metadata),
        encounter: getVideoEncounter(metadata),
        date: getVideoDate(videoDate),
        isFromToday: (today.toDateString() === videoDate.toDateString()),
        time: getVideoTime(videoDate),
        protected: Boolean(metadata.protected),
        playerSpecID: metadata?.playerSpecID,
        playerName: metadata?.playerName,
        playerRealm: metadata?.playerRealm,
    };
}

/**
 * Get the date a video was recorded from the date object.
 */
const getMetadataForVideo = (video: string) => {
    const metadataFile = getMetadataFileForVideo(video)

    if (!fs.existsSync(metadataFile)) {
        console.error(`[Util] Metadata file does not exist: ${metadataFile}`);
        return undefined;
    }

    try {
        const metadataJSON = fs.readFileSync(metadataFile);
        return JSON.parse(metadataJSON.toString());
    } catch (e) {
        console.error(`[Util] Unable to read and/or parse JSON from metadata file: ${metadataFile}`);
    }
}

/**
 * Writes video metadata asynchronously and returns a Promise
 */
 const writeMetadataFile = async (videoPath: string, metadata: any) => {
    const metadataFileName = getMetadataFileForVideo(videoPath);
    const jsonString = JSON.stringify(metadata, null, 2);

    return await fspromise.writeFile(
        metadataFileName,
        jsonString,
        {
            encoding: 'utf-8',
        }
    );
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
 * Return information about a video needed for various parts of the application
 */
const getVideoInfo = (videoPath: string): VideoInfo => {
    videoPath = path.resolve(videoPath);
    const fstats = fs.statSync(videoPath);
    const mtime = fstats.mtime.getTime();
    const size = fstats.size;

    return { name: videoPath, size, mtime };
};

/**
 * Asynchronously find and return a list of video files in the given directory,
 * sorted by modification time (newest to oldest)
 */
const getSortedVideos = async (storageDir: string, sortDirection: FileSortDirection = FileSortDirection.NewestFirst): Promise<VideoInfo[]> => {
    const files = (await globPromise(path.join(storageDir, "*.mp4")))
        .map(getVideoInfo);

    if (sortDirection === FileSortDirection.NewestFirst) {
        return files.sort((A: VideoInfo, B: VideoInfo) => B.mtime - A.mtime);
    }

    return files.sort((A: VideoInfo, B: VideoInfo) => A.mtime - B.mtime);
};

/**
 * Asynchronously delete the oldest, unprotected videos to ensure we don't store
 * more material than the user has allowed us.
 */
const runSizeMonitor = async (storageDir: string, maxStorageGB: number): Promise<void> => {
    let videoToDelete;
    const maxStorageBytes = maxStorageGB * Math.pow(1024, 3);

    let files = await getSortedVideos(storageDir);
    console.debug(`[Size Monitor] Running (max size = ${byteSize(maxStorageBytes)})`);

    files = files.map(file => {
        const metadata = getMetadataForVideo(file.name);
        return { ...file, metadata, };
    });

    // Files without metadata are considered dangling and are cleaned up. 
    const danglingFiles = files.filter((file: any) => !file.hasOwnProperty('metadata') || !file.metadata);
    const unprotectedFiles = files.filter((file: any) => file.hasOwnProperty('metadata') && file.metadata && !Boolean(file.metadata.protected));

    if (danglingFiles.length !== 0) {
        console.log(`[Size Monitor] Deleting ${danglingFiles.length} dangling video(s)`);

        while (videoToDelete = danglingFiles.pop()) {
            console.log(`[Size Monitor] Delete dangling video: ${videoToDelete.name}`)
            deleteVideo(videoToDelete.name);
        }
    }

    // Filter files that doesn't cause the total video file size to exceed the maximum
    // as given by `maxStorageBytes`
    let totalVideoFileSize = 0;

    const filesOverMaxStorage = unprotectedFiles.filter((file: any) => {
        totalVideoFileSize += file.size;
        return totalVideoFileSize > maxStorageBytes;
    });

    // Calculate total file size of all unprotected files
    totalVideoFileSize = unprotectedFiles
        .map(file => file.size)
        .reduce((prev, curr) => prev + curr, 0);

    console.log(`[Size Monitor] Unprotected file(s) considered ${unprotectedFiles.length}, total size = ${byteSize(totalVideoFileSize)}`)

    if (filesOverMaxStorage.length === 0) {
        return;
    }

    console.log(`[Size Monitor] Deleting ${filesOverMaxStorage.length} old video(s)`)

    while (videoToDelete = filesOverMaxStorage.pop()) {
        console.log(`[Size Monitor] Delete oldest video: ${videoToDelete.name} (${byteSize(videoToDelete.size)})`);
        deleteVideo(videoToDelete.name);
    }
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
        console.log("[Util] Deleting: " + file);
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        console.error(`[Util] Unable to delete file: ${file}.`)
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

    const minEncounterDuration = getNumberConfigSafe(cfg, 'min-encounter-duration');

    if ((!minEncounterDuration) || (minEncounterDuration < 0) || (minEncounterDuration > 10000)) {
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
        console.error(`[Util] Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`);
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
 * Sanitize a filename and replace all invalid characters with a space.
 *
 * Multiple consecutive invalid characters will be replaced by a single space.
 * Multiple consecutive spaces will be replaced by a single space.
 */
const sanitizeFilename = (filename: string): string => {
    return filename
        .replace(/[<>:"/\|?*]/g, ' ')   // Replace all invalid characters with space
        .replace(/ +/g, ' ');           // Replace multiple spaces with a single space
};

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
const cutVideo = async (
        initialFile: string,
        finalDir: string,
        outputFilename: string | undefined,
        desiredDuration: number
    ): Promise<string> => {
    
    const videoFileName = path.basename(initialFile, '.mp4');
    const videoFilenameSuffix = outputFilename ? ' - ' + outputFilename : '';
    const baseVideoFilename = sanitizeFilename(videoFileName + videoFilenameSuffix);
    const finalVideoPath = path.join(finalDir, baseVideoFilename + ".mp4");

    return new Promise<string> ((resolve) => {

        // Use ffprobe to check the length of the initial file.
        ffmpeg.ffprobe(initialFile, (err: any, data: any) => {
            if (err) {
                console.log("[Util] FFprobe error: ", err);
                throw new Error("FFprobe error when cutting video");
            }

            // Calculate the desired start time relative to the initial file. 
            const bufferedDuration = data.format.duration;
            let startTime = Math.round(bufferedDuration - desiredDuration);

            // Defensively avoid a negative start time error case. 
            if (startTime < 0) {
                console.log("[Util] Video start time was: ", startTime);
                console.log("[Util] Avoiding error by not cutting video");
                startTime = 0;
            }

            // This was super helpful in debugging during development so I've kept it.
            console.log("[Util] Ready to cut video.");
            console.log("[Util] Initial duration:", bufferedDuration, 
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
                        console.log('[Util] FFmpeg video cut error (1): ', err)
                        throw new Error("FFmpeg error when cutting video (1)");
                    }
                    else {
                        console.log("[Util] FFmpeg cut video succeeded");
                        resolve(finalVideoPath);
                    }
                })

                // Handle an error with the FFmpeg cutting. Not sure if we 
                // need this as well as the above but being careful.
                .on('error', (err: any) => {
                    console.log('[Util] FFmpeg video cut error (2): ', err)
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

const defaultAudioDevice = (cfg: ElectronStore, deviceType: string): string => {
    const cfgKey = `audio-${deviceType}-device`;
    const defaultValue = 'all';

    console.info(`[Util] Defaulting ${cfgKey} to ${defaultValue}`);
    cfg.set(cfgKey, defaultValue);
    return defaultValue;
}

/**
 *  Default the monitor index to 1. 
 */
 const defaultMonitorIndex = (cfg: ElectronStore): number => {
    console.info("[Util] Defaulting monitor index to 1");
    cfg.set('monitor-index', 1);
    return 1;
}

/**
 *  Default the minimum encounter duration to 15. 
 */
 const defaultMinEncounterDuration = (cfg: ElectronStore): number => {
    console.info("Defaulting minimum encounter duration to 15");
    cfg.set('min-encounter-duration', 15);
    return 15;
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
    loadAllVideos,
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
    defaultMinEncounterDuration,
    defaultAudioDevice,
    addColor,
    getSortedVideos,
};
