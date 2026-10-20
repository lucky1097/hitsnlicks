# Minimal static file server for local development (no Node/Python needed).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8080
param([int]$Port = 8080)

$root = Split-Path -Parent $PSScriptRoot
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.woff2' = 'font/woff2'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.wav' = 'audio/wav'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Hits & Licks dev server: http://localhost:$Port/  (root: $root)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ($rel -eq '') { $rel = 'index.html' }
      $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $path -PathType Leaf)) {
        $res.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes("404: $rel")
      } else {
        $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
        $type = $mime[$ext]; if (-not $type) { $type = 'application/octet-stream' }
        $res.ContentType = $type
        $bytes = [IO.File]::ReadAllBytes($path)
      }
      if ($rel -like '*.png' -or $rel -like '*.jpg') { $res.Headers.Add('Cache-Control', 'max-age=600') } else { $res.Headers.Add('Cache-Control', 'no-store') }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $res.StatusCode = 500
    } finally {
      $res.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
}
