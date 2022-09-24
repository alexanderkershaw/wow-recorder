import * as React from 'react';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { setSetting } from './settingUtils';
import Stack from '@mui/material/Stack';
import { OurDisplayType } from 'main/types';

const ipc = window.electron.ipcRenderer;
const store = window.electron.store;
const displayConfiguration = ipc.sendSync('settingsWindow', ['getAllDisplays']);

export default function VideoSettings() {
  const [state, setState] = React.useState({
    monitorIndex: store.get('monitor-index'),
  });

  const style = {
    height: '2.5rem',
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
        '& > :not(style)': { m: 1, width: '50ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label" sx = {style}>Monitor</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="monitor-index"
          value={state.monitorIndex}
          label="Monitor"
          onChange={(event) => setSetting('monitorIndex', event.target.value, setState)} 
          sx={style}
        >
          { displayConfiguration.map((display: OurDisplayType) =>
            <MenuItem key={ 'display-' + display.id } value={ display.index + 1 }>
              [{ display.index + 1 }] { display.size.width }x{ display.size.height } @ { display.displayFrequency } Hz ({display.physicalPosition}) {display.primary ? ' (Primary)' : ''}
            </MenuItem>
          )}
        </Select>
      </FormControl>
    </Stack>
  );
}