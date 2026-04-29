# 本番環境セットアップガイド

つながり基金のホームページを本番環境（GitHub Pages + microCMS）にデプロイするための、ステップバイステップガイドです。

## 全体の流れ

1. **GitHub リポジトリの作成** （15分）
2. **GitHub Pages有効化** （5分）
3. **microCMS アカウント作成・スキーマ設定** （30分）
4. **GitHub Secrets設定** （5分）
5. **DNS設定** （10分、反映待ちは最大48時間）
6. **テスト・確認** （15分）

**合計**: 約1～2日（DNS反映待ちを除く作業時間は約80分）

---

## Step 1: GitHub リポジトリの作成

### 1-1. 新規リポジトリの作成

1. [GitHub](https://github.com)にログイン
2. 右上の「+」ボタン → 「New repository」
3. 以下の情報を入力：
   - **Repository name**: `tender-telescope`
   - **Description**: `つながり基金ホームページ`
   - **Public**: ✅ チェック（必須：Pages利用のため）
   - **Initialize with**: チェックなし（既存コードをpushするため）
4. 「Create repository」をクリック

### 1-2. ローカルコードを GitHub へプッシュ

ターミナルで以下を実行：

```bash
cd /path/to/tender-telescope

# リモートリポジトリを追加
git remote add origin https://github.com/YOUR_USERNAME/tender-telescope.git

# mainブランチに切り替え
git branch -M main

# プッシュ
git push -u origin main
```

`YOUR_USERNAME` は自分の GitHub ユーザー名に置き換えてください。

---

## Step 2: GitHub Pages有効化

### 2-1. Pages設定

1. GitHub リポジトリの **Settings** → **Pages**
2. **Build and deployment** セクション：
   - **Source**: 「Deploy from a branch」を選択
   - **Branch**: 「main」 → 「/(root)」を選択
3. **Save** をクリック

### 2-2. GitHub Actions権限の確認

1. Settings → **Actions** → **General**
2. **Workflow permissions**: 「Read and write permissions」を選択
3. 「Save」をクリック

---

## Step 3: microCMS アカウント作成・スキーマ設定

### 3-1. microCMS アカウント作成

1. [microCMS](https://microcms.io/)にアクセス
2. 「無料で始める」をクリック
3. アカウント情報を入力（メールアドレス、パスワード等）
4. メール認証を完了

### 3-2. サービスを作成

1. ダッシュボードで「サービス作成」をクリック
2. サービス名を入力（例：`tsunagari-fund`）
3. リージョン：日本を選択
4. 「作成」をクリック

### 3-3. APIスキーマの作成

#### ① お知らせ (news)

1. 「APIスキーマ」 → 「新規作成」
2. **スキーマ名**: `news`
3. 以下のフィールドを追加：

| フィールド名 | 型 | オプション |
|---|---|---|
| title | テキスト | 必須 |
| description | テキストエリア | - |
| content | リッチテキスト | - |
| image | 画像 | - |

4. 「作成」をクリック

#### ② プロジェクト (projects)

スキーマ名: `projects`

| フィールド名 | 型 | オプション |
|---|---|---|
| title | テキスト | 必須 |
| description | テキストエリア | - |
| content | リッチテキスト | - |
| image | 画像 | - |
| status | 選択 | 値: 進行中, 完了, 企画中 |
| startDate | 日付 | - |

#### ③ 助成プログラム (grants)

スキーマ名: `grants`

| フィールド名 | 型 | オプション |
|---|---|---|
| title | テキスト | 必須 |
| description | テキストエリア | - |
| content | リッチテキスト | - |
| amount | 数値 | - |
| deadline | 日付 | - |
| applicationUrl | URL | - |

#### ④ メディア掲載 (media)

スキーマ名: `media`

| フィールド名 | 型 | オプション |
|---|---|---|
| title | テキスト | 必須 |
| outlet | テキスト | 掲載媒体名 |
| url | URL | - |
| publishedAt | 日付 | - |
| image | 画像 | バナー画像 |

### 3-4. APIキーを生成

1. microCMS ダッシュボード → **「API キー」**
2. **「新規作成」** をクリック
3. **キー名**: 「GitHub Actions」
4. **権限**: 「読み取り」を選択
5. 「作成」をクリック
6. 表示されたAPIキーをコピーして安全に保管

### 3-5. API URLを確認

ダッシュボードの以下から確認できます：
- サービス名をクリック
- 「API」セクション
- **基本URL** をコピー（例：`https://tsunagari-fund.microcms.io/api/v1`）

---

## Step 4: GitHub Secrets設定

### 4-1. Secrets登録

1. GitHub リポジトリの **Settings** → **Secrets and variables** → **Actions**
2. **「New repository secret」** をクリック
3. 以下を追加：

**1つ目：**
- Name: `MICROCMS_API_URL`
- Secret: microCMSのAPI URL（Step 3-5で確認した値）
  - 例：`https://tsunagari-fund.microcms.io/api/v1`

**2つ目：**
- Name: `MICROCMS_API_KEY`
- Secret: microCMSのAPIキー（Step 3-4で生成した値）

4. 各項目後に「Add secret」をクリック

---

## Step 5: DNS設定

詳細は [DNS_SETUP.md](./DNS_SETUP.md) をご参照ください。

簡潔には：
1. ドメインレジストラのDNS設定で、以下のAレコードを追加：
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

2. CNAME設定：
   ```
   www → YOUR_USERNAME.github.io
   ```

3. GitHub Pages設定で、カスタムドメインを登録（Settings → Pages → Custom domain）

4. DNS反映を待つ（最大48時間）

---

## Step 6: テスト・確認

### 6-1. 初回デプロイの確認

1. GitHub リポジトリの **Actions** タブ
2. 最新のワークフロー実行を確認
3. ✅ 「Deploy to GitHub Pages」が完了したか確認

### 6-2. サイトのアクセス確認

#### テストサイト（GitHub Pages）：
```
https://YOUR_USERNAME.github.io/
```

#### カスタムドメイン（DNS設定後）：
```
https://escf.jp
```

### 6-3. 機能テスト

- [ ] トップページが表示される
- [ ] 質問フロー（「あなたはどの立場？」）が動作する
- [ ] ページ遷移が正常に機能する
- [ ] モバイル表示が正常か確認
- [ ] ヘッダー・フッターが正常に表示される

### 6-4. microCMS連携テスト

1. microCMS で「news」に記事を作成・公開
2. GitHub Actions で自動デプロイが実行されるか確認
3. サイトに反映されるか確認

---

## Step 7: 初期コンテンツの設定

microCMS管理画面で、以下を設定してください：

### お知らせ (news)
- 3～5件の初期記事を追加
- 各記事を公開状態に

### プロジェクト (projects)
- OMATSU-RebootCAMP
- 地域共創プロジェクト
- その他のプロジェクト

### 助成プログラム (grants)
- 現在募集中のプログラムを登録

### メディア掲載実績 (media)
- 過去のメディア掲載情報を登録

---

## Step 8: クライアント向けマニュアル作成

[MICROCMS_SETUP.md](./MICROCMS_SETUP.md) を参考に、クライアント向けのシンプルなマニュアルを作成してください。

内容：
- microCMS管理画面へのログイン方法
- 各コンテンツの更新方法
- よくある質問と答え
- トラブルシューティング

---

## トラブルシューティング

### デプロイが失敗する場合

**確認項目：**
- [ ] GitHub Actions ワークフロー実行ログを確認（Actions タブ）
- [ ] MICROCMS_API_KEY, MICROCMS_API_URL が正しく設定されているか
- [ ] microCMS API キーの権限が「読み取り」になっているか
- [ ] ブランチが「main」か確認

### サイトが表示されない場合

- [ ] GitHub Pages が有効化されているか確認
- [ ] ブランチが「main」に設定されているか
- [ ] デプロイが完了しているか（Actions タブ）
- [ ] ブラウザのキャッシュをクリア

### DNS設定がうまくいかない場合

- [ ] DNS反映には最大48時間かかることを確認
- [ ] DNS設定ツール（[MXToolbox](https://mxtoolbox.com/)など）で設定を確認
- [ ] ドメインレジストラのサポートに連絡

---

## 次のステップ

1. ✅ 本番サイト完成
2. ✅ 自動デプロイ機能動作確認
3. クライアント引き継ぎ
4. マニュアル提供
5. 旧サーバー解約

---

## サポート

何かわからないことがあれば、以下をご参照ください：

- [Astro ドキュメント](https://docs.astro.build/)
- [microCMS ドキュメント](https://microcms.io/docs)
- [GitHub Pages ドキュメント](https://pages.github.com/)
