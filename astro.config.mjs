import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // GitHub Pages用の設定
  site: 'https://escf.jp',

  // 出力をスタティックに設定
  output: 'static',

  integrations: [
    // sitemap-index.xml を自動生成する（public/robots.txt から参照している）
    sitemap({
      // 記入例のページは検索結果に出さない
      filter: (page) => !page.includes('/supporters/sample-'),
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