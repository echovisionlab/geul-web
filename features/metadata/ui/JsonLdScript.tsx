interface Props {
  data: unknown;
}

export function JsonLdScript({ data }: Props) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
