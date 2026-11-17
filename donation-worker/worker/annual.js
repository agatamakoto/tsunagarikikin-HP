/**
 * 年間寄付額のお知らせ（マンスリーの法人サポーター向け・決算用）
 *
 * いつ：毎月1日 9:00（日本時間）に Cron で動く（wrangler.toml の [triggers]）。
 * 誰に：法人 × マンスリー（毎月）で、決算月が「先月」の寄付者。
 *       例）12月1日の実行 → 決算月が11月の法人に、前年12月1日〜今年11月30日の合計を送る。
 *       年額の法人、個人、決算月が未登録の法人には送らない。
 *       途中で解約した法人でも、その1年間に寄付があれば送る（決算に必要なため）。
 * 何を：1年間の合計額と明細を書いたPDF（buildAnnualStatementPdf）をメールに添付する。
 *
 * 受領証の二重発行を避けるための決まり：
 *   - 毎月の寄付金受領証が正本。この書類は「お知らせ（明細）」であり、受領証ではない。
 *   - PDF・メール本文の両方に「寄付金受領証ではありません」と明記する。
 *   - 受領証番号は振らない。
 *
 * 金額の出どころ：Pay.jp に実際に記録されている決済（返金分は差し引く）。
 *   KVや台帳ではなく決済の記録を正とするので、途中で金額が変わっても合う。
 *
 * 二重送信の防止：送れたら KV に annual:{サブスクID}:{決算年}-{決算月} を記録し、
 *   同じ年度のお知らせは二度送らない。
 */
import { buildAnnualStatementPdf } from "./receipt.js";

const JST = 9 * 3600 * 1000;

