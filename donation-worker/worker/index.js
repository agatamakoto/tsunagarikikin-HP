/**
 * えひめ西条つながり基金 マンスリー会員（継続課金）Worker
 *
 * 役割：フロント(donate.html=個人 / donate-corporate.html=法人)から申込データを受け取り、
 *   1) Pay.jp に顧客(Customer)を作成（カードを登録）
 *   2) その金額の月額プラン(Plan)を用意（無ければ作成）
 *   3) 継続課金(Subscription)を作成
 *   4) 寄付者情報（氏名・住所等、寄付金控除の証明書発行に使う情報）を KV に記録
 *
 * entityType: "individual"（個人） | "corporate"（法人）
 * 個人はさらに anonymous: true で匿名寄付（氏名・住所を受け取らない・領収書なし）に対応。
 *
 * 必要な設定（wrangler.toml / secret）：
 *   - PAYJP_SECRET_KEY : Pay.jpのシークレット鍵（sk_test_… / sk_live_…）… secretで登録
 *   - ALLOW_ORIGIN     : フォームを置くサイトのオリジン（例 https://tsunagi-saijo.org）
 *   - DONORS (推奨)    : 寄付者記録用のKV Namespace（無くても決済は動くが、名簿・領収書用データが残らない）
 */

import { buildReceiptPdf, makeReceiptNo } from "./receipt.js";
import { appendDonationRow } from "./sheets.js";

