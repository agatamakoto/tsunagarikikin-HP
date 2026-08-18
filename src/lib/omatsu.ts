// src/lib/omatsu.ts
// OMATSU-RebootCAMP セクション共通の設定値
import { DONATION_API_URL } from './donationConfig';

/** このプログラムのページ群のベースパス（末尾スラッシュなし） */
export const BASE = '/projects/Omatsu-RebootCAMP';

/** 事務局の問い合わせ先 */
export const CONTACT_EMAIL = 'info@escf.jp';

/** トップのメインビジュアル。
 *  ページを開くたびに順番がランダムになり、ゆっくり切り替わる。
 *  写真を追加するときは public/images/omatsu/hero/ に置いて1行足すだけ。
 */
export const HERO_IMAGES = [
  '/images/omatsu/hero/01.jpg',
  '/images/omatsu/hero/02.jpg',
  '/images/omatsu/hero/03.jpg',
  '/images/omatsu/hero/04.jpg',
  '/images/omatsu/hero/05.jpg',
  '/images/omatsu/hero/06.jpg',
];

/** プログラム風景の写真（トップのABOUT横・aboutページの概要横） */
export const PROGRAM_IMAGE = '/images/omatsu/program/program.jpg';

/** ロゴ画像 */
export const LOGO = {
  /** 横組み（明るい背景用） */
  horizontal: '/images/omatsu/logo/logo-horizontal.png',
  /** 横組み・白ヌキ（濃色背景用） */
  horizontalWhite: '/images/omatsu/logo/logo-horizontal-white.png',
  /** 縦組み（タグライン付き） */
  vertical: '/images/omatsu/logo/logo-vertical.png',
};

/** エントリーフォームの送信先。
 *  寄付システムと同じ Cloudflare Worker の /omatsu-entry に POST する。
 *  受信内容は info@escf.jp にメール転送され、応募者には受付確認メールが届く。
 *  （空文字にすると「フォーム準備中」の表示に切り替わる）
 */
export const ENTRY_ENDPOINT = `${DONATION_API_URL}/omatsu-entry`;

/** サイト共通のディスクリプション */
export const SITE_DESCRIPTION =
  '「OMATSU-Reboot CAMP」は、祭りの未来を守りたい地域住民と、祭りを通じて地域に関わりたい地域外の人材を繋ぐプログラムです。お祭りに参加いただくことで地域文化の体験と地域住民との繋がりの機会を提供します。';

/** 参加自治会（プロジェクト）記事の一覧
 *  記事を追加したら、ここに1行足す。ページ本体は
 *  src/pages/projects/Omatsu-RebootCAMP/project/<slug>.astro に置く。
 */
export interface OmatsuProject {
  /** URL の末尾。ファイル名と一致させる */
  slug: string;
  /** お祭りの名称 */
  title: string;
  /** 自治会・お祭り運営組織の名称 */
  organization: string;
  /** 一覧カードと記事の見出しに使うキャッチコピー（省略時は title を使う） */
  catchcopy?: string;
  /** 開催地 */
  area: string;
  /** 開催時期（表示用の自由文） */
  period: string;
  /** 応募の締切（省略可） */
  deadline?: string;
  /** 一覧カードに出す短い紹介文 */
  summary: string;
  /** 一覧カードのサムネイル画像。未設定なら仮枠 */
  thumbnail?: string;
  /** 募集状況 */
  status: '募集中' | '募集準備中' | '募集終了';
}

