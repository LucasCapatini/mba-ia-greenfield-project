import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { Channel } from '../channels/entities/channel.entity';
import { User } from '../users/entities/user.entity';
import { VideoUpload } from '../videos/entities/video-upload.entity';
import { Video } from '../videos/entities/video.entity';

/**
 * Todas as entidades do schema. As relações são bidirecionais (ex.: `Channel.videos`), então
 * qualquer DataSource que registre uma delas precisa registrar todas. A API descobre as
 * entidades pelos `forFeature` dos módulos de domínio (`autoLoadEntities`); o worker, que só
 * importa `Video`, e os DataSources de teste usam esta lista.
 */
export const ENTITIES = [
  User,
  Channel,
  RefreshToken,
  VerificationToken,
  Video,
  VideoUpload,
];
