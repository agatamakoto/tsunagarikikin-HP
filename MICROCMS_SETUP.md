# microCMS統合ガイド

つながり基金のホームページはmicroCMSと連携しており、ブログ感覚で簡単にコンテンツを更新できます。

## セットアップ手順

### 1. microCMSアカウントの作成

1. [microCMS](https://microcms.io/)にアクセス
2. 無料プランでアカウントを作成
3. サービスを作成（例：`tsunagari-fund`）

### 2. APIスキーマの設定

microCMSのダッシュボードで、以下の4つのコンテンツタイプを作成してください：

#### ① お知らせ (news)
- フィールド：
  - `title` (テキスト, 必須)
  - `description` (テキストエリア)
  - `content` (リッチテキストエディタ)
  - `image` (画像)
  - `publishedAt` (日時, 自動)

#### ② プロジェクト (projects)
- フィールド：
  - `title` (テキスト, 必須)
  - `description` (テキストエリア)
  - `content` (リッチテキストエディタ)
  - `image` (画像)
  - `status` (選択: 進行中/完了/企画中)
  - `startDate` (日付)

#### ③ 助成プログラム (grants)
- フィールド：
  - `title` (テキスト, 必須)
  - `description` (テキストエリア)
  - `content` (リッチテキストエディタ)
  - `amount` (数値)
  - `deadline` (日付)
  - `applicationUrl` (URL)

#### ④ メディア掲載 (media)
- フィールド：
  - `title` (テキスト, 必須)
  - `outlet` (テキスト：掲載媒体)
  - `url` (URL)
  - `publishedAt` (日付)
  - `image` (画像：バナーなど)

### 3. APIキーの取得

1. microCMS管理画面の「API キー」セクションへ
2. 読み込み権限のあるキーを生成
3. APIキーと、サービスURLを安全に保管

### 4. 環境変数の設定

以下の手順で環境変数を設定します：

#### ローカル開発時
`tender-telescope/.env.local`ファイルを編集：

```
MICROCMS_API_URL=https://YOUR_SERVICE_ID.microcms.io/api/v1
MICROCMS_API_KEY=YOUR_API_KEY_HERE
```

`YOUR_SERVICE_ID`と`YOUR_API_KEY_HERE`を自分の値に置き換えてください。

#### GitHub本番環境
1. GitHubリポジトリの Settings → Secrets and variables → Actions へ
2. 以下の2つのシークレットを追加：
   - `MICROCMS_API_URL`: microCMSのAPI URL
   - `MICROCMS_API_KEY`: microCMSのAPIキー

### 5. コンテンツの更新

microCMS管理画面で以下の項目を更新すると、自動的にサイトが更新されます：

1. **お知らせ** → トップページと「活動を知る」ページに表示
2. **プロジェクト** → トップページと「協働とプロジェクト」ページに表示
3. **助成プログラム** → 「助成や支援を受ける」ページに表示
4. **メディア掲載** → 「活動を知る」ページに表示

## 自動デプロイの流れ

1. **microCMSで更新** → コンテンツを編集・公開
2. **Webhookが発火** → microCMSがGitHubにシグナルを送信
3. **GitHub Actions実行** → 自動的にサイトをビルド
4. **自動デプロイ** → GitHub Pagesに反映（数分以内）

## トラブルシューティング

### デプロイが失敗する場合
- `.env.local`のAPIキーが正しいか確認
- GitHubのシークレット設定を確認
- GitHub Actionsのログを確認

### コンテンツが表示されない場合
- microCMSで記事を「公開」状態にしているか確認
- ブラウザのキャッシュをクリア（Ctrl+Shift+Delete）
- microCMSのスキーマ設定が正しいか確認

## サポート

- [microCMS ドキュメント](https://microcms.io/docs)
- [Astro ドキュメント](https://docs.astro.build/)
