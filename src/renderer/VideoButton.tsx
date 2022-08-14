
import * as React from 'react';
import Tab from '@mui/material/Tab';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { categories, videoButtonSx }  from '../main/constants';
import { getResultText, getFormattedDuration } from './rendererutils';
import ListItemIcon from '@mui/material/ListItemIcon';
import Check from '@mui/icons-material/Check';

/**
 * Import the arena zone backdrops.
 */
import arenaBED from "../../assets/arena/BED.png";
import arenaDAL from "../../assets/arena/DAL.jpg";
import arenaNAG from "../../assets/arena/NAG.jpg";
import arenaROL from "../../assets/arena/ROL.png";
import arenaROB from "../../assets/arena/ROB.jpg";
import arenaTP  from "../../assets/arena/TP.png";
import arenaTOL from "../../assets/arena/TOL.png";
import arenaBRK from "../../assets/arena/BRK.jpg";
import arenaED  from "../../assets/arena/ED.jpg";
import arenaASH from "../../assets/arena/ASH.jpg";
import arenaMUG from "../../assets/arena/MUG.jpg";
import arenaHP  from "../../assets/arena/HP.jpg";
import arenaMAL from "../../assets/arena/MAL.jpg";
import arenaENI from "../../assets/arena/ENI.png";

/**
 * Import the dungeon zone backdrops.
 */
import dungeonTOP from "../../assets/dungeon/TOP.jpg";
import dungeonTVM from "../../assets/dungeon/TVM.jpg";
import dungeonHOA from "../../assets/dungeon/HOA.jpg";
import dungeonNW  from "../../assets/dungeon/NW.jpg";
import dungeonSOA from "../../assets/dungeon/SOA.jpg";
import dungeonPF  from "../../assets/dungeon/PF.jpg";
import dungeonSD  from "../../assets/dungeon/SD.jpg";
import dungeonDOS from "../../assets/dungeon/DOS.jpg";
import dungeonMTS from "../../assets/dungeon/MTS.jpg";

/**
 * Import the raid encounter backdrops.
 */
import raid2512 from "../../assets/raid/2512.jpg";
import raid2537 from "../../assets/raid/2537.jpg";
import raid2539 from "../../assets/raid/2539.jpg";
import raid2540  from "../../assets/raid/2540.jpg";
import raid2542 from "../../assets/raid/2542.jpg";
import raid2543  from "../../assets/raid/2543.jpg";
import raid2544  from "../../assets/raid/2544.jpg";
import raid2546 from "../../assets/raid/2546.jpg";
import raid2549 from "../../assets/raid/2549.jpg";
import raid2553 from "../../assets/raid/2553.jpg";
import raid2529 from "../../assets/raid/2529.jpg";

/**
 * Import the battleground backdrops.
 */
 import battlegroundAB from "../../assets/battlegrounds/AB.jpg";
 import battlegroundAV from "../../assets/battlegrounds/AV.jpg";
 import battlegroundBFG from "../../assets/battlegrounds/BFG.jpg";
 import battlegroundDG  from "../../assets/battlegrounds/DG.jpg";
 import battlegroundEOTS from "../../assets/battlegrounds/EOTS.jpg";
 import battlegroundIOC  from "../../assets/battlegrounds/IOC.jpg";
 import battlegroundSM  from "../../assets/battlegrounds/SM.jpg";
 import battlegroundSS from "../../assets/battlegrounds/SS.jpg";
 import battlegroundTOK from "../../assets/battlegrounds/TOK.jpg";
 import battlegroundTP from "../../assets/battlegrounds/TP.jpg";
 import battlegroundWSG from "../../assets/battlegrounds/WSG.jpg";

/**
 * List of zones and their backdrop image.
 */
