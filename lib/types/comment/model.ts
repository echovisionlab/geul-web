export interface CommentWithAuthor {
  id: string;
  post_id: string;
  member_id: string | null;
  parent_id: string | null;
  content: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
  author_name: string | null;
  author_image: string | null;
}

export interface CreateCommentInput {
  post_id: string;
  member_id: string;
  parent_id?: string | null;
  content: string;
}
