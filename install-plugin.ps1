<#
.SYNOPSIS
    Automated installer script for StratumDonut Chart Plugin in Apache Superset.
.DESCRIPTION
    Installs and registers the StratumDonut Chart Plugin into an Apache Superset repository:
    1. Locates and validates the Apache Superset root directory.
    2. Builds the plugin (TypeScript compilation) if npm is available.
    3. Copies plugin files into superset-frontend/plugins/superset-plugin-chart-stratum-donut.
    4. Safely parses and updates MainPreset.ts with backup and idempotency:
       - import { StratumDonutChartPlugin } from '../../../plugins/superset-plugin-chart-stratum-donut/src';
       - new StratumDonutChartPlugin().configure({ key: 'stratum_donut' }),
       Legacy registration variants (`.register()` lines, odd indentation, duplicates)
       are normalized to the canonical form instead of adding new lines.
    5. Cleans stale Webpack/Babel cache.
.PARAMETER SupersetPath
    Path to the Apache Superset root directory (a checkout of apache/superset 6.1.0).
.PARAMETER PluginPath
    Path to the StratumDonut plugin root directory (default: script root).
.PARAMETER CleanReinstall
    Removes existing plugin folder completely and reinstalls from scratch.
.PARAMETER RebuildFrontend
    Runs 'npm run build' inside superset-frontend to recompile Webpack bundles.
.PARAMETER SkipBuild
    Skips running 'npm run build' before copying files.
.PARAMETER SkipCleanCache
    Skips removing superset-frontend/node_modules/.cache.
.PARAMETER Force
    Runs non-interactively using defaults without prompting.
#>

