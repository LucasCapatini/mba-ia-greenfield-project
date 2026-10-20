import { DomainException } from '../common/exceptions/domain.exception';
import { SUBSCRIPTION_ERROR_CODES } from './subscriptions.constants';

// Exceções de domínio das inscrições (social-interactions — `### Error Catalog`), mapeadas para
// HTTP pelo DomainExceptionFilter (phase-02-auth/TD-07).

export class CannotSubscribeOwnChannelException extends DomainException {
  constructor() {
    super(
      SUBSCRIPTION_ERROR_CODES.CANNOT_SUBSCRIBE_OWN_CHANNEL,
      422,
      'You cannot subscribe to your own channel',
    );
  }
}
