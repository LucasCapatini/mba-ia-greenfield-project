import { reactionDelta } from './reaction-transition';

describe('reactionDelta', () => {
  it.each([
    [null, 'like', { like: 1, dislike: 0 }],
    [null, 'dislike', { like: 0, dislike: 1 }],
    ['like', 'dislike', { like: -1, dislike: 1 }],
    ['dislike', 'like', { like: 1, dislike: -1 }],
    ['like', null, { like: -1, dislike: 0 }],
    ['dislike', null, { like: 0, dislike: -1 }],
  ] as const)(
    'should move the counters from %s to %s',
    (previous, next, expected) => {
      expect(reactionDelta(previous, next)).toEqual(expected);
    },
  );

  it.each([
    [null, null],
    ['like', 'like'],
    ['dislike', 'dislike'],
  ] as const)(
    'should not move the counters when %s stays %s (idempotent set-state)',
    (previous, next) => {
      expect(reactionDelta(previous, next)).toEqual({ like: 0, dislike: 0 });
    },
  );
});
