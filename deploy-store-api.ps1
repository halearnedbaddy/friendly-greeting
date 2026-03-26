# Deploy store-api edge function to Supabase
# Run this in PowerShell after logging in: npx supabase login

Write-Host "Deploying store-api edge function..." -ForegroundColor Cyan
Set-Location $PSScriptRoot

# Check if supabase is available
$supabase = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabase) {
    Write-Host "Using npx supabase (first run may take a moment)..." -ForegroundColor Yellow
    npx supabase functions deploy store-api
} else {
    supabase functions deploy store-api
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDeployment successful!" -ForegroundColor Green
    Write-Host "Add Product should now work. Try adding a product in your store dashboard." -ForegroundColor Green
} else {
    Write-Host "`nDeployment failed. Common causes:" -ForegroundColor Red
    Write-Host "1. Not logged in - Run: npx supabase login" -ForegroundColor Yellow
    Write-Host "2. Project not linked - Run: npx supabase link --project-ref pxyyncsnjpuwvnwyfdwx" -ForegroundColor Yellow
    Write-Host "3. No internet connection" -ForegroundColor Yellow
}
