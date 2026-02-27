# PowerShell script to automatically add, commit, and push changes to GitHub
# Usage: .\auto_commit_push.ps1 "Your commit message"

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Message
)

# Stage all changes
Write-Host "Staging all changes..."
git add -A

# Commit with provided message
Write-Host "Committing with message: $Message"
git commit -m "$Message"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Commit failed. Aborting push."
    exit $LASTEXITCODE
}

# Push to current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Pushing to origin/$currentBranch..."
git push origin $currentBranch

if ($LASTEXITCODE -eq 0) {
    Write-Host "Push successful!"
} else {
    Write-Error "Push failed. Please check remote settings."
    exit $LASTEXITCODE
}