$ErrorActionPreference = "Continue"
Start-Process -FilePath "npx.cmd" -ArgumentList "next", "start", "-p", "3000" -WorkingDirectory (Get-Location) -WindowStyle Hidden
Start-Sleep -Seconds 7

$r = Invoke-WebRequest -Uri "http://localhost:3000/login" -UseBasicParsing
Write-Output ("LOGIN status=" + $r.StatusCode)

$req = [System.Net.HttpWebRequest]::Create("http://localhost:3000/api/dashboard")
$req.AllowAutoRedirect = $false
try { $resp = $req.GetResponse(); Write-Output ("API status=" + [int]$resp.StatusCode); $resp.Close() }
catch [System.Net.WebException] {
  $sc = [int]$_.Exception.Response.StatusCode
  $body = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd()
  Write-Output ("API status=" + $sc + " body=" + $body)
}

Get-Process | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Output "server stopped"
