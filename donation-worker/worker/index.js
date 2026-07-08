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

export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400, cors); }

    const entityType = body.entityType === "corporate" ? "corporate" : "individual";
    const anonymous = entityType === "individual" && !!body.anonymous;
    const donationType = body.donationType === "onetime" ? "onetime" : "recurring"; // 継続 or 単発
    const billingCycle = body.billingCycle === "year" ? "year" : "month"; // 個人は月額のみ、法人は月額/年額
    const token = body.token;
    const amount = parseInt(body.amount, 10);
    const email = str(body.email, 200);

    if (!token) return json({ error: "カード情報がありません" }, 400, cors);
    if (!Number.isInteger(amount) || amount < 1000 || amount > 1000000)
      return json({ error: "金額は1,000円〜1,000,000円で指定してください" }, 400, cors);
    if (!email) return json({ error: "メールアドレスを入力してください" }, 400, cors);

    // ---- 属性ごとの入力整形 ----
    // 使いみち：継続寄付（マンスリー・年額）は常に「財団運営」固定。都度寄付のみフォームで選択可。
    const purpose = donationType === "onetime" ? (str(body.purpose, 100) || "財団運営") : "財団運営";
    let donor = { entityType, anonymous, donationType, billingCycle, purpose, amount, email };
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

    const sk = env.PAYJP_SECRET_KEY;
    if (!sk) return json({ error: "サーバー設定エラー（鍵未設定）" }, 500, cors);
    const auth = "Basic " + btoa(sk + ":");

    async function payjp(path, params, method) {
      const opt = { method: method || "POST", headers: { Authorization: auth } };
      if (params) {
        opt.headers["Content-Type"] = "application/x-www-form-urlencoded";
        opt.body = formEncode(params);
      }
      const res = await fetch("https://api.pay.jp/v1" + path, opt);
      let data = {};
      try { data = await res.json(); } catch {}
      return { ok: res.ok, status: res.status, data };
    }

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

    ctx.waitUntil(sendThanks(env, { donor, kind: billingCycle === "year" ? "yearly" : "monthly", amount }));
    return json({ ok: true, subscriptionId: sub.data.id, customerId: cust.data.id }, 200, cors);
  },
};

// ===== サンクスメール送信（Resend経由。RESEND_API_KEY をsecretで登録） =====
// 記名の寄付者には、受領証PDF（自動生成）＋税額控除に係る証明書PDFを添付する。
// 匿名寄付は氏名・住所を記載できないため、受領証は発行しない（本文のみ）。
async function sendThanks(env, { donor, kind, amount }) {
  if (!env.RESEND_API_KEY || !donor.email) return;
  const mail = buildThanksEmail({ donor, kind, amount });

  const attachments = [];
  if (!donor.anonymous && env.DONORS) {
    try {
      const [fontBuf, certBuf] = await Promise.all([
        env.DONORS.get("asset:font-kosugi", "arrayBuffer"),
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

function buildThanksEmail({ donor, kind, amount }) {
  const anon = !!donor.anonymous;
  const isCorp = donor.entityType === "corporate";
  const name = isCorp ? donor.companyName : anon ? "" : donor.name;
  const greeting = anon ? "ご支援者様" : name + (isCorp ? " 御中" : " 様");
  const kindLabel = kind === "onetime" ? "今回のみのご寄付" : kind === "yearly" ? "年額サポーター（毎年）" : "マンスリーサポーター（毎月）";
  const yen = "¥" + Number(amount).toLocaleString();
  const date = jstDateString();
  const subject = "【えひめ西条つながり基金】ご寄付ありがとうございました";
  const receiptNote = anon
    ? "匿名でのご寄付のため、寄付金受領証は発行いたしません。"
    : "寄付金受領証および税額控除に係る証明書は、追ってお送りいたします。";

  const text = [
    greeting,
    "",
    "このたびは、公益財団法人えひめ西条つながり基金へご寄付をいただき、誠にありがとうございます。",
    "以下のとおり承りました。",
    "",
    "　受付日：" + date,
    "　種別　：" + kindLabel,
    "　金額　：" + yen,
    "",
    receiptNote,
    "",
    "皆さまからのお気持ちは、愛媛県全域で地域課題の解決や魅力づくりに取り組む団体への助成として大切に活用いたします。",
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
      <p style="margin:0 0 16px;">このたびは、当基金へご寄付をいただき、誠にありがとうございます。以下のとおり承りました。</p>
      <table style="width:100%;border-collapse:collapse;background:#f8f9fa;border-radius:10px;overflow:hidden;font-size:14px;">
        <tr><td style="padding:10px 14px;color:#5a7080;width:90px;">受付日</td><td style="padding:10px 14px;font-weight:bold;">${date}</td></tr>
        <tr><td style="padding:10px 14px;color:#5a7080;border-top:1px solid #e2e8ea;">種別</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e2e8ea;">${kindLabel}</td></tr>
        <tr><td style="padding:10px 14px;color:#5a7080;border-top:1px solid #e2e8ea;">金額</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e2e8ea;">${yen}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#5a7080;">${escapeHtml(receiptNote)}</p>
      <p style="margin:16px 0 0;">皆さまからのお気持ちは、愛媛県全域で地域課題の解決に取り組む団体への助成として大切に活用いたします。</p>
    </div>
    <div style="padding:16px 24px;background:#f8f9fa;border-top:1px solid #e2e8ea;font-size:12px;color:#5a7080;line-height:1.8;">
      公益財団法人えひめ西条つながり基金<br>TEL 0897-47-6943 ／ <a href="mailto:info@escf.jp" style="color:#2a8aaa;">info@escf.jp</a>
    </div>
  </div>
</body></html>`;

  return { subject, html, text };
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
