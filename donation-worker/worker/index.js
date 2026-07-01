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

export default {
  async fetch(request, env) {
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
    const billingCycle = body.billingCycle === "year" ? "year" : "month"; // 個人は月額のみ、法人は月額/年額
    const token = body.token;
    const amount = parseInt(body.amount, 10);
    const email = str(body.email, 200);

    if (!token) return json({ error: "カード情報がありません" }, 400, cors);
    if (!Number.isInteger(amount) || amount < 1000 || amount > 1000000)
      return json({ error: "金額は1,000円〜1,000,000円で指定してください" }, 400, cors);
    if (!email) return json({ error: "メールアドレスを入力してください" }, 400, cors);

    // ---- 属性ごとの入力整形 ----
    let donor = { entityType, anonymous, billingCycle, amount, email };
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

    return json({ ok: true, subscriptionId: sub.data.id, customerId: cust.data.id }, 200, cors);
  },
};

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
