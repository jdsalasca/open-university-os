Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Simulacro de respaldo y restauración de MySQL 8.4: el gate de producción exige copias probadas, y
# una copia que nadie restaura es un deseo, no un respaldo.
#
# 1. Vuelca la base de desarrollo (solo datos locales/sintéticos, nunca institucionales) con mysqldump.
# 2. Levanta un MySQL 8.4 desechable, sin volumen persistente, en un puerto efímero.
# 3. Restaura el volcado ahí y compara tabla por tabla: catálogo, conteos y versión Flyway.
# 4. Limpia el contenedor y el volcado. Cualquier diferencia sale con código distinto de cero.
#
# Credenciales: solo los valores de desarrollo del compose (`universiry_dev`), sobrescribibles por
# entorno. Nada de esto es un secreto de producción.
function Compare-RestoredDatabase {
    param(
        [hashtable]$Source = @{},
        [hashtable]$Restored = @{},
        [string]$SourceFlyway = '',
        [string]$RestoredFlyway = ''
    )

    $diferencias = @()
    foreach ($tabla in $Source.Keys) {
        if (-not $Restored.ContainsKey($tabla)) {
            $diferencias += "tabla ausente en la restauración: $tabla"
        }
        elseif ($Restored[$tabla] -ne $Source[$tabla]) {
            $diferencias += "conteo distinto en ${tabla}: origen $($Source[$tabla]), restaurada $($Restored[$tabla])"
        }
    }
    foreach ($tabla in $Restored.Keys) {
        if (-not $Source.ContainsKey($tabla)) {
            $diferencias += "tabla sobrante en la restauración: $tabla"
        }
    }
    if ($SourceFlyway -ne $RestoredFlyway) {
        $diferencias += "versión Flyway distinta: origen $SourceFlyway, restaurada $RestoredFlyway"
    }
    return $diferencias
}

# Una consulta escalar contra MySQL con reintentos. El host de desarrollo se comparte con otras
# sesiones y un hipo transitorio no puede romper el simulacro con un null: se reintenta y, si no hay
# respuesta, se dice exactamente qué consulta falló.
function Invoke-MysqlScalar {
    param(
        [string]$Contenedor,
        [string]$Usuario,
        [string]$Clave,
        [string]$Consulta,
        [int]$Intentos = 5
    )

    for ($intento = 1; $intento -le $Intentos; $intento++) {
        $salida = docker exec --env "MYSQL_PWD=$Clave" $Contenedor `
            mysql --host=127.0.0.1 --user=$Usuario --batch --skip-column-names -e $Consulta 2>$null
        # docker devuelve un array, una linea por elemento: al interpolarlo PowerShell lo une con
        # espacios y una lista de tablas se vuelve una sola "tabla". Se une con saltos de linea.
        $texto = ($salida -join "`n").Trim()
        if ($LASTEXITCODE -eq 0 -and $texto -ne '') {
            return $texto
        }
        Start-Sleep -Seconds 2
    }
    throw "MySQL no respondió a: $Consulta (contenedor $Contenedor, $Intentos intentos)."
}

