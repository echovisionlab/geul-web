export function resolveCommentActions(input: { isDeleted: boolean; isOwnComment: boolean; canModerate: boolean }) {
  return {
    canEdit: !input.isDeleted && input.isOwnComment,
    canDelete: !input.isDeleted && (input.isOwnComment || input.canModerate),
  };
}
