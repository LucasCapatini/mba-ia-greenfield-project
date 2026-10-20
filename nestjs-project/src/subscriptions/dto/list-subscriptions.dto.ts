import { CursorPageQuery } from '../../videos/dto/list-videos.dto';

/** `GET /me/subscriptions` — só `cursor`/`limit`; a ordem é sempre alfabética (TD-08). */
export class ListSubscriptionsQuery extends CursorPageQuery {}