const buttonBackdrops: any =  {
  // Arenas
  1672: arenaBED,
  617:  arenaDAL,
  1505: arenaNAG,
  572:  arenaROL,
  2167: arenaROB,
  1134: arenaTP,
  980:  arenaTOL,
  1504: arenaBRK,
  2373: arenaED,
  1552: arenaASH,
  1911: arenaMUG,
  1825: arenaHP,
  2509: arenaMAL,
  2547: arenaENI,

  // Raids
  2537: raid2537,
  2512: raid2512,
  2529: raid2529,
  2539: raid2539,
  2540: raid2540,
  2542: raid2542,
  2543: raid2543,
  2544: raid2544,
  2546: raid2546,
  2549: raid2549,
  2553: raid2553,

  // Dungeons
  2291: dungeonDOS,
  2287: dungeonHOA,
  2290: dungeonMTS,
  2289: dungeonPF,
  2284: dungeonSD,
  2258: dungeonSOA,
  2286: dungeonNW,
  2293: dungeonTOP,
  2441: dungeonTVM,

  // BGs
  30:	  battlegroundAV,
  2107: battlegroundAB,
  1681: battlegroundAB,
  1105: battlegroundDG,
  566:  battlegroundEOTS,
  968:  battlegroundEOTS,
  628:  battlegroundIOC,
  1803: battlegroundSS,
  727:  battlegroundSM,
  //607:  "Strand of the Ancients",
  998:  battlegroundTOK,
  761:  battlegroundBFG,
  726:  battlegroundTP,
  489:  battlegroundWSG

};

/**
 * For shorthand referencing. 
 */
const ipc = window.electron.ipcRenderer;

export default function VideoButton(props: any) {
  const state = props.state;
  const videoIndex = props.index;

  const categoryIndex = state.categoryIndex;
  const category = categories[categoryIndex]

  const video = state.videoState[category][videoIndex];
  const videoPath = video.fullPath;

  const isGoodResult = video.result;
  const resultText = getResultText(category, isGoodResult);

  const isProtected = video.protected;

  const duration = video.duration;
  const formattedDuration = getFormattedDuration(duration);

  const resultClass: string = isGoodResult ? "goodResult" : "badResult";
  const buttonBackdrop: string = (category === "Raids") ? buttonBackdrops[video.encounterID] : buttonBackdrops[video.zoneID];

  const [anchorElement, setAnchorElement] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorElement);

  /**
  * Called when a rightclick on the video button occurs. 
  */
  const openMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    setAnchorElement(event.currentTarget);
  };

  /**
  *  Called when either a button is clicked or something else on the screen is. 
  */
  const handleCloseMenu = () => {
    setAnchorElement(null);
  };

  /**
  * Delete a video.
  */
  function deleteVideo(filePath: string) {6
    ipc.sendMessage('contextMenu', ['delete', filePath])
    handleCloseMenu();
  };

  /**
  * Move a video to the permanently saved location. 
  */
  const saveVideo = (filePath: string) => {
    ipc.sendMessage('contextMenu', ['save', filePath])
    handleCloseMenu();
  };

  /**
  * Open the location of the video in file explorer.
  */
  const openLocation = (filePath: string) => {
    ipc.sendMessage('contextMenu', ['open', filePath])
    handleCloseMenu();
  };

  return (
    <React.Fragment>
      <Tab 
        label={
          <div id={ videoPath } className={ "videoButton" } style={{ backgroundImage: `url(${buttonBackdrop})`}} onContextMenu={openMenu}>
            <div className='duration'>{ formattedDuration }</div>
            <div className='encounter'>{ video.encounter }</div>
            <div className='zone'>{ video.zone }</div>
            <div className='time'>{ video.time }</div>
            <div className='date'>{ video.date }</div>
            <div className={ resultClass }>{ resultText }</div>
          </div> 
        }
        key={ videoPath }
        sx = {{ ...videoButtonSx }}
        {...props}
      />
      <Menu 
        id={ videoPath } 
        anchorEl={anchorElement} 
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }} 
        open={open} onClose={handleCloseMenu} 
        MenuListProps={{'aria-labelledby': 'basic-button'}}>
        <MenuItem onClick={() => deleteVideo(videoPath)}>Delete</MenuItem>
        <MenuItem onClick={() => saveVideo(videoPath)}> 
          {isProtected &&
            <ListItemIcon>
              <Check />
            </ListItemIcon>
          }
          Save
        </MenuItem>
        <MenuItem onClick={() => openLocation(videoPath)}>Open Location</MenuItem>
      </Menu>
    </React.Fragment>
  );
}
