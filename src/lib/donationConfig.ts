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
