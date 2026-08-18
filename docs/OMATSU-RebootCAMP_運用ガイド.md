# OMATSU-RebootCAMP ページ 運用ガイド

`escf.jp/projects/Omatsu-RebootCAMP/` 配下のページの追加・編集手順です。
STUDIO（`omatsu-reboot-camp.studio.site`）のデザインを再現して移設したものです。

---

## 1. ファイルの場所

```
src/lib/omatsu.ts                                  ← 記事の一覧データ・共通設定
src/layouts/OmatsuLayout.astro                     ← ヘッダー/フッター/デザイン定義
src/layouts/OmatsuArticleLayout.astro              ← 参加自治会（お祭り）記事のガワ
src/layouts/OmatsuNewsLayout.astro                 ← お知らせ記事のガワ
src/layouts/OmatsuInterviewLayout.astro            ← 協賛企業インタビューのガワ
src/pages/projects/Omatsu-RebootCAMP/
├── index.astro                                    ← トップ
├── about.astro                                    ← プログラムについて
├── sponsor.astro                                  ← 協賛企業
├── entry.astro                                    ← エントリーフォーム
├── project/
│   ├── index.astro                                ← お祭り一覧
│   └── _template.astro                            ← ★記事のひな形（公開されない）
├── interview/
│   ├── yada-denki.astro                           ← 協賛企業インタビュー
│   ├── toshin-giken.astro
│   └── _template.astro                            ← ★記事のひな形（公開されない）
└── news/
    ├── index.astro                                ← お知らせ一覧
    └── _template.astro                            ← ★記事のひな形（公開されない）
```

> ファイル名の先頭が `_` のものはページとして公開されません。ひな形置き場です。

---

## 2. 参加自治会（お祭り）の記事を追加する

### 手順

**① ひな形をコピーする**

`src/pages/projects/Omatsu-RebootCAMP/project/_template.astro` をコピーし、
同じフォルダに **半角英数字とハイフンだけ**の名前で保存します。

```
例: sample-jichikai.astro
→ 公開URL: https://escf.jp/projects/Omatsu-RebootCAMP/project/sample-jichikai
```

**② 冒頭の項目を書き換える**

```astro
<OmatsuArticleLayout
  title="〇〇神社秋季例大祭"        ← お祭りの名前（ページ見出しになる）
  organization="〇〇自治会"          ← 主催する自治会・運営組織
  area="愛媛県西条市〇〇"            ← 開催地
  period="2026年10月中旬（予定）"    ← 開催時期
  status="募集中"                    ← 募集中 / 募集準備中 / 募集終了
  capacity="1〜3名程度"              ← 省略可
  fee="無料"                         ← 省略すると「無料（交通費・宿泊費は自己負担）」
  summary="一覧カードに出す短い紹介文"
>
```

**③ 本文をHTMLで書く**

`>` から `</OmatsuArticleLayout>` の間が本文です。普通のHTMLがそのまま使えます。

| 書きたいもの | タグ |
|---|---|
| 大見出し（青い縦線つき） | `<h2>見出し</h2>` |
| 小見出し（青文字） | `<h3>見出し</h3>` |
| 本文 | `<p>本文</p>` |
| 箇条書き | `<ul><li>項目</li></ul>` |
| 番号つきリスト | `<ol><li>項目</li></ol>` |
| 表 | `<table><tr><th>見出し</th><td>内容</td></tr></table>` |
| 引用・地域の声 | `<blockquote><p>コメント</p></blockquote>` |
| リンク | `<a href="/...">リンク文字</a>` |

見た目は自動で整うので、CSSを書く必要はありません。

**④ 一覧に載せる**

`src/lib/omatsu.ts` の `projects` 配列に1行足します。ここに書いたものが
トップページとお祭り一覧ページのカードになります。

```ts
export const projects: OmatsuProject[] = [
  {
    slug: 'sample-jichikai',           // ← ②で付けたファイル名（.astroは除く）
    title: '〇〇神社秋季例大祭',
    organization: '〇〇自治会',
    area: '愛媛県西条市〇〇',
    period: '2026年10月中旬（予定）',
    summary: '150年続くだんじり運行の担い手を募集しています。',
    status: '募集中',
  },
];
```

