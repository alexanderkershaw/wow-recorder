import * as React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { ObsAudioDevice } from 'main/obsAudioDeviceUtils';
import ConfigContext from "./ConfigContext";
import Box from '@mui/material/Box';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { configSchema } from '../main/configSchema'

const ipc = window.electron.ipcRenderer;

export default function GeneralSettings() {

  const [config, setConfig] = React.useContext(ConfigContext);

  const modifyConfig = (stateKey: string, value: any) => {
    setConfig((prevConfig: any) => ({ ...prevConfig, [stateKey]: value }));
  };

  const audioDevices = ipc.sendSync('getAudioDevices', []);
  console.log(audioDevices);

  const availableAudioDevices = {
    input: [
      new ObsAudioDevice('none', '(None: no microphone input will be recorded)'),
      new ObsAudioDevice('all', '(All)'),
      ...audioDevices.input,
    ],
    output: [
      new ObsAudioDevice('none', '(None: no sound will be recorded)'),
      new ObsAudioDevice('all', '(All)'),
      ...audioDevices.output,
    ]
  };

  const style = {
    width: '405px',
    color: 'white',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'black'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#bb4220'
    },
    '&.Mui-focused': {
      borderColor: '#bb4220',
      color: '#bb4220'
    },
  }   

  return (
    <Stack
      component="form"
      sx={{
        '& > :not(style)': { m: 0, width: '50ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <Box component="span" sx={{ display: 'flex', alignItems: 'center'}}>
        <FormControl sx={{my: 1}}>
          <InputLabel id="demo-simple-select-label" sx = {style}>Input</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="audio-input-device"
            value={config.audioInputDevice}
            label="Input"
            onChange={(event) => modifyConfig('audioInputDevice', event.target.value)}
            sx={style}
          >
            { availableAudioDevices.input.map((device: ObsAudioDevice) => {
              return (
                <MenuItem key={ 'device_' + device.id } value={ device.id }>{ device.name }</MenuItem>
              )
            })}
          </Select>
        </FormControl>
        <Tooltip title={configSchema["audioInputDevice"].description} >
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center'}}>
        <FormControl sx={{my: 1}}>
          <InputLabel id="demo-simple-select-label" sx = {style}>Output</InputLabel>
          <Select
            labelId="demo-simple-select-label"
            id="audio-output-device"
            value={config.audioOutputDevice}
            label="Output"
            onChange={(event) => modifyConfig('audioOutputDevice', event.target.value)}
            sx={style}
          >
            { availableAudioDevices.output.map((device: ObsAudioDevice) => {
              return (
                <MenuItem key={ 'device_' + device.id } value={ device.id }>{ device.name }</MenuItem>
              )
            })}
          </Select>
        </FormControl>
        <Tooltip title={configSchema["audioOutputDevice"].description} >
          <IconButton>
            <InfoIcon style={{ color: 'white' }}/>
          </IconButton>
        </Tooltip>
      </Box>
    </Stack>
  );
}