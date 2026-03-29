Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Running Complia predeploy checks..." -ForegroundColor Cyan

Write-Host "[1/7] Backend lint" -ForegroundColor Yellow
flake8 accounts complia_backend/notices complia_backend/exceptions.py complia_backend/health.py complia_backend/urls.py complia_backend/settings.py `
  --exclude=accounts/migrations,complia_backend/notices/migrations `
  --max-line-length=160 `
  --extend-ignore=E302,E305,W293

Write-Host "[2/7] Migration drift check" -ForegroundColor Yellow
python manage.py makemigrations --check --dry-run

Write-Host "[3/7] Backend tests" -ForegroundColor Yellow
python manage.py test

Write-Host "[4/7] Django deploy checks" -ForegroundColor Yellow
$env:DEBUG = "False"
$env:ALLOWED_HOSTS = "example.com"
$env:CORS_ALLOWED_ORIGINS = "https://example.com"
$env:CSRF_TRUSTED_ORIGINS = "https://example.com"
$env:SECURE_HSTS_SECONDS = "31536000"
python manage.py check --deploy

Write-Host "[5/7] Frontend install" -ForegroundColor Yellow
Push-Location complia_frontend
npm ci

Write-Host "[6/7] Frontend typecheck" -ForegroundColor Yellow
npm run typecheck

Write-Host "[7/7] Frontend build" -ForegroundColor Yellow
npm run build
Pop-Location

Write-Host "Predeploy checks completed successfully." -ForegroundColor Green
