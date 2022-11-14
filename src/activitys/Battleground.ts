import { Flavour, Metadata } from "main/types";
import { classicBattlegrounds, retailBattlegrounds, VideoCategory } from "../main/constants";
import Activity from "./Activity";

/**
 * Arena match class.
 */
export default class Battleground extends Activity {
    constructor(startDate: Date, 
                category: VideoCategory, 
                zoneID: number,
                flavour: Flavour) 
    {
        super(startDate, category, flavour);
        this.zoneID = zoneID;
    }

    get battlegroundName(): string {
        if (!this.zoneID) {
            throw new Error("zoneID not set, can't get battleground name");
        }

        if (retailBattlegrounds.hasOwnProperty(this.zoneID)) {
            return retailBattlegrounds[this.zoneID];
        }

        if (classicBattlegrounds.hasOwnProperty(this.zoneID)) {
            return classicBattlegrounds[this.zoneID];
        }

        return 'Unknown Battleground';
    };

    estimateResult() {
        // We decide who won by counting the deaths. The winner is the 
        // team with the least deaths. Obviously this is a best effort
        // thing and might be wrong.
        const friendsDead = this.deaths.filter(d => d.friendly).length;
        const enemiesDead = this.deaths.filter(d => !d.friendly).length;
        console.info("[Battleground] Friendly deaths: ", friendsDead);
        console.info("[Battleground] Enemy deaths: ", enemiesDead);
        const result = (friendsDead < enemiesDead) ? true : false;
        this.result = result;
        return result;
    };

    getMetadata(): Metadata {
        return {
            category: this.category,
            zoneID: this.zoneID,
            zoneName: this.battlegroundName,
            duration: this.duration,
            result: this.estimateResult(),
            flavour: this.flavour,
            player: this.player,
        }
    }

    getFileName(): string {
        const resultText = this.estimateResult() ? "Win" : "Loss";
        return `${this.battlegroundName} (${resultText})`;
    }
}
