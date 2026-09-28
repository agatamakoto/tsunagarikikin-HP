import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

import { interviews } from './src/lib/omatsu.ts';

// 限定公開（hidden: true）のインタビュー記事のURL。サイトマップから除く
const hiddenInterviewPaths = interviews
  .filter((iv) => iv.hidden)
  .map((iv) => `/projects/Omatsu-RebootCAMP/interview/${iv.slug}`);

export default defineConfig({
  // GitHub Pages用の設定
  site: 'https://escf.jp',

  // 出力をスタティックに設定
  output: 'static',

  integrations: [
    // sitemap-index.xml を自動生成する（public/robots.txt から参照している）
    sitemap({
      // 記入例のページと、限定公開のインタビュー記事は検索結果に出さない
      filter: (page) =>
        !page.includes('/supporters/sample-') &&
        !hiddenInterviewPaths.some((path) => page.includes(path)),
      serialize: (item) => {
        // 募集中の案内なので、OMATSU-RebootCAMP は更新頻度と優先度を上げる
        if (item.url.includes('/projects/Omatsu-RebootCAMP')) {
          item.changefreq = 'weekly';
          item.priority = 0.8;
        }
        return item;
      },
    }),
  ],
});