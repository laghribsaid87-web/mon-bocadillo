$ErrorActionPreference = 'Stop'
if (-not (Test-Path "gradle-8.1.1")) {
    Invoke-WebRequest -Uri "https://services.gradle.org/distributions/gradle-8.1.1-bin.zip" -OutFile "gradle.zip"
    Expand-Archive -Path "gradle.zip" -DestinationPath "." -Force
}
.\gradle-8.1.1\bin\gradle.bat assembleDebug > build_out.txt 2>&1
