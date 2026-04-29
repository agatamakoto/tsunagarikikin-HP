# DNS設定ガイド（escf.jpの切り替え）

現在のサイトから新しいGitHub Pagesベースのサイトへ、ドメイン（escf.jp）を切り替える手順です。

## 前提条件

- GitHub Pagesの設定が完了している
- リポジトリが公開状態
- メールアドレスの確認が済んでいる

## ステップ 1: GitHub Pagesの設定

1. GitHubリポジトリの Settings → Pages へ
2. Source が「Deploy from a branch」になっていることを確認
3. Branch を「main」に設定
4. Folder を「/(root)」に設定

## ステップ 2: GitHub Pages上でのカスタムドメイン設定

1. Settings → Pages → Custom domain
2. 「escf.jp」を入力
3. 「Save」をクリック
   - 自動的に `CNAME` ファイルが作成されます

## ステップ 3: DNS設定（ドメインレジストラで実施）

escf.jpを管理しているドメインレジストラ（おそらく お名前.com など）で、以下のDNS設定を変更してください：

### 設定内容

#### A レコード（IPv4）
以下の4つのIPアドレスをAレコードに追加：
- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

#### CNAME レコード（サブドメイン）
- Name: `www`
- Value: `YOUR_GITHUB_USERNAME.github.io`

例：
- Name: `www`
- Value: `sketm.github.io`

### 各レジストラでの設定方法

#### お名前.com の場合
1. お名前.comにログイン
2. 「ドメイン一覧」→ 「escf.jp」を選択
3. 「DNS設定」→ 「DNS A/MXレコード設定」
4. 上記のAレコード4つを追加
5. CNAME設定で「www」→ `YOUR_GITHUB_USERNAME.github.io` を追加

#### ムームードメイン の場合
1. ムームードメインにログイン
2. 「コントロールパネル」→ 「ドメイン一覧」
3. 「escf.jp」の「変更」をクリック
4. 「ネームサーバ設定変更」で、GitHubのネームサーバを設定
   または
5. 「MXレコード設定」でAレコードを手動設定

#### その他のレジストラ
- レジストラのサポートページで「GitHub Pages」や「カスタムドメイン」を検索
- 上記の4つのIPアドレスと、CNAMEレコードの情報を入力

## ステップ 4: DNS反映の確認

1. 以下のコマンドで DNS 設定を確認：
   ```bash
   nslookup escf.jp
   ```
   または
   ```bash
   dig escf.jp
   ```

2. 反映には **最大 48 時間** かかることがあります

3. [https://escf.jp](https://escf.jp) にアクセスしてサイトが表示されるか確認

## ステップ 5: HTTPS有効化（自動）

GitHub PagesはHTTPSを自動的に有効化します。

1. Settings → Pages → Enforce HTTPS
2. このオプションを有効化
3. サイトが HTTPS で安全に動作することを確認

## トラブルシューティング

### サイトが表示されない場合
- DNS設定が反映されるまで待つ（最大48時間）
- GitHub Settings → Pages で「Custom domain」が正しく設定されているか確認
- ブラウザのキャッシュをクリア（Ctrl+Shift+Delete）

### www.escf.jpは動作するがescf.jpは動作しない場合
- Aレコードが正しく設定されているか確認
- DNS プロバイダのサポートに連絡

### HTTPSエラーが表示される場合
- DNS反映完了後、GitHub側で証明書を自動生成するまで待つ（数時間）
- Settings → Pages で「Enforce HTTPS」を有効化

## 旧サーバーの解約

新しいサイトが正常に動作することを確認してから：

1. DNS設定が新しいサーバーを向いていることを確認
2. 旧サーバーへのアクセスがないことを確認（アナリティクスで確認）
3. 旧サーバーをシャットダウン・解約

## 参考

- [GitHub Pages のカスタムドメイン設定](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [DNS設定確認ツール](https://mxtoolbox.com/)
