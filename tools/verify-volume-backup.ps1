Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Simulacro de respaldo y restauración de volúmenes: el gate de producción exige copias probadas.
#
# El volumen de branding-assets está vacío hoy (0 archivos), así que respaldarlo y restaurarlo no
# probaría nada: vacío contra vacío siempre coincide. Este script prueba el MECANISMO con volúmenes
# desechables que sí tienen contenido: siembra archivos canario sintéticos, los respalda a un tar,
# los restaura en otro volumen y compara ruta por ruta con sha256. No toca ningún volumen de la
# aplicación: todo lo que crea lo borra.
function Compare-VolumeTree {
    param(
        [hashtable]$Source = @{},
        [hashtable]$Restored = @{}
    )

    $diferencias = @()
    foreach ($ruta in $Source.Keys) {
        if (-not $Restored.ContainsKey($ruta)) {
            $diferencias += "archivo ausente en la restauración: $ruta"
        }
        elseif ($Restored[$ruta] -ne $Source[$ruta]) {
            $diferencias += "contenido distinto en ${ruta}: origen $($Source[$ruta]), restaurada $($Restored[$ruta])"
        }
    }
    foreach ($ruta in $Restored.Keys) {
        if (-not $Source.ContainsKey($ruta)) {
            $diferencias += "archivo sobrante en la restauración: $ruta"
        }
    }
    return $diferencias
}

if ($MyInvocation.InvocationName -ne '.') {
    $sufijo = [Guid]::NewGuid().ToString('N').Substring(0, 12)
    $volumenOrigen = "universiry-volumen-prueba-origen-$sufijo"
    $volumenDestino = "universiry-volumen-prueba-destino-$sufijo"
    $respaldo = Join-Path ([IO.Path]::GetTempPath()) "universiry-volumen-$sufijo.tar"
    $creados = @()

    try {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            throw 'Docker CLI no está disponible en PATH.'
        }

        Write-Host '1/4 Sembrando archivos canario sintéticos en un volumen desechable...'
        docker volume create $volumenOrigen | Out-Null
        $creados += $volumenOrigen
        docker run --rm -v "${volumenOrigen}:/datos" alpine sh -c `
            "echo 'canario-uno-sintetico' > /datos/a.txt && mkdir -p /datos/sub && head -c 2048 /dev/urandom > /datos/sub/b.bin && ls -R /datos" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo sembrar el volumen.' }

        Write-Host '2/4 Respaldando el volumen a un tar...'
        docker run --rm -v "${volumenOrigen}:/datos:ro" -v "$([IO.Path]::GetTempPath()):/salida" alpine `
            sh -c "tar -cf /salida/$(Split-Path $respaldo -Leaf) -C /datos ." | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'El respaldo a tar falló.' }
        $kilos = [math]::Round((Get-Item $respaldo).Length / 1KB, 1)
        Write-Host "    respaldo en $respaldo ($kilos kB)"

        Write-Host '3/4 Restaurando el tar en otro volumen desechable...'
        docker volume create $volumenDestino | Out-Null
        $creados += $volumenDestino
        docker run --rm -v "${volumenDestino}:/datos" -v "$([IO.Path]::GetTempPath()):/salida" alpine `
            sh -c "tar -xf /salida/$(Split-Path $respaldo -Leaf) -C /datos" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'La restauración falló.' }

        Write-Host '4/4 Comparando árbol contra árbol por sha256...'
        $arbol = {
            param($volumen)
            $comando = "cd /datos && find . -type f | sort | while read f; do printf '%s %s\n' ""`$f"" ""`$(sha256sum ""`$f"" | cut -d' ' -f1)""; done"
            $lineas = docker run --rm -v "${volumen}:/datos:ro" alpine sh -c $comando
            $mapa = @{}
            foreach ($linea in $lineas) {
                $partes = $linea -split ' ', 2
                if ($partes.Count -eq 2) { $mapa[$partes[0]] = $partes[1] }
            }
            return $mapa
        }
        $origen = & $arbol $volumenOrigen
        $restaurado = & $arbol $volumenDestino
        $diferencias = @(Compare-VolumeTree -Source $origen -Restored $restaurado)
        Write-Host "    $($origen.Count) archivos en origen; $($restaurado.Count) en restauración."
        if ($diferencias.Count -gt 0) {
            $diferencias | ForEach-Object { Write-Host "    DIFERENCIA: $_" }
            throw "La restauración no coincide: $($diferencias.Count) diferencia(s)."
        }
        Write-Host 'Restauración idéntica: el mecanismo de respaldo sirve.'
    }
    finally {
        foreach ($nombre in $creados) {
            docker volume rm --force $nombre *> $null
        }
        if (Test-Path $respaldo) { Remove-Item $respaldo -Force }
    }
}
