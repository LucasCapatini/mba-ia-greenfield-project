import { DataSource, Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import {
  ALL_ENTITIES,
  cleanAllTables,
  createTestDataSource,
} from '../test/create-test-data-source';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import {
  ListChannelVideosDto,
  ListOwnerVideosDto,
  ListPublicVideosDto,
} from './dto/list-videos.dto';
import { Video } from './entities/video.entity';
import { VideosListingService } from './videos-listing.service';
import { CategorySlugNotFoundException } from './videos.exceptions';
import type { VideosService } from './videos.service';

type Seed = Partial<
  Pick<
    Video,
    | 'title'
    | 'status'
    | 'visibility'
    | 'processing_status'
    | 'view_count'
    | 'created_at'
    | 'published_at'
    | 'category_id'
  >
>;

const BASE = Date.parse('2026-10-01T12:00:00.000Z');
const minutes = (n: number) => new Date(BASE + n * 60_000);

function ownerQuery(
  overrides: Partial<ListOwnerVideosDto> = {},
): ListOwnerVideosDto {
  return Object.assign(new ListOwnerVideosDto(), overrides);
}

function channelQuery(
  overrides: Partial<ListChannelVideosDto> = {},
): ListChannelVideosDto {
  return Object.assign(new ListChannelVideosDto(), overrides);
}

describe('VideosListingService (integration)', () => {
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;
  let service: VideosListingService;
  let channel: Channel;
  let counter = 0;
  let music: string;
  let gaming: string;
  let news: string;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    videoRepository = dataSource.getRepository(Video);
    const thumbnails = {
      thumbnailUrl: () => null,
    } as unknown as VideosService;
    service = new VideosListingService(dataSource, thumbnails);
    // Categorias semeadas pela migration SeedCategories (cleanAllTables não as apaga).
    const categories = await dataSource.query<{ id: string; slug: string }[]>(
      `SELECT "id", "slug" FROM "categories" WHERE "slug" IN ('music', 'gaming', 'news')`,
    );
    const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
    music = bySlug.get('music')!;
    gaming = bySlug.get('gaming')!;
    news = bySlug.get('news')!;
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: 'listing@example.com',
        password: 'hashed',
      }),
    );
    channel = await dataSource.getRepository(Channel).save(
      dataSource.getRepository(Channel).create({
        name: 'Listing',
        nickname: 'listing',
        user_id: user.id,
      }),
    );
  });

  /** Insere vídeos com datas explícitas (a coluna de criação é sobrescrita por SQL). */
  async function seed(specs: Seed[], channelId = channel.id): Promise<Video[]> {
    const saved: Video[] = [];
    for (const spec of specs) {
      const publicId = `list${String(++counter).padStart(7, '0')}`;
      const video = await videoRepository.save(
        videoRepository.create({
          public_id: publicId,
          channel_id: channelId,
          title: spec.title ?? `Video ${counter}`,
          original_filename: 'a.mp4',
          content_type: 'video/mp4',
          storage_key: `videos/${publicId}/source`,
          status: spec.status ?? 'draft',
          visibility: spec.visibility ?? 'public',
          processing_status: spec.processing_status ?? 'ready',
          view_count: spec.view_count ?? 0,
          published_at: spec.published_at ?? null,
          category_id: spec.category_id ?? null,
        }),
      );
      const createdAt = spec.created_at ?? minutes(counter);
      await dataSource.query(
        `UPDATE "videos" SET "created_at" = $1 WHERE "id" = $2`,
        [createdAt, video.id],
      );
      saved.push({ ...video, created_at: createdAt });
    }
    return saved;
  }

  describe('listOwnerVideos', () => {
    it('should page 25 videos as 20 + 5 by created_at desc with a stable cursor', async () => {
      await seed(
        Array.from({ length: 25 }, (_, i) => ({
          created_at: minutes(i),
          status: i % 3 === 0 ? 'published' : 'draft',
        })),
      );

      const first = await service.listOwnerVideos(channel.id, ownerQuery());
      expect(first.items).toHaveLength(20);
      expect(first.total).toBe(25);
      expect(first.next_cursor).not.toBeNull();
      const created = first.items.map((item) => item.created_at);
      expect(created).toEqual([...created].sort().reverse());

      // A newer video inserted between the pages must not shift page 2.
      await seed([{ created_at: minutes(100) }]);

      const second = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ cursor: first.next_cursor! }),
      );
      expect(second.items).toHaveLength(5);
      expect(second.next_cursor).toBeNull();
      expect(second.total).toBe(26);
      const firstIds = new Set(first.items.map((item) => item.public_id));
      expect(second.items.some((item) => firstIds.has(item.public_id))).toBe(
        false,
      );
      expect(second.items.at(-1)?.created_at).toBe(minutes(0).toISOString());
    });

    it('should not skip rows that differ only in microseconds (same JS millisecond)', async () => {
      const seeded = await seed([{}, {}, {}]);
      const micro = [
        '2026-10-02 08:00:00.123789',
        '2026-10-02 08:00:00.123456',
        '2026-10-02 08:00:00.123001',
      ];
      for (const [index, video] of seeded.entries()) {
        await dataSource.query(
          `UPDATE "videos" SET "created_at" = $1::timestamp WHERE "id" = $2`,
          [micro[index], video.id],
        );
      }

      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await service.listOwnerVideos(
          channel.id,
          ownerQuery({ limit: 1, cursor }),
        );
        seen.push(...page.items.map((item) => item.public_id));
        cursor = page.next_cursor ?? undefined;
      } while (cursor);

      expect(seen).toEqual(seeded.map((video) => video.public_id));
    });

    it('should not skip rows sharing the exact same timestamp across a page boundary', async () => {
      const sameInstant = new Date('2026-10-02T08:00:00.123Z');
      const seeded = await seed(
        Array.from({ length: 6 }, () => ({ created_at: sameInstant })),
      );

      const first = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ limit: 4 }),
      );
      const second = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ limit: 4, cursor: first.next_cursor! }),
      );

      const all = [...first.items, ...second.items].map((i) => i.public_id);
      expect(new Set(all).size).toBe(6);
      expect(all.sort()).toEqual(seeded.map((v) => v.public_id).sort());
    });

    it('should filter by status and search the title case-insensitively', async () => {
      await seed([
        { title: 'Aula 1' },
        { title: 'aula 2' },
        { title: 'Outro' },
        { title: 'Aula publicada', status: 'published' },
        { title: '100% aula_x' },
      ]);

      const page = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ status: 'draft', q: 'aula' }),
      );
      expect(page.items.map((item) => item.title).sort()).toEqual([
        '100% aula_x',
        'Aula 1',
        'aula 2',
      ]);
      expect(page.total).toBe(3);

      const literal = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ q: '%' }),
      );
      expect(literal.items.map((item) => item.title)).toEqual(['100% aula_x']);
    });

    it('should filter by visibility and processing status', async () => {
      await seed([
        { visibility: 'unlisted' },
        { visibility: 'public', processing_status: 'processing' },
        { visibility: 'public' },
      ]);

      const unlisted = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ visibility: 'unlisted' }),
      );
      expect(unlisted.total).toBe(1);
      expect(unlisted.items[0].visibility).toBe('unlisted');

      const processing = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ processing_status: 'processing' }),
      );
      expect(processing.items.map((i) => i.processing_status)).toEqual([
        'processing',
      ]);
    });

    it('should filter by an inclusive from/to date range on created_at', async () => {
      await seed([
        { title: 'before', created_at: new Date('2026-09-30T23:59:59Z') },
        { title: 'first day', created_at: new Date('2026-10-01T00:00:00Z') },
        { title: 'last day', created_at: new Date('2026-10-03T23:59:59Z') },
        { title: 'after', created_at: new Date('2026-10-04T00:00:00Z') },
      ]);

      const page = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ from: '2026-10-01', to: '2026-10-03' }),
      );

      expect(page.items.map((item) => item.title).sort()).toEqual([
        'first day',
        'last day',
      ]);
    });

    it('should sort by views and keep the total independent of the cursor', async () => {
      await seed([{ view_count: 5 }, { view_count: 50 }, { view_count: 20 }]);

      const first = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ sort: 'views', limit: 2 }),
      );
      const second = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ sort: 'views', limit: 2, cursor: first.next_cursor! }),
      );

      expect(
        [...first.items, ...second.items].map((i) => i.view_count),
      ).toEqual([50, 20, 5]);
      expect(first.total).toBe(3);
      expect(second.total).toBe(3);
    });

    it('should only list the given channel', async () => {
      const otherUser = await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: 'other-listing@example.com',
          password: 'hashed',
        }),
      );
      const other = await dataSource.getRepository(Channel).save(
        dataSource.getRepository(Channel).create({
          name: 'Other',
          nickname: 'other_listing',
          user_id: otherUser.id,
        }),
      );
      await seed([{}], other.id);
      await seed([{}]);

      const page = await service.listOwnerVideos(channel.id, ownerQuery());
      expect(page.total).toBe(1);
    });

    it('should reject a cursor emitted for another sort', async () => {
      await seed([{}, {}, {}]);
      const first = await service.listOwnerVideos(
        channel.id,
        ownerQuery({ limit: 1 }),
      );

      await expect(
        service.listOwnerVideos(
          channel.id,
          ownerQuery({ sort: 'views', cursor: first.next_cursor! }),
        ),
      ).rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    });
  });

  describe('listRelated', () => {
    const published = (
      title: string,
      category_id: string | null,
      minute: number,
    ): Seed => ({
      title,
      status: 'published',
      category_id,
      published_at: minutes(minute),
    });

    it('should list the same category first by published_at desc, then fill with other categories without repeating', async () => {
      const [origin] = await seed([
        published('origin', music, 50),
        published('m1', music, 1),
        published('m3', music, 3),
        published('m2', music, 2),
        published('g1', gaming, 10),
        published('n1', news, 12),
        published('none', null, 11),
      ]);

      const result = await service.listRelated(origin, 12);

      expect(result.items.map((item) => item.title)).toEqual([
        'm3',
        'm2',
        'm1',
        'n1',
        'none',
        'g1',
      ]);
      expect(Object.keys(result)).toEqual(['items']);
      expect(result.items[0].channel).toEqual({
        nickname: 'listing',
        name: 'Listing',
      });
    });

    it('should exclude the origin, unlisted, drafts and videos that are not ready', async () => {
      const [origin] = await seed([
        published('origin', music, 50),
        { ...published('unlisted', music, 1), visibility: 'unlisted' },
        { title: 'draft', category_id: music },
        {
          ...published('processing', music, 2),
          processing_status: 'processing',
        },
        { ...published('failed', gaming, 3), processing_status: 'failed' },
        published('ok', music, 4),
      ]);

      const result = await service.listRelated(origin, 12);

      expect(result.items.map((item) => item.title)).toEqual(['ok']);
    });

    it('should list only the most recent public videos when the origin has no category', async () => {
      const [origin] = await seed([
        published('origin', null, 50),
        published('m1', music, 1),
        published('none', null, 3),
        published('g1', gaming, 2),
      ]);

      const result = await service.listRelated(origin, 12);

      expect(result.items.map((item) => item.title)).toEqual([
        'none',
        'g1',
        'm1',
      ]);
    });

    it('should respect the limit across both groups', async () => {
      const [origin] = await seed([
        published('origin', music, 50),
        published('m1', music, 1),
        published('m2', music, 2),
        published('g1', gaming, 10),
        published('g2', gaming, 11),
      ]);

      const onlySame = await service.listRelated(origin, 1);
      const mixed = await service.listRelated(origin, 3);

      expect(onlySame.items.map((item) => item.title)).toEqual(['m2']);
      expect(mixed.items.map((item) => item.title)).toEqual(['m2', 'm1', 'g2']);
    });
  });

  describe('listChannelPublicVideos', () => {
    it('should exclude drafts and unlisted videos and order by published_at desc', async () => {
      await seed([
        { title: 'p1', status: 'published', published_at: minutes(1) },
        { title: 'p3', status: 'published', published_at: minutes(3) },
        { title: 'p2', status: 'published', published_at: minutes(2) },
        {
          title: 'unlisted',
          status: 'published',
          visibility: 'unlisted',
          published_at: minutes(4),
        },
        { title: 'draft' },
        { title: 'unpublished', published_at: minutes(5) },
      ]);

      const page = await service.listChannelPublicVideos(
        channel,
        channelQuery(),
      );

      expect(page.items.map((item) => item.title)).toEqual(['p3', 'p2', 'p1']);
      expect(page.next_cursor).toBeNull();
      expect(page.items[0].channel).toEqual({
        nickname: 'listing',
        name: 'Listing',
      });
    });

    it('should order popular by view_count desc and oldest by published_at asc, across pages', async () => {
      await seed([
        {
          title: 'a',
          status: 'published',
          view_count: 10,
          published_at: minutes(1),
        },
        {
          title: 'b',
          status: 'published',
          view_count: 300,
          published_at: minutes(2),
        },
        {
          title: 'c',
          status: 'published',
          view_count: 50,
          published_at: minutes(3),
        },
      ]);

      const popular1 = await service.listChannelPublicVideos(
        channel,
        channelQuery({ sort: 'popular', limit: 2 }),
      );
      const popular2 = await service.listChannelPublicVideos(
        channel,
        channelQuery({
          sort: 'popular',
          limit: 2,
          cursor: popular1.next_cursor!,
        }),
      );
      expect(
        [...popular1.items, ...popular2.items].map((i) => i.view_count),
      ).toEqual([300, 50, 10]);

      const oldest = await service.listChannelPublicVideos(
        channel,
        channelQuery({ sort: 'oldest' }),
      );
      expect(oldest.items.map((item) => item.title)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('listSubscriptionFeed (Fase 06 — social-interactions/TD-08)', () => {
    async function followerOf(...channelIds: string[]): Promise<string> {
      const fan = await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `fan${++counter}@example.com`,
          password: 'hashed',
        }),
      );
      for (const channelId of channelIds) {
        await dataSource.getRepository(Subscription).save({
          user_id: fan.id,
          channel_id: channelId,
        });
      }
      return fan.id;
    }

    async function otherChannel(nickname: string): Promise<Channel> {
      const owner = await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `${nickname}@example.com`,
          password: 'hashed',
        }),
      );
      return dataSource.getRepository(Channel).save(
        dataSource.getRepository(Channel).create({
          name: nickname,
          nickname,
          user_id: owner.id,
        }),
      );
    }

    it('should list only published + public + ready videos of followed channels, newest first, across pages', async () => {
      const followed = await otherChannel('seguido');
      const ignored = await otherChannel('ignorado');
      const published = { status: 'published' as const };
      await seed([
        { ...published, title: 'c1', published_at: minutes(10) },
        { ...published, title: 'c3', published_at: minutes(30) },
        {
          ...published,
          title: 'unlisted',
          visibility: 'unlisted',
          published_at: minutes(40),
        },
        {
          ...published,
          title: 'processing',
          processing_status: 'processing',
          published_at: minutes(41),
        },
        { title: 'draft' },
      ]);
      await seed(
        [
          { ...published, title: 's2', published_at: minutes(20) },
          { ...published, title: 's4', published_at: minutes(50) },
        ],
        followed.id,
      );
      await seed(
        [{ ...published, title: 'x', published_at: minutes(60) }],
        ignored.id,
      );
      const fan = await followerOf(channel.id, followed.id);

      const titles: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await service.listSubscriptionFeed(fan, {
          cursor,
          limit: 2,
        });
        pages++;
        titles.push(...page.items.map((item) => item.title));
        for (const item of page.items) {
          expect(Object.keys(item.channel).sort()).toEqual([
            'name',
            'nickname',
          ]);
        }
        cursor = page.next_cursor ?? undefined;
      } while (cursor);

      expect(titles).toEqual(['s4', 'c3', 's2', 'c1']);
      expect(pages).toBe(2);
    });

    it('should return an empty feed for a user who follows nobody', async () => {
      await seed([{ status: 'published', published_at: minutes(1) }]);
      const loner = await followerOf();

      await expect(
        service.listSubscriptionFeed(loner, { limit: 20 }),
      ).resolves.toEqual({ items: [], next_cursor: null });
    });
  });

  describe('listPublic (Fase 07 — home-search-production/TD-01, TD-02, TD-03)', () => {
    function publicQuery(
      overrides: Partial<ListPublicVideosDto> = {},
    ): ListPublicVideosDto {
      return Object.assign(new ListPublicVideosDto(), overrides);
    }

    async function channelNamed(
      name: string,
      nickname: string,
    ): Promise<Channel> {
      const owner = await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `${nickname}@example.com`,
          password: 'hashed',
        }),
      );
      return dataSource
        .getRepository(Channel)
        .save(
          dataSource
            .getRepository(Channel)
            .create({ name, nickname, user_id: owner.id }),
        );
    }

    async function titlesOf(query: ListPublicVideosDto): Promise<string[]> {
      const page = await service.listPublic(query);
      return page.items.map((item) => item.title);
    }

    it('should list only published + public + ready videos of every channel, newest first, across pages', async () => {
      const other = await channelNamed('Other', 'other_chan');
      const published = Array.from({ length: 22 }, (_, i) => ({
        title: `p${i + 1}`,
        status: 'published' as const,
        published_at: minutes(i + 1),
      }));
      await seed(published.slice(0, 11));
      await seed(published.slice(11), other.id);
      await seed([
        { title: 'draft', status: 'draft' },
        {
          title: 'unlisted',
          status: 'published',
          visibility: 'unlisted',
          published_at: minutes(90),
        },
        {
          title: 'processing',
          status: 'published',
          processing_status: 'processing',
          published_at: minutes(91),
        },
        {
          title: 'failed',
          status: 'published',
          processing_status: 'failed',
          published_at: minutes(92),
        },
      ]);

      const first = await service.listPublic(publicQuery());
      expect(first.items.map((item) => item.title)).toEqual(
        Array.from({ length: 20 }, (_, i) => `p${22 - i}`),
      );
      expect(first.items[0].channel).toEqual({
        nickname: 'other_chan',
        name: 'Other',
      });
      expect(first.next_cursor).toEqual(expect.any(String));

      const second = await service.listPublic(
        publicQuery({ cursor: first.next_cursor! }),
      );
      expect(second.items.map((item) => item.title)).toEqual(['p2', 'p1']);
      expect(second.next_cursor).toBeNull();
    });

    it('should filter by category slug and reject an unknown slug', async () => {
      await seed([
        {
          title: 'm1',
          status: 'published',
          published_at: minutes(1),
          category_id: music,
        },
        {
          title: 'g1',
          status: 'published',
          published_at: minutes(2),
          category_id: gaming,
        },
        {
          title: 'm2',
          status: 'published',
          published_at: minutes(3),
          category_id: music,
        },
        { title: 'none', status: 'published', published_at: minutes(4) },
      ]);

      await expect(
        titlesOf(publicQuery({ category: 'music' })),
      ).resolves.toEqual(['m2', 'm1']);
      await expect(
        service.listPublic(publicQuery({ category: 'inexistente' })),
      ).rejects.toThrow(CategorySlugNotFoundException);
    });

    it('should match the title or the channel name/nickname by substring, ignoring accents and case', async () => {
      const rock = await channelNamed('Rock Club', 'rock_club');
      const bia = await channelNamed('Músicas do Bia', 'bia_som');
      await seed(
        [
          {
            title: 'Música ao vivo',
            status: 'published',
            published_at: minutes(1),
          },
        ],
        rock.id,
      );
      await seed(
        [
          { title: 'Show 1', status: 'published', published_at: minutes(2) },
          { title: 'Show 2', status: 'published', published_at: minutes(3) },
        ],
        bia.id,
      );
      await seed([
        {
          title: 'Aula de cálculo',
          status: 'published',
          published_at: minutes(4),
        },
      ]);

      await expect(titlesOf(publicQuery({ q: 'musica' }))).resolves.toEqual([
        'Show 2',
        'Show 1',
        'Música ao vivo',
      ]);
      await expect(titlesOf(publicQuery({ q: 'MÚSICA' }))).resolves.toEqual([
        'Show 2',
        'Show 1',
        'Música ao vivo',
      ]);
      await expect(titlesOf(publicQuery({ q: 'bia_som' }))).resolves.toEqual([
        'Show 2',
        'Show 1',
      ]);
      await expect(titlesOf(publicQuery({ q: 'calc' }))).resolves.toEqual([
        'Aula de cálculo',
      ]);
    });

    it('should treat % and _ in the term as literal characters', async () => {
      await seed([
        {
          title: 'Desconto de 100% hoje',
          status: 'published',
          published_at: minutes(1),
        },
        { title: '100 vídeos', status: 'published', published_at: minutes(2) },
        {
          title: 'Tutorial_avancado',
          status: 'published',
          published_at: minutes(3),
        },
        {
          title: 'Tutorialxavancado',
          status: 'published',
          published_at: minutes(4),
        },
      ]);

      await expect(titlesOf(publicQuery({ q: '100%' }))).resolves.toEqual([
        'Desconto de 100% hoje',
      ]);
      await expect(titlesOf(publicQuery({ q: 'l_a' }))).resolves.toEqual([
        'Tutorial_avancado',
      ]);
    });

    it('should combine the search term with the category filter', async () => {
      await seed([
        {
          title: 'Música ao vivo',
          status: 'published',
          published_at: minutes(1),
          category_id: music,
        },
        {
          title: 'Música de jogo',
          status: 'published',
          published_at: minutes(2),
          category_id: gaming,
        },
      ]);

      await expect(
        titlesOf(publicQuery({ q: 'musica', category: 'music' })),
      ).resolves.toEqual(['Música ao vivo']);
    });
  });
});
