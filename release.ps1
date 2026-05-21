# Lis le token depuis .env
$token = (Get-Content .env | Where-Object { $_ -match "GH_TOKEN" }) -replace "GH_TOKEN=", ""

# Lis la version actuelle
$package = Get-Content package.json | ConvertFrom-Json
$current = $package.version
Write-Host "Version actuelle : $current"

# Demande la nouvelle version
$newVersion = Read-Host "Nouvelle version (ex: 1.0.1)"

# Met à jour package.json
$package.version = $newVersion
$package | ConvertTo-Json -Depth 10 | Set-Content package.json

# Git commit
git add .
git commit -m "Release v$newVersion"
git push

# Build et publish
$env:GH_TOKEN = $token
npm run dist -- --publish always

Write-Host "✅ Release v$newVersion publiée !" -ForegroundColor Green