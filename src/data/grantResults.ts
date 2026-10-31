// src/data/grantResults.ts
// 助成実績（これまでに助成金をお支払いした団体と金額）
// 元データ：Googleドライブ「助成プログラム／助成先団体・支払い実績一覧」
// 金額は実際にお支払いした額。報告書PDFは個人名を黒塗りしたものを public/reports/grants/ に置く。
// 報告書が未提出の助成（例：イマココ子育て支援）は、提出されるまで載せない。

export interface GrantRecipient {
  name: string;
  amount: number;
  /** 報告書PDF（public/ からのパス） */
  report?: string;
}

export interface GrantProgram {
  /** 募集した年度 */
  year: string;
  title: string;
  /** プログラムの紹介ページ（あれば） */
  page?: string;
  recipients: GrantRecipient[];
}

const R = '/reports/grants/';

export const GRANT_PROGRAMS: GrantProgram[] = [
  {
    year: '令和7年度',
    title: '今治・西条 山林火災復興支援基金',
    page: '/grants/qkcuxtu0pv',
    recipients: [
      { name: '高宮農園', amount: 100000, report: R + 'sanrin_takamiya.pdf' },
      { name: '特定非営利活動法人えひめ311', amount: 65446, report: R + 'sanrin_ehime311.pdf' },
    ],
  },
  {
    year: '令和7年度',
    title: '市之川未来基金',
    page: '/grants/v_3kkpcbz',
    recipients: [
      { name: '株式会社フラスコ', amount: 100000, report: R + 'ichinokawa_frasco.pdf' },
      { name: '洋菓子工房れじゅーる', amount: 83172, report: R + 'ichinokawa_rejouir.pdf' },
    ],
  },
  {
    year: '令和7年度',
    title: 'マッチングギフト型助成プログラム（こども）',
    recipients: [
      { name: '西条第九運営委員会', amount: 100000, report: R + 'matching_daiku.pdf' },
      { name: '西条市立石根小学校PTA', amount: 100000 },
    ],
  },
  {
    year: '令和6年度',
    title: '西条市にこども食堂を2つ増やそう（2年目）',
    page: '/grants/nnjzx43pxy7g',
    recipients: [
      { name: '吉岡わくわく食堂', amount: 100000, report: R + 'kodomo_wakuwaku_2.pdf' },
      { name: '周布つむぎて地域食堂', amount: 100000, report: R + 'kodomo_suftsumugite_2.pdf' },
    ],
  },
  {
    year: '令和5年度',
    title: 'イベントからごみを減らそう',
    recipients: [{ name: '株式会社糸プロジェクト', amount: 135140, report: R + 'gomi_ito.pdf' }],
  },
  {
    year: '令和5年度',
    title: '防災を通じて障害者との共生を考える',
    recipients: [{ name: '戻川自主防災会', amount: 100000, report: R + 'bosai_modorikawa.pdf' }],
  },
  {
    year: '令和5年度',
    title: '農の多様性で暮らしに豊かさを',
    recipients: [{ name: 'まんがら自然塾「畑の学校」', amount: 150000, report: R + 'nogyo_mangara.pdf' }],
  },
  {
    year: '令和4年度',
    title: '西条市にこども食堂を2つ増やそう（1年目）',
    page: '/grants/nnjzx43pxy7g',
    recipients: [
      { name: '吉岡わくわく食堂', amount: 95957, report: R + 'kodomo_wakuwaku_1.pdf' },
      { name: '周布つむぎて地域食堂', amount: 88701 },
    ],
  },
  {
    year: '令和4年度',
    title: '西条市の水の課題を市民に周知する事業',
    recipients: [{ name: '西条農業高校 TeamSSS', amount: 110645, report: R + 'mizu_teamsss.pdf' }],
  },
  {
    year: '令和4年度',
    title: '西条市内在住の外国人に関する調査',
    recipients: [{ name: 'NPO法人西条市国際交流協会', amount: 100000, report: R + 'gaikokujin_kokusai.pdf' }],
  },
  {
    year: '令和4年度',
    title: '女性が明るく健康的になれる事業',
    recipients: [{ name: 'ネットラジオ局 Wake Up！SAIJO', amount: 185000, report: R + 'josei_wakeup.pdf' }],
  },
];

const all = GRANT_PROGRAMS.flatMap((p) => p.recipients);

/** 助成総額（円） */
export const GRANT_TOTAL = all.reduce((sum, r) => sum + r.amount, 0);
/** 助成の件数 */
export const GRANT_COUNT = all.length;
/** 助成先の団体数（同じ団体は1つと数える） */
export const GRANT_ORG_COUNT = new Set(all.map((r) => r.name)).size;
