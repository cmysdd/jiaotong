param([ValidateSet('Inspect', 'Publish', 'Status', 'EnablePages', 'Diagnose', 'Rerun')][string]$Action = 'Inspect')
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
    $responseCode = [int]$_.Exception.Response.StatusCode
    if ($responseCode -ge 500) {
        Write-Output "REPOSITORY_LOOKUP_RETRY $responseCode"
        $repoPage = 1
        do {
            $accountRepositories = @(Invoke-RestMethod -Uri "https://api.github.com/user/repos?affiliation=owner&per_page=100&page=$repoPage" -Headers $headers)
            $repository = $accountRepositories | Where-Object { $_.full_name -eq "$owner/$repoName" } | Select-Object -First 1
            $repoPage++
        } while (-not $repository -and $accountRepositories.Count -eq 100)
    } elseif ($responseCode -ne 404) { throw }
}
if ($Action -eq 'Inspect') {
    if ($repository) { Write-Output "REPOSITORY_EXISTS $($repository.html_url)" } else { Write-Output "REPOSITORY_AVAILABLE $owner/$repoName" }
    Write-Output "GIT_IDENTITY $($account.name) <$($account.id)+$owner@users.noreply.github.com>"
    exit 0
}
if ($Action -eq 'Status') {
    if (-not $repository) { throw 'Repository does not exist yet.' }
    $runs = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/actions/runs?per_page=3" -Headers $headers
    foreach ($run in $runs.workflow_runs) { Write-Output "WORKFLOW $($run.id) $($run.head_sha) $($run.status) $($run.conclusion) $($run.html_url)" }
    try {
        $pages = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/pages" -Headers $headers
        Write-Output "PAGES $($pages.status) $($pages.html_url)"
    } catch { Write-Output "PAGES_NOT_READY $([int]$_.Exception.Response.StatusCode)" }
    exit 0
}
if ($Action -in @('Diagnose', 'Rerun')) {
    $runs = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/actions/runs?per_page=1" -Headers $headers
    $latestRun = $runs.workflow_runs | Select-Object -First 1
    if (-not $latestRun) { throw 'No workflow run exists.' }
    if ($Action -eq 'Rerun') {
        Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/actions/runs/$($latestRun.id)/rerun" -Method Post -Headers $headers | Out-Null
        Write-Output "RERUN_REQUESTED $($latestRun.id)"
        exit 0
    }
    $jobs = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/actions/runs/$($latestRun.id)/jobs" -Headers $headers
    foreach ($job in $jobs.jobs) {
        Write-Output "JOB $($job.name) $($job.status) $($job.conclusion)"
        foreach ($step in $job.steps) { Write-Output "STEP $($step.name) $($step.conclusion)" }
        if ($job.check_run_url) {
            $annotations = Invoke-RestMethod -Uri "$($job.check_run_url)/annotations" -Headers $headers
            foreach ($annotation in $annotations) { Write-Output "ANNOTATION $($annotation.title) $($annotation.message)" }
        }
    }
    exit 0
}
if ($Action -eq 'EnablePages') {
    if (-not $repository) { throw 'Repository does not exist yet.' }
    $pagesBody = @{ build_type = 'workflow' } | ConvertTo-Json
    try { $pages = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/pages" -Headers $headers } catch {
        if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
        $pages = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/pages" -Method Post -Headers $headers -ContentType 'application/json' -Body $pagesBody
    }
    if ($pages.build_type -ne 'workflow') { $pages = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repoName/pages" -Method Put -Headers $headers -ContentType 'application/json' -Body $pagesBody }
    Write-Output "PAGES_ENABLED $($pages.html_url)"
    exit 0
}
if ($repository) { throw 'Target repository already exists. Inspect its contents before publishing.' }
$body = @{ name = $repoName; description = '2026年交通运输知识竞赛刷题网站：分类练习、直接背题、模拟考试、错题和收藏。'; private = $false; auto_init = $false } | ConvertTo-Json
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
