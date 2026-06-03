// src/lib/microcms.ts
import { createClient } from 'microcms-js-sdk';

// Vercelとの連携設定（ここはそのまま）
export const client = createClient({
  serviceDomain: import.meta.env.MICROCMS_SERVICE_DOMAIN ?? 'placeholder',
  apiKey: import.meta.env.MICROCMS_API_KEY ?? 'placeholder',
});

// ==========================================
// ここから下が「データの設計図（型）」です！
// ==========================================

// 1. お知らせ (news)
export interface News {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
}

// 2. 寄付・支援実績 (statistics)
export interface Statistic {
  total_amount: number;      // 寄付総額（数字）
  supporter_count: number;   // 寄付者延べ人数（数字）
  last_update: string;       // 最終更新日（文字）
}

// 3. プロジェクト一覧 (projects)
export interface Project {
  id: string;
  title: string;             // タイトル
  description: string;       // 説明文
  image?: { url: string };   // 画像（?は「無い場合もあるよ」という意味）
  content?: string;          // 詳細内容
}

// 4. 助成プログラム (grants)
export interface Grant {
  id: string;
  title: string;
  status: string[];          // 募集中などのステータス
  deadline?: string;
  image?: { url: string };
  content?: string;
  url?: string;              // 外部リンク（microCMSで作ったページのURL）
}

// 5. 活動レポート (reports)
export interface Report {
  id: string;
  title: string;
  organization: string;      // 団体名
  summary: string;           // 概要
  image?: { url: string };
  content?: string;
  date?: string;             // 公開日・実施日
}