export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // ===== 寄付者本人によるマイページ（定期寄付の確認・解約） =====
    // ref = サブスクリプションID。このIDを知っている（＝申込時の本人メールに届いた）人だけが操作できる。
    if (url.pathname === "/manage-info" && request.method === "GET") {
      return handleManageInfo(url.searchParams.get("ref"), env, cors);
    }
    if (url.pathname === "/manage-cancel" && request.method === "POST") {
      let cbody;
      try { cbody = await request.json(); } catch { return json({ error: "invalid json" }, 400, cors); }
      return handleManageCancel(cbody.ref, env, cors);
    }

    // ===== Pay.jp からの通知（Webhook） =====
    // 継続寄付の2回目以降はPay.jpが自動で課金するため、このWorkerは呼ばれない。
    // その更新分を台帳に残すため、Pay.jpからの通知を受けてここで追記する。
    if (url.pathname === "/payjp-webhook" && request.method === "POST") {
      return handlePayjpWebhook(request, env, ctx);
    }

    // ===== OMATSU-RebootCAMP 参加エントリーの受付 =====
    // フォームの内容を事務局(info@escf.jp)にメールで転送し、応募者には受付確認を返す。
    // 台帳は事務局が手作業で作成するため、ここでは保存しない。
    if (url.pathname === "/omatsu-entry" && request.method === "POST") {
      let ebody;
      try { ebody = await request.json(); } catch { return json({ error: "invalid json" }, 400, cors); }
      return handleOmatsuEntry(ebody, env, ctx, cors);
    }

    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400, cors); }

    const entityType = body.entityType === "corporate" ? "corporate" : "individual";
    const anonymous = entityType === "individual" && !!body.anonymous;
    const donationType = body.donationType === "onetime" ? "onetime" : "recurring"; // 継続 or 単発
    const billingCycle = body.billingCycle === "year" ? "year" : "month"; // 個人は月額のみ、法人は月額/年額
    // 支払い方法：銀行振込は「都度寄付」のみ対応（継続寄付はカードのみ）
    const paymentMethod = (body.paymentMethod === "bank" && donationType === "onetime") ? "bank" : "card";
    const token = body.token;
    const amount = parseInt(body.amount, 10);
    const email = str(body.email, 200);

    // 銀行振込はこの時点で決済しないためカードトークンは不要
    if (paymentMethod === "card" && !token) return json({ error: "カード情報がありません" }, 400, cors);
    if (!Number.isInteger(amount) || amount < 1000 || amount > 1000000)
      return json({ error: "金額は1,000円〜1,000,000円で指定してください" }, 400, cors);
    if (!email) return json({ error: "メールアドレスを入力してください" }, 400, cors);
    // 銀行振込は振込名義が当基金に通知されるため、匿名では受け付けない（受領証の発行にも氏名・住所が必要）
    if (paymentMethod === "bank" && anonymous)
      return json({ error: "銀行振込では匿名でのお申込みはお受けできません" }, 400, cors);

    // ---- 属性ごとの入力整形 ----
    // 使いみち：継続寄付（マンスリー・年額）は常に「財団運営」固定。都度寄付のみフォームで選択可。
    const purpose = donationType === "onetime" ? (str(body.purpose, 100) || "財団運営") : "財団運営";
    let donor = { entityType, anonymous, donationType, billingCycle, paymentMethod, purpose, amount, email };
    let displayName;

    if (entityType === "corporate") {
      donor.companyName = str(body.companyName, 100);
      donor.companyKana = str(body.companyKana, 100);
      donor.contactName = str(body.contactName, 100);
      donor.contactKana = str(body.contactKana, 100);
      donor.department = str(body.department, 100);
      donor.phone = str(body.phone, 30);
      donor.zip = str(body.zip, 10);
      donor.prefecture = str(body.prefecture, 10);
      donor.address = str(body.address, 200);
      donor.mailingAddress = str(body.mailingAddress, 300);
      donor.publicity = body.publicity === "yes" ? "yes" : "no";
      donor.referral = str(body.referral, 50);

      if (!donor.companyName || !donor.companyKana) return json({ error: "法人名・フリガナを入力してください" }, 400, cors);
      if (!donor.contactName || !donor.contactKana) return json({ error: "ご担当者名・フリガナを入力してください" }, 400, cors);
      if (!donor.phone) return json({ error: "電話番号を入力してください" }, 400, cors);
      if (!donor.zip || !donor.prefecture || !donor.address) return json({ error: "所在地を入力してください" }, 400, cors);

      displayName = donor.companyName;
    } else if (!anonymous) {
      donor.name = str(body.name, 100);
      donor.kana = str(body.kana, 100);
      donor.gender = str(body.gender, 10);
      donor.birthdate = str(body.birthdate, 10);
      donor.phone = str(body.phone, 30);
      donor.zip = str(body.zip, 10);
      donor.prefecture = str(body.prefecture, 10);
      donor.address = str(body.address, 200);
      donor.mailingAddress = str(body.mailingAddress, 300);
      donor.publicity = body.publicity === "yes" ? "yes" : "no";
      donor.referral = str(body.referral, 50);

      if (!donor.name || !donor.kana) return json({ error: "お名前・フリガナを入力してください" }, 400, cors);
      if (!donor.phone) return json({ error: "電話番号を入力してください" }, 400, cors);
      if (!donor.zip || !donor.prefecture || !donor.address) return json({ error: "ご住所を入力してください" }, 400, cors);

      displayName = donor.name;
    } else {
      // 匿名寄付：氏名・住所は受け取らない。領収書は発行しない。
      donor.publicity = "no";
      displayName = "匿名希望";
    }

    // ===== 銀行振込（都度寄付）: この時点では決済しない =====
    // 入金はあとから銀行口座に着金するため、ここでは「お申込みの受付」のみを行う。
    // 受領証・税額控除証明書は、事務局が入金を確認したあとに発行する（未入金の証明書を出さないため）。
    if (paymentMethod === "bank") {
      const reference = makeBankReference();
      donor.status = "入金待ち";

      if (env.DONORS) {
        try {
          await env.DONORS.put("bank:" + reference, JSON.stringify({
            reference,
            ...donor,
            createdAt: new Date().toISOString(),
          }));
        } catch (e) { /* 記録失敗でも申込自体は受け付ける */ }
      }
      ctx.waitUntil(sendThanks(env, { donor, kind: "bank", amount, reference }));
      ctx.waitUntil(appendDonationRow(env, donor, reference));
      return json({ ok: true, reference }, 200, cors);
    }

    if (!env.PAYJP_SECRET_KEY) return json({ error: "サーバー設定エラー（鍵未設定）" }, 500, cors);
    const payjp = makePayjp(env.PAYJP_SECRET_KEY);

    // ===== 単発寄付（都度寄付）: 顧客・定期課金を作らず、その場で1回だけ課金 =====
    if (donationType === "onetime") {
      const chargeParams = {
        amount,
        currency: "jpy",
        card: token,
        description: "都度寄付" + (anonymous ? "(匿名)" : "") + ": " + displayName,
        "metadata[entityType]": entityType,
        "metadata[anonymous]": anonymous ? "true" : "false",
        "metadata[donationType]": "onetime",
      };
      if (!anonymous) chargeParams["metadata[name]"] = displayName;

      const charge = await payjp("/charges", chargeParams);
      if (!charge.ok) return json({ error: "決済に失敗しました", detail: charge.data.error || charge.data }, 400, cors);

      if (env.DONORS) {
        try {
          await env.DONORS.put("charge:" + charge.data.id, JSON.stringify({
            chargeId: charge.data.id,
            ...donor,
            createdAt: new Date().toISOString(),
          }));
        } catch (e) { /* 記録失敗でも決済自体は成立しているので握りつぶす */ }
      }
      ctx.waitUntil(sendThanks(env, { donor, kind: "onetime", amount }));
      ctx.waitUntil(appendDonationRow(env, donor, charge.data.id));
      return json({ ok: true, chargeId: charge.data.id }, 200, cors);
    }

    // ===== 継続寄付（マンスリー／年額）: 顧客＋プラン＋定期課金 =====
    // 1) 顧客を作成（カードを登録）
    // Pay.jp customer の metadata は個人情報を最小限に留め、詳細はKVの寄付者記録側で保持する。
    const custParams = {
      email,
      card: token,
      description: (billingCycle === "year" ? "年額サポーター" : "マンスリーサポーター")
        + (entityType === "corporate" ? "(法人)" : anonymous ? "(匿名)" : "") + ": " + displayName,
      "metadata[entityType]": entityType,
      "metadata[anonymous]": anonymous ? "true" : "false",
      "metadata[billingCycle]": billingCycle,
    };
    if (!anonymous) custParams["metadata[name]"] = displayName;

    const cust = await payjp("/customers", custParams);
    if (!cust.ok) return json({ error: "カード登録に失敗しました", detail: cust.data.error || cust.data }, 400, cors);

    // 2) プランを用意（課金間隔×金額ごとに monthly_<金額> / yearly_<金額> というIDで使い回す）
    const planId = (billingCycle === "year" ? "yearly_" : "monthly_") + amount;
    const planName = (billingCycle === "year" ? "年額寄付 " + amount + "円/年" : "マンスリー寄付 " + amount + "円/月");
    const created = await payjp("/plans", {
      amount,
      currency: "jpy",
      interval: billingCycle, // "month" | "year"
      id: planId,
      name: planName,
    });
    if (!created.ok) {
      // 既に存在する場合はそれを使う。無ければ本当の失敗。
      const exists = await payjp("/plans/" + planId, null, "GET");
      if (!exists.ok) return json({ error: "プラン設定に失敗しました", detail: created.data.error || created.data }, 400, cors);
    }

    // 3) 継続課金を作成
    const sub = await payjp("/subscriptions", { customer: cust.data.id, plan: planId });
    if (!sub.ok) return json({ error: "定期課金の作成に失敗しました", detail: sub.data.error || sub.data }, 400, cors);

    // 4) 寄付者記録を KV に保存（寄付者名簿・行政提出用台帳・将来の領収書発行のもとになるデータ）
    if (env.DONORS) {
      try {
        await env.DONORS.put("sub:" + sub.data.id, JSON.stringify({
          subscriptionId: sub.data.id,
          customerId: cust.data.id,
          ...donor,
          createdAt: new Date().toISOString(),
        }));
      } catch (e) { /* 記録失敗でも決済自体は成立しているので握りつぶす */ }
    }

    ctx.waitUntil(sendThanks(env, { donor, kind: billingCycle === "year" ? "yearly" : "monthly", amount, subscriptionId: sub.data.id }));
    ctx.waitUntil(appendDonationRow(env, donor, sub.data.id));
    return json({ ok: true, subscriptionId: sub.data.id, customerId: cust.data.id }, 200, cors);
  },
};

