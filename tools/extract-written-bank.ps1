$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $workspace '笔试题库'
$outputDirectory = Join-Path $workspace '.source\written'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$application = $null
try {
    $application = New-Object -ComObject Word.Application
    $application.Visible = $false
    $application.DisplayAlerts = 0
    try { $application.AutomationSecurity = 3 } catch {}
    $files = Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File | Where-Object { $_.Extension -in '.doc', '.docx' }
    foreach ($file in $files) {
        $document = $null
        try {
            $document = $application.Documents.Open($file.FullName, $false, $true)
            $relative = $file.FullName.Substring($sourceDirectory.Length).TrimStart('\')
            $safeName = ($relative -replace '[\\/:*?"<>|]', '__') + '.txt'
            $content = $document.Content.Text
            [System.IO.File]::WriteAllText((Join-Path $outputDirectory $safeName), $content, [System.Text.UTF8Encoding]::new($false))
            Write-Output "EXTRACTED $relative ($($content.Length) chars)"
        } finally {
            if ($null -ne $document) { $document.Close(0); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null }
        }
    }
} finally {
    if ($null -ne $application) { $application.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($application) | Out-Null }
}
