// src/lib/microcms.ts
/**
 * microCMS API クライアント
 * microCMSのドキュメント: https://microcms.io/docs/api
 */

const MICROCMS_SERVICE_DOMAIN = import.meta.env.MICROCMS_SERVICE_DOMAIN;
const MICROCMS_API_URL = import.meta.env.MICROCMS_API_URL;
const MICROCMS_API_KEY = import.meta.env.MICROCMS_API_KEY;

interface MicroCMSOptions {
  limit?: number;
  offset?: number;
  depth?: number;
  filters?: string;
  orders?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('microCMS returned non-JSON response');
  }
}

function buildContentUrl(endpoint: string, options?: MicroCMSOptions): string {
  const baseUrl = MICROCMS_SERVICE_DOMAIN
    ? `https://${MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1`
    : (MICROCMS_API_URL || '').replace(/\/+$/, '');
  const params = new URLSearchParams();

  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.depth) params.append('depth', options.depth.toString());
  if (options?.filters) params.append('filters', options.filters);
  if (options?.orders) params.append('orders', options.orders);

  const isLegacyApiPath = baseUrl.includes('/apis/');
  const endpointSuffix = isLegacyApiPath ? `/apis/${endpoint}` : `/api/v1/${endpoint}`;
  const resolvedBase = baseUrl.endsWith(endpointSuffix) ? baseUrl : `${baseUrl}/${endpoint}`;

  return `${resolvedBase}${params.toString() ? '?' + params.toString() : ''}`;
}

/**
 * microCMSからデータを取得
 */
export async function getMicroCMSContent<T>(
  endpoint: string,
  options?: MicroCMSOptions
): Promise<T> {
  if ((!MICROCMS_SERVICE_DOMAIN && !MICROCMS_API_URL) || !MICROCMS_API_KEY) {
    console.warn('microCMS環境変数が設定されていません。.env.localを確認してください。');
    // デモ用のダミーデータを返す
    return getDummyContent(endpoint) as T;
  }

  const url = buildContentUrl(endpoint, options);

  try {
    const response = await fetch(url, {
      headers: {
        'X-API-KEY': MICROCMS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`microCMS API Error: ${response.status} ${response.statusText}`);
    }

    return await parseJsonResponse<T>(response);
  } catch (error) {
    console.error(`Error fetching from microCMS (${endpoint}):`, error);
    // エラー時はダミーデータを返す
    return getDummyContent(endpoint) as T;
  }
}

/**
 * 単一のドキュメントを取得
 */
export async function getMicroCMSDocument<T>(
  endpoint: string,
  documentId: string
): Promise<T> {
  if ((!MICROCMS_SERVICE_DOMAIN && !MICROCMS_API_URL) || !MICROCMS_API_KEY) {
    return getDummyDocument(endpoint, documentId) as T;
  }

  const baseUrl = MICROCMS_SERVICE_DOMAIN
    ? `https://${MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1`
    : (MICROCMS_API_URL || '').replace(/\/+$/, '');
  const isLegacyApiPath = baseUrl.includes('/apis/');
  const endpointSuffix = isLegacyApiPath ? `/apis/${endpoint}` : `/api/v1/${endpoint}`;
  const resolvedBase = baseUrl.endsWith(endpointSuffix) ? baseUrl : `${baseUrl}/${endpoint}`;
  const url = `${resolvedBase}/${documentId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-API-KEY': MICROCMS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`microCMS API Error: ${response.status} ${response.statusText}`);
    }

    return await parseJsonResponse<T>(response);
  } catch (error) {
    console.error(`Error fetching document from microCMS:`, error);
    return getDummyDocument(endpoint, documentId) as T;
  }
}

/**
 * デモ用ダミーコンテンツ
 */
function getDummyContent(endpoint: string): Record<string, any> {
  const dummyData: Record<string, any> = {
    news: {
      contents: [
        {
          id: '1',
          title: '【重要】寄付型クラウドファンディング第2期の募集開始',
          description: '今年度も寄付型クラウドファンディングを開始いたします。',
          publishedAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: '新しい助成プログラムのご紹介',
          description: '組織基盤強化支援プログラムが新たに始まります。',
          publishedAt: new Date().toISOString(),
        },
        {
          id: '3',
          title: 'OMATSU-RebootCAMP 2024の参加者募集中',
          description: '起業家育成プログラムへの参加をお待ちしております。',
          publishedAt: new Date().toISOString(),
        },
      ],
      totalCount: 3,
    },
    projects: {
      contents: [
        {
          id: 'project-1',
          title: 'OMATSU-RebootCAMP',
          description: '地域の起業家育成と支援プログラム',
          image: { url: '#' },
        },
        {
          id: 'project-2',
          title: '地域共創プロジェクト',
          description: '企業×NPO×行政の協働で実現する地域課題解決',
          image: { url: '#' },
        },
        {
          id: 'project-3',
          title: '次世代育成イニシアティブ',
          description: '若き起業家と地域をつなぐネットワーク構築',
          image: { url: '#' },
        },
      ],
      totalCount: 3,
    },
    grants: {
      contents: [
        {
          id: 'grant-1',
          title: '地域課題解決助成プログラム',
          description: '地域の課題解決に取り組むNPOを支援します',
          deadline: '2024-06-30',
        },
        {
          id: 'grant-2',
          title: 'スタートアップ育成プログラム',
          description: '起業家の事業化を支援します',
          deadline: '2024-05-31',
        },
      ],
      totalCount: 2,
    },
  };

  return dummyData[endpoint] || { contents: [], totalCount: 0 };
}

/**
 * デモ用ダミードキュメント
 */
function getDummyDocument(endpoint: string, documentId: string): Record<string, any> {
  return {
    id: documentId,
    title: 'Sample Document',
    content: 'This is a sample document',
  };
}
