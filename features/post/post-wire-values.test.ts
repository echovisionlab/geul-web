import { PostStatus as PublicPostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { POST_ACTION, PUBLIC_POST_STATUS } from './post-wire-values';

const members = (generated: object) =>
  Object.fromEntries(Object.entries(generated).filter(([name]) => Number.isNaN(Number(name))));

describe('post wire values', () => {
  it('mirror every generated enum member', () => {
    expect(PUBLIC_POST_STATUS).toEqual(members(PublicPostStatus));
    expect(POST_ACTION).toEqual(members(PostAction));
  });
});
