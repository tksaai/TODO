# Task Muse

タスクを達成すると、応援キャラクターのミラが音声付きで褒めてくれるタスク管理アプリです。

## 構成

- アプリ本体: Cloudflare Pages に静的デプロイ
- タスク保存: ブラウザの `localStorage`
- 音声: Web Speech API
- LLM: DDNS で公開したサーバーPC上の Ollama へ HTTPS で接続

## Cloudflare Pages へのデプロイ

### いまのCloudflare画面でWorkerとして作る場合

Cloudflareの新しい作成画面で `Create a Worker` と表示される場合は、Workers Static Assets としてデプロイできます。

```text
Project name: todo
Build command: npm run build
Deploy command: npx wrangler deploy
```

`Project name` は小文字・数字・ハイフンだけなので、`TODO` ではなく `todo` にしてください。

### GitHub連携

この方式を推奨します。

1. GitHubで空のリポジトリを作成します。
   - Repository name: `TODO`
   - Public/Private: どちらでも可
   - README / .gitignore / license は追加しない
2. このローカルリポジトリにGitHubのURLを設定してpushします。

```powershell
git remote add origin https://github.com/tksaai/TODO.git
git push -u origin main
```

3. Cloudflare Dashboardで `Workers & Pages` -> `Create application` -> `Pages` -> `Connect to Git` を選びます。
4. GitHub連携を許可し、`TODO` リポジトリを選びます。
5. Pages のビルド設定は以下にします。

```text
Framework preset: None
Build command: 空欄
Build output directory: .
Root directory: /
Production branch: main
```

以後は `git push` するたびに Cloudflare Pages が自動デプロイします。

### 手動アップロード

CLI で直接アップロードする場合は以下です。

```powershell
npx wrangler pages deploy . --project-name task-muse
```

`_headers` はCloudflare用のセキュリティヘッダーです。HTTPS ページから DDNS の LLM サーバーへ接続するため、`connect-src` は `https:` を許可しています。Workers Static Assets のSPA fallbackは `wrangler.toml` の `not_found_handling = "single-page-application"` で処理します。

## LLM サーバーPC

サーバーPCには Ollama と Caddy を入れます。

```powershell
ollama pull qwen2.5:0.5b
ollama serve
```

DDNS ホスト名を `server-pc/Caddyfile.example` の `your-ddns.example.com` に設定し、Cloudflare Pages のURLを `TASK_MUSE_ORIGIN` に設定します。この設定例では、APIキー付きで `/api/tags` と `/api/chat` だけを Ollama に転送します。

```powershell
.\server-pc\env.example.ps1
caddy run --config .\server-pc\Caddyfile.example
```

ルーターではサーバーPCへ 80/443 を転送してください。Cloudflare Pages は HTTPS なので、DDNS 側も HTTPS 必須です。

## アプリ側の設定

アプリ右側の「無料LLM」で以下を設定します。

- URL: `https://your-ddns.example.com`
- モデル: `qwen2.5:0.5b`
- APIキー: `TASK_MUSE_LLM_KEY` と同じ値

`config.js` に既定値を書いておくこともできます。

```js
window.TASK_MUSE_CONFIG = {
  llmEndpoint: "https://your-ddns.example.com",
  llmModel: "qwen2.5:0.5b"
};
```

## ローカル確認

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1 -Port 5173
```

ブラウザで `http://127.0.0.1:5173/` を開きます。

## スマホ利用

幅の狭い画面ではタスク入力、検索、フィルターが縦に並び、達成時の褒め台詞は下部にも表示されます。
