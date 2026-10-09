$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$source = Join-Path $workspace '2026年知识竞赛题库.wps'
$outputDirectory = Join-Path $workspace '.source'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$application = $null
$document = $null
try {
    $application = New-Object -ComObject Word.Application
    $application.Visible = $false
    $application.DisplayAlerts = 0
    try { $application.AutomationSecurity = 3 } catch {}
    $document = $application.Documents.Open($source, $false, $true)
    $content = $document.Content.Text
    [System.IO.File]::WriteAllText((Join-Path $outputDirectory 'question-bank.txt'), $content, [System.Text.UTF8Encoding]::new($false))
    Write-Output "EXTRACTED $($content.Length) characters"
    Write-Output ($content.Substring(0, [Math]::Min(7000, $content.Length)))
    try {
        $document.SaveAs2((Join-Path $outputDirectory 'question-bank.html'), 8)
        Write-Output 'HTML_EXPORTED'
    } catch {
        Write-Output "HTML_EXPORT_UNAVAILABLE: $($_.Exception.Message)"
    }
} finally {
    if ($null -ne $document) { $document.Close(0); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null }
    if ($null -ne $application) { $application.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($application) | Out-Null }
}
