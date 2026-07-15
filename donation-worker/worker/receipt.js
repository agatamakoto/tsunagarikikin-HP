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
    "愛媛県西条市（本部所在地）",
    "TEL 0897-47-6943 ／ info@escf.jp",
  ];
  issuerLines.forEach((line, i) => {
    draw(line, margin, y - i * 18, i === 0 ? 13 : 10.5, i === 0 ? black : gray);
  });

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