export const projects: OmatsuProject[] = [
  {
    slug: 'daishimachi',
    title: '西条祭り（伊曽乃神社祭礼）',
    organization: '大師町屋台',
    catchcopy: '絆が燃える！絵巻にのこる大師町屋台で、忘れられない秋祭りを！',
    area: '愛媛県西条市大師町',
    period: '2026年10月15日（木）〜16日（金）',
    deadline: '2026年9月22日（火）',
    summary:
      '西条藩の陣屋跡のそばに残る、住む人20軒に満たない町。それでも思いを繋いだ人々が毎年集います。町の一員として西条祭りに参加しませんか。',
    thumbnail: '/images/omatsu/project/daishimachi/01.jpg',
    status: '募集中',
  },
  {
    slug: 'otani',
    title: '西条祭り（飯積神社祭礼）',
    organization: '大谷太鼓台',
    catchcopy: '寄せ太鼓が魅せる！迫力と一体感の【大谷太鼓台】のお祭り！',
    area: '愛媛県西条市大谷',
    period: '2026年10月17日（土）午前2時〜',
    deadline: '2026年9月末日',
    summary:
      '11台の太鼓台が一斉に差し上げる「寄せ太鼓」発祥の地。誰もが気軽に肩を並べられる温かさが魅力の大谷太鼓台で、共に担ぐ仲間を募集します。',
    thumbnail: '/images/omatsu/project/otani/01.jpg',
    status: '募集中',
  },
  {
    slug: 'hongo',
    title: '西条祭り（飯積神社祭礼）',
    organization: '飯岡本郷太鼓台',
    catchcopy: '龍の物語が美しい、本郷スタイルのかき夫参加者募集！',
    area: '愛媛県西条市飯岡本郷',
    period: '2026年10月16日（金）〜17日（土）',
    deadline: '2026年10月7日（水）',
    summary:
      '明治初期の創建から4代目。9頭の龍で龍の一生を描いた布団締めが最大の見どころ。「団結」「担き太鼓」「こだわりの太鼓台」を掲げる一台です。',
    thumbnail: '/images/omatsu/project/hongo/01.jpg',
    status: '募集中',
  },
];

/** エントリーフォームの選択肢や申込データに使う表記。
 *  「自治会名_お祭り名」の形に統一する。
 */
export function entryLabel(p: Pick<OmatsuProject, 'organization' | 'title'>): string {
  return `${p.organization}_${p.title}`;
}

/** YouTubeチャンネル「えひめ西条つながり基金TV」 */
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@TV-kp6mj/shorts';

/** トップページのインタビュー欄に流すYouTubeショート。
 *  表示順はページを開くたびにランダムに入れ替わる。
 *  動画を追加するときは、YouTubeのURL末尾のID（例 youtube.com/shorts/XXXXXXXXXXX）と
 *  タイトルをここに1行足すだけでよい。
 */
export interface OmatsuShort {
  /** YouTubeの動画ID（11文字） */
  id: string;
  title: string;
}

export const shorts: OmatsuShort[] = [
  { id: 'Owo58dfGIrE', title: 'プロジェクトにかける想い' },
  { id: 'RPK5WXmBYDM', title: '西条のお祭り、何がすごいの？' },
  { id: '6r0CJodvccE', title: '西条まつりとは？' },
  { id: 'HAliR7DNvtU', title: 'それぞれのお祭りの特徴は？' },
  { id: 'euPya7ROw9A', title: '西条祭りの魅力！秋川さんインタビュー' },
  { id: 'usCe8je0SYI', title: '西条まつりに参加して「紺屋町屋台」' },
  { id: 'l9CP7j_XEqQ', title: '三嶋神社のお祭りに参加して' },
  { id: '0xBInizWrno', title: '石鎚神社のお祭り 前編' },
  { id: 'KFYqG3wUufI', title: '田滝おれん踊りの歴史とは' },
  { id: 'I_4Np0VZ5bI', title: '田滝おれんおどり 地域の人との関わりは' },
];

/** ショート動画のサムネイル（縦長）URL */
export function shortThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/oar2.jpg`;
}

/** サムネイルが無い場合の代替（動画の1コマ） */
export function shortThumbnailFallback(id: string): string {
  return `https://i.ytimg.com/vi/${id}/frame0.jpg`;
}