[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$SupersetPath,

    [Parameter(Position = 1)]
    [string]$PluginPath,

    [switch]$CleanReinstall,
    [switch]$RebuildFrontend,
    [switch]$SkipBuild,
    [switch]$SkipCleanCache,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Color([string]$text, [string]$color = "White") {
    Write-Host $text -ForegroundColor $color
}

Write-Color "================================================================" "Cyan"
Write-Color "   StratumDonut - Apache Superset Plugin Installer             " "Cyan"
Write-Color "   Donut a doppio anello: riferimento e confronto               " "Cyan"
Write-Color "================================================================" "Cyan"
Write-Color ""

# -------------------------------------------------------------
# 1. Resolve Plugin Path
# -------------------------------------------------------------
if (-not $PluginPath) {
    $CurrentDir = (Get-Location).Path
    if (Test-Path (Join-Path $CurrentDir "package.json")) {
        $PluginPath = $CurrentDir
    } elseif (Test-Path (Join-Path $PSScriptRoot "src\index.ts")) {
        $PluginPath = $PSScriptRoot
    } elseif (Test-Path (Join-Path (Split-Path -Parent $PSScriptRoot) "src\index.ts")) {
        $PluginPath = Split-Path -Parent $PSScriptRoot
    } else {
        $PluginPath = $PSScriptRoot
    }
}

$ResolvedPluginPath = (Resolve-Path $PluginPath).Path
if (-not (Test-Path (Join-Path $ResolvedPluginPath "package.json"))) {
    Write-Color "[ERRORE] Impossibile trovare package.json del plugin in '$ResolvedPluginPath'!" "Red"
    exit 1
}
Write-Color "[INFO] Cartella Plugin (sorgente): $ResolvedPluginPath" "Green"

# -------------------------------------------------------------
# 2. Resolve Superset Path
# -------------------------------------------------------------
$DefaultCandidate = Join-Path $env:USERPROFILE "superset"

if (-not $SupersetPath) {
    $Candidates = @(
        "C:\Superset",
        (Join-Path $ResolvedPluginPath "..\superset"),
        (Join-Path $ResolvedPluginPath "..\superset-6.1.0"),
        (Join-Path $ResolvedPluginPath "..\apache-superset"),
        (Join-Path $env:USERPROFILE "superset_6_1_0\superset"),
        (Join-Path $env:USERPROFILE "superset"),
        (Join-Path $env:USERPROFILE "Projects\superset")
    )

    foreach ($cand in $Candidates) {
        if ($cand -and (Test-Path (Join-Path $cand "superset-frontend\package.json"))) {
            $SupersetPath = (Resolve-Path $cand).Path
            Write-Color "[INFO] Trovata installazione Superset automatica: $SupersetPath" "Green"
            break
        }
    }
}

if (-not $SupersetPath) {
    if ($Force) {
        $SupersetPath = $DefaultCandidate
    } else {
        Write-Color "Inserisci il percorso della cartella radice di Apache Superset" "Yellow"
        Write-Color "[Default: $DefaultCandidate]:" "Gray"
        $InputPath = Read-Host "Percorso Superset"
        if ([string]::IsNullOrWhiteSpace($InputPath)) {
            $SupersetPath = $DefaultCandidate
        } else {
            $SupersetPath = $InputPath.Trim('"', "'").Trim()
        }
    }
}

if (-not (Test-Path $SupersetPath)) {
    Write-Color "[ERRORE] Il percorso specificato '$SupersetPath' non esiste!" "Red"
    Write-Color "Verifica che il percorso punti alla radice di Apache Superset contenente 'superset-frontend'." "Yellow"
    exit 1
}

$ResolvedSupersetPath = (Resolve-Path $SupersetPath).Path
$FrontendDir = Join-Path $ResolvedSupersetPath "superset-frontend"

if (-not (Test-Path (Join-Path $FrontendDir "package.json"))) {
    Write-Color "[ERRORE] 'superset-frontend\package.json' non trovato in '$ResolvedSupersetPath'!" "Red"
    Write-Color "Assicurati di selezionare la cartella principale del repository Superset." "Yellow"
    exit 1
}
Write-Color "[INFO] Cartella Target Superset: $ResolvedSupersetPath" "Green"
Write-Color "[INFO] Cartella superset-frontend: $FrontendDir" "Gray"
Write-Color ""

# -------------------------------------------------------------
# 3. Build Plugin (TypeScript compilation)
# -------------------------------------------------------------
$DistDir = Join-Path $ResolvedPluginPath "dist"
if (Test-Path $DistDir) {
    Write-Color "`n=== FASE 1: Bundle Pre-compilato 'dist' Rilevato ===" "Cyan"
    Write-Color "[OK] File compilati gia' pronti in dist/. Installazione istantanea senza download dipendenze." "Green"
} elseif (Test-Path (Join-Path $ResolvedPluginPath "src\index.ts")) {
    Write-Color "`n=== FASE 1: Sorgenti 'src/' Rilevati ===" "Cyan"
    Write-Color "[OK] Sorgenti TypeScript pronti. Superset li compilera' direttamente tramite Webpack." "Green"
} elseif (-not $SkipBuild) {
    Write-Color "=== FASE 1: Compilazione TypeScript del Plugin ===" "Cyan"
    $NpmCmd = Get-Command "npm" -ErrorAction SilentlyContinue
    if ($NpmCmd) {
        $PluginNodeModules = Join-Path $ResolvedPluginPath "node_modules"
        $LocalTsc = Join-Path $PluginNodeModules "typescript\lib\tsc.js"
        if (-not (Test-Path $LocalTsc)) {
            Write-Color "[INFO] Dipendenze non pronte (typescript locale mancante). Esecuzione automatica 'npm install --legacy-peer-deps' (stesso comportamento dello stratum-bar)..." "Yellow"
            $OrigLoc = Get-Location
            try {
                Set-Location $ResolvedPluginPath
                & $NpmCmd.Source install --legacy-peer-deps
                if ($LASTEXITCODE -eq 0) {
                    Write-Color "[SUCCESS] Dipendenze installate (npm install --legacy-peer-deps)." "Green"
                } else {
                    Write-Color "[WARN] 'npm install --legacy-peer-deps' ha restituito codice $LASTEXITCODE. Si prosegue con i file presenti." "Yellow"
                }
            } catch {
                Write-Color "[WARN] Avviso durante npm install: $_" "Yellow"
            } finally {
                Set-Location $OrigLoc
            }
        } else {
            Write-Color "[INFO] Dipendenze gia' presenti (typescript locale rilevato)." "Gray"
        }

        Write-Color "[INFO] Esecuzione 'npm run build' in '$ResolvedPluginPath'..." "Yellow"
        $OrigLoc = Get-Location
        try {
            Set-Location $ResolvedPluginPath
            & $NpmCmd.Source run build
            if ($LASTEXITCODE -eq 0) {
                Write-Color "[SUCCESS] Compilazione TypeScript completata con successo." "Green"
            } else {
                Write-Color "[WARN] 'npm run build' ha restituito codice $LASTEXITCODE. Si prosegue con i file presenti." "Yellow"
            }
        } catch {
            Write-Color "[WARN] Avviso durante compilazione npm: $_" "Yellow"
        } finally {
            Set-Location $OrigLoc
        }
    } else {
        Write-Color "[INFO] 'npm' non rilevato nel PATH. Si prosegue usando dist/src preesistenti." "Gray"
    }
    Write-Color ""
}

# -------------------------------------------------------------
# 4. Copy/Sync Plugin to superset-frontend/plugins
# -------------------------------------------------------------
Write-Color "=== FASE 2: Copia e Sincronizzazione Plugin ===" "Cyan"
$PluginsTargetRoot = Join-Path $FrontendDir "plugins"
if (-not (Test-Path $PluginsTargetRoot)) {
    New-Item -ItemType Directory -Path $PluginsTargetRoot -Force | Out-Null
}

$DestPluginDir = Join-Path $PluginsTargetRoot "superset-plugin-chart-stratum-donut"
if (Test-Path $DestPluginDir) {
    Write-Color "[INFO] Pulizia versione precedente in '$DestPluginDir'..." "Yellow"
    try {
        Remove-Item -Recurse -Force $DestPluginDir -ErrorAction Stop
    } catch {
        Start-Sleep -Milliseconds 300
        Remove-Item -Recurse -Force $DestPluginDir -ErrorAction SilentlyContinue
    }
}

New-Item -ItemType Directory -Path $DestPluginDir -Force | Out-Null

$ItemsToCopy = @("src", "dist", "package.json", "tsconfig.json", "README.md", "CHANGELOG.md", "AGENTS.md")
foreach ($item in $ItemsToCopy) {
    $srcItem = Join-Path $ResolvedPluginPath $item
    if (Test-Path $srcItem) {
        $destItem = Join-Path $DestPluginDir $item
        $isDir = (Get-Item $srcItem) -is [System.IO.DirectoryInfo]
        if ($isDir) {
            Copy-Item -Path $srcItem -Destination $DestPluginDir -Recurse -Force
            Write-Color "  [+] Copiata cartella: $item" "Gray"
        } else {
            Copy-Item -Path $srcItem -Destination $destItem -Force
            Write-Color "  [+] Copiato file:     $item" "Gray"
        }
    }
}
Write-Color "[SUCCESS] Plugin copiato con successo in '$DestPluginDir'" "Green"
Write-Color ""

# -------------------------------------------------------------
# 5. Safely parse and update MainPreset.ts
# -------------------------------------------------------------
Write-Color "=== FASE 3: Registrazione in MainPreset.ts ===" "Cyan"

$PresetCandidates = @(
    (Join-Path $FrontendDir "src\visualizations\presets\MainPreset.ts"),
    (Join-Path $FrontendDir "src\visualizations\presets\MainPreset.js")
)

$PresetFile = $null
foreach ($pf in $PresetCandidates) {
    if (Test-Path $pf) {
        $PresetFile = $pf
        break
    }
}

if (-not $PresetFile) {
    Write-Color "[ERRORE] Impossibile trovare MainPreset.ts in '$FrontendDir\src'!" "Red"
    exit 1
}

Write-Color "[INFO] File preset individuato: $PresetFile" "Gray"

# 5.1 Backup di sicurezza
$BackupFile = "$PresetFile.bak"
if (-not (Test-Path $BackupFile)) {
    Copy-Item -Path $PresetFile -Destination $BackupFile -Force
    Write-Color "[SUCCESS] Creato backup di sicurezza: $(Split-Path -Leaf $BackupFile)" "Green"
} else {
    Write-Color "[INFO] Backup di sicurezza preesistente mantenuto: $(Split-Path -Leaf $BackupFile)" "Gray"
}

# 5.2 Lettura e parsing
$RawContent = [System.IO.File]::ReadAllText($PresetFile, [System.Text.Encoding]::UTF8)
$NL = if ($RawContent.Contains("`r`n")) { "`r`n" } else { "`n" }

$TargetImport = "import { StratumDonutChartPlugin } from '../../../plugins/superset-plugin-chart-stratum-donut/src';"
$TargetRegister = "        new StratumDonutChartPlugin().configure({ key: 'stratum_donut' }),"

# Verifica idempotenza sulla FORMA CANONICA (riga-esatta): le varianti legacy
# (riga con `.register()`, indentazioni anomale, duplicati) non contano come
# configurazione valida e vengono normalizzate dal ramo else.
$PresetLineList = [System.Collections.Generic.List[string]]($RawContent -split "\r?\n")
$hasExactImport = ($PresetLineList -contains $TargetImport)
$hasExactRegister = ($PresetLineList -contains $TargetRegister)
$importCount = ([regex]::Matches($RawContent, "from\s*['`"][^'`"]*superset-plugin-chart-stratum-donut")).Count
$registerCount = ([regex]::Matches($RawContent, "new\s+StratumDonutChartPlugin")).Count

if (-not $CleanReinstall -and $hasExactImport -and $hasExactRegister -and ($importCount -eq 1) -and ($registerCount -eq 1)) {
    Write-Color "[INFO] MainPreset.ts e' gia' registrato correttamente (idempotente - nessuna modifica necessaria)." "Green"
} else {
    Write-Color "[INFO] Aggiornamento import e registrazione in corso..." "Yellow"

    $lines = [System.Collections.Generic.List[string]]($RawContent -split "\r?\n")
    $filteredLines = [System.Collections.Generic.List[string]]::new()
    $lastImportIdx = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match "from\s*['`"][^'`"]*superset-plugin-chart-stratum-donut") {
            continue
        }
        if ($line.Trim().StartsWith("import ")) {
            $lastImportIdx = $filteredLines.Count
        }
        $filteredLines.Add($line)
    }

    if ($lastImportIdx -ge 0) {
        $filteredLines.Insert($lastImportIdx + 1, $TargetImport)
    } else {
        $filteredLines.Insert(0, $TargetImport)
    }

    $intermediateContent = $filteredLines -join $NL

    $regLines = [System.Collections.Generic.List[string]]($intermediateContent -split "\r?\n")
    $finalLines = [System.Collections.Generic.List[string]]::new()
    $pluginsIdx = -1

    for ($i = 0; $i -lt $regLines.Count; $i++) {
        $line = $regLines[$i]
        if ($line -match 'new\s+StratumDonutChartPlugin') {
            continue
        }
        $finalLines.Add($line)
        if ($line -match 'plugins\s*:\s*\[') {
            $pluginsIdx = $finalLines.Count
        }
    }

    if ($pluginsIdx -ge 0) {
        $finalLines.Insert($pluginsIdx, $TargetRegister)
    } else {
        $finalLines.Add($TargetRegister)
    }

    $NewContent = $finalLines -join $NL
    $Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($PresetFile, $NewContent, $Utf8NoBom)

    Write-Color "[SUCCESS] Aggiunto import:       $TargetImport" "Green"
    Write-Color "[SUCCESS] Aggiunta registrazione: $TargetRegister" "Green"
    Write-Color "[SUCCESS] File $(Split-Path -Leaf $PresetFile) salvato con successo." "Green"
}
Write-Color ""

# -------------------------------------------------------------
# 6. Safety Cache Cleanup
# -------------------------------------------------------------
if (-not $SkipCleanCache) {
    Write-Color "=== FASE 4: Pulizia Cache Frontend Webpack ===" "Cyan"
    $CacheDirs = @(
        (Join-Path $FrontendDir "node_modules\.cache"),
        (Join-Path $FrontendDir ".cache")
    )
    foreach ($cd in $CacheDirs) {
        if (Test-Path $cd) {
            try {
                Remove-Item -Recurse -Force $cd -ErrorAction SilentlyContinue
                Write-Color "[SUCCESS] Svuotata cache in: $cd" "Green"
            } catch {
                Write-Color "[WARN] Impossibile svuotare $($cd): $_" "Yellow"
            }
        }
    }
    Write-Color ""
}

# -------------------------------------------------------------
# 7. Hotfix per Bugnoti Superset 6.x (Geostyler & Dipendenze)
# -------------------------------------------------------------
Write-Color "=== FASE 5: Patch Automatica Bugnoti Superset 6.x ===" "Cyan"
$WebpackConfig = Join-Path $FrontendDir "webpack.config.js"
if (Test-Path $WebpackConfig) {
    $WebpackContent = [System.IO.File]::ReadAllText($WebpackConfig, [System.Text.Encoding]::UTF8)
    # Fissa il problema di risoluzione path su Windows per geostyler (che rompe npm run build locale e docker)
    $TargetGeostylerRegex = '/node_modules\/.*geostyler.*\/.*\.(js|mjs)$/'
    $FixedGeostylerRegex = '/node_modules[\\\/].*geostyler.*[\\\/].*\.(js|mjs)$/'
    if ($WebpackContent.Contains($TargetGeostylerRegex)) {
        $WebpackContent = $WebpackContent.Replace($TargetGeostylerRegex, $FixedGeostylerRegex)
        [System.IO.File]::WriteAllText($WebpackConfig, $WebpackContent, [System.Text.UTF8Encoding]::new($false))
        Write-Color "[SUCCESS] Webpack config patchato: Risolto bug geostyler regex per Windows/ESM." "Green"
    } else {
        Write-Color "[INFO] Webpack config: patch geostyler gia' applicata o non trovata." "Gray"
    }
}

$PackageJson = Join-Path $FrontendDir "package.json"
if (Test-Path $PackageJson) {
    $PkgContent = Get-Content -Raw $PackageJson
    $Modified = $false
    
    # Aggiungi @react-spring/web se mancante (causa crash frequenti di visx)
    if ($PkgContent -notmatch '"@react-spring/web"') {
        $PkgContent = $PkgContent -replace '("dependencies"\s*:\s*\{)', "`$1`n    `"@react-spring/web`": `"^9.7.5`","
        $Modified = $true
        Write-Color "[SUCCESS] Aggiunto @react-spring/web a package.json." "Green"
    }
    
    # Aggiungi @fontsource/inter se mancante
    if ($PkgContent -notmatch '"@fontsource/inter"') {
        $PkgContent = $PkgContent -replace '("dependencies"\s*:\s*\{)', "`$1`n    `"@fontsource/inter`": `"^5.2.6`","
        $Modified = $true
        Write-Color "[SUCCESS] Aggiunto @fontsource/inter a package.json." "Green"
    }

    # Superset 6.1.0 RC3 usa @deck.gl/widgets (via @deck.gl/react) senza dichiararlo tra le dipendenze:
    # senza, webpack non risolve il modulo. Compare solo in "overrides", quindi si controlla "dependencies".
    $DeclaredDeps = @()
    try { $DeclaredDeps = @(($PkgContent | ConvertFrom-Json).dependencies.PSObject.Properties.Name) } catch { }
    if ($DeclaredDeps.Count -gt 0 -and $DeclaredDeps -notcontains '@deck.gl/widgets') {
        $PkgContent = $PkgContent -replace '("dependencies"\s*:\s*\{)', "`$1`n    `"@deck.gl/widgets`": `"~9.2.5`","
        $Modified = $true
        Write-Color "[SUCCESS] Aggiunto @deck.gl/widgets a package.json." "Green"
    }

    if ($Modified) {
        [System.IO.File]::WriteAllText($PackageJson, $PkgContent, [System.Text.UTF8Encoding]::new($false))
        Write-Color "[INFO] Modifiche salvate in package.json (sara' necessario npm install / rebuild)." "Gray"
    } else {
        Write-Color "[INFO] Le dipendenze critiche (@react-spring/web, @fontsource/inter, @deck.gl/widgets) sono gia' presenti." "Gray"
    }
}
Write-Color ""

# -------------------------------------------------------------
# 8. Optional Frontend Rebuild
# -------------------------------------------------------------
if ($RebuildFrontend) {
    Write-Color "=== FASE 6: Ricompilazione Frontend Apache Superset ===" "Cyan"
    $NpmCmd = Get-Command "npm" -ErrorAction SilentlyContinue
    if ($NpmCmd) {
        Write-Color "[INFO] Avvio 'npm run build' in '$FrontendDir'..." "Yellow"
        $OrigLoc = Get-Location
        try {
            Set-Location $FrontendDir
            & $NpmCmd.Source run build
            if ($LASTEXITCODE -eq 0) {
                Write-Color "[SUCCESS] Frontend Apache Superset ricompilato con successo!" "Green"
            } else {
                Write-Color "[WARN] 'npm run build' ha terminato con codice $LASTEXITCODE." "Yellow"
            }
        } finally {
            Set-Location $OrigLoc
        }
    }
    Write-Color ""
}

Write-Color "================================================================" "Green"
Write-Color "   Installazione Plugin StratumDonut completata con successo! " "Green"
Write-Color "================================================================" "Green"
Write-Color "Il plugin 'stratum_donut' e' ora registrato nel frontend Superset." "White"
Write-Color "Riavvia il server o visualizza la dashboard per utilizzarlo." "White"
Write-Color ""
