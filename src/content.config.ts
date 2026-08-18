import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 法人サポーター（1社＝1つのMarkdownファイルで管理）
// ファイルは src/content/supporters/ に置く（例：holic.md）
const supporters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/supporters' }),
  schema: z.object({
    name: z.string(),                    // 企業・団体名
    logo: z.string(),                    // ロゴ画像のパス（例：/images/supporters/holic.png）
    title: z.string().optional(),        // インタビューの見出し（例：お金の価値が定量的から定性的に。）
    thumbnail: z.string().optional(),    // カード・記事のメイン写真（例：/images/supporters/holic-thumb.jpg）
    interviewees: z.string().optional(), // 語り手（例：杉原 淳一 × 深井 龍之介）
    url: z.string().optional(),          // 企業サイトのURL（任意）
    order: z.number().default(999),      // 表示順（小さいほど先）
    published: z.boolean().default(true),// 公開する/しない
  }),
});

export const collections = { supporters };
