. (Join-Path $PSScriptRoot 'verify-volume-backup.ps1')

Describe 'Compare-VolumeTree' {
    It 'accepts an identical tree' {
        # Arrange
        $origen = @{ 'logo/a.png' = 'abc123'; 'banners/b.png' = 'def456' }
        $restaurado = @{ 'logo/a.png' = 'abc123'; 'banners/b.png' = 'def456' }

        # Act
        $diferencias = Compare-VolumeTree -Source $origen -Restored $restaurado

        # Assert
        $diferencias | Should BeNullOrEmpty
    }

    It 'reports a file missing from the restore' {
        # Arrange
        $origen = @{ 'logo/a.png' = 'abc123'; 'banners/b.png' = 'def456' }
        $restaurado = @{ 'logo/a.png' = 'abc123' }

        # Act
        $diferencias = @(Compare-VolumeTree -Source $origen -Restored $restaurado)

        # Assert
        $diferencias.Count | Should Be 1
        $diferencias[0] | Should Match 'banners/b.png'
    }

    It 'reports a byte-level drift in a restored file' {
        # Arrange
        $origen = @{ 'logo/a.png' = 'abc123' }
        $restaurado = @{ 'logo/a.png' = 'xyz999' }

        # Act
        $diferencias = @(Compare-VolumeTree -Source $origen -Restored $restaurado)

        # Assert
        $diferencias.Count | Should Be 1
        $diferencias[0] | Should Match 'logo/a.png'
    }

    It 'reports an empty restore of a non-empty source' {
        # Arrange
        $origen = @{ 'logo/a.png' = 'abc123' }
        $restaurado = @{}

        # Act
        $diferencias = @(Compare-VolumeTree -Source $origen -Restored $restaurado)

        # Assert
        $diferencias.Count | Should Be 1
    }
}
