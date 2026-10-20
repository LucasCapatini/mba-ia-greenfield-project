export const COMMENT_ERROR_CODES = {
  NOT_FOUND: 'COMMENT_NOT_FOUND',
  FORBIDDEN: 'COMMENT_FORBIDDEN',
} as const;

/** Ordenações da listagem de raízes (social-interactions/TD-06). */
export const COMMENT_SORTS = ['latest', 'top'] as const;
export type CommentSort = (typeof COMMENT_SORTS)[number];

/** Limite do texto após `trim` (social-interactions/TD-07). */
export const COMMENT_TEXT_MAX_LENGTH = 2000;