// ===== OMATSU-RebootCAMP エントリーの受付 =====
// 受け取った内容を事務局(info@escf.jp)にメール転送する。応募者には受付確認メールを返す。
// 応募者データの保存はしない（台帳は事務局が手作業で作成する運用）。
const OMATSU_OFFICE_TO = "info@escf.jp";

// 生年月日・性別・住所は、参加者を対象とする傷害保険の加入手続きに必要な項目。
// 当財団と参加先の自治会・お祭り運営組織で共同利用する旨をフォームで明示し、同意を得ている。
const OMATSU_ENTRY_FIELDS = [
  { key: "project", label: "参加希望のお祭り", max: 200, required: true },
  { key: "name", label: "お名前", max: 100, required: true },
  { key: "kana", label: "フリガナ", max: 100, required: true },
  { key: "birthdate", label: "生年月日", max: 20, required: true },
  { key: "age", label: "年齢", max: 10 },
  { key: "gender", label: "性別", max: 20, required: true },
  { key: "address", label: "住所", max: 200, required: true },
  { key: "email", label: "メールアドレス", max: 200, required: true },
  { key: "tel", label: "電話番号", max: 40, required: true },
  { key: "experience", label: "お祭りへの参加経験", max: 100 },
  { key: "motivation", label: "参加を希望する理由", max: 4000, required: true },
  { key: "note", label: "その他・ご質問", max: 4000 },
];

