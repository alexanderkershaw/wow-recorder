import { dungeonsByZoneId } from '../main/constants'

interface imageObject {
    [id: number]: string;
}

// Load the arena images. This expects files with the name <id>.jpg 
// to exist in the appropriate assets folder. 
const arenaIDs = [
    1672, // Blade's Edge
    617,  // Dalaran
    1505, // Nagrand 
    572,  // Ruins of Lordareon
    2167, // Robodome
    1134, // Tigers Peak
    980,  // Tol'viron
    1504, // Black Rook
    2373, // Empyrean Domain
    1552, // Ashamane's Fall
    1911, // Mugambala
    1825, // Hook Point
    2509, // Maldraxxus
    2547  // Enigma Crucible
]

let arena: imageObject = {};

for (const id of arenaIDs) {
    arena[id] = require(`../../assets/arena/${id}.jpg`);
}

const dungeonIDs = Object.keys(dungeonsByZoneId).map(v=> parseInt(v, 10))

let dungeon: imageObject = {};

for (const id of dungeonIDs) {
    try {
        dungeon[id] = require(`../../assets/dungeon/${id}.jpg`);
    }
    catch {};
}

// Load the raid encounter images. This expects files with the 
// name <id>.jpg to exist in the appropriate assets folder.
const raidIDs = [
    // Sepulcher of the First Ones
    2512, // Vigilant Guardian
    2537, // Jailer
    2539, // Luhvium
    2540, // Desaugne
    2542, // Skolex
    2543, // Dreadlords
    2544, // Pantheon
    2546, // Anduin
    2549, // Rygelon
    2553, // Artificer
    2529, // Halondrus

    // Sanctum of Domination
    2523, // "The Tarragrue",
    2433, // "Eye of the Jailer",
    2429, // "The Nine",
    2432, // "Remnant of Ner'zhul",
    2434, // "Souldrender Dormazain",
    2430, // "Painsmith Raznal",
    2436, // "Guardian of the First Ones",
    2431, // "Fatescribe Roh-Kalo",
    2422, // "Kel'Thuzad",
    2435, // "Sylvanas Windrunner",

    // Castle Nathria
    2398, // "Shriekwing",
    2418, // "Huntsman Altimor",
    2404, // "Sun King's Salvation",
    2405, // "Xy'mox",
    2383, // "Hungering Destroyer",
    2406, // "Inerva",
    2412, // "Council of Blood",
    2399, // "Sludgefist",
    2417, // "Stone Legion Generals",
    2407, // "Sire Denathrius"
]

let raid: imageObject = {};

for (const id of raidIDs) {
    raid[id] = require(`../../assets/raid/${id}.jpg`);
}

// Load the battleground images. This expects files with the 
// name <id>.jpg to exist in the appropriate assets folder.

// Some of these have two entries either because there is 
// two versions of the map (EOTS casual vs rated) or for no 
// reason other than I don't have a good exhaustive list. 
const battlegroundIDs = [
    2107, // Arathi Basin
    1681, // Arathi Basin
    30,   // Alterac Valley
    761,  // Battle for Gilneas
    1105, // Deepwind Gorge
    2245, // Deepwind Gorge
    566,  // EOTS
    968,  // EOTS
    628,  // IOC
    727,  // Silvershard Mines
    1803, // Seething Shore
    998,  // Temple of Kotmogu
    726,  // Twin Peaks
    489,  // Warsong Gulch
]

let battleground: imageObject = {};

for (const id of battlegroundIDs) {
    battleground[id] = require(`../../assets/battlegrounds/${id}.jpg`);
}

// Load the battleground images. This expects files with the name <id>.jpg 
// to exist in the appropriate assets folder. For reference see: 
// https://wowpedia.fandom.com/wiki/SpecializationID
const specIDs = [
    250, 251, 252,      // Death Knight
    577, 581,           // Demon Hunter
    102, 103, 104, 105, // Druid
    253, 254, 255,      // Hunter
    62, 63, 64,         // Mage
    268, 270, 269,      // Monk
    65, 66, 70,         // Paladin
    256, 257, 258,      // Priest
    259, 260, 261,      // Rogue
    262, 263, 264,      // Shaman
    265, 266, 267,      // Warlock
    71, 72, 73          // Warrior
]

// Set a 'not found' icon for defaulting to if everything goes wrong.
// This is also what we default to over upgrade of the application when 
// previous videos don't have the metadata to show the spec. 
let spec: imageObject = { 
    0: require("../../assets/icon/wowNotFound.png") 
};

for (const id of specIDs) {
    spec[id] = require(`../../assets/specs/${id}.png`);
}

export {
    arena,
    dungeon,
    raid,
    battleground,
    spec
}