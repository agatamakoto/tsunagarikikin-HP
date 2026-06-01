import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // GitHub Pages用の設定
  site: 'https://escf.jp',

  // 出力をスタティックに設定
  output: 'static',

  adapter: cloudflare(),
});