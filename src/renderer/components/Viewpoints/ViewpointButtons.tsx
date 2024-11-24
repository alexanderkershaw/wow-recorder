/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { AppState, RendererVideo } from 'main/types';
import { MutableRefObject, useEffect, useState } from 'react';
import {
  CloudDownload,
  CloudUpload,
  FolderOpen,
  Link as Link1,
  PackageX,
  Trash,
} from 'lucide-react';
import { faMessage, faStar } from '@fortawesome/free-solid-svg-icons';
import {
  faStar as faStarOutline,
  faMessage as faMessageOutline,
} from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { stopPropagation } from '../../rendererutils';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { toast } from '../Toast/useToast';
import { useSettings } from '../../useSettings';
import DeleteDialog from '../../DeleteDialog';
import StateManager from '../../StateManager';
import TagDialog from '../../TagDialog';

interface IProps {
  povs: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  stateManager: MutableRefObject<StateManager>;
}

const ipc = window.electron.ipcRenderer;

export default function ViewpointButtons(props: IProps) {
  const { appState, setAppState, persistentProgress, povs, stateManager } =
    props;
  const [config] = useSettings();
  const [ctrlDown, setCtrlDown] = useState<boolean>(false);
  const multiPov = povs.length > 1;

  /**
   * Sets up event listeners so that users can skip the "Are you sure you want
   * to delete this video?" prompt by holding CTRL.
   */
  useEffect(() => {
    document.addEventListener('keyup', (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlDown(false);
      }
    });

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        setCtrlDown(true);
      }
    });
  });

  const { playingVideo } = appState;

  if (!playingVideo) {
    return <></>;
  }

  const { cloud, videoName, videoSource, isProtected } = playingVideo;

  const haveOnDisk =
    !cloud ||
    povs.filter((v) => v.videoName === videoName).filter((v) => !v.cloud)
      .length > 0;

  const haveInCloud =
    cloud ||
    povs.filter((v) => v.videoName === videoName).filter((v) => v.cloud)
      .length > 0;

  const getTagButton = () => {
    const { tag } = playingVideo;

    let tagTooltip: string = tag || 'Add a tag';

    if (tagTooltip.length > 50) {
      tagTooltip = `${tagTooltip.slice(0, 50)}...`;
    }

    return (
      <TagDialog
        video={playingVideo}
        stateManager={stateManager}
        tooltipContent={tagTooltip}
      >
        <Button onMouseDown={stopPropagation} variant="secondary" size="lgicon">
          {tag ? (
            <FontAwesomeIcon icon={faMessage} size="lg" />
          ) : (
            <FontAwesomeIcon icon={faMessageOutline} size="lg" />
          )}
        </Button>
      </TagDialog>
    );
  };

  const protectVideo = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    stateManager.current.toggleProtect(playingVideo);
    const src = cloud ? videoName : videoSource;
    const bool = !isProtected;

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'save',
      src,
      cloud,
      bool,
    ]);
  };

  const getProtectVideoButton = () => {
    return (
      <Tooltip content={isProtected ? 'Age out' : 'Never age out'}>
        <Button
          onMouseDown={stopPropagation}
          onClick={protectVideo}
          variant="secondary"
          size="lgicon"
        >
          {isProtected ? (
            <FontAwesomeIcon icon={faStar} size="lg" />
          ) : (
            <FontAwesomeIcon icon={faStarOutline} size="lg" />
          )}
        </Button>
      </Tooltip>
    );
  };

  const getShareableLink = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    try {
      await ipc.invoke('getShareableLink', [videoName]);
      toast({
        title: 'Shareable link generated and placed in clipboard',
        description: 'This link will be valid for up to 30 days.',
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: 'Failed to generate link',
        description: 'Please see logs for more details',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const getShareLinkButton = () => {
    return (
      <Tooltip content="Get shareable link">
        <Button
          onMouseDown={stopPropagation}
          onClick={getShareableLink}
          variant="secondary"
          size="lgicon"
        >
          <Link1 />
        </Button>
      </Tooltip>
    );
  };

  const openLocation = (event: React.SyntheticEvent) => {
    event.stopPropagation();

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'open',
      videoSource,
      cloud,
    ]);
  };

  const getOpenButton = () => {
    return (
      <Tooltip content="Open location">
        <Button
          onMouseDown={stopPropagation}
          onClick={openLocation}
          variant="secondary"
          size="lgicon"
        >
          <FolderOpen />
        </Button>
      </Tooltip>
    );
  };

  const downloadVideo = async () => {
    ipc.sendMessage('videoButton', ['download', playingVideo]);
  };

  const getDownloadButton = () => {
    return (
      <Tooltip content="Download to disk">
        <Button
          onMouseDown={stopPropagation}
          onClick={downloadVideo}
          variant="secondary"
          size="lgicon"
        >
          <CloudDownload />
        </Button>
      </Tooltip>
    );
  };

  const uploadVideo = async () => {
    ipc.sendMessage('videoButton', ['upload', videoSource]);
  };

  const getUploadButton = () => {
    return (
      <Tooltip content="Upload to cloud">
        <Button
          onMouseDown={stopPropagation}
          onClick={uploadVideo}
          variant="secondary"
          size="lgicon"
        >
          <CloudUpload />
        </Button>
      </Tooltip>
    );
  };

  const deleteVideo = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    const src = cloud ? videoName : videoSource;
    window.electron.ipcRenderer.sendMessage('deleteVideo', [src, cloud]);
    stateManager.current.deleteVideo(playingVideo);
    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        playingVideo: undefined,
      };
    });
  };

  const onDeleteSingle = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (ctrlDown) {
      deleteVideo(event);
    }
  };

  const getDeleteSingleButton = () => {
    return (
      <DeleteDialog onDelete={(e) => deleteVideo(e)} tooltipContent="Delete">
        <Button
          onMouseDown={stopPropagation}
          variant="secondary"
          size="lgicon"
          onClick={onDeleteSingle}
        >
          <Trash />
        </Button>
      </DeleteDialog>
    );
  };

  const deleteAllPovs = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    povs.forEach((p) => {
      const src = p.cloud ? p.videoName : p.videoSource;
      window.electron.ipcRenderer.sendMessage('deleteVideo', [src, p.cloud]);
      stateManager.current.deleteVideo(p);
    });

    setAppState((prevState) => {
      return {
        ...prevState,
        playingVideo: undefined,
      };
    });
  };

  const onDeleteAll = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (ctrlDown) {
      deleteAllPovs(event);
    }
  };

  const getDeleteAllButton = () => {
    return (
      <DeleteDialog
        onDelete={(e) => deleteAllPovs(e)}
        tooltipContent="Delete all points of view"
      >
        <Button
          onMouseDown={stopPropagation}
          variant="secondary"
          size="lgicon"
          onClick={onDeleteAll}
        >
          <PackageX />
        </Button>
      </DeleteDialog>
    );
  };

  return (
    <div className="flex flex-row items-center content-center gap-x-2 py-1 pr-10">
      {getTagButton()}
      {getProtectVideoButton()}
      {cloud && getShareLinkButton()}
      {!cloud && getOpenButton()}
      {cloud && !haveOnDisk && getDownloadButton()}
      {!cloud && !haveInCloud && config.cloudUpload && getUploadButton()}
      {getDeleteSingleButton()}
      {multiPov && getDeleteAllButton()}
    </div>
  );
}
