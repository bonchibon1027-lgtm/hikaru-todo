# ひかるのやることリスト

ゴール → ステップ → Todo の3階層を一目で俯瞰できる、階層型タスク管理PWA。

## 技術スタック

- Vite + React 18(実体は React 19) + TypeScript
- PWA: `vite-plugin-pwa`(自動更新)
- データ層: ローカル(localStorage)/ Supabase(Postgres + Auth)の2実装を切替可能

## ローカル起動

```bash
npm install
npm run dev
```

`http://localhost:5173` を開くと、**何も設定しなくてもローカルモード(localStorage保存)で即動作**します。ログイン不要です。

### ビルド

```bash
npm run build   # tsc + vite build。dist/ に出力
npm run preview # ビルド結果をローカルで確認
```

## データの保存先

- **デフォルト(ローカルモード)**: ブラウザの `localStorage`(キー: `hikaru-todo-data`)に保存されます。他の端末とは同期されません。
- **Supabaseモード**: `.env` に接続情報を設定すると、Supabase(クラウド)に保存され、複数端末で同じデータを見られるようになります。切替は自動判定(`.env` に URL・ANON KEY が両方揃っていればSupabaseモード)。

## Supabaseへの接続手順

1. [Supabase](https://supabase.com/) で無料プロジェクトを作成する
2. プロジェクトのSQL Editorを開き、`supabase/schema.sql` の内容を貼り付けて実行する
   - `goals` / `steps` / `todos` テーブルと、Row Level Security(所有者本人のみ全操作可)のポリシーが作成されます
3. Supabaseダッシュボードの `Project Settings > API` から、
   - `Project URL`
   - `anon public` キー
   を確認する
4. プロジェクトルートに `.env` ファイルを作成し、`.env.example` を参考に以下を記入する

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
   ```

5. `npm run dev` を再起動する。起動時にメール+パスワードのログイン画面が表示されるので、「アカウントを新規作成」から自分専用アカウントを作る(Supabaseの認証設定でメール確認をオフにしておくと即ログインできて楽です)
6. 2台目以降の端末でも同じ `.env` を設定してログインすれば、同じデータが同期されます(セッションは端末ごとに保持され、以後は自動ログイン)

`.env` は `.gitignore` 済みです。Supabaseの `anon` キーは公開前提のキーですが、リポジトリに直接コミットしない運用にしています。

## PWAとしてインストール

- スマホ(Chrome/Safari): ブラウザメニューから「ホーム画面に追加」
- PC(Chrome/Edge): アドレスバーのインストールアイコンからアプリ化

`npm run build` 後の `dist/` を静的ホスティング(Vercel / Netlify / Cloudflare Pages など)にデプロイすると、HTTPS配信されインストール可能になります(`npm run dev` のローカル環境でも動作確認は可能です)。

## デスクトップから起動

デプロイせずローカルで使う場合は、デスクトップの「ひかるのやることリスト」ショートカットをダブルクリックするだけで起動できます。内部では `launch-app.ps1` が本番ビルド(`dist/`)を `vite preview --port 4173` でバックグラウンド配信し(既に起動済みならスキップ)、Edgeをアプリモード(`--app=http://localhost:4173`、アドレスバーなしのウィンドウ)で開きます。Edgeが見つからない場合は既定のブラウザで開きます。ショートカットの実体は `launch-app.ps1` を非表示ウィンドウで実行するだけなので、コマンドプロンプトなどは表示されません。ビルド内容を更新した場合は `npm run build` を再実行してから起動し直してください(配信済みのプレビューサーバーが動いていると古い内容のままなので、一度タスクマネージャー等で該当の `node` プロセスを終了してから起動し直すと確実です)。

## JSONインポート

チャットのClaudeにタスク分解させた結果を貼り付けて、フォルダ・ゴール一式を一括登録できます。

- ツリービューの「JSONインポート」ボタン(ゴール追加ボタンの近く)を押すとテキストエリアが開きます
- 以下の形式のJSONを貼り付けて「読み込む」を押すと、内容がバリデーションされます
- 問題なければ「フォルダ○件・ゴール○件・ステップ○件・Todo○件を追加します」(フォルダが0件のときは「ゴール○件・ステップ○件・Todo○件を追加します」)というプレビューが出るので、「取り込む」で確定します(「キャンセル」で中止)
- 既存データには追記されます(上書きされません)。sortOrderは既存データの続きから、folders/goals/steps/todosは配列順で登録されます

### 形式

```json
{
  "folders": [
    {
      "title": "フォルダ名(例: 3年前期期末テスト)",
      "goals": [
        {
          "title": "ゴール名",
          "dueDate": "2026-08-31",
          "steps": [
            { "title": "ステップ名", "todos": ["Todo1", "Todo2"] },
            { "title": "Todoなしステップ", "todos": [] }
          ]
        }
      ]
    }
  ],
  "goals": [
    {
      "title": "フォルダに入れないゴール名",
      "dueDate": null,
      "steps": []
    }
  ]
}
```

- `folders` と `goals` はどちらもトップレベルの項目で、どちらも省略可(どちらか一方だけでもOK)。トップレベルの `goals` はフォルダに属さないゴール(トップレベル表示)になります
- 旧形式(`goals` のみ、`folders` なし)もそのまま有効です(完全後方互換)。既存のインポート用JSONはそのまま使えます
- `title`(フォルダ・ゴール・ステップ・Todoいずれも)は必須。空文字や欠落はエラーになり、何も登録されません
- フォルダ名が既存フォルダの `title` と完全一致する場合は新規フォルダを作らず、既存フォルダにゴールを追加します
- `dueDate` はゴールのみが持てます。`"YYYY-MM-DD"` 形式の文字列、または `null`。省略した場合も無期限(`null`)扱い。`"YYYY-MM-DD"` 以外の形式や実在しない日付はエラーになります(無期限扱いにはなりません)
- フォルダの `goals`、ゴールの `steps`、ステップの `todos` はいずれも省略可(省略時は空配列)
- JSONとして不正な場合は「JSONの形式が正しくありません」、`folders`/`goals` がどちらも無い、ゴールが1件もない、`title` 欠落などの場合はそれぞれ具体的なエラーメッセージが表示され、登録は行われません

## JSONエクスポート(v2追加)

現在の全active(非アーカイブ)データを、JSONインポートと互換のフォーマットで書き出せます。

- ツリービューの「エクスポート」ボタン(「JSONインポート」の隣)を押すと、整形済みJSONがテキストエリアに表示されます
- 「コピー」でクリップボードにコピーされます(`navigator.clipboard`が使えない環境ではテキストエリアが選択状態になるので、手動でコピーしてください)
- 完了済みのTodoには `"done": true`、完了済みのステップには `"status": "done"` が付与されます。このJSONをそのままインポートすると、完了状態を保ったまま復元されます(`done: true` のTodoは取り込み時に `completedAt` が現在時刻で設定されます)
- アーカイブ済みのゴールはエクスポートに含まれません。ゴールを1件も含まないフォルダも出力されません
- 用途: チャットのClaudeに現状のJSONを貼って相談し、追加分だけのJSONを生成してもらって再インポートする/端末間でデータを移し替える、など

## スマホ連動・クラウド同期(v2追加)

- Supabaseモード(`.env`にキー設定済み)でログインすると、初回ログイン後にクラウド側が空でローカルに保存済みデータがある場合、「この端末のデータをクラウドへ移行」バナーが表示されます。実行するとローカルの全データ(フォルダ・ゴール・ステップ・Todo、完了状態や並び順を含む)を順序を保ったままSupabaseへ登録します。失敗した場合、ローカルのデータは一切削除されません
- タブ・アプリを非表示から復帰した際(`visibilitychange`)、Supabaseモードでは自動的にクラウドから最新データを再取得します(ローカルモードでは何もしません)
- チェックボックスなど主要なタップ領域は44px以上を確保し、`viewport-fit=cover` + `env(safe-area-inset-*)` でノッチ・ホームインジケーターのある端末にも対応しています

## GitHub Pagesへのデプロイ(v2追加)

`main`ブランチへのpush時に `.github/workflows/deploy.yml`(リポジトリルート)が自動的にビルド・デプロイします。

- Node 20 + `npm ci` → `VITE_BASE=/hikaru-todo/` を設定して `npm run build`(サブパス配信に対応するため、vite.config.tsの`base`をこの環境変数で切り替えます。ローカル開発・未設定時は従来通り`base: '/'`)
- Supabaseキー(`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)はリポジトリの Secrets に設定されていればビルド時に環境変数として渡されます。**未設定でもビルドは失敗せず**、その場合はローカルモード(localStorage保存、ログイン不要)で公開されます
- `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages` を使用。事前にリポジトリの Settings → Pages で「GitHub Actions」をソースとして選択してください
- ワークフローは `goal-todo/**` の変更時のみ起動します(このリポジトリは複数プロジェクトを含むため)

## 画面構成

- **Todoビュー**: 未完了Todoのフラット一覧。チェックで即完了。デフォルトは各ゴールの「現在のステップ」のTodoのみ表示(ヘッダーの「すべて表示」トグルで全件表示に切替可)。スマホでの初期画面
- **ツリービュー**: フォルダ(任意)→ゴール→ステップ→Todoの階層表示、進捗バー付き。現在のステップにはNOWバッジが付き展開表示、それ以降の未来ステップは折りたたみがデフォルト。PC(768px以上)での初期画面

下部のタブで切り替えます。

## ディレクトリ構成

```
src/
  types/            データモデルの型定義(Folder/Goal/Step/Todo)
  repository/        永続化層(Repositoryインターフェース、Local/Supabase実装)
  context/           DataContext(状態管理・CRUD操作)
  auth/               Supabaseモード用ログイン画面
  components/         再利用UIコンポーネント(FolderCard/GoalCard/StepBlock等)
  views/              TreeView / TodoView
  utils/              進捗計算・JSONインポート/エクスポート・ストリーク計算・クリック音・UI設定などの純粋関数
supabase/
  schema.sql            Supabase用テーブル定義・RLSポリシー(新規プロジェクト用)
  migration-v1.2.sql     既存プロジェクトにフォルダ機能(v1.2)だけを追加する場合のALTER文
```