> `slug` とファイル名が一致していないとリンク切れになります。ここだけ注意。

---

## 3. お知らせを追加する

やり方は同じです。

1. `news/_template.astro` をコピーして `news/2026-09-01-boshu-kaishi.astro` などの名前で保存
2. `title` / `date`（YYYY-MM-DD）/ `category` を書き換え、本文をHTMLで書く
3. `src/lib/omatsu.ts` の `news` 配列に1行足す

一覧は日付の新しい順に自動で並びます。

---

## 3-2. 協賛企業を追加する

`src/lib/omatsu.ts` の `sponsors` 配列に1行足すだけです。
**ゴールド → シルバー → ブロンズ の順**に自動で並びます。

```ts
export const sponsors: Sponsor[] = [
  {
    name: '矢田電気',
    tier: 'gold',                                   // gold / silver / bronze
    logo: '/images/omatsu/sponsors/yada-denki.png', // 未設定なら仮枠が出ます
    url: 'https://example.com/',                    // 企業サイト（任意）
    interviewSlug: 'yada-denki',                    // インタビュー記事がある場合
  },
];
```

ロゴは階級が上ほど大きく表示されます（ゴールド420px／シルバー320px／ブロンズ220px枠）。
その階級の登録が0件のときは「現在、募集中です。」と表示されます。

## 3-3. 協賛企業インタビューを追加する

> **現在インタビューは非表示です。**
> `src/lib/omatsu.ts` の `interviews` 配列が空のあいだは、協賛企業ページの
> 「INTERVIEW」欄も、ロゴ下の「インタビューを読む →」リンクも表示されません。
> 記事を1件登録すると自動的に現れます。

矢田電気さま・東新技研さまの記事は、質問の枠組みだけ作った下書きが
`interview/_yada-denki.astro` `interview/_toshin-giken.astro` にあります。

**① 記事本体を公開状態にする**

下書きファイル名の**先頭の「_」を外します**（`_` 付きはビルドされません）。

```
_yada-denki.astro  →  yada-denki.astro
```

新しく作る場合は `interview/_template.astro` をコピーして
`interview/<slug>.astro` として保存し、`slug` と `lead` を書き換えます。
本文は質問と回答をHTMLで書きます。

- 質問は `<h3>` （頭に「―」が自動で付きます）
- 回答は `<p>`
- 強調したい一言は `<blockquote>` （大きな文字で目立ちます）

**② 一覧カードに載せる**

`src/lib/omatsu.ts` の `interviews` 配列のコメントを外して編集します。

```ts
export const interviews: OmatsuInterview[] = [
  {
    slug: 'yada-denki',                    // ①のファイル名と一致させる
    company: '㈲矢田電気さま',
    tier: 'gold',
    title: '記事のタイトル',                // カードの見出しになります
    summary: 'カードに出す短い紹介文',      // 任意
    thumbnail: '/images/omatsu/interviews/yada-denki.jpg', // 未設定なら仮枠
    date: '2026-09-01',                    // 任意
  },
];
```

これだけで、協賛企業ページにインタビュー欄が復活し、サムネイル＋階級バッジ付きの
カードが2列で並びます。クリックすると詳細ページに飛びます。

## 3-4. トップページのYouTubeショートを追加する

トップページのPROJECTとENTRYの間にある「インタビュー」の帯です。
`src/lib/omatsu.ts` の `shorts` 配列に、動画IDとタイトルを1行足すだけです。

```ts
export const shorts: OmatsuShort[] = [
  { id: 'Owo58dfGIrE', title: 'プロジェクトにかける想い' },
];
```

動画IDは YouTubeのURL `youtube.com/shorts/XXXXXXXXXXX` の末尾11文字です。

- サムネイルはYouTubeから自動で取得します（画像の用意は不要）
- **表示順はページを開くたびにランダム**に入れ替わります
- 左から右へ自動で流れ、マウスを乗せると止まります
- クリックするとその場で再生されます

