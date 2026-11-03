import { useId, type ReactNode, type Ref } from 'react';
import { VisuallyHidden } from '@/components/core/Typography';
import type { MermaidImage } from './mermaid-renderer';
import classes from './Mermaid.module.css';
export type MermaidDiagramPreviewState =
  | { status: 'loading'; image?: MermaidImage }
  | { status: 'ready'; image: MermaidImage }
  | { status: 'error'; detail: string };
export interface MermaidDiagramViewProps {
  source: string;
  title?: string;
  state: MermaidDiagramPreviewState;
  diagramRef?: Ref<HTMLDivElement>;
  loadingSurface: ReactNode;
  labels: { empty: string; invalid: string; loading: string };
}
export function MermaidDiagramView({
  source,
  title,
  state,
  diagramRef,
  loadingSurface,
  labels,
}: MermaidDiagramViewProps) {
  const captionId = useId();
  const descriptionId = useId();
  const caption = title?.trim();
  const image = source.trim() && 'image' in state ? state.image : undefined;
  const name = caption || image?.accessibleTitle || 'Mermaid';
  const normalize = (value: string) => value.trim().replace(/\s+/gu, ' ');
  const description = [image?.accessibleTitle, image?.accessibleDescription]
    .filter((value): value is string => Boolean(value))
    .filter(
      (value, index, values) =>
        normalize(value) !== normalize(name) &&
        values.findIndex((other) => normalize(other) === normalize(value)) === index,
    )
    .join(' ');

  return (
    <div
      ref={diagramRef}
      className={classes.diagram}
      role={image && state.status === 'ready' ? 'img' : 'figure'}
      aria-label={caption ? undefined : name}
      aria-labelledby={caption ? captionId : undefined}
      aria-describedby={image && description ? descriptionId : undefined}
      aria-busy={Boolean(source.trim()) && state.status === 'loading'}
      data-mermaid-status={!source.trim() ? 'empty' : state.status}
    >
      {image ? <img src={image.src} width={image.width} alt="" className={classes.image} /> : null}
      {!source.trim() ? (
        <span className={classes.message}>{labels.empty}</span>
      ) : state.status === 'ready' ? null : state.status === 'error' ? (
        <div role="alert" className={classes.error}>
          <span>{labels.invalid}</span>
          <pre>{state.detail}</pre>
        </div>
      ) : image ? (
        <span role="status" className={classes.message}>
          {labels.loading}
        </span>
      ) : (
        loadingSurface
      )}
      {caption && (
        <span id={captionId} className={classes.caption}>
          {title}
        </span>
      )}
      {image && description && <VisuallyHidden id={descriptionId}>{description}</VisuallyHidden>}
    </div>
  );
}
