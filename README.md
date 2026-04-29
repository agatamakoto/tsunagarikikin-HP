# つながり基金 ホームページ

西条の地から、地域共創のプラットフォームへ。つながり基金のオフィシャルウェブサイト。

## プロジェクト概要

- **フレームワーク**: Astro（静的サイトジェネレーター）
- **CMS**: microCMS（ヘッドレスCMS）
- **ホスティング**: GitHub Pages
- **自動デプロイ**: GitHub Actions
- **ドメイン**: escf.jp

## 特徴

✨ **高速・軽量**
- 静的サイト化により、爆速でサイトが読み込まれます
- SEO最適化済み

💰 **維持費ゼロ**
- GitHub Pages: 無料
- microCMS: 無料プラン利用可
- サーバー代なし

🎯 **簡単更新**
- microCMS管理画面で、ブログ感覚でコンテンツ更新
- 技術知識不要
- 更新すると自動的にサイトに反映

🎨 **親しみやすいデザイン**
- 西条の地下水「うちぬき」をイメージした透明感のある水色
- 柔らかい曲線とアニメーション
- レスポンシブ対応（スマホ・タブレット対応）

## 更新可能なコンテンツ

microCMS連携により、以下の項目は管理画面から簡単に更新できます：

- 📰 **お知らせ** - トップページ・「活動を知る」に表示
- 🎯 **プロジェクト** - トップページ・「協働とプロジェクト」に表示
- 💰 **寄付統計** - リアルタイム表示
- 📊 **助成プログラム** - 「助成や支援を受ける」に表示
- 📺 **メディア掲載** - 「活動を知る」に表示

## セットアップ

### 開発環境での実行

```bash
# プロジェクトをクローン
git clone https://github.com/your-username/tender-telescope.git
cd tender-telescope

# 依存パッケージをインストール
npm install

# 開発サーバーを起動
npm run dev
# http://localhost:4321 でサイトが開きます
```

### microCMS連携の設定

詳細は [MICROCMS_SETUP.md](./MICROCMS_SETUP.md) をご参照ください。

### DNS設定（escf.jp）

詳細は [DNS_SETUP.md](./DNS_SETUP.md) をご参照ください。

## ビルド・デプロイ

### ビルド

```bash
npm run build
```

`dist/` フォルダに静的ファイルが生成されます。

### デプロイ

GitHub Actionsが自動で以下を実行します：

1. `main` ブランチへのプッシュ時
2. microCMS からのウェブフック受信時
3. 毎日夜間

手動トリガーの場合：
```bash
git push origin main
```

## プロジェクト構成

```
tender-telescope/
├── src/
│   ├── components/           # Astroコンポーネント
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   └── QuestionFlow.astro
│   ├── layouts/              # ページレイアウト
│   │   └── Layout.astro
│   ├── pages/                # ページコンポーネント
│   │   ├── index.astro       # トップページ
│   │   ├── about.astro
│   │   ├── donation.astro
│   │   ├── support.astro
│   │   ├── projects.astro
│   │   ├── news.astro
│   │   └── contact.astro
│   └── lib/                  # ユーティリティ
│       └── microcms.ts       # microCMS APIクライアント
├── public/                   # 静的アセット
├── .github/workflows/        # GitHub Actions設定
│   └── deploy.yml
├── astro.config.mjs         # Astro設定
├── tsconfig.json            # TypeScript設定
├── package.json             # パッケージ設定
├── .env.local               # ローカル環境変数（Git除外）
├── .gitignore
├── MICROCMS_SETUP.md        # microCMS設定ガイド
├── DNS_SETUP.md             # DNS設定ガイド
└── README.md                # このファイル
```

## ページ構成

### トップページ (`/`)
- ヒーロービジュアル
- 2ステップの診断フロー（「あなたはどの立場？」）
- 最新プロジェクト（3件）
- お知らせ
- 統計情報（寄付総額など）
- 「これからの財団について」セクション

### 財団について (`/about`)
- ビジョン・ミッション
- 設立背景
- 組織概要・役員名簿
- オープンソース化について

### 寄付をする (`/donation`)
- 寄付の仕組み
- 個人からの寄付
- 企業からの寄付
- 冠基金
- 遺贈寄付

### 助成や支援を受ける (`/support`)
- 助成プログラム一覧
- クラウドファンディング
- 伴走支援

### 協働とプロジェクト (`/projects`)
- 進行中のプロジェクト
- 協働マッチング事例

### 活動を知る (`/news`)
- お知らせ
- 寄付統計
- 助成先の声
- メディア掲載実績

### お問い合わせ (`/contact`)
- 目的別お問い合わせフォーム
- FAQ
- SNS リンク

## 色彩設計

- **メインカラー**: `#5ec7d4`（透明感のある水色）
- **アクセント**: `#ff9f3c`（暖かいオレンジ）
- **セカンダリ**: `#ffd84c`（イエロー）
- **ベース**: `#ffffff`（白）
- **テキスト**: `#2c3e50`（濃い灰色）

## 開発ガイドライン

### コンポーネント作成

```astro
---
// src/components/MyComponent.astro
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<div class="my-component">
  <h2>{title}</h2>
</div>

<style>
  .my-component {
    /* スタイルをここに記述 */
  }
</style>
```

### microCMSからのデータ取得

```astro
---
import { getMicroCMSContent } from '../lib/microcms';

// お知らせ一覧を取得
const news = await getMicroCMSContent('news', { limit: 5 });
---

{news.contents.map((article) => (
  <article>
    <h3>{article.title}</h3>
    <p>{article.description}</p>
  </article>
))}
```

## トラブルシューティング

### ローカル開発時にコンテンツが表示されない

`.env.local` で microCMS の認証情報が設定されているか確認してください。設定されていない場合はダミーデータが表示されます。

### ビルドエラーが発生する

```bash
# キャッシュをクリア
rm -rf node_modules package-lock.json
npm install

# 再度ビルド
npm run build
```

### デプロイが失敗する

[GitHub Actions のログ](../../actions) を確認してください。

## 今後の拡張予定

- [ ] メールマガジン登録機能
- [ ] SNS連携
- [ ] 多言語対応
- [ ] ブログ機能の強化

## ライセンス

ISC License

## サポート

問い合わせは GitHub Issues でお願いします。

## 参考リンク

- [Astro ドキュメント](https://docs.astro.build/)
- [microCMS ドキュメント](https://microcms.io/docs/)
- [GitHub Pages](https://pages.github.com/)
