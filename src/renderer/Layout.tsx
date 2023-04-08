import * as React from 'react';
import Box from '@mui/material/Box';
import { TAppState, TNavigatorState } from 'main/types';
import {
  Button,
  List,
  ListItem,
  ListItemButton,
  TextField,
} from '@mui/material';
import { VideoJS } from './VideoJS';
import 'videojs-hotkeys';
import { VideoCategory } from '../types/VideoCategory';
import VideoButton from './VideoButton';
import HomePage from './HomePage';
import { filterVideos, parseVideoFilters } from './rendererutils';

interface IProps {
  navigation: TNavigatorState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
  videoState: any;
  appState: TAppState;
  setAppState: React.Dispatch<React.SetStateAction<TAppState>>;
}

const ipc = window.electron.ipcRenderer;
let debounceSearchTimer: NodeJS.Timer;

/**
 * The GUI itself.
 */
const Layout: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigation, videoState, appState, setAppState } =
    props;
  const { categoryIndex, videoIndex } = navigation;
  const { numVideosDisplayed, videoFilters } = appState;
  const categories = Object.values(VideoCategory);
  const category = categories[categoryIndex];

  /**
   * Update the state variable following a change of selected video.
   */
  const handleChangeVideo = (index: number) => {
    setNavigation((prevState) => {
      return {
        ...prevState,
        videoIndex: index,
      };
    });
  };

  const loadMoreVideos = () => {
    setAppState((prevState) => {
      return {
        ...prevState,
        numVideosDisplayed: prevState.numVideosDisplayed + 10,
      };
    });
  };

  // This is effectively equivalent to componentDidMount() in
  // React Component classes
  React.useEffect(() => {
    ipc.on('fatalError', async (stack) => {
      setAppState((prevState) => {
        return {
          ...prevState,
          fatalError: true,
          fatalErrorText: stack as string,
        };
      });
    });
  }, []);

  const debouncedFilter = (event: React.BaseSyntheticEvent) => {
    const filterText = event.target.value;

    if (debounceSearchTimer) {
      clearTimeout(debounceSearchTimer);
    }

    debounceSearchTimer = setTimeout(() => {
      const filters = parseVideoFilters(filterText);
      console.log('Set filters', filters);

      setAppState((prevState) => {
        return {
          ...prevState,
          videoFilters: filters,
        };
      });
    }, 750);
  };

  /**
   * Returns a video panel with videos.
   */
  const getVideoPanel = () => {
    const video = videoState[category][videoIndex];
    const videoFullPath = video.fullPath;
    return (
      <Box sx={{ display: 'flex', height: '100%' }}>
        <VideoJS id="video-player" key={videoFullPath} video={video} />
      </Box>
    );
  };

  const getHomePage = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          alignItems: 'center',
          justifyContet: 'center',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
        }}
      >
        <HomePage videoState={videoState} setNavigation={setNavigation} />
      </Box>
    );
  };

  const getShowMoreButton = () => {
    return (
      <Box
        key="show-more-button-box"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '50px',
        }}
      >
        <Button
          key="show-more-button"
          variant="outlined"
          onClick={loadMoreVideos}
          sx={{
            mb: 1,
            color: 'white',
            borderColor: 'white',
            ':hover': {
              color: '#bb4420',
              borderColor: '#bb4420',
            },
          }}
        >
          Load More
        </Button>
      </Box>
    );
  };

  const getVideoSelection = () => {
    const categoryState = videoState[category];
    if (!categoryState) return <></>;

    const filteredCategoryState = categoryState.filter((video: any) =>
      filterVideos(video, videoFilters)
    );

    const slicedCategoryState = filteredCategoryState.slice(
      0,
      numVideosDisplayed
    );

    const moreVideosRemain =
      slicedCategoryState.length !== filteredCategoryState.length;

    return (
      <>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'scroll',
            height: '100%',
            width: '100%',
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '1em',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#888',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555',
            },
          }}
        >
          <List sx={{ width: '100%' }}>
            <ListItem disablePadding key="search-bar" sx={{ width: '100%' }}>
              <TextField
                fullWidth
                placeholder="Suggestions: wins, losses, today, yesterday"
                id="search-bar"
                onChange={debouncedFilter}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': { borderColor: '#bb4220' },
                    '& > fieldset': { borderColor: 'darkgrey' },
                    '&:hover fieldset': {
                      borderColor: '#bb4220',
                    },
                  },
                  '& label.Mui-focused': { color: '#bb4220' },
                  mt: 2,
                  ml: 2,
                  mr: 2,
                  input: { color: 'white' },
                }}
                inputProps={{ style: { color: 'white' } }}
              />
            </ListItem>
            {slicedCategoryState.map((video: any) => {
              return (
                <ListItem
                  disablePadding
                  key={video.fullPath}
                  sx={{ width: '100%' }}
                >
                  <ListItemButton
                    onClick={() => handleChangeVideo(video.index)}
                  >
                    <VideoButton
                      key={video.fullPath}
                      videostate={videoState}
                      categoryIndex={categoryIndex}
                      videoIndex={video.index}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
            {moreVideosRemain && getShowMoreButton()}
          </List>
        </Box>
      </>
    );
  };

  if (categoryIndex < 0) {
    return getHomePage();
  }

  if (videoIndex < 0) {
    return getVideoSelection();
  }

  return getVideoPanel();
};

export default Layout;
