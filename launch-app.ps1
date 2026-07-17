# ひかるのやることリスト - ローカル本番ビルド起動ランチャー
# デスクトップショートカットから呼び出される想定。
# エラーが起きても黙って死なず、最後の手段として既定ブラウザでURLを開く。

$ErrorActionPreference = 'Stop'

$AppDir = 'C:\Claude\goal-todo'
$Url = 'http://localhost:4173'

try {
    # Node/npmのPATHを通す
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    # 既にサーバーが応答しているか確認
    $alreadyRunning = $false
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) {
            $alreadyRunning = $true
        }
    } catch {
        $alreadyRunning = $false
        $null = $_
    }

    if (-not $alreadyRunning) {
        # vite preview をウィンドウ非表示で起動
        $viteJs = Join-Path $AppDir 'node_modules\vite\bin\vite.js'
        $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCmd -and (Test-Path $viteJs)) {
            $nodePath = $nodeCmd.Source
            Start-Process -FilePath $nodePath `
                -ArgumentList @($viteJs, 'preview', '--port', '4173', '--strictPort') `
                -WorkingDirectory $AppDir `
                -WindowStyle Hidden

            # 起動を待つ(最大10秒ポーリング)
            $ready = $false
            for ($i = 0; $i -lt 20; $i++) {
                Start-Sleep -Milliseconds 500
                try {
                    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
                    if ($resp.StatusCode -eq 200) {
                        $ready = $true
                        break
                    }
                } catch {
                    $null = $_ # まだ起動中
                }
            }
        }
    }

    # Edgeをアプリモードで開く
    $edgePaths = @(
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
    $edgeExe = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($edgeExe) {
        Start-Process -FilePath $edgeExe -ArgumentList "--app=$Url"
    } else {
        Start-Process $Url
    }
}
catch {
    # 最後の手段: 既定ブラウザでURLを開く
    try {
        Start-Process $Url
    } catch {
        $null = $_ # これも失敗した場合は何もできることがない
    }
}
