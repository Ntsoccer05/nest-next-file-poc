'use client';

import { useState, useRef, useEffect } from 'react';

interface UploadResult {
  name: string;
  size: number;
  mimeType: string;
  createdAt: string | null;
  modifiedAt: string | null;
  createdAtSource: 'exif' | 'lastModified' | 'unknown';
  exifCreatedAt: string | null;
  exifModifiedAt: string | null;
  clientLastModified: string | null;
  exifTags: Record<string, unknown>;
  blocked: false;
}

interface UploadError {
  error: string;
}

const BACKEND_URL = 'http://localhost:3001/upload';

// SSR/クライアント差異を避けるため、マウント後のみ日時フォーマット
function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}

function toJST(iso: string | null, isClient: boolean): string {
  if (!iso) return '—';
  if (!isClient) return iso; // SSR時はUTCのまま返す
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function Home() {
  const [result, setResult] = useState<UploadResult | UploadError | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isClient = useIsClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setLoading(true);
    setResult(null);
    setShowAllTags(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('lastModified', String(selectedFile.lastModified));
    try {
      const res = await fetch(BACKEND_URL, { method: 'POST', body: formData });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const isError = result && 'error' in result;
  const ok = result && !isError ? (result as UploadResult) : null;

  return (
    <main style={{ paddingBottom: 60 }}>
      <h1>File Upload PoC</h1>
      <p style={{ color: '#666' }}>NestJS + file-type + exiftool-vendored</p>

      <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
        <input
          ref={inputRef}
          type="file"
          onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setResult(null); }}
          style={{ display: 'block', marginBottom: 8 }}
        />
        {selectedFile && (
          <small style={{ color: '#888', display: 'block', marginBottom: 12 }}>
            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            &nbsp;—&nbsp;
            ブラウザlastModified: {toJST(new Date(selectedFile.lastModified).toISOString(), isClient)} (JST)
          </small>
        )}
        <button
          type="submit"
          disabled={!selectedFile || loading}
          style={{
            padding: '8px 24px',
            backgroundColor: selectedFile && !loading ? '#0070f3' : '#ccc',
            color: '#fff', border: 'none', borderRadius: 4,
            cursor: selectedFile && !loading ? 'pointer' : 'default',
          }}
        >
          {loading ? 'アップロード中...' : 'アップロード'}
        </button>
      </form>

      {isError && (
        <div style={cardStyle('#fff0f0', '#ffcccc')}>
          <h2 style={{ color: '#cc0000', marginTop: 0 }}>エラー</h2>
          <p>{(result as UploadError).error}</p>
        </div>
      )}

      {ok && (
        <>
          {/* ── 基本情報 ── */}
          <section style={cardStyle('#f8f8f8', '#ddd')}>
            <h2 style={{ marginTop: 0 }}>基本情報</h2>
            <Table rows={[
              ['ファイル名',  ok.name],
              ['サイズ',      `${ok.size.toLocaleString()} bytes`],
              ['MIMEタイプ',  ok.mimeType],
            ]} />
          </section>

          {/* ── 日時情報 ── */}
          <section style={cardStyle('#f0fff4', '#bbf7d0')}>
            <h2 style={{ marginTop: 0 }}>日時情報</h2>
            <Table rows={[
              ['EXIFの作成日時 (CreateDate)',
                ok.exifCreatedAt
                  ? `${toJST(ok.exifCreatedAt, isClient)} (JST) / ${ok.exifCreatedAt} (UTC)`
                  : '—（EXIFなし）'],
              ['EXIFの更新日時 (ModifyDate)',
                ok.exifModifiedAt
                  ? `${toJST(ok.exifModifiedAt, isClient)} (JST) / ${ok.exifModifiedAt} (UTC)`
                  : '—（EXIFなし）'],
              ['ブラウザ lastModified（OSの更新日時）※',
                ok.clientLastModified
                  ? `${toJST(ok.clientLastModified, isClient)} (JST) / ${ok.clientLastModified} (UTC)`
                  : '—（未送信）'],
              ['解決済み createdAt',
                ok.createdAt
                  ? `${toJST(ok.createdAt, isClient)} (JST) / ${ok.createdAt} (UTC)`
                  : '—'],
              ['解決済み modifiedAt',
                ok.modifiedAt
                  ? `${toJST(ok.modifiedAt, isClient)} (JST) / ${ok.modifiedAt} (UTC)`
                  : '—'],
              ['取得元', sourceLabel(ok.createdAtSource)],
            ]} />
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#666' }}>
              ※ ブラウザのFile APIはOSの「更新日時」(lastModified)のみ取得可能。
              「作成日時」(birthtime)はブラウザ仕様上取得不可。
            </p>
          </section>

          {/* ── EXIFタグ一覧 ── */}
          <section style={cardStyle('#f0f4ff', '#bbd0f7')}>
            <h2 style={{ marginTop: 0 }}>
              EXIFタグ一覧
              <span style={{ fontSize: 13, color: '#666', fontWeight: 'normal', marginLeft: 8 }}>
                ({Object.keys(ok.exifTags ?? {}).length} 件)
              </span>
            </h2>
            <button
              onClick={() => setShowAllTags(v => !v)}
              style={{ marginBottom: 12, padding: '4px 12px', cursor: 'pointer' }}
            >
              {showAllTags ? '折りたたむ' : '展開して表示'}
            </button>
            {showAllTags && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>タグ名</th>
                      <th style={thStyle}>値</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(ok.exifTags ?? {}).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid #dde' }}>
                        <td style={{ ...tdStyle, fontWeight: 'bold', color: '#334' }}>{k}</td>
                        <td style={{ ...tdStyle, wordBreak: 'break-all' }}>
                          {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function sourceLabel(src: string) {
  if (src === 'exif') return 'EXIFメタデータ';
  if (src === 'lastModified') return 'ブラウザ lastModified';
  return '不明';
}

function cardStyle(bg: string, border: string): React.CSSProperties {
  return { marginTop: 24, padding: 20, borderRadius: 8, backgroundColor: bg, border: `1px solid ${border}` };
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 12px',
  backgroundColor: '#e8eeff', borderBottom: '2px solid #bbd0f7',
};
const tdStyle: React.CSSProperties = { padding: '5px 12px' };

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} style={{ borderBottom: '1px solid #e0e0e0' }}>
            <td style={{ padding: '6px 12px 6px 0', color: '#555', whiteSpace: 'nowrap', width: 260 }}>{label}</td>
            <td style={{ padding: '6px 0', wordBreak: 'break-all' }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