async function handleOmatsuEntry(body, env, ctx, cors) {
  const entry = {};
  for (const f of OMATSU_ENTRY_FIELDS) {
    entry[f.key] = str(body[f.key], f.max);
  }

  // 必須項目のチェック
  const missing = OMATSU_ENTRY_FIELDS.filter((f) => f.required && !entry[f.key]).map((f) => f.label);
  if (missing.length) {
    return json({ error: "未入力の項目があります：" + missing.join("、") }, 400, cors);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry.email)) {
    return json({ error: "メールアドレスの形式が正しくありません" }, 400, cors);
  }
  if (!body.agree) {
    return json({ error: "個人情報保護方針への同意が必要です" }, 400, cors);
  }
  if (!env.RESEND_API_KEY) {
    return json({ error: "現在フォームをご利用いただけません。お手数ですがメールにてご連絡ください。" }, 503, cors);
  }

  const receivedAt = jstDateTimeString();

  // --- 事務局宛の通知メール ---
  const rows = OMATSU_ENTRY_FIELDS
    .filter((f) => entry[f.key])
    .map(
      (f) =>
        `<tr><th align="left" style="padding:8px 12px;background:#f6f6f6;white-space:nowrap;vertical-align:top;">${escapeHtml(f.label)}</th>` +
        `<td style="padding:8px 12px;">${escapeHtml(entry[f.key]).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");

  const officeHtml =
    `<p>OMATSU-RebootCAMPの参加エントリーがありました。</p>` +
    `<p>受付日時：${escapeHtml(receivedAt)}</p>` +
    `<table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">${rows}</table>` +
    `<p style="font-size:13px;color:#666;">※このメールに返信すると応募者ご本人に届きます。</p>`;

  const officeText =
    "OMATSU-RebootCAMPの参加エントリーがありました。\n" +
    "受付日時：" + receivedAt + "\n\n" +
    OMATSU_ENTRY_FIELDS.filter((f) => entry[f.key])
      .map((f) => f.label + "：" + entry[f.key])
      .join("\n");

  const officeSent = await sendResendMail(env, {
    to: [OMATSU_OFFICE_TO],
    replyTo: entry.email,
    subject: `【OMATSU-RebootCAMP】参加エントリー：${entry.name}様（${entry.project}）`,
    html: officeHtml,
    text: officeText,
  });

  // 事務局に届かなければ受付できたことにしない
  if (!officeSent) {
    return json({ error: "送信に失敗しました。時間をおいて再度お試しください。" }, 502, cors);
  }

  // --- 応募者宛の受付確認メール（失敗しても受付自体は成立させる） ---
  const applicantText =
    `${entry.name} 様\n\n` +
    "OMATSU-RebootCAMPへのエントリーをありがとうございます。\n" +
    "以下の内容で受け付けました。\n\n" +
    "――――――――――――――――――\n" +
    OMATSU_ENTRY_FIELDS.filter((f) => entry[f.key])
      .map((f) => f.label + "：" + entry[f.key])
      .join("\n") +
    "\n――――――――――――――――――\n\n" +
    "数日以内に事務局より、オンライン面談のご案内をお送りします。\n" +
    "今しばらくお待ちください。\n\n" +
    "※このメールは自動送信です。ご不明な点はこのままご返信ください。\n" +
    "※ご記入いただいた個人情報は、参加受付・保険の加入手続き・受け入れ地域との\n" +
    "　連絡調整の目的で、当財団と参加先の自治会・お祭り運営組織が共同で利用します。\n" +
    "　開示・訂正・削除のご請求は https://escf.jp/privacy の窓口で承ります。\n\n" +
    "――――――――――――――――――\n" +
    "OMATSU-RebootCAMP ～100年後も楽しめる地域をつくろう～\n" +
    "事務局：公益財団法人えひめ西条つながり基金\n" +
    "〒793-0030 愛媛県西条市大町1663番地\n" +
    "https://escf.jp/projects/Omatsu-RebootCAMP\n";

  ctx.waitUntil(
    sendResendMail(env, {
      to: [entry.email],
      replyTo: OMATSU_OFFICE_TO,
      subject: "【OMATSU-RebootCAMP】エントリーを受け付けました",
      html: `<pre style="font-family:sans-serif;font-size:14px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(applicantText)}</pre>`,
      text: applicantText,
    })
  );

  return json({ ok: true }, 200, cors);
}