## 4. 写真を入れる

現在、写真の入る場所は**仮の枠（斜線の点線ボックス）**で表示されています。

### 手順

1. 画像を `public/images/omatsu/` に置く（フォルダがなければ作る）
2. 該当箇所の仮枠を `<img>` に差し替える

**差し替え前**

```html
<div class="om-ph" style="aspect-ratio: 16 / 9;">
  <span>メインビジュアル<span class="note">お祭りの様子</span></span>
</div>
```

**差し替え後**

```html
<img src="/images/omatsu/main-visual.jpg" alt="〇〇祭りでだんじりを担ぐ参加者" />
```

`alt` には写真の内容を短く書いてください（検索対策と読み上げ対応のため）。

### 必要な写真の一覧

| 場所 | 状態 | 推奨サイズ |
|---|---|---|
| ヘッダーのロゴ | ✅ `logo/logo-horizontal.png` | — |
| フッターのロゴ（白ヌキ） | ✅ `logo/logo-horizontal-white.png` | — |
| トップのメインビジュアル | ✅ `hero/01〜06.jpg`（6枚を入れ替え表示） | 1600×900 |
| トップのABOUT横・aboutページ | ✅ `program/program.jpg` | 1280×960（4:3） |
| 各お祭り記事の写真（大師町・大谷・本郷） | ✅ 配置済み | — |
| 協賛企業のロゴ（18社） | ✅ `sponsors/` に配置済み | — |
| インタビューのサムネイル | ⬜ 未 | 1280×800（16:10） |
| インタビューのメイン写真 | ⬜ 未 | 1600×900 |

### メインビジュアルの写真を入れ替える

`public/images/omatsu/hero/` に画像を置き、`src/lib/omatsu.ts` の
`HERO_IMAGES` に1行足すだけです。**ページを開くたびに順番がランダムになり、
5.5秒ごとにゆっくり切り替わります**（ゆっくり拡大するアニメーション付き）。
枚数は何枚でも構いません。他のタブを見ているあいだは切り替えが止まります。

写真は16:9で中央をトリミングして使うので、被写体が中央寄りのものが向いています。

ロゴの縦組み版（タグライン付き）も `logo/logo-vertical.png` に置いてあります。
SNSのOGP画像や印刷物に使えます。3点とも背景は透過処理済みです。

> トップページのYouTubeショートのサムネイルは、YouTubeから自動取得するため用意不要です。

---

## 5. エントリーフォームについて

### 届く先

エントリーが送信されると、**info@escf.jp に申込内容がメールで届きます**。
そのメールに返信すると、応募者ご本人に直接返信できます（Reply-Toを応募者に設定しています）。
応募者にも自動で受付確認メールが届きます。

台帳は事務局側で手作業で作成する運用のため、システム側には保存していません。

### 「参加を希望するお祭り」の選択肢

`src/lib/omatsu.ts` の `projects` に登録したお祭りが**自動で並びます**。
表記は「**自治会名_お祭り名**」に統一されます（例：田滝自治会_おれん踊り）。
募集終了にしたものは選択肢から自動で消えます。

お祭りの記事ページから「このお祭りに参加する」で遷移した場合は、
そのお祭りが最初から選ばれた状態になります。

### 仕組み

寄付システムと同じ Cloudflare Worker の `/omatsu-entry` にJSONでPOSTしています。

- Worker側：`donation-worker/worker/index.js` の `handleOmatsuEntry`
- 送信先URL：`src/lib/omatsu.ts` の `ENTRY_ENDPOINT`
- メール送信にはResendを使用（`RESEND_API_KEY` は設定済み）

**Workerを変更したら `wrangler deploy` が必要です。**
`ENTRY_ENDPOINT` を空文字にすると「フォーム準備中」の表示に戻ります。

---

## 6. 公開するまで

```bash
npm run dev
```

でローカル確認（`http://localhost:4321/projects/Omatsu-RebootCAMP`）。
問題なければ `master` に push すると GitHub Actions が動いて自動で公開されます。
