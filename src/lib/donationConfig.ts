// =====================================================================
// 寄付フォーム設定 — ここの2つを書き換えるだけで全フォームに反映されます
//
//  PAYJP_PUBLIC_KEY : Pay.jp の「公開鍵」
//     - テスト中は pk_test_… / 本番公開時に pk_live_… に差し替え
//     - 公開鍵はブラウザに出るのが前提の鍵なので、ここに書いて公開して問題ありません
//     - 【重要】「秘密鍵 sk_…」は絶対にここに書かないでください（Worker側のsecretのみ）
//
//  DONATION_API_URL : 継続課金を処理する Cloudflare Worker の URL
//     - donation-worker/ をデプロイすると発行されるURL
// =====================================================================

export const PAYJP_PUBLIC_KEY = "pk_live_8b1b10e699203c0f6c7f10ac";
export const DONATION_API_URL = "https://saijo-monthly-donation.agata-a57.workers.dev";

// =====================================================================
// 銀行振込（都度寄付）の振込先口座
//   - 都度寄付フォームで「銀行振込」を選ぶと、この内容が画面とメールに表示されます
//   - 同じ内容を donation-worker/worker/wrangler.toml の [vars] にも設定してください
//     （サイトの表示＝こちら、振込案内メールの本文＝wrangler.toml 側）
//   - accountHolder（カナ）は空にすると表示されません。
//     ネットバンキングでの振込時に使われるため、通帳・口座情報の表記どおりに設定してください。
// =====================================================================
export const BANK_TRANSFER = {
  bankName: "GMOあおぞらネット銀行",
  branchName: "法人第二営業部",
  accountType: "普通",
  accountNumber: "1877830",
  accountHolder: "ザイ)エヒメサイジヨウツナガリキキン",
  accountHolderKanji: "公益財団法人えひめ西条つながり基金",
  note: "振込手数料はご負担いただきますようお願いいたします。",
};
