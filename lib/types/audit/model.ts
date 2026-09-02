import { z } from 'zod';

// ========================================
// Entity Types (확장 가능)
// ========================================
export const AuditEntityType = z.enum([
  // 콘텐츠
  'post',
  'page',
  'work',
  'series',
  'artist',
  'comment',
  'release',
  // 사용자/구독자
  'user',
  // 정책
  'privacy',
  'terms',
  // 시스템
  'site_setting',
  'campaign',
  'email_template',
  'menu',
  'category',
  'tag',
  // 폼
  'form',
  // 음악 DB
  'genre',
  'label',
  'style',
  'format',
  'track',
  'credit_role',
  // 지도
  'map_place',
  // 클라이언트
  'client',
  // 기타
  'file',
  'system',
  // 공유 링크
  'share_link',
]);
export type AuditEntityType = z.infer<typeof AuditEntityType>;

// ========================================
// Actions
// ========================================
export const AuditAction = z.enum([
  // CRUD
  'create',
  'read',
  'update',
  'delete',
  // 상태 변경
  'publish',
  'unpublish',
  'archive',
  'unarchive',
  // 멤버/권한
  'add_member',
  'remove_member',
  'add_collaborator',
  'remove_collaborator',
  'grant_access',
  'revoke_access',
  // 기타
  'login',
  'logout',
  'export',
  'import',
  'send',
  'schedule',
  'cancel_schedule',
  'activate',
  'verify',
  'unsubscribe',
]);
export type AuditAction = z.infer<typeof AuditAction>;

// ========================================
// Result (성공/실패/거부)
// ========================================
export const AuditResult = z.enum(['success', 'failure', 'rejection']);
export type AuditResult = z.infer<typeof AuditResult>;

// ========================================
// Failure Reasons (result: 'failure')
// ========================================
export const FAILURE_REASONS = {
  // 로그인 실패
  invalid_credentials: 'invalid_credentials',
  user_not_found: 'user_not_found',
  account_disabled: 'account_disabled',
  account_banned: 'account_banned',
  email_not_verified: 'email_not_verified',
  oauth_failed: 'oauth_failed',
  too_many_attempts: 'too_many_attempts',
  // 게시물
  post_not_found: 'post_not_found',
  not_post_owner: 'not_post_owner',
  not_post_manager: 'not_post_manager',
  already_published: 'already_published',
  already_archived: 'already_archived',
  not_published: 'not_published',
  not_archived: 'not_archived',
  cannot_delete_published: 'cannot_delete_published',
  cannot_edit_archived: 'cannot_edit_archived',
  content_empty: 'content_empty',
  // 댓글
  comment_not_found: 'comment_not_found',
  not_comment_author: 'not_comment_author',
  comment_already_deleted: 'comment_already_deleted',
  comments_disabled: 'comments_disabled',
  // 사용자
  member_profile_not_found: 'member_profile_not_found',
  invalid_profile_data: 'invalid_profile_data',
  // 멤버
  member_not_found: 'member_not_found',
  already_member: 'already_member',
  cannot_remove_owner: 'cannot_remove_owner',
  // Collaborator
  collaborator_not_found: 'collaborator_not_found',
  // 일반 엔티티
  entity_not_found: 'entity_not_found',
  entity_conflict: 'entity_conflict',
  // 아티스트
  artist_not_found: 'artist_not_found',
  // 카테고리
  category_not_found: 'category_not_found',
  // 태그
  tag_not_found: 'tag_not_found',
  // 시리즈
  series_not_found: 'series_not_found',
  // 페이지
  page_not_found: 'page_not_found',
  // 작품
  work_not_found: 'work_not_found',
  not_work_owner: 'not_work_owner',
  // 릴리즈
  release_not_found: 'release_not_found',
  // 트랙
  track_not_found: 'track_not_found',
  // 장르/스타일/포맷
  genre_not_found: 'genre_not_found',
  style_not_found: 'style_not_found',
  format_not_found: 'format_not_found',
  // 레이블
  label_not_found: 'label_not_found',
  // 지도 장소
  map_place_not_found: 'map_place_not_found',
  // 메뉴
  menu_not_found: 'menu_not_found',
  // 이메일 템플릿
  email_template_not_found: 'email_template_not_found',
  // 구독자
  invalid_token: 'invalid_token',
  token_expired: 'token_expired',
  // 정책
  privacy_not_found: 'privacy_not_found',
  terms_not_found: 'terms_not_found',
  invalid_status: 'invalid_status',
  // 파일
  file_not_found: 'file_not_found',
  // 클라이언트
  client_not_found: 'client_not_found',
  // 크레딧 역할
  credit_role_not_found: 'credit_role_not_found',
  // 캠페인
  campaign_not_found: 'campaign_not_found',
} as const;

export type FailureReason = (typeof FAILURE_REASONS)[keyof typeof FAILURE_REASONS];

// ========================================
// Rejection Reasons (result: 'rejection')
// ========================================
export const REJECTION_REASONS = {
  not_authenticated: 'not_authenticated',
  not_admin: 'not_admin',
  not_owner: 'not_owner',
  insufficient_permission: 'insufficient_permission',
} as const;