// now の時点で「先月が決算月」の対象期間を求める
export function fiscalPeriodFor(now = new Date()) {
  const jst = new Date(now.getTime() + JST);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1; // 今月（1〜12）
  const fiscalMonth = m === 1 ? 12 : m - 1; // 先月＝決算月
  const endYear = m === 1 ? y - 1 : y;
  // 期間：決算月の翌月1日（前年）0:00 〜 決算月末日 23:59:59（日本時間）
  const startMs = Date.UTC(endYear - 1, fiscalMonth, 1) - JST; // 月の添字 fiscalMonth ＝ 決算月の翌月
  const endExclusiveMs = Date.UTC(endYear, fiscalMonth, 1) - JST; // ＝ 今月1日 0:00
  const startJ = new Date(startMs + JST);
  const lastJ = new Date(endExclusiveMs - 1 + JST);
  const fmt = (d) => `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  const short = (d) => `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月`;
  return {
    fiscalMonth,
    endYear,
    since: Math.floor(startMs / 1000),
    until: Math.floor(endExclusiveMs / 1000) - 1,
    label: `${fmt(startJ)}〜${fmt(lastJ)}`,
    shortLabel: `${short(startJ)}〜${short(lastJ)}`,
  };
}

export async function runAnnualStatements(env, now = new Date()) {
  const results = [];
  if (!env.DONORS || !env.PAYJP_SECRET_KEY || !env.RESEND_API_KEY) {
    console.log("annual: 設定不足のためスキップ");
    return results;
  }
  const period = fiscalPeriodFor(now);

  // KVの寄付者記録（sub:）から対象の法人を選ぶ
  const targets = [];
  let cursor;
  do {
    const page = await env.DONORS.list({ prefix: "sub:", cursor });
    for (const k of page.keys) {
      let donor;
      try { donor = JSON.parse(await env.DONORS.get(k.name)); } catch { continue; }
      if (!donor || donor.entityType !== "corporate") continue;
      if (donor.billingCycle === "year") continue; // 年額は対象外（年1回の受領証で足りる）
      if (parseInt(donor.fiscalMonth, 10) !== period.fiscalMonth) continue;
      if (!donor.email || !donor.customerId) continue;
      targets.push(donor);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  if (!targets.length) return results;

  const fontBuf = await env.DONORS.get("asset:font-ipaex", "arrayBuffer");
  if (!fontBuf) {
    console.log("annual: フォントが無いためPDFを作れずスキップ");
    return results;
  }

  for (const donor of targets) {
    const dedupeKey = `annual:${donor.subscriptionId}:${period.endYear}-${period.fiscalMonth}`;
    try {
      if (await env.DONORS.get(dedupeKey)) { results.push({ sub: donor.subscriptionId, status: "already sent" }); continue; }
    } catch { /* 読めなければ送信を試みる */ }

    const charges = await listPaidCharges(env, donor.customerId, period.since, period.until);
    if (charges === null) { results.push({ sub: donor.subscriptionId, status: "payjp error" }); continue; }
    if (!charges.length) { results.push({ sub: donor.subscriptionId, status: "no donations" }); continue; }

    const items = charges.map((c) => ({ date: jstDate(c.created), amount: c.net }));
    const total = items.reduce((s, it) => s + it.amount, 0);

    const pdfBytes = await buildAnnualStatementPdf({
      donor, periodLabel: period.label, items, total, issuedAt: jstDate(Math.floor(now.getTime() / 1000)), fontBytes: fontBuf,
    });
    const sent = await sendAnnualMail(env, { donor, period, items, total, pdfBytes });
    if (sent) {
      try { await env.DONORS.put(dedupeKey, new Date().toISOString()); } catch { /* 記録漏れは許容 */ }
    }
    results.push({ sub: donor.subscriptionId, status: sent ? "sent" : "mail error", total, count: items.length });
  }
  console.log("annual:", JSON.stringify(results));
  return results;
}

// 期間内の成立した決済を古い順に返す（返金分は差し引き、全額返金は除く）。失敗時は null。
async function listPaidCharges(env, customerId, since, until) {
  const base = env.PAYJP_API_URL || "https://api.pay.jp/v1";
  const auth = "Basic " + btoa(env.PAYJP_SECRET_KEY + ":");
  const out = [];
  let offset = 0;
  for (let guard = 0; guard < 10; guard++) {
    const q = new URLSearchParams({ customer: customerId, since: String(since), until: String(until), limit: "100", offset: String(offset) });
    let data;
    try {
      const res = await fetch(`${base}/charges?${q}`, { headers: { Authorization: auth } });
      if (!res.ok) return null;
      data = await res.json();
    } catch { return null; }
    for (const c of data.data || []) {
      if (!c.paid || c.captured === false) continue;
      const net = (c.amount || 0) - (c.amount_refunded || 0);
      if (net <= 0) continue;
      out.push({ created: c.created, net });
    }
    if (!data.has_more) break;
    offset += 100;
  }
  return out.sort((a, b) => a.created - b.created);
}

async function sendAnnualMail(env, { donor, period, items, total, pdfBytes }) {
  const greeting = `${donor.companyName} 御中`;
  const contact = donor.contactName ? `${donor.contactName} 様` : "";
  const yen = Number(total).toLocaleString() + "円";
  const subject = `【えひめ西条つながり基金】年間寄付額のお知らせ（${period.shortLabel}）`;

  const text = [
    greeting,
    ...(contact ? [contact] : []),
    "",
    "いつも当基金へのご支援を、誠にありがとうございます。",
    "御社の決算期に合わせて、この1年間にマンスリーサポーターとしていただいたご寄付の合計額をお知らせいたします。",
    "",
    "　対象期間：" + period.label,
    "　ご寄付の回数：" + items.length + "回",
    "　合計金額：" + yen,
    "",
    "明細をPDFで添付しております。決算のご確認にお役立てください。",
    "",
    "※この書類は寄付金受領証（領収書）ではありません。",
    "　ご寄付ごとの寄付金受領証は、毎月のご寄付の際にメールでお送りしております。",
    "　経理・税務のお手続きには、各月の寄付金受領証をご使用ください。",
    "　受領証がお手元に見当たらない場合は、このメールにご返信ください。再送いたします。",
    "",
    "引き続き、地域を支えるご支援をどうぞよろしくお願いいたします。",
    "",
    "──────────",
    "公益財団法人えひめ西条つながり基金",
    "TEL 0897-47-6943 ／ info@escf.jp",
  ].join("\n");

  const html = `<!doctype html><html lang="ja"><body style="margin:0;background:#f4f7f8;padding:24px 0;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;color:#2c3e50;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8ea;">
    <div style="background:#1a3547;color:#fff;padding:20px 24px;font-size:16px;font-weight:bold;">公益財団法人えひめ西条つながり基金</div>
    <div style="padding:24px;line-height:1.9;">
      <p style="margin:0 0 12px;font-weight:bold;">${esc(greeting)}${contact ? "<br>" + esc(contact) : ""}</p>
      <p style="margin:0 0 16px;">いつも当基金へのご支援を、誠にありがとうございます。御社の決算期に合わせて、この1年間にマンスリーサポーターとしていただいたご寄付の合計額をお知らせいたします。</p>
      <table style="width:100%;border-collapse:collapse;background:#f8f9fa;border-radius:10px;overflow:hidden;font-size:14px;">
        <tr><td style="padding:10px 14px;color:#5a7080;width:110px;">対象期間</td><td style="padding:10px 14px;font-weight:bold;">${esc(period.label)}</td></tr>
        <tr><td style="padding:10px 14px;color:#5a7080;border-top:1px solid #e2e8ea;">ご寄付の回数</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e2e8ea;">${items.length}回</td></tr>
        <tr><td style="padding:10px 14px;color:#5a7080;border-top:1px solid #e2e8ea;">合計金額</td><td style="padding:10px 14px;font-weight:bold;font-size:18px;border-top:1px solid #e2e8ea;">${esc(yen)}</td></tr>
      </table>
      <p style="margin:16px 0 0;">明細をPDFで添付しております。決算のご確認にお役立てください。</p>
      <div style="margin:16px 0 0;padding:14px 16px;border:2px solid #FF9F3C;border-radius:12px;font-size:13px;line-height:1.8;">
        <strong>この書類は寄付金受領証（領収書）ではありません。</strong><br>
        ご寄付ごとの寄付金受領証は、毎月のご寄付の際にメールでお送りしております。経理・税務のお手続きには、各月の寄付金受領証をご使用ください。受領証がお手元に見当たらない場合は、このメールにご返信ください。再送いたします。
      </div>
      <p style="margin:16px 0 0;">引き続き、地域を支えるご支援をどうぞよろしくお願いいたします。</p>
    </div>
    <div style="padding:16px 24px;background:#f8f9fa;border-top:1px solid #e2e8ea;font-size:12px;color:#5a7080;line-height:1.8;">
      公益財団法人えひめ西条つながり基金<br>TEL 0897-47-6943 ／ <a href="mailto:info@escf.jp" style="color:#2a8aaa;">info@escf.jp</a>
    </div>
  </div>
</body></html>`;

  // 事務局にも写しを送る（お礼メールと同じ THANKS_COPY_TO、寄付者からは見えないBCC）
  const copyTo = String(env.THANKS_COPY_TO || "").split(",").map((s) => s.trim()).filter((s) => s && s !== donor.email);

  try {
    const res = await fetch(env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "公益財団法人えひめ西条つながり基金 <info@escf.jp>",
        to: [donor.email],
        ...(copyTo.length ? { bcc: copyTo } : {}),
        reply_to: "info@escf.jp",
        subject,
        html,
        text,
        attachments: [{ filename: `年間寄付額のお知らせ_${period.shortLabel}.pdf`, content: toBase64(pdfBytes) }],
      }),
    });
    return res.ok;
  } catch { return false; }
}

function jstDate(unixSeconds) {
  const d = new Date(unixSeconds * 1000 + JST);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

function toBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i += 0x8000) binary += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
  return btoa(binary);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
