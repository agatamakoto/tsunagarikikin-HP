/**
 * 寄付金受領証（PDF）の生成
 * - pdf-lib + fontkit で日本語フォント（Kosugi）を埋め込み、A4サイズの受領証を1枚生成する
 * - 匿名寄付は呼び出し側で対象外とする（氏名・住所を記載できないため）
 */
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const A4 = { width: 595.28, height: 841.89 };

export async function buildReceiptPdf({ donor, kind, amount, receiptNo, issuedAt, fontBytes }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // フォントデータをプール共有のない綺麗なUint8Arrayに正規化（Node Buffer/ArrayBuffer両対応）
  const src = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
  const fontData = new Uint8Array(src.byteLength);
  fontData.set(src);
  // subset:true は一部フォントでグリフ欠落バグが出るため、フォント全体を埋め込む（IPAexゴシックで全文字表示を確認済み）
  const font = await pdf.embedFont(fontData, { subset: false });

  const page = pdf.addPage([A4.width, A4.height]);
  const margin = 56;
  const black = rgb(0.1, 0.1, 0.12);
  const gray = rgb(0.4, 0.44, 0.48);
  const primary = rgb(0.1, 0.21, 0.27); // #1a3547相当

  const draw = (text, x, y, size, color = black, opts = {}) => {
    page.drawText(text, { x, y, size, font, color, ...opts });
  };
  const centerText = (text, y, size, color = black) => {
    const w = font.widthOfTextAtSize(text, size);
    draw(text, (A4.width - w) / 2, y, size, color);
  };

  let y = A4.height - margin;

  // タイトル
  centerText("寄 付 金 受 領 証", y, 26, primary);
  y -= 40;

  // 受領証番号・発行日（右上寄せ）
  const metaLines = [`受領証番号：${receiptNo}`, `発行日：${issuedAt}`];
  metaLines.forEach((line, i) => {
    const size = 10.5;
    const w = font.widthOfTextAtSize(line, size);
    draw(line, A4.width - margin - w, A4.height - margin - 14 - i * 16, size, gray);
  });

  y -= 20;
  page.drawLine({ start: { x: margin, y }, end: { x: A4.width - margin, y }, thickness: 1.2, color: primary });
  y -= 40;

  // 宛名
  const isCorp = donor.entityType === "corporate";
  const addressee = isCorp ? `${donor.companyName} 御中` : `${donor.name} 様`;
  draw(addressee, margin, y, 15, black);
  y -= 42;

  // 本文
  const kindLabel = kind === "onetime" ? "都度のご寄付" : kind === "yearly" ? "年額サポーターとしてのご寄付" : "マンスリーサポーターとしてのご寄付";
  const bodyLines = [
    "下記のとおり、ご寄付をいただいたことを証明いたします。",
  ];
  bodyLines.forEach((line) => { draw(line, margin, y, 11.5, black); y -= 24; });
  y -= 10;

  // 明細テーブル風のブロック
  const tableTop = y;
  const rowH = 30;
  const rows = [
    ["寄付金額", `${Number(amount).toLocaleString()} 円`],
    ["寄付の種別", kindLabel],
    ["寄付の使い道", donor.purpose || "財団運営"],
    ["寄付者", isCorp ? donor.companyName : donor.name],
    ["ご住所", formatAddress(donor)],
  ];
  const tableLeft = margin;
  const tableWidth = A4.width - margin * 2;
  const labelW = 120;

  page.drawRectangle({
    x: tableLeft, y: tableTop - rowH * rows.length, width: tableWidth, height: rowH * rows.length,
    borderColor: rgb(0.85, 0.87, 0.88), borderWidth: 1,
  });

  rows.forEach((row, i) => {
    const rowY = tableTop - rowH * (i + 1);
    if (i > 0) {
      page.drawLine({ start: { x: tableLeft, y: rowY + rowH }, end: { x: tableLeft + tableWidth, y: rowY + rowH }, thickness: 0.6, color: rgb(0.88, 0.9, 0.9) });
    }
    page.drawRectangle({ x: tableLeft, y: rowY, width: labelW, height: rowH, color: rgb(0.965, 0.975, 0.977) });
    draw(row[0], tableLeft + 14, rowY + 10, 11, gray);
    draw(row[1], tableLeft + labelW + 14, rowY + 10, 12, black);
  });
  y = tableTop - rowH * rows.length - 36;

  const note = "上記のご寄付は、当基金の公益目的事業のために大切に活用させていただきます。";
  draw(note, margin, y, 10.5, gray);
  y -= 60;

  // 発行者情報
  const issuerLines = [
    "公益財団法人えひめ西条つながり基金",
    "愛媛県西条市大町1663番地",
    "TEL 0897-47-6943 ／ info@escf.jp",
  ];
  issuerLines.forEach((line, i) => {
    draw(line, margin, y - i * 18, i === 0 ? 13 : 10.5, i === 0 ? black : gray);
  });

  return await pdf.save();
}