// Resendでメールを1通送る。成功したら true。
async function sendResendMail(env, { to, replyTo, subject, html, text }) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "公益財団法人えひめ西条つながり基金 <info@escf.jp>",
        to,
        reply_to: replyTo,
        subject,
        html,
        text,
      }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function jstDateTimeString() {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // JST
  const p = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() + "年" + (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日 " +
    p(d.getUTCHours()) + ":" + p(d.getUTCMinutes())
  );
}

// ===== サンクスメール送信（Resend経由。RESEND_API_KEY をsecretで登録） =====
// 記名の寄付者には、受領証PDF（自動生成）＋税額控除に係る証明書PDFを添付する。
// 匿名寄付は氏名・住所を記載できないため、受領証は発行しない（本文のみ）。
async function sendThanks(env, { donor, kind, amount, subscriptionId, reference }) {
  if (!env.RESEND_API_KEY || !donor.email) return;
  const mail = buildThanksEmail({ donor, kind, amount, subscriptionId, reference, bank: bankInfo(env) });

  // 銀行振込はまだ入金されていないため、受領証・控除証明書は添付しない。
  // （事務局が着金を確認したうえで発行する）
  const attachments = [];
  if (kind !== "bank" && !donor.anonymous && env.DONORS) {
    try {
      const [fontBuf, certBuf] = await Promise.all([
        env.DONORS.get("asset:font-ipaex", "arrayBuffer"),
        env.DONORS.get("asset:tax-certificate", "arrayBuffer"),
      ]);
      if (fontBuf) {
        const receiptNo = makeReceiptNo();
        const issuedAt = jstDateString();
        const pdfBytes = await buildReceiptPdf({
          donor, kind, amount, receiptNo, issuedAt, fontBytes: fontBuf,
        });
        attachments.push({
          filename: `寄付金受領証_${receiptNo}.pdf`,
          content: bufferToBase64(pdfBytes),
        });
      }
      if (certBuf) {
        attachments.push({
          filename: "税額控除に係る証明書.pdf",
          content: bufferToBase64(new Uint8Array(certBuf)),
        });
      }
    } catch (e) { /* 添付生成に失敗しても本文メールは送る */ }
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "公益財団法人えひめ西条つながり基金 <info@escf.jp>",
        to: [donor.email],
        reply_to: "info@escf.jp",
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(attachments.length ? { attachments } : {}),
      }),
    });
  } catch (e) { /* 送信失敗は決済に影響させない */ }
}

function bufferToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function jstDateString() {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // JST
  return d.getUTCFullYear() + "年" + (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日";
}

// 銀行振込のお申込み番号。
// 振込依頼人名の欄はカナ・数字しか使えない銀行があるため、あえて数字だけで構成する。
function makeBankReference(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 3600 * 1000);
  const y = String(jst.getUTCFullYear()).slice(-2);
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${y}${m}${d}${rand}`;
}

// 振込先口座（wrangler.toml の [vars] で設定。未設定でもメール自体は送れるようにする）
function bankInfo(env) {
  return {
    bankName: env.BANK_NAME || "",
    branchName: env.BANK_BRANCH || "",
    accountType: env.BANK_ACCOUNT_TYPE || "普通",
    accountNumber: env.BANK_ACCOUNT_NUMBER || "",
    accountHolder: env.BANK_ACCOUNT_HOLDER || "",
    accountHolderKanji: env.BANK_ACCOUNT_HOLDER_KANJI || "公益財団法人えひめ西条つながり基金",
  };
}

function buildThanksEmail({ donor, kind, amount, subscriptionId, reference, bank }) {
  const anon = !!donor.anonymous;
  const isBank = kind === "bank";
  const isCorp = donor.entityType === "corporate";
  const name = isCorp ? donor.companyName : anon ? "" : donor.name;
  const greeting = anon ? "ご支援者様" : name + (isCorp ? " 御中" : " 様");
  const kindLabel = isBank ? "今回のみのご寄付（銀行振込）"
    : kind === "onetime" ? "今回のみのご寄付"
    : kind === "yearly" ? "年額サポーター（毎年）"
    : "マンスリーサポーター（毎月）";
  const yen = "¥" + Number(amount).toLocaleString();
  const date = jstDateString();
  const subject = isBank
    ? "【えひめ西条つながり基金】お振込先のご案内（お申込みありがとうございました）"
    : "【えひめ西条つながり基金】ご寄付ありがとうございました";
  const receiptNote = isBank
    ? "寄付金受領証および税額控除に係る証明書は、ご入金を確認したのちにお送りいたします。"
    : anon
      ? "匿名でのご寄付のため、寄付金受領証は発行いたしません。"
      : "寄付金受領証および税額控除に係る証明書は、追ってお送りいたします。";

  // 銀行振込：振込先のご案内ブロック
  const bankRows = isBank && bank ? [
    ["金融機関", [bank.bankName, bank.branchName].filter(Boolean).join("　")],
    ["口座種別", bank.accountType],
    ["口座番号", bank.accountNumber],
    ["口座名義", bank.accountHolderKanji + (bank.accountHolder ? "（" + bank.accountHolder + "）" : "")],
    ["お申込み番号", reference || ""],
  ].filter(([, v]) => v) : [];

  const bankText = isBank ? [
    "",
    "▼ お振込先",
    ...bankRows.map(([k, v]) => "　" + k + "：" + v),
    "",
    "お振込みの際は、お申込み番号またはお名前を振込依頼人名に入れていただけると確認がスムーズです。",
    "恐れ入りますが、振込手数料はご負担いただきますようお願いいたします。",
  ] : [];

  const bankHtml = isBank ? `
      <div style="margin:16px 0 0;padding:14px 16px;border:2px solid #FF9F3C;border-radius:12px;">
        <p style="margin:0 0 10px;font-weight:bold;font-size:14px;">お振込先</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${bankRows.map(([k, v], i) => `<tr><td style="padding:8px 0;color:#5a7080;width:7.5em;${i ? "border-top:1px solid #eef1f2;" : ""}">${escapeHtml(k)}</td><td style="padding:8px 0;font-weight:bold;${i ? "border-top:1px solid #eef1f2;" : ""}">${escapeHtml(v)}</td></tr>`).join("")}
        </table>
        <p style="margin:12px 0 0;font-size:12px;color:#5a7080;line-height:1.8;">お振込みの際は、<strong>お申込み番号またはお名前</strong>を振込依頼人名に入れていただけると確認がスムーズです。<br>恐れ入りますが、振込手数料はご負担いただきますようお願いいたします。</p>
      </div>` : "";
  const manageUrl = subscriptionId ? `https://escf.jp/donation/manage?ref=${encodeURIComponent(subscriptionId)}` : null;
  const manageNote = manageUrl
    ? "ご登録内容の確認・金額変更のご相談・解約は、下記のご本人専用ページから行えます。このURLは第三者に共有しないようご注意ください。"
    : null;

  const text = [
    greeting,
    "",
    isBank
      ? "このたびは、公益財団法人えひめ西条つながり基金へのご寄付をお申込みいただき、誠にありがとうございます。"
      : "このたびは、公益財団法人えひめ西条つながり基金へご寄付をいただき、誠にありがとうございます。",
    isBank ? "以下のとおりお申込みを承りました。下記の口座へお振込みをお願いいたします。" : "以下のとおり承りました。",
    "",
    (isBank ? "　受付日　　：" : "　受付日：") + date,
    (isBank ? "　種別　　　：" : "　種別　：") + kindLabel,
    (isBank ? "　金額　　　：" : "　金額　：") + yen,
    ...bankText,
    "",
    receiptNote,
    "",
    "皆さまからのお気持ちは、愛媛県全域で地域課題の解決や魅力づくりに取り組む団体への助成として大切に活用いたします。",
    ...(manageUrl ? ["", manageNote, "　" + manageUrl] : []),
    "",
    "──────────",
    "公益財団法人えひめ西条つながり基金",
    "TEL 0897-47-6943 ／ info@escf.jp",
  ].join("\n");

  const html = `<!doctype html><html lang="ja"><body style="margin:0;background:#f4f7f8;padding:24px 0;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#2c3e50;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8ea;">
    <div style="background:#1a3547;color:#fff;padding:20px 24px;font-size:16px;font-weight:bold;">公益財団法人えひめ西条つながり基金</div>
    <div style="padding:24px;line-height:1.9;">
      <p style="margin:0 0 12px;font-weight:bold;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 16px;">${isBank
        ? "このたびは、当基金へのご寄付をお申込みいただき、誠にありがとうございます。以下のとおりお申込みを承りました。下記の口座へお振込みをお願いいたします。"
        : "このたびは、当基金へご寄付をいただき、誠にありがとうございます。以下のとおり承りました。"}</p>
      <table style="width:100%;border-collapse:collapse;background:#f8f9fa;border-radius:10px;overflow:hidden;font-size:14px;">
        <tr><td style="padding:10px 14px;color:#5a7080;width:90px;">受付日</td><td style="padding:10px 14px;font-weight:bold;">${date}</td></tr>
        <tr><td style="padding:10px 14px;color:#5a7080;border-top:1px solid #e2e8ea;">種別</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e2e8ea;">${kindLabel}</td></tr>
        <tr><td style="padding:10px 14px;color:#5a7080;border-top:1px solid #e2e8ea;">金額</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e2e8ea;">${yen}</td></tr>
      </table>
      ${bankHtml}
      <p style="margin:16px 0 0;font-size:13px;color:#5a7080;">${escapeHtml(receiptNote)}</p>
      <p style="margin:16px 0 0;">皆さまからのお気持ちは、愛媛県全域で地域課題の解決に取り組む団体への助成として大切に活用いたします。</p>
      ${manageUrl ? `<div style="margin:20px 0 0;padding:14px 16px;background:#EDF2F4;border-radius:10px;">
        <p style="margin:0 0 8px;font-size:13px;color:#1a3547;">${escapeHtml(manageNote)}</p>
        <a href="${manageUrl}" style="display:inline-block;background:#1F4E5F;color:#fff;text-decoration:none;padding:9px 18px;border-radius:999px;font-size:13px;">ご登録内容の確認・解約はこちら</a>
      </div>` : ""}
    </div>
    <div style="padding:16px 24px;background:#f8f9fa;border-top:1px solid #e2e8ea;font-size:12px;color:#5a7080;line-height:1.8;">
      公益財団法人えひめ西条つながり基金<br>TEL 0897-47-6943 ／ <a href="mailto:info@escf.jp" style="color:#2a8aaa;">info@escf.jp</a>
    </div>
  </div>
</body></html>`;

  return { subject, html, text };
}

