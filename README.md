# 外部コミュニケーション記録アプリ — 移行手順

## ファイル構成（移行後）

```
haccp/
├── index.html   ← メイン画面（これだけ）
├── app.js       ← ロジック（Supabase対応版）
└── setup.sql    ← Supabase DB初期化SQL（初回のみ）
```

PHPファイル（config.php / records.php / members.php / export.php / setup.php / db.php）は
すべて不要になります。

---

## 変更点まとめ

| 項目 | 移行前 | 移行後 |
|---|---|---|
| ホスティング | InfinityFree（PHP必須） | Cloudflare Pages（静的） |
| データベース | MySQL | PostgreSQL（Supabase） |
| 記録CRUD | records.php（PHP） | Supabase REST API |
| 設定（メンバー） | members.php（PHP） | Supabase app_settings テーブル |
| PDF出力 | export.php でHTML生成 | ブラウザ印刷（同等の品質） |
| Excel出力 | ZipArchiveでxlsx生成 | SheetJS（クライアント生成） |
| デプロイ | FTPアップロード | GitHubプッシュで自動反映 |

---

## STEP 1 — Supabase でテーブルを作る

石灰散布アプリや報告書アプリで**同じプロジェクトを使い回せます**。

1. [supabase.com](https://supabase.com) → 該当プロジェクトを開く
2. 左メニュー「SQL Editor」→「New query」
3. `setup.sql` の内容を貼り付けて「Run」
4. エラーなく完了すればOK

Project Settings → API から以下をメモ：
- **Project URL**（例: `https://abcde.supabase.co`）
- **anon public キー**（`eyJ...`から始まる文字列）

---

## STEP 2 — `app.js` の2行を書き換える

```javascript
const SUPABASE_URL     = 'https://あなたのID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...あなたのanonキー...';
```

---

## STEP 3 — GitHubにアップロード

`index.html` と `app.js` の2ファイルをGitHubリポジトリに追加（他のアプリと同じリポジトリでOK）。

---

## STEP 4 — Cloudflare Pages でホスティング

他のアプリと同じリポジトリを使っている場合は追加作業なし。
GitHubにpushするだけで自動デプロイされます。

新しいリポジトリの場合は「Workers & Pages」→「Pages」タブ→「Connect to Git」。

---

## STEP 5 — アクセスURL

```
https://あなたのプロジェクト.pages.dev/haccp/index.html
```

または同リポジトリのルートにある場合：
```
https://あなたのプロジェクト.pages.dev/index.html
```

---

## 既存データの移行

InfinityFreeのphpMyAdminで `comm_records` と `app_settings` テーブルをCSVエクスポートし、
SupabaseのTable EditorでCSVインポートできます。

インポート後、シーケンスをリセット：
```sql
SELECT setval('comm_records_id_seq', (SELECT MAX(id) FROM comm_records));
```
