#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"

# Helper functions for pretty terminal output.
function Write-Part ([string] $Text) {
  Write-Host $Text -NoNewline
}
function Write-Emphasized ([string] $Text) {
  Write-Host $Text -NoNewLine -ForegroundColor "Yellow"
}
function Write-Done {
  Write-Host " done" -NoNewline -ForegroundColor "Green";
  Write-Host "."
}

# Get Path environment variable for the current user.
$user = [EnvironmentVariableTarget]::User
$path = [Environment]::GetEnvironmentVariable("PATH", $user)

$install_dir = $args[0]

# Add Helper to PATH
Write-Part "Adding "; Write-Emphasized $install_dir; Write-Part " to the "
Write-Emphasized "PATH"; Write-Part " environment variable..."
[Environment]::SetEnvironmentVariable("PATH", "${path};${install_dir}", $user)
# Add Helper to the PATH variable of the current terminal session
# so `git-credential-netlify` can be used immediately without restarting the
# terminal.
$env:PATH += ";${install_dir}"
Write-Done

Write-Host ""
Write-Host "Netlify Credential Helper for Git was installed successfully." -ForegroundColor "Green"
Write-Host ""