// ===== Pay.jp からの通知（Webhook）=====
//
// なぜ必要か：
//   継続寄付は「申込時」にこのWorkerが台帳へ1行追記する。しかし2回目以降の課金は
//   Pay.jpが自動で行うためWorkerが動かず、そのままでは台帳に一切残らない。
//   （＝毎月の更新分が台帳から抜け、寄付総額が実際より少なくなる）
//   そこでPay.jpからの通知を受け取り、更新分をここで追記する。
//
// 扱うイベント：
//   subscription.renewed … 定期課金の「期間更新」＝2回目以降の課金
//   初回申込は subscription.created という別イベントなので、
//   申込時の追記と二重にならない。
//
// なりすまし対策：
//   Pay.jpは全ての通知に X-Payjp-Webhook-Token を付ける。
//   管理画面で確認できる値を PAYJP_WEBHOOK_TOKEN に設定し、一致しない通知は拒否する。
//   （未設定のまま公開すると誰でも台帳に書き込めてしまうため、未設定なら受け付けない）
async function handlePayjpWebhook(request, env, ctx) {
  if (!env.PAYJP_WEBHOOK_TOKEN) return new Response("webhook token not configured", { status: 500 });
  if (request.headers.get("X-Payjp-Webhook-Token") !== env.PAYJP_WEBHOOK_TOKEN) {
    return new Response("forbidden", { status: 403 });
  }

  let event;
  try { event = await request.json(); } catch { return new Response("invalid json", { status: 400 }); }

  // 対象外のイベントは200で返す（Pay.jpに再送させないため）
  if (event.type !== "subscription.renewed") return new Response("ignored", { status: 200 });
  // テストモードの通知を本番の台帳に混ぜない
  if (event.livemode === false) return new Response("ignored: test mode", { status: 200 });

  const result = await recordSubscriptionRenewal(env, event);
  // 失敗時は5xxを返してPay.jpに再送させる。重複は下の dedupeKey で防いでいるので再送は安全。
  return new Response(result.message, { status: result.ok ? 200 : 500 });
}

