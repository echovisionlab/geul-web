import type { FileManagerRow } from '@/lib/actions/file';
import type { EditorFileLibraryPickerViewLabels } from './EditorFileLibraryPickerView';

export const editorFileLibraryPickerStoryLabels: EditorFileLibraryPickerViewLabels = {
  search: '파일 및 폴더 검색',
  searchScope: '검색',
  currentFolder: '현재 폴더',
  allFiles: '모든 파일',
  name: '이름',
  type: '형식',
  allTypes: '모든 형식',
  images: '이미지',
  audio: '오디오',
  video: '비디오',
  documents: '문서',
  sortLabel: '정렬',
  sortName: '이름',
  sortNewest: '최신순',
  sortOldest: '오래된 순',
  sortSize: '큰 파일순',
  sortSmallest: '작은 파일순',
  size: '크기',
  location: '위치',
  folderType: '폴더',
  empty: '검색 결과가 없습니다.',
  folderNotFound: '폴더를 찾을 수 없습니다.',
  selectFile: '파일을 선택하세요.',
  loading: '불러오는 중',
  back: '뒤로',
  add: '추가',
  loadMore: '더 보기',
  selectAllRows: '모든 파일 선택',
  open: '열기',
  preview: '미리보기',
  download: '다운로드',
  gridView: '그리드 보기',
  listView: '목록 보기',
  closePreview: '미리보기 닫기',
  itemCount: (count) => `${count}개 항목`,
  searchResultCount: (count) => `${count}개 결과`,
  selectedCount: (count) => `${count}개 파일 선택`,
};

export const editorFileLibraryBrowseRows: FileManagerRow[] = [
  {
    kind: 'folder',
    id: 'story-folder-recordings',
    name: 'Recordings',
    folderPath: [
      { id: 'story-folder-library', name: 'Library' },
      { id: 'story-folder-recordings', name: 'Recordings' },
    ],
    createdAt: '2026-08-11T00:00:00Z',
    updatedAt: '2026-08-11T00:00:00Z',
  },
  {
    kind: 'file',
    id: 'story-file-audio',
    fileName: 'field-recording',
    extension: 'wav',
    mimeType: 'audio/wav',
    fileSize: 84_000_000,
    folderPath: [
      { id: 'story-folder-library', name: 'Library' },
      { id: 'story-folder-recordings', name: 'Recordings' },
    ],
    createdAt: '2026-08-11T00:00:00Z',
    updatedAt: '2026-08-11T00:00:00Z',
    usageCount: 1,
    inlineUrl: '/storybook/media/audio-sample.mp3',
    downloadUrl: '/storybook/media/audio-sample.mp3',
    playbackUrl: '/storybook/media/audio-sample.m3u8',
  },
  {
    kind: 'file',
    id: 'story-file-image',
    fileName: 'poster',
    extension: 'png',
    mimeType: 'image/png',
    fileSize: 2_400_000,
    folderPath: [{ id: 'story-folder-library', name: 'Library' }],
    createdAt: '2026-08-10T00:00:00Z',
    updatedAt: '2026-08-10T00:00:00Z',
    usageCount: 0,
  },
];

function audioSearchRow(index: number): FileManagerRow {
  return {
    kind: 'file',
    id: `story-file-audio-${index}`,
    fileName: `field-recording-${String(index).padStart(2, '0')}`,
    extension: 'wav',
    mimeType: 'audio/wav',
    fileSize: 24_000_000 + index * 1_000_000,
    folderPath: [
      { id: 'story-folder-library', name: 'Library' },
      { id: 'story-folder-recordings', name: 'Recordings' },
    ],
    createdAt: '2026-08-11T00:00:00Z',
    updatedAt: '2026-08-11T00:00:00Z',
    usageCount: index % 3,
  };
}

export const editorFileLibrarySearchRows = [
  ...editorFileLibraryBrowseRows,
  ...Array.from({ length: 9 }, (_, index) => audioSearchRow(index + 1)),
];

export const editorFileLibraryPaginatedRows = [
  ...editorFileLibrarySearchRows,
  ...Array.from({ length: 38 }, (_, index) => audioSearchRow(index + 10)),
];

export const editorFileLibraryNextPageRows = [audioSearchRow(48), audioSearchRow(49)];

export function isEditorFileLibraryStoryRowDisabled(row: FileManagerRow) {
  return row.id === 'story-file-image';
}
