# Pemasang native host Kalam untuk Windows (Chrome/Edge/Brave).
# Pakai (PowerShell): .\install-windows.ps1 -ExtensionId <ID> [-Folder "$HOME\Documents\Kalam"]
param(
  [Parameter(Mandatory = $true)][string]$ExtensionId,
  [string]$Folder = "$HOME\Documents\Kalam"
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$host_py = Join-Path $here "kalam-host.py"
$launcher = Join-Path $here "kalam-host.cmd"
New-Item -ItemType Directory -Force -Path $Folder | Out-Null

# Chrome memanggil berkas eksekusi; bungkus python lewat .cmd agar stdio tetap bersih.
"@echo off`r`npython `"$host_py`" %*" | Set-Content -Encoding ASCII $launcher

$manifest = @{
  name = "id.aisac.kalam"
  description = "Kalam - jembatan desktop penulis buku"
  path = $launcher
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 4
$manifestPath = Join-Path $here "id.aisac.kalam.json"
$manifest | Set-Content -Encoding UTF8 $manifestPath

$keys = @(
  "HKCU:\Software\Google\Chrome\NativeMessagingHosts\id.aisac.kalam",
  "HKCU:\Software\Chromium\NativeMessagingHosts\id.aisac.kalam",
  "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\id.aisac.kalam",
  "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\id.aisac.kalam"
)
foreach ($k in $keys) {
  New-Item -Path $k -Force | Out-Null
  Set-ItemProperty -Path $k -Name "(default)" -Value $manifestPath
  Write-Host "terdaftar: $k"
}
Write-Host "Folder naskah: $Folder"
Write-Host "Selesai. Nyalakan 'Aplikasi desktop (native)' di tab Koneksi, lalu tekan Uji."