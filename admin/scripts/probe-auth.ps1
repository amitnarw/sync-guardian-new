$ErrorActionPreference = "Stop"
$url = ((Get-Content .env.local | Where-Object { $_ -like 'NEXT_PUBLIC_SUPABASE_URL=*' }) -replace '^NEXT_PUBLIC_SUPABASE_URL=', '')
$key = ((Get-Content .env.local | Where-Object { $_ -like 'NEXT_PUBLIC_SUPABASE_ANON_KEY=*' }) -replace '^NEXT_PUBLIC_SUPABASE_ANON_KEY=', '')
if (-not $url -or -not $key) { Write-Output "ENV MISSING"; exit 1 }

$target = "$url/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback"
$req = [System.Net.HttpWebRequest]::Create($target)
$req.AllowAutoRedirect = $false
$req.Method = "GET"
$req.Headers.Add("apikey", $key)
$req.Headers.Add("Authorization", "Bearer $key")
try {
  $resp = $req.GetResponse()
  Write-Output "STATUS: $([int]$resp.StatusCode)"
  $loc = $resp.Headers["Location"]
  if ($loc) {
    $u = [uri]$loc
    Write-Output "REDIRECT HOST: $($u.Host)"
    Write-Output "REDIRECT PATH: $($u.AbsolutePath)"
    if ($u.Host -like "*accounts.google.com*") { Write-Output "VERDICT: redirect_to allowlisted -> Google authorize reachable (config OK)" }
    else { Write-Output "VERDICT: redirected elsewhere - check Site URL fallback" }
  } else {
    $sr = New-Object IO.StreamReader($resp.GetResponseStream())
    Write-Output "BODY: $($sr.ReadToEnd())"
  }
  $resp.Close()
} catch [System.Net.WebException] {
  $resp = $_.Exception.Response
  if ($resp) {
    Write-Output "STATUS: $([int]$resp.StatusCode)"
    $sr = New-Object IO.StreamReader($resp.GetResponseStream())
    Write-Output "BODY: $($sr.ReadToEnd())"
    $loc = $resp.Headers["Location"]
    if ($loc) {
      $u = [uri]$loc
      Write-Output "REDIRECT HOST: $($u.Host) PATH: $($u.AbsolutePath)"
      if ($u.Host -like "*accounts.google.com*") { Write-Output "VERDICT: allowlisted -> Google authorize reachable (config OK)" }
    }
  } else {
    Write-Output "ERROR: $($_.Exception.Message)"
  }
}
