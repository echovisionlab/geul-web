import { notFound } from 'next/navigation';
import { EditorInteractionLab } from './EditorInteractionLab';

export default function EditorInteractionLabPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <EditorInteractionLab />;
}
