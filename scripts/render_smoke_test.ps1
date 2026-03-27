param(
    [Parameter(Mandatory = $true)]
    [string]$BackendBaseUrl,
    [Parameter(Mandatory = $false)]
    [string]$FrontendBaseUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-StatusCode {
    param(
        [string]$Name,
        [int]$Expected,
        [int]$Actual
    )

    if ($Expected -ne $Actual) {
        throw "$Name failed: expected status $Expected, got $Actual."
    }
    Write-Host "[OK] $Name ($Actual)" -ForegroundColor Green
}

$backend = $BackendBaseUrl.TrimEnd("/")
Write-Host "Running backend smoke tests against $backend" -ForegroundColor Cyan

$health = Invoke-WebRequest -Uri "$backend/api/v1/health/" -Method GET
Assert-StatusCode -Name "Health endpoint" -Expected 200 -Actual $health.StatusCode

$ready = Invoke-WebRequest -Uri "$backend/api/v1/ready/" -Method GET
Assert-StatusCode -Name "Readiness endpoint" -Expected 200 -Actual $ready.StatusCode

$search = Invoke-WebRequest -Uri "$backend/api/v1/notices/?search=DRC-01" -Method GET
Assert-StatusCode -Name "Notices search endpoint" -Expected 200 -Actual $search.StatusCode

$searchData = $search.Content | ConvertFrom-Json
if ($null -eq $searchData.count -or $null -eq $searchData.results) {
    throw "Notices search response shape is invalid (expected paginated object)."
}
Write-Host "[OK] Notices search shape (count=$($searchData.count))" -ForegroundColor Green

$feedbackPayload = @{
    notice = 1
    is_helpful = $true
} | ConvertTo-Json

$feedback = Invoke-WebRequest -Uri "$backend/api/v1/feedback/" -Method POST -ContentType "application/json" -Body $feedbackPayload
Assert-StatusCode -Name "Feedback submit endpoint" -Expected 201 -Actual $feedback.StatusCode

if ($FrontendBaseUrl) {
    $frontend = $FrontendBaseUrl.TrimEnd("/")
    Write-Host "Running frontend smoke test against $frontend" -ForegroundColor Cyan
    $frontendResponse = Invoke-WebRequest -Uri $frontend -Method GET
    Assert-StatusCode -Name "Frontend root page" -Expected 200 -Actual $frontendResponse.StatusCode
}

Write-Host "Render smoke tests completed successfully." -ForegroundColor Green
