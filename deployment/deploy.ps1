param([string]$Tag = (Get-Date -Format 'yyyyMMdd-HHmmss'))
$ErrorActionPreference = 'Stop'
$projectId = 'russian-anastasiay-20261123'
$deployAccount = 'liuhaolingtitan@gmail.com'
$region = 'europe-west1'
$image = "${region}-docker.pkg.dev/$projectId/russian-reader/reader:$Tag"
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (!(Test-Path -LiteralPath '.local/access-settings.json')) { throw 'Run deployment/access_setup.py with the configured Access issuer and audience first.' }
    $accessSettings = Get-Content -Raw -LiteralPath '.local/access-settings.json' | ConvertFrom-Json
    if (!$accessSettings.authSecretName -or !$accessSettings.authSecretVersion) { throw 'Access secret settings are incomplete' }
    $secretBinding = "ACCESS_CONFIG=$($accessSettings.authSecretName):$($accessSettings.authSecretVersion)"
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
    node deployment/build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
    gcloud builds submit .deploy --config=deployment/cloudbuild.json "--substitutions=_IMAGE=$image" "--region=$region" --default-buckets-behavior=regional-user-owned-bucket "--project=$projectId" "--account=$deployAccount" --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Cloud Build failed' }
    gcloud run deploy russian-reader "--image=$image" "--region=$region" "--project=$projectId" "--account=$deployAccount" "--service-account=reader-runtime@$projectId.iam.gserviceaccount.com" "--set-secrets=$secretBinding" --memory=256Mi --cpu=1 --concurrency=20 --min-instances=0 --max-instances=1 --cpu-throttling --no-cpu-boost --execution-environment=gen1 --timeout=60 --allow-unauthenticated --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Cloud Run deployment failed' }
    python deployment/smoke.py
    if ($LASTEXITCODE -ne 0) { throw 'Live checks failed' }
} finally { Pop-Location }
