import type { AudioViewModel } from './audio-view-model';
import { applyMediaHydrationDomAttrs } from './hydration';
import { mediaStyleToString, type MediaContainerStyleRecord } from './shared';
import type { VideoViewModel } from './video-view-model';

function applyContainerStyle(element: HTMLElement, style: React.CSSProperties | undefined) {
  if (!style) {
    return;
  }
  const styleString = mediaStyleToString(style as MediaContainerStyleRecord);
  if (styleString) {
    element.setAttribute('style', styleString);
  }
}

function appendMeta(root: HTMLElement, classPrefix: 'audio' | 'video', title: string, sizeText: string) {
  const meta = document.createElement('div');
  meta.className = `${classPrefix}-block__meta`;

  const titleSpan = document.createElement('span');
  titleSpan.className = `${classPrefix}-block__title`;
  titleSpan.textContent = title;
  meta.appendChild(titleSpan);

  if (sizeText) {
    const sizeSpan = document.createElement('span');
    sizeSpan.className = `${classPrefix}-block__size`;
    sizeSpan.textContent = sizeText;
    meta.appendChild(sizeSpan);
  }

  root.appendChild(meta);
}

export function createMediaCaptionDom(text: string) {
  const caption = document.createElement('div');
  caption.className = 'media-block__caption';
  caption.textContent = text;
  caption.style.marginTop = '0.5rem';
  caption.style.fontSize = '0.6875rem';
  caption.style.lineHeight = '1.4';
  caption.style.color = 'var(--mantine-color-dimmed)';
  caption.style.textAlign = 'left';
  caption.style.display = 'block';
  caption.style.width = '100%';
  caption.style.minHeight = '20px';
  return caption;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

function appendIcon(container: HTMLElement, icon: 'play' | 'pause' | 'volume' | 'mute') {
  const span = document.createElement('span');
  span.className = `audio-player__icon audio-player__icon--${icon}`;

  const svg = createSvgElement('svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  if (icon === 'play') {
    const polygon = createSvgElement('polygon');
    polygon.setAttribute('points', '8,5 19,12 8,19');
    polygon.setAttribute('fill', 'currentColor');
    svg.appendChild(polygon);
  } else if (icon === 'pause') {
    const left = createSvgElement('rect');
    left.setAttribute('x', '7');
    left.setAttribute('y', '5');
    left.setAttribute('width', '3.5');
    left.setAttribute('height', '14');
    left.setAttribute('rx', '1');
    left.setAttribute('fill', 'currentColor');
    const right = createSvgElement('rect');
    right.setAttribute('x', '13.5');
    right.setAttribute('y', '5');
    right.setAttribute('width', '3.5');
    right.setAttribute('height', '14');
    right.setAttribute('rx', '1');
    right.setAttribute('fill', 'currentColor');
    svg.append(left, right);
  } else if (icon === 'volume') {
    const path = createSvgElement('path');
    path.setAttribute('d', 'M4 9h4l5-4v14l-5-4H4zm12.5-1.5a5 5 0 010 9m-2.5-6.5a2.5 2.5 0 010 4');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  } else {
    const path = createSvgElement('path');
    path.setAttribute('d', 'M4 9h4l5-4v14l-5-4H4zm10 1l6 6m0-6l-6 6');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  }

  span.appendChild(svg);
  container.appendChild(span);
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDownloadButtonLabel(action: AudioViewModel['actions'][number]) {
  return action.label;
}

function createAudioPlayer(model: AudioViewModel) {
  const player = document.createElement('div');
  player.className = 'audio-player geul-media-player';
  player.setAttribute('data-audio-player', 'true');
  player.setAttribute('data-audio-player-ready', model.isReady ? 'true' : 'false');
  player.setAttribute('data-audio-player-playing', 'false');

  const audio = document.createElement('audio');
  audio.className = 'audio-player__media';
  audio.preload = 'metadata';
  if (model.domAttrs['data-file-id']) {
    audio.setAttribute('data-file-id', model.domAttrs['data-file-id']);
  }
  if (model.playbackUrl && model.playbackSource !== 'hls') {
    audio.src = model.playbackUrl;
  }
  player.appendChild(audio);

  const main = document.createElement('div');
  main.className = 'audio-player__main';

  const surface = document.createElement('div');
  surface.className = 'audio-player__surface';

  const content = document.createElement('div');
  content.className = 'audio-player__content';

  const visual = document.createElement('div');
  visual.className = 'audio-player__visual';

  const waveformPanel = document.createElement('div');
  waveformPanel.className = 'audio-player__view-panel audio-player__view-panel--waveform';
  waveformPanel.setAttribute('data-audio-player-view-panel', 'waveform');

  const waveShell = document.createElement('div');
  waveShell.className = 'audio-player__wave-shell';
  const frame = document.createElement('div');
  frame.className = 'audio-player__wave-frame';

  const wave = document.createElement('div');
  wave.className = 'audio-player__wave';
  wave.setAttribute('data-audio-player-wave', 'true');
  wave.setAttribute('data-audio-player-wave-ready', 'false');

  frame.appendChild(wave);
  if (model.waveformData?.length || model.waveformUrl) {
    const loading = document.createElement('div');
    loading.className = 'audio-player__wave-loading';
    loading.setAttribute('data-audio-player-wave-loading', 'true');

    const spinner = document.createElement('span');
    spinner.className = 'audio-player__wave-loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    loading.append(spinner);
    frame.appendChild(loading);
  }
  waveShell.appendChild(frame);
  waveformPanel.appendChild(waveShell);
  visual.appendChild(waveformPanel);

  content.appendChild(visual);

  const meta = document.createElement('div');
  meta.className = 'audio-player__meta';

  const currentTime = document.createElement('span');
  currentTime.className = 'audio-player__time audio-player__time--current';
  currentTime.setAttribute('data-audio-player-current-time', 'true');
  currentTime.textContent = '0:00';

  const separator = document.createElement('span');
  separator.className = 'audio-player__time-separator';
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '/';

  const duration = document.createElement('span');
  duration.className = 'audio-player__time audio-player__time--duration';
  duration.setAttribute('data-audio-player-duration', 'true');
  duration.textContent = model.durationSeconds > 0 ? formatTime(model.durationSeconds) : '--:--';

  meta.append(currentTime, separator, duration);

  const footer = document.createElement('div');
  footer.className = 'audio-player__footer';

  const controls = document.createElement('div');
  controls.className = 'audio-player__controls';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'audio-player__control-button audio-player__toggle';
  toggle.setAttribute('data-audio-player-toggle', 'true');
  toggle.setAttribute('aria-label', 'Play audio');
  toggle.disabled = !model.isReady || !model.playbackUrl;
  appendIcon(toggle, 'play');
  appendIcon(toggle, 'pause');
  controls.appendChild(toggle);

  const toolbar = document.createElement('div');

  const mute = document.createElement('button');
  mute.type = 'button';
  mute.className = 'audio-player__control-button audio-player__mute';
  mute.setAttribute('data-audio-player-mute', 'true');
  mute.setAttribute('data-muted', 'false');
  mute.setAttribute('aria-label', 'Mute audio');
  mute.disabled = !model.playbackUrl;
  appendIcon(mute, 'volume');
  appendIcon(mute, 'mute');
  controls.appendChild(mute);

  const volume = document.createElement('input');
  volume.className = 'audio-player__volume';
  volume.setAttribute('data-audio-player-volume', 'true');
  volume.setAttribute('type', 'range');
  volume.setAttribute('min', '0');
  volume.setAttribute('max', '1');
  volume.setAttribute('step', '0.01');
  volume.setAttribute('value', '1');
  volume.setAttribute('aria-label', 'Audio volume');
  volume.style.setProperty('--audio-volume-progress', '100%');
  volume.disabled = !model.playbackUrl;
  controls.appendChild(volume);

  footer.appendChild(controls);
  footer.appendChild(meta);

  toolbar.className = 'audio-player__toolbar';

  model.actions.forEach((action) => {
    const link = document.createElement('a');
    link.className = 'audio-player__control-button audio-player__download-button';
    link.href = action.href;
    link.setAttribute('data-audio-player-download', action.key);
    link.setAttribute('aria-label', action.label);
    link.setAttribute('title', action.label);
    if (action.download) {
      link.setAttribute('download', '');
    }
    if (action.target) {
      link.target = action.target;
    }
    if (action.rel) {
      link.rel = action.rel;
    }
    link.textContent = getDownloadButtonLabel(action);
    toolbar.appendChild(link);
  });

  footer.appendChild(toolbar);
  content.appendChild(footer);

  surface.appendChild(content);

  main.appendChild(surface);

  player.appendChild(main);
  player.setAttribute('data-audio-player-view', 'waveform');
  return player;
}

export function buildAudioMediaDom(model: AudioViewModel, className = 'audio-block') {
  const root = document.createElement('div');
  root.className = className;
  applyMediaHydrationDomAttrs(root, model.domAttrs);
  root.setAttribute('data-media-name', model.domAttrs['data-media-name'] || '');
  applyContainerStyle(root, model.containerStyle);

  const header = document.createElement('div');
  header.className = 'audio-block__header';

  const meta = document.createElement('div');
  meta.className = 'audio-block__meta';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'audio-block__title';
  titleSpan.textContent = model.title;
  meta.appendChild(titleSpan);

  if (model.sizeText) {
    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'audio-block__size';
    sizeSpan.textContent = model.sizeText;
    meta.appendChild(sizeSpan);
  }

  header.appendChild(meta);

  root.appendChild(header);

  root.appendChild(createAudioPlayer(model));

  if (model.caption) {
    root.appendChild(createMediaCaptionDom(model.caption));
  }

  return root;
}

export function buildVideoMediaDom(model: VideoViewModel, className = 'video-block') {
  const root = document.createElement('div');
  root.className = className;
  applyMediaHydrationDomAttrs(root, model.domAttrs);
  root.setAttribute('data-media-name', model.domAttrs['data-media-name'] || '');
  applyContainerStyle(root, model.containerStyle);

  appendMeta(root, 'video', model.title, model.sizeText);

  const playerContainer = document.createElement('div');
  playerContainer.className = 'video-player-container geul-media-player';

  const video = document.createElement('video');
  video.controls = true;
  video.preload = 'metadata';
  if (model.domAttrs['data-file-id']) {
    video.setAttribute('data-file-id', model.domAttrs['data-file-id']);
  }
  if (model.hlsUrl) {
    video.setAttribute('data-hls-src', model.hlsUrl);
  } else if (model.playbackUrl) {
    video.src = model.playbackUrl;
  }
  if (model.posterUrl) {
    video.poster = model.posterUrl;
  }
  playerContainer.appendChild(video);
  root.appendChild(playerContainer);

  if (model.caption) {
    root.appendChild(createMediaCaptionDom(model.caption));
  }

  return root;
}
