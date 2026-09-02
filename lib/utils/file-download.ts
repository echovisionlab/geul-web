'use client';

interface DownloadRemoteFileOptions {
  url: string;
  filename: string;
}

export async function downloadRemoteFile({ url, filename }: DownloadRemoteFileOptions) {
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      mode: 'cors',
    });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener noreferrer';
    anchor.target = '_blank';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  } catch {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener noreferrer';
    anchor.target = '_blank';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }
}
