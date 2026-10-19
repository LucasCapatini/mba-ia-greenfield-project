import { VIDEO_TITLE_MAX_LENGTH } from './videos.constants';

/**
 * Título inicial do rascunho (`### Data Model → Video`): o nome do arquivo sem a última extensão
 * ("Minha aula.final.mp4" → "Minha aula.final"); quando não sobra nada (".mp4"), o nome inteiro.
 * Truncado por code point a `VIDEO_TITLE_MAX_LENGTH` para não partir um par substituto.
 * A migration `ExtendVideosForPublishing` aplica a mesma regra às linhas antigas.
 */
export function deriveVideoTitle(originalFilename: string): string {
  const trimmed = originalFilename.trim();
  const withoutExtension = trimmed.replace(/\.[^.]*$/, '').trim();
  const base = withoutExtension.length > 0 ? withoutExtension : trimmed;
  return Array.from(base).slice(0, VIDEO_TITLE_MAX_LENGTH).join('');
}