async function recordSubscriptionRenewal(env, event) {
  const sub = event.data || {};
  const subId = sub.id;
  if (!subId) return { ok: true, message: "no subscription id" };
  if (!env.DONORS) return { ok: false, message: "kv unavailable" };

  // 同じ課金期間の通知が二重に記録されないようにする（Pay.jpは通知を再送することがある）
  const periodStart = sub.current_period_start;
  const dedupeKey = `ledger:renewed:${subId}:${periodStart}`;
  try {
    if (await env.DONORS.get(dedupeKey)) return { ok: true, message: "already recorded" };
  } catch (e) { /* KV読み取り失敗時は追記を試みる（取りこぼしより重複の方が発見しやすい） */ }

  // 申込時に保存した寄付者情報（氏名・住所・使いみち等）を引く
  let donor = null;
  try {
    const raw = await env.DONORS.get("sub:" + subId);
    if (raw) donor = JSON.parse(raw);
  } catch (e) { /* 引けなくても金額だけは台帳に残す */ }

  // 金額はPay.jp側のプラン金額を正とする（申込後に金額変更があってもズレない）
  const amount = (sub.plan && sub.plan.amount) || (donor && donor.amount) || 0;
  if (!amount) return { ok: true, message: "amount unknown, skipped" };

  const row = donor
    ? { ...donor, amount }
    : {
        // KVに寄付者情報が無い場合でも、入金の事実は台帳に残す
        entityType: "individual", anonymous: false, donationType: "recurring",
        billingCycle: "month", purpose: "財団運営", amount, email: "",
      };

  const appended = await appendDonationRow(env, row, `${subId}（${periodLabel(periodStart)}分）`);
  if (!appended) return { ok: false, message: "sheet append failed" };

  try { await env.DONORS.put(dedupeKey, new Date().toISOString()); } catch (e) { /* 重複防止の記録漏れは許容 */ }
  return { ok: true, message: "recorded" };
}

// Unix秒（Pay.jpの課金期間開始）を「2026/08」形式にする
function periodLabel(unixSeconds) {
  if (!unixSeconds) return "";
  const jst = new Date(unixSeconds * 1000 + 9 * 3600 * 1000);
  return jst.getUTCFullYear() + "/" + String(jst.getUTCMonth() + 1).padStart(2, "0");
}

// ===== マイページ（本人によるご登録内容の確認・解約） =====
async function handleManageInfo(ref, env, cors) {
  if (!ref) return json({ error: "パラメータが不正です" }, 400, cors);
  if (!env.DONORS) return json({ error: "サーバー設定エラー" }, 500, cors);
  const raw = await env.DONORS.get("sub:" + ref);
  if (!raw) return json({ error: "この寄付情報は見つかりませんでした。URLをご確認ください。" }, 404, cors);
  const donor = JSON.parse(raw);
  return json({
    ok: true,
    entityType: donor.entityType,
    billingCycle: donor.billingCycle,
    amount: donor.amount,
    purpose: donor.purpose || "財団運営",
    status: donor.status || "active",
    canceledAt: donor.canceledAt || null,
  }, 200, cors);
}

async function handleManageCancel(ref, env, cors) {
  if (!ref) return json({ error: "パラメータが不正です" }, 400, cors);
  if (!env.DONORS) return json({ error: "サーバー設定エラー" }, 500, cors);
  if (!env.PAYJP_SECRET_KEY) return json({ error: "サーバー設定エラー（鍵未設定）" }, 500, cors);

  const key = "sub:" + ref;
  const raw = await env.DONORS.get(key);
  if (!raw) return json({ error: "この寄付情報は見つかりませんでした。URLをご確認ください。" }, 404, cors);
  const donor = JSON.parse(raw);

  if (donor.status === "canceled") {
    return json({ ok: true, alreadyCanceled: true }, 200, cors);
  }

  const payjp = makePayjp(env.PAYJP_SECRET_KEY);
  const res = await payjp("/subscriptions/" + ref + "/cancel", {});
  if (!res.ok) return json({ error: "解約処理に失敗しました。時間をおいて再度お試しいただくか、お問い合わせください。" }, 400, cors);

  donor.status = "canceled";
  donor.canceledAt = new Date().toISOString();
  try { await env.DONORS.put(key, JSON.stringify(donor)); } catch (e) { /* Pay.jp側の解約は成立しているので握りつぶす */ }

  return json({ ok: true }, 200, cors);
}

function makePayjp(secretKey) {
  const auth = "Basic " + btoa(secretKey + ":");
  return async function payjp(path, params, method) {
    const opt = { method: method || "POST", headers: { Authorization: auth } };
    if (params) {
      opt.headers["Content-Type"] = "application/x-www-form-urlencoded";
      opt.body = formEncode(params);
    }
    const res = await fetch("https://api.pay.jp/v1" + path, opt);
    let data = {};
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function str(v, max) {
  return (v == null ? "" : String(v)).slice(0, max).trim();
}
function formEncode(obj) {
  return Object.keys(obj)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]))
    .join("&");
}
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(cors || {}) },
  });
}
