import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';
import { ISettingsPanelProps } from 'main/types';

export default function ContentSettings(props: ISettingsPanelProps) {
  const { config } = props;

  const getCheckBox = (preference: string) =>
    <Checkbox
      checked={Boolean(config[preference])}
      onChange={props.onChange}
      name={preference}
      style={checkBoxStyle}
    />;

  const checkBoxStyle = {color: "#bb4220", padding: 5};
  const formControlLabelStyle = {color: "white"};
  const formLabelStyle = {color: "white"};
  const formGroupStyle = {width: '48ch', padding: 1};

  return (
    <div>
      <FormLabel id="radios" sx={formLabelStyle}>Game Type</FormLabel>
      <Divider color="black" />
      <FormGroup sx={formGroupStyle}>
        <FormControlLabel control={getCheckBox("recordRetail")} label="Retail" style={formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("recordClassic")} label="Classic" style={formControlLabelStyle} />
      </FormGroup>
      <FormLabel id="radios" sx={formLabelStyle}>PvE</FormLabel>
      <Divider color="black" />
      <FormGroup sx={formGroupStyle}>
        <FormControlLabel control={getCheckBox("recordRaids")} label="Raids" style={formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("recordDungeons")} label="Mythic+" style={formControlLabelStyle} />
      </FormGroup>
      <FormLabel id="radios" sx={formLabelStyle}>PvP</FormLabel>
      <Divider color="black" />
      <FormGroup sx={formGroupStyle}>
        <FormControlLabel control={getCheckBox("recordTwoVTwo")} label="2v2" style={formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("recordThreeVThree")} label="3v3" style={formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("recordSkirmish")} label="Skirmish" style={formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("recordSoloShuffle")} label="Solo Shuffle" style={formControlLabelStyle} />
        <FormControlLabel control={getCheckBox("recordBattlegrounds")} label="Battlegrounds" style={formControlLabelStyle} />
      </FormGroup>
    </div>
  );
}