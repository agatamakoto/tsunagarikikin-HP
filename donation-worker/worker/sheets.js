/**
 * Googleスプレッドシート「寄付者台帳_全自動版」への自動追記
 * - サービスアカウントのJSON（env.GOOGLE_SA_JSON）でJWTを作り、アクセストークンを取得
 * - 寄付日の年度（4月〜翌3月）のタブ「〇〇〇〇年度」に1行追記する
 * - 追記に失敗しても決済・KV記録には影響させない（握りつぶす）
 */

export async function appendDonationRow(env, donor, txnId) {
  if (!env.GOOGLE_SA_JSON || !env.GOOGLE_SHEET_ID) return;
  try {
    const sa = JSON.parse(env.GOOGLE_SA_JSON);
    const token = await getAccessToken(sa);
    const tab = fiscalYearTab();
    const range = `'${tab}'!A:V`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [donorToRow(donor, txnId)] }),
    });
  } catch (e) { /* シート追記失敗はKVに残っているので握りつぶす */ }
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = b64url(utf8(JSON.stringify(header))) + "." + b64url(utf8(JSON.stringify(claim)));
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, utf8(unsigned));
  const jwt = unsigned + "." + b64url(new Uint8Array(sig));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("token error: " + JSON.stringify(data));
  return data.access_token;
}

async function importPrivateKey(pem) {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

function utf8(s) { return new TextEncoder().encode(s); }
function b64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