if ($MyInvocation.InvocationName -ne '.') {
    $contenedorOrigen = 'open-university-os-mysql-1'
    $baseDatos = $env:MYSQL_DATABASE
    if ([string]::IsNullOrEmpty($baseDatos)) { $baseDatos = 'universiry_dev' }
    $usuario = $env:DB_USERNAME
    if ([string]::IsNullOrEmpty($usuario)) { $usuario = 'universiry_dev' }
    $clave = $env:DB_PASSWORD
    if ([string]::IsNullOrEmpty($clave)) { $clave = 'universiry_dev_local_only' }
    $volcado = Join-Path ([IO.Path]::GetTempPath()) ("universiry-respaldo-{0:yyyyMMdd-HHmmss}.sql" -f (Get-Date))
    $contenedorTemporal = 'universiry-mysql-restore-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
    $claveTemporal = 'restore-' + [Guid]::NewGuid().ToString('N')
    $temporalArrancado = $false

    try {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            throw 'Docker CLI no está disponible en PATH.'
        }

        Write-Host "1/4 Volcando $baseDatos desde $contenedorOrigen..."
        docker exec --env "MYSQL_PWD=$clave" $contenedorOrigen `
            mysqldump --host=127.0.0.1 --user=$usuario --single-transaction --routines --events `
            --no-tablespaces $baseDatos `
            > $volcado
        if ($LASTEXITCODE -ne 0) { throw 'mysqldump falló.' }
        $kilos = [math]::Round((Get-Item $volcado).Length / 1KB, 1)
        Write-Host "    volcado en $volcado ($kilos kB)"

        Write-Host '2/4 Levantando MySQL 8.4 desechable...'
        docker run --detach --rm `
            --name $contenedorTemporal `
            --env "MYSQL_ROOT_PASSWORD=$claveTemporal" `
            --publish '127.0.0.1::3306' `
            mysql:8.4 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el MySQL temporal.' }
        $temporalArrancado = $true
        $listo = $false
        for ($intento = 0; $intento -lt 180; $intento++) {
            docker exec --env "MYSQL_PWD=$claveTemporal" $contenedorTemporal `
                mysqladmin ping --host=127.0.0.1 --user=root --silent *> $null
            if ($LASTEXITCODE -eq 0) { $listo = $true; break }
            Start-Sleep -Seconds 1
        }
        if (-not $listo) { throw 'El MySQL temporal no quedó listo.' }
        docker exec --env "MYSQL_PWD=$claveTemporal" $contenedorTemporal `
            mysql --host=127.0.0.1 --user=root -e "CREATE DATABASE $baseDatos;" | Out-Null

        Write-Host '3/4 Restaurando el volcado en el temporal...'
        Get-Content $volcado -Raw -Encoding utf8 | docker exec --interactive `
            --env "MYSQL_PWD=$claveTemporal" $contenedorTemporal `
            mysql --host=127.0.0.1 --user=root $baseDatos
        if ($LASTEXITCODE -ne 0) { throw 'La restauración falló.' }

        Write-Host '4/4 Comparando origen contra restauración...'
        $consultar = {
            param($contenedor, $credenciales, $db)
            $lista = Invoke-MysqlScalar -Contenedor $contenedor -Usuario $credenciales.User `
                -Clave $credenciales.Pass `
                -Consulta "SELECT table_name FROM information_schema.tables WHERE table_schema='$db';"
            $tablas = @($lista -split "`r?`n" | Where-Object { $_ -and $_.Trim() -ne '' })
            $conteos = @{}
            foreach ($tabla in $tablas) {
                $conteos[$tabla] = Invoke-MysqlScalar -Contenedor $contenedor -Usuario $credenciales.User `
                    -Clave $credenciales.Pass `
                    -Consulta "SELECT COUNT(*) FROM ``$db``.``$tabla``;"
            }
            $flyway = Invoke-MysqlScalar -Contenedor $contenedor -Usuario $credenciales.User `
                -Clave $credenciales.Pass `
                -Consulta "SELECT MAX(CAST(version AS UNSIGNED)) FROM ``$db``.flyway_schema_history WHERE success=1;"
            return @{ Conteos = $conteos; Flyway = $flyway }
        }
        $origen = & $consultar $contenedorOrigen @{ User = $usuario; Pass = $clave } $baseDatos
        $restaurada = & $consultar $contenedorTemporal @{ User = 'root'; Pass = $claveTemporal } $baseDatos
        $diferencias = @(Compare-RestoredDatabase -Source $origen.Conteos -Restored $restaurada.Conteos `
            -SourceFlyway $origen.Flyway -RestoredFlyway $restaurada.Flyway)
        Write-Host "    $($origen.Conteos.Count) tablas, Flyway $($origen.Flyway) en origen; " `
            + "$($restaurada.Conteos.Count) tablas, Flyway $($restaurada.Flyway) en restauración."
        if ($diferencias.Count -gt 0) {
            $diferencias | ForEach-Object { Write-Host "    DIFERENCIA: $_" }
            throw "La restauración no coincide: $($diferencias.Count) diferencia(s)."
        }
        Write-Host 'Restauración idéntica: el respaldo sirve.'
    }
    finally {
        if ($temporalArrancado -and (Get-Command docker -ErrorAction SilentlyContinue)) {
            docker rm --force $contenedorTemporal *> $null
        }
        if (Test-Path $volcado) { Remove-Item $volcado -Force }
    }
}