/** 協賛企業
 *  tier の順（gold → silver → bronze）に掲載される。
 *  logo は public/ からのパス。未設定のあいだは仮枠が表示される。
 *  interviewId を設定すると、協賛企業ページのインタビュー記事にリンクする。
 */
export type SponsorTier = 'gold' | 'silver' | 'bronze';

export interface Sponsor {
  /** 企業・団体名 */
  name: string;
  tier: SponsorTier;
  /** ロゴ画像のパス（例: '/images/omatsu/sponsors/yada-denki.jpg'）未設定なら仮枠 */
  logo?: string;
  /** 企業サイトのURL */
  url?: string;
  /** リンクの表示名。省略時は「公式サイト」 */
  linkLabel?: '公式サイト' | '公式SNS' | '関連サイト';
  /** インタビュー記事のslug（例: 'yada-denki'）。interviews 配列と対応させる */
  interviewSlug?: string;
}

export const sponsorTierLabels: Record<SponsorTier, { ja: string; en: string }> = {
  gold: { ja: 'ゴールドスポンサー', en: 'GOLD' },
  silver: { ja: 'シルバースポンサー', en: 'SILVER' },
  bronze: { ja: 'ブロンズスポンサー', en: 'BRONZE' },
};

// 社名は「㈱／㈲」の略号で統一し、敬称「さま」まで含めて登録する
// （画面にはこのまま表示されます）。
// url を設定するとロゴが公式サイトへのリンクになります。
export const sponsors: Sponsor[] = [
  {
    name: '㈲矢田電気さま',
    tier: 'gold',
    interviewSlug: 'yada-denki',
    logo: '/images/omatsu/sponsors/yada-denki.jpg',
    url: 'https://www.kensetumap.com/company/445120/',
    linkLabel: '関連サイト',
  },
  {
    name: '㈲東新技研さま',
    tier: 'silver',
    interviewSlug: 'toshin-giken',
    logo: '/images/omatsu/sponsors/toshin-giken.jpg',
    url: 'https://www.toushin-giken.co.jp/',
  },
  // --- ブロンズスポンサー ---
  {
    name: '㈱H＆M一級建築士事務所さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/hm-kenchikushi.jpg',
    url: 'https://handm2013.com/',
  },
  {
    name: '㈱NEXTAさま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/nexta.png',
    url: 'https://www.nexta-auto.jp/',
  },
  {
    name: 'Libertyさま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/liberty.jpg',
    url: 'https://www.facebook.com/dressyliberty',
    linkLabel: '公式SNS',
  },
  {
    name: '㈲伊予提灯工房さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/iyo-chochin.jpg',
    url: 'https://www.instagram.com/iyochochin/',
    linkLabel: '公式SNS',
  },
  {
    name: 'うちだ美容室さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/uchida-biyoshitsu.png',
    url: 'http://www.beauty-uchida.co.jp/',
  },
  {
    name: '㈱金鱗さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/kinrin.png',
    url: 'http://kinrin.jp/',
  },
  {
    name: '㈱三河屋さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/mikawaya.png',
    url: 'https://www.instagram.com/mikawaya1769/',
    linkLabel: '公式SNS',
  },
  {
    name: '㈱三崎建築設計さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/misaki-kenchiku.jpg',
    url: 'https://misaki-architects.info/',
  },
  {
    name: '㈱ヤマダさま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/yamada.png',
    url: 'https://www.yamada2937.com/',
  },
  {
    name: '行政書士ほしくま事務所さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/hoshikuma.jpg',
    url: 'https://hosikuma.com/',
  },
  {
    name: '工藤石油㈱さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/kudo-sekiyu.jpg',
    url: 'https://eneos-ss.com/search/ss/pc/detail.php?SCODE=680212',
    linkLabel: '関連サイト',
  },
  {
    name: '高橋畳センターさま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/takahashi-tatami.png',
    url: 'https://saijo.mypl.net/shop/00000375527/',
    linkLabel: '関連サイト',
  },
  {
    name: '樋口商店さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/higuchi-shoten.jpg',
    url: 'https://higuchisyouten.com/',
  },
  {
    name: '税理士法人ミチ・ツナグさま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/michi-tsunagu.jpg',
    url: 'https://www.michitsunagu.com/',
  },
  {
    name: '㈱弓山建設さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/yumiyama-kensetsu.jpg',
    url: 'http://www.yumiyama.jp/',
  },
  {
    name: '読売センターいよ西条さま',
    tier: 'bronze',
    logo: '/images/omatsu/sponsors/yomiuri-iyosaijo.jpg',
    url: 'https://www.mapion.co.jp/phonebook/M02031/38206/23830209628/',
    linkLabel: '関連サイト',
  },
];