/**
 * 年間寄付額のお知らせ（決算用の明細）PDF
 * - マンスリーの法人サポーター向け。決算月の翌月に、その事業年度の1年間の合計額を知らせる。
 * - これは「受領証」ではない。毎月の受領証と二重発行にならないよう、
 *   タイトル・本文・注意書きのすべてで「受領証ではない」ことを明記する。
 *   受領証番号も振らない（番号つきの書類は証憑と誤解されやすいため）。
 *
 * items: [{ date: "2026年4月16日", amount: 3000 }, ...]（日付順。毎月なので最大12〜13行）
 */
export async function buildAnnualStatementPdf({ donor, periodLabel, items, total, issuedAt, fontBytes }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const src = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
  const fontData = new Uint8Array(src.byteLength);
  fontData.set(src);
  const font = await pdf.embedFont(fontData, { subset: false });

  const page = pdf.addPage([A4.width, A4.height]);
  const margin = 56;
  const black = rgb(0.1, 0.1, 0.12);
  const gray = rgb(0.4, 0.44, 0.48);
  const primary = rgb(0.1, 0.21, 0.27);
  const accent = rgb(0.82, 0.38, 0.05); // 注意書きの枠（オレンジ系）
  const rule = rgb(0.88, 0.9, 0.9);

  const draw = (text, x, y, size, color = black) => page.drawText(text, { x, y, size, font, color });
  const textW = (text, size) => font.widthOfTextAtSize(text, size);
  const centerText = (text, y, size, color = black) => draw(text, (A4.width - textW(text, size)) / 2, y, size, color);
  const rightText = (text, xRight, y, size, color = black) => draw(text, xRight - textW(text, size), y, size, color);
  const boxW = A4.width - margin * 2;

  let y = A4.height - margin;

  // 右上：発行日
  rightText(`発行日：${issuedAt}`, A4.width - margin, y, 10.5, gray);
  y -= 34;

  // タイトル（受領証ではないことをタイトル直下で明示）
  centerText("年間寄付額のお知らせ", y, 24, primary);
  y -= 20;
  centerText("決算用の明細です（寄付金受領証ではありません）", y, 11, gray);
  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: A4.width - margin, y }, thickness: 1.2, color: primary });
  y -= 34;

  // 宛名
  draw(`${donor.companyName || ""} 御中`, margin, y, 15, black);
  y -= 30;

  draw("マンスリーサポーターとして1年間にいただいたご寄付の合計額をお知らせいたします。", margin, y, 10.5, black);
  y -= 22;

  // 合計のブロック
  const sumRows = [
    ["対象期間", periodLabel],
    ["ご寄付の回数", `${items.length} 回`],
    ["合計金額", `${Number(total).toLocaleString()} 円`],
  ];
  const sRowH = 28;
  const labelW = 120;
  page.drawRectangle({ x: margin, y: y - sRowH * sumRows.length, width: boxW, height: sRowH * sumRows.length, borderColor: rgb(0.85, 0.87, 0.88), borderWidth: 1 });
  sumRows.forEach((row, i) => {
    const rowY = y - sRowH * (i + 1);
    if (i > 0) page.drawLine({ start: { x: margin, y: rowY + sRowH }, end: { x: margin + boxW, y: rowY + sRowH }, thickness: 0.6, color: rule });
    page.drawRectangle({ x: margin, y: rowY, width: labelW, height: sRowH, color: rgb(0.965, 0.975, 0.977) });
    draw(row[0], margin + 14, rowY + 9, 11, gray);
    const isTotal = i === sumRows.length - 1;
    draw(row[1], margin + labelW + 14, rowY + (isTotal ? 7 : 9), isTotal ? 15 : 12, black);
  });
  y -= sRowH * sumRows.length + 26;

  // 明細
  draw("ご寄付の明細", margin, y, 12, primary);
  y -= 8;
  const colNo = margin + 14;
  const colDate = margin + 70;
  const colAmtRight = A4.width - margin - 14;
  const dRowH = items.length > 14 ? 16 : 19;
  const head = y - dRowH;
  page.drawRectangle({ x: margin, y: head, width: boxW, height: dRowH, color: rgb(0.93, 0.95, 0.96) });
  draw("No.", colNo, head + 5, 10, gray);
  draw("決済日", colDate, head + 5, 10, gray);
  rightText("金額", colAmtRight, head + 5, 10, gray);
  y = head;
  items.forEach((it, i) => {
    const rowY = y - dRowH;
    if (i > 0) page.drawLine({ start: { x: margin, y: y }, end: { x: margin + boxW, y: y }, thickness: 0.5, color: rule });
    draw(String(i + 1), colNo, rowY + 5, 10.5, black);
    draw(it.date, colDate, rowY + 5, 10.5, black);
    rightText(`${Number(it.amount).toLocaleString()} 円`, colAmtRight, rowY + 5, 10.5, black);
    y = rowY;
  });
  // 合計行
  page.drawLine({ start: { x: margin, y }, end: { x: margin + boxW, y }, thickness: 1, color: primary });
  const totalY = y - dRowH - 2;
  draw("合計", colDate, totalY + 5, 11.5, black);
  rightText(`${Number(total).toLocaleString()} 円`, colAmtRight, totalY + 5, 11.5, black);
  y = totalY - 22;

  // 注意書き（受領証ではないこと）
  const notes = [
    "この書類は、決算のご確認用にお送りする明細です。寄付金受領証（領収書）ではありません。",
    "ご寄付ごとの寄付金受領証は、毎月のご寄付の際にメールでお送りしております。",
    "経理・税務のお手続きには、各月の寄付金受領証をご使用ください。",
    "返金があったご寄付は、返金後の金額で記載しています。",
  ];
  const noteH = 18 * notes.length + 16;
  page.drawRectangle({ x: margin, y: y - noteH, width: boxW, height: noteH, borderColor: accent, borderWidth: 1.4 });
  notes.forEach((line, i) => draw("・" + line, margin + 12, y - 19 - i * 18, 9.5, black));
  y -= noteH + 30;

  // 発行者情報
  const issuerLines = [
    "公益財団法人えひめ西条つながり基金",
    "愛媛県西条市大町1663番地",
    "TEL 0897-47-6943 ／ info@escf.jp",
  ];
  issuerLines.forEach((line, i) => draw(line, margin, y - i * 18, i === 0 ? 13 : 10.5, i === 0 ? black : gray));

  return await pdf.save();
}

function formatAddress(donor) {
  if (donor.entityType === "corporate") {
    const parts = [donor.zip ? `〒${donor.zip}` : "", donor.prefecture || "", donor.address || ""].filter(Boolean);
    return parts.join(" ") || "―";
  }
  const parts = [donor.zip ? `〒${donor.zip}` : "", donor.prefecture || "", donor.address || ""].filter(Boolean);
  return parts.join(" ") || "―";
}

export function makeReceiptNo(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `ESCF-${y}${m}${d}-${rand}`;
}
