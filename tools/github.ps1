param([ValidateSet('Inspect', 'Publish')][string]$Action = 'Inspect')
$ErrorActionPreference = 'Stop'
$repoName = 'transport-quiz-2026'
$owner = 'cmysdd'
$env:GCM_INTERACTIVE = 'Never'
$env:GIT_TERMINAL_PROMPT = '0'
$credentialInput = "protocol=https`nhost=github.com`nusername=$owner`n`n"
$credentialOutput = $credentialInput | git -c credential.interactive=false credential fill 2>$null
$credential = @{}
foreach ($line in $credentialOutput) {
    if ($line -match '^([^=]+)=(.*)$') { $credential[$Matches[1]] = $Matches[2] }
}
if (-not $credential.password) { throw 'No saved GitHub credential is available for cmysdd.' }
$headers = @{ Authorization = "Bearer $($credential.password)"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'transport-quiz-builder' }
$account = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers
if ($account.login -ne $owner) { throw "GitHub authenticated account is $($account.login), expected $owner." }
Write-Output "AUTHENTICATED $($account.login)"
$repository = $null
try { $repository = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName" -Headers $headers } catch {
    if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
}
if ($Action -eq 'Inspect') {
    if ($repository) { Write-Output "REPOSITORY_EXISTS $($repository.html_url)" } else { Write-Output "REPOSITORY_AVAILABLE $owner/$repoName" }
    Write-Output "GIT_IDENTITY $($account.name) <$($account.id)+$owner@users.noreply.github.com>"
    exit 0
}
if ($repository) { throw 'Target repository already exists. Inspect its contents before publishing.' }
$body = @{ name = $repoName; description = '2026年交通运输知识竞赛刷题网站：分类练习、随机刷题、模拟考试、错题和收藏。'; private = $false; auto_init = $false } | ConvertTo-Json
$repository = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
Write-Output "CREATED $($repository.html_url)"
git config user.name $(if ($account.name) { $account.name } else { $owner })
git config user.email "$($account.id)+$owner@users.noreply.github.com"
git remote add origin $repository.clone_url
if ($LASTEXITCODE -ne 0) { throw 'Failed to add Git remote.' }
git add .
git commit -m 'Build 2026 transport knowledge quiz website'
if ($LASTEXITCODE -ne 0) { throw 'Failed to commit website.' }
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'Failed to push website.' }
Write-Output "PUBLISHED $($repository.html_url)"