/** 指定した階級の協賛企業を取り出す */
export function sponsorsByTier(tier: SponsorTier): Sponsor[] {
  return sponsors.filter((s) => s.tier === tier);
}

/** 協賛企業インタビュー記事の一覧
 *  記事を追加したら、ここに1行足す。ページ本体は
 *  src/pages/projects/Omatsu-RebootCAMP/interview/<slug>.astro に置く。
 */
export interface OmatsuInterview {
  /** URLの末尾。ファイル名と一致させる */
  slug: string;
  /** 企業・団体名（敬称「さま」まで含めて書く） */
  company: string;
  /** 協賛の階級（カードのバッジになる） */
  tier: SponsorTier;
  /** 記事のタイトル。カードの見出しになる */
  title: string;
  /** カードに出す短い紹介文（省略可） */
  summary?: string;
  /** サムネイル画像のパス。未設定なら仮枠が出る */
  thumbnail?: string;
  /** 掲載日 YYYY-MM-DD（省略可） */
  date?: string;
}

/* ============================================================
   【インタビューを公開するとき】
   この配列に1件足すと、協賛企業ページに「INTERVIEW」の欄が現れ、
   該当企業のロゴ下に「インタビューを読む →」のリンクも出ます。
   配列が空のあいだは、インタビュー関連の表示が丸ごと消えます。

   記事本体は
     src/pages/projects/Omatsu-RebootCAMP/interview/_<slug>.astro
   に下書きが置いてあります。ファイル名の先頭の「_」を外すと公開されます
   （「_」付きのファイルはビルドされません）。

   例）矢田電気さまの記事を公開する場合
     1. _yada-denki.astro → yada-denki.astro にリネーム
     2. 下のコメントを外して内容を整える
   ============================================================ */
export const interviews: OmatsuInterview[] = [
  // {
  //   slug: 'yada-denki',
  //   company: '㈲矢田電気さま',
  //   tier: 'gold',
  //   title: '記事のタイトル',
  //   summary: 'カードに出す短い紹介文',
  //   thumbnail: '/images/omatsu/interviews/yada-denki.jpg',
  //   date: '2026-09-01',
  // },
  // {
  //   slug: 'toshin-giken',
  //   company: '㈲東新技研さま',
  //   tier: 'silver',
  //   title: '記事のタイトル',
  //   thumbnail: '/images/omatsu/interviews/toshin-giken.jpg',
  // },
];

/** slug からインタビュー記事の情報を引く */
export function findInterview(slug: string): OmatsuInterview | undefined {
  return interviews.find((i) => i.slug === slug);
}

/** お知らせ記事の一覧
 *  記事を追加したら、ここに1行足す。ページ本体は
 *  src/pages/projects/Omatsu-RebootCAMP/news/<slug>.astro に置く。
 */
export interface OmatsuNews {
  slug: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  category?: string;
}

export const news: OmatsuNews[] = [
  // {
  //   slug: '2026-09-01-boshu-kaishi',
  //   title: '2026年度の参加者募集を開始しました',
  //   date: '2026-09-01',
  //   category: 'お知らせ',
  // },
];

/** YYYY-MM-DD を「2026.09.01」形式に */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}.${m}.${d}`;
}
