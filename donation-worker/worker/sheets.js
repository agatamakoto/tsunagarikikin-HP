/**
 * 寄付者台帳（Googleスプレッドシート）への自動追記
 * - スプレッドシートに仕込んだ Google Apps Script の Web App へ、寄付1件分の行データをPOSTする
 * - サービスアカウント/GCP不要（組織ポリシーの影響を受けない）
 * - 追記に失敗しても決済・KV記録には影響させない（握りつぶす）
 *
 * 必要な設定（secret）：
 *   - SHEETS_WEBHOOK_URL    : Apps Script Web App のURL（/exec で終わるもの）
 *   - SHEETS_WEBHOOK_SECRET : Apps Script側と一致させる合言葉（なりすまし防止）
 */

export async function appendDonationRow(env, donor, txnId) {
  if (!env.SHEETS_WEBHOOK_URL) return;
  try {
    await fetch(env.SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.SHEETS_WEBHOOK_SECRET || "",
        fiscalYear: fiscalYearTab(),
        row: donorToRow(donor, txnId),
      }),
    });
  } catch (e) { /* 追記失敗はKVに残っているので握りつぶす */ }
}

// 4月始まりの年度タブ名（例：2026年4月〜2027年3月 → "2026年度"）
function fiscalYearTab(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const fy = m >= 4 ? y : y - 1;
  return fy + "年度";
}

function jstDate(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

function genderLabel(g) { return { male: "男性", female: "女性", other: "その他" }[g] || ""; }
function referralLabel(r) {
  return {
    homepage: "ホームページ", sns: "SNS", introduction: "知人・関係者の紹介",
    event: "イベント・説明会", press: "新聞・報道", other: "その他",
  }[r] || "";
}

// 台帳の22列に対応した1行を作る
function donorToRow(d, txnId) {
  const isCorp = d.entityType === "corporate";
  const anon = !!d.anonymous;
  const houhou = d.donationType === "onetime" ? "都度" : (d.billingCycle === "year" ? "年額" : "マンスリー");
  return [
    jstDate(),                                                 // 日付
    isCorp ? "法人" : "個人",                                   // 種別
    houhou,                                                    // 寄付方法
    d.purpose || "財団運営",                                   // 使いみち
    anon ? "はい" : "いいえ",                                   // 匿名
    isCorp ? (d.companyName || "") : (anon ? "" : (d.name || "")),   // 氏名／法人名
    isCorp ? (d.companyKana || "") : (anon ? "" : (d.kana || "")),   // フリガナ
    isCorp ? (d.contactName || "") : "",                       // ご担当者名（法人）
    isCorp ? (d.contactKana || "") : "",                       // ご担当者フリガナ（法人）
    isCorp ? (d.department || "") : "",                        // ご担当者部署・役職（法人）
    (!isCorp && !anon) ? genderLabel(d.gender) : "",           // 性別（個人）
    (!isCorp && !anon) ? (d.birthdate || "") : "",             // 生年月日（個人）
    d.amount,                                                  // 金額
    d.email || "",                                             // メールアドレス
    anon ? "" : (d.phone || ""),                               // 電話番号
    anon ? "" : (d.zip || ""),                                 // 郵便番号
    anon ? "" : (d.prefecture || ""),                          // 都道府県
    anon ? "" : (d.address || ""),                             // 住所
    anon ? "" : (d.mailingAddress || ""),                      // 郵送先
    (!anon && d.publicity === "yes") ? "掲載可" : "掲載しない",  // 広報物掲載
    referralLabel(d.referral),                                 // 認知経路
    txnId,                                                     // 受付ID
  ];
}
