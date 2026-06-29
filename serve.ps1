param(
  [int]$Port = 5173
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Address = [System.Net.IPAddress]::Parse("127.0.0.1")
$Listener = [System.Net.Sockets.TcpListener]::new($Address, $Port)
$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".svg" = "image/svg+xml"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body
  )

  $Header = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
}

try {
  $Listener.Start()
  Write-Host "Task Muse: http://127.0.0.1:$Port/"

  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $RequestLine = $Reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($RequestLine)) {
        continue
      }

      while ($Reader.Peek() -gt -1) {
        $Line = $Reader.ReadLine()
        if ([string]::IsNullOrEmpty($Line)) {
          break
        }
      }

      $Parts = $RequestLine.Split(" ")
      $Target = if ($Parts.Length -ge 2) { $Parts[1] } else { "/" }
      $PathOnly = $Target.Split("?")[0]
      if ($PathOnly -eq "/") {
        $PathOnly = "/index.html"
      }

      $Relative = [System.Uri]::UnescapeDataString($PathOnly.TrimStart("/")).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
      $FullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $Relative))
      $RootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

      if (-not $FullPath.StartsWith($RootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        Send-Response $Stream 403 "Forbidden" "text/plain; charset=utf-8" $Body
        continue
      }

      if (-not [System.IO.File]::Exists($FullPath)) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        Send-Response $Stream 404 "Not Found" "text/plain; charset=utf-8" $Body
        continue
      }

      $Extension = [System.IO.Path]::GetExtension($FullPath).ToLowerInvariant()
      $ContentType = if ($MimeTypes.ContainsKey($Extension)) { $MimeTypes[$Extension] } else { "application/octet-stream" }
      $Body = [System.IO.File]::ReadAllBytes($FullPath)
      Send-Response $Stream 200 "OK" $ContentType $Body
    } catch {
      if ($Stream) {
        $Body = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
        Send-Response $Stream 500 "Internal Server Error" "text/plain; charset=utf-8" $Body
      }
    } finally {
      $Client.Close()
    }
  }
} finally {
  $Listener.Stop()
}
