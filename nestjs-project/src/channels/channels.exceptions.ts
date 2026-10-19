import { DomainException } from '../common/exceptions/domain.exception';
import { CHANNEL_ERROR_CODES } from './channels.constants';

// Exceções de domínio do canal (video-channel-management — `### Error Catalog`), mapeadas para
// HTTP pelo DomainExceptionFilter (phase-02-auth/TD-07).

export class NicknameTakenException extends DomainException {
  constructor(nickname: string) {
    super(
      CHANNEL_ERROR_CODES.NICKNAME_TAKEN,
      409,
      `Nickname "${nickname}" is already taken`,
    );
  }
}

export class ChannelNotFoundException extends DomainException {
  constructor() {
    super(CHANNEL_ERROR_CODES.NOT_FOUND, 404, 'Channel not found');
  }
}
