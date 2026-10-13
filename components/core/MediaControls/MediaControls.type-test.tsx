import { MediaTransport, MediaAudioFrame, MediaWaveformSeek, applyVideoMediaPresentation } from './index';
import { NativeRange } from '../Input/NativeRange';
import { applyNativeRange } from '../Input/native-range';
const transport = {
  labels: { play: 'Play', pause: 'Pause', mute: 'Mute', unmute: 'Unmute', volume: 'Volume' },
  playing: false,
  muted: false,
  volume: 0.5,
  currentTime: 0,
  duration: 10,
  onPlay: () => {},
  onMute: () => {},
  onVolumeChange: (_value: number) => {},
};
<MediaTransport {...transport} />;
// @ts-expect-error a typed spread cannot open the presentation boundary
<MediaTransport {...transport} {...{ style: { color: 'red' } }} />;
// @ts-expect-error arbitrary media skins remain closed
<MediaAudioFrame playing={false} ready className="foreign">
  Waveform
</MediaAudioFrame>;
// @ts-expect-error SDK adapter is a finite owner protocol
applyVideoMediaPresentation(document.createElement('div'), { kind: 'anything' });
// @ts-expect-error imperative adapter does not accept external styles
applyNativeRange(document.createElement('input'), { value: 1, label: 'Volume', style: { color: 'red' } });
<NativeRange value={1} label="Volume" onChange={() => {}} />;
// @ts-expect-error native range API does not inherit arbitrary HTML presentation attrs
<NativeRange value={1} label="Volume" onChange={() => {}} className="foreign" />;
const seek = {
  label: 'Seek playback',
  currentTime: 0,
  duration: 10,
  waveRef: { current: null },
  waveReady: true,
  onSeek: (_time: number) => {},
};
<MediaWaveformSeek {...seek} />;
// @ts-expect-error the waveform seek surface keeps Core geometry and focus presentation
<MediaWaveformSeek {...seek} className="foreign" />;
// @ts-expect-error seek requires an accessible name
<MediaWaveformSeek {...seek} label={undefined} />;
