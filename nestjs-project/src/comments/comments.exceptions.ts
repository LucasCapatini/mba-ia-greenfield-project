import { DomainException } from '../common/exceptions/domain.exception';
import { COMMENT_ERROR_CODES } from './comments.constants';

// Exceções de domínio dos comentários (social-interactions — `### Error Catalog`), mapeadas para
// HTTP pelo DomainExceptionFilter (phase-02-auth/TD-07).

/** Inexistente, id malformado ou comentário de um vídeo que não está `published`. */
export class CommentNotFoundException extends DomainException {
  constructor() {
    super(COMMENT_ERROR_CODES.NOT_FOUND, 404, 'Comment not found');
  }
}

/** Só o autor edita ou exclui o comentário (TD-06, Revisions 2026-10-20). */
export class CommentForbiddenException extends DomainException {
  constructor() {
    super(
      COMMENT_ERROR_CODES.FORBIDDEN,
      403,
      'Only the author can change this comment',
    );
  }
}
