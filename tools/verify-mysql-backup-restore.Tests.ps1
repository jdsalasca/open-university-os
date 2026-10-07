. (Join-Path $PSScriptRoot 'verify-mysql-backup-restore.ps1')

Describe 'Compare-RestoredDatabase' {
    It 'accepts an identical restore' {
        # Arrange
        $origen = @{ 'institution_banner' = 0; 'flyway_schema_history' = 27 }
        $restaurada = @{ 'institution_banner' = 0; 'flyway_schema_history' = 27 }

        # Act
        $diferencias = Compare-RestoredDatabase -Source $origen -Restored $restaurada `
            -SourceFlyway '27' -RestoredFlyway '27'

        # Assert
        $diferencias | Should BeNullOrEmpty
    }

    It 'reports a table missing from the restore' {
        # Arrange
        $origen = @{ 'institution_banner' = 0; 'flyway_schema_history' = 27 }
        $restaurada = @{ 'flyway_schema_history' = 27 }

        # Act
        $diferencias = @(Compare-RestoredDatabase -Source $origen -Restored $restaurada `
            -SourceFlyway '27' -RestoredFlyway '27')

        # Assert
        $diferencias.Count | Should Be 1
        $diferencias[0] | Should Match 'institution_banner'
    }

    It 'reports a row-count drift in a restored table' {
        # Arrange
        $origen = @{ 'institution_banner' = 3 }
        $restaurada = @{ 'institution_banner' = 2 }

        # Act
        $diferencias = @(Compare-RestoredDatabase -Source $origen -Restored $restaurada `
            -SourceFlyway '27' -RestoredFlyway '27')

        # Assert
        $diferencias.Count | Should Be 1
        $diferencias[0] | Should Match 'institution_banner'
        $diferencias[0] | Should Match '3'
        $diferencias[0] | Should Match '2'
    }

    It 'reports a flyway version drift' {
        # Arrange
        $origen = @{ 'flyway_schema_history' = 27 }
        $restaurada = @{ 'flyway_schema_history' = 27 }

        # Act
        $diferencias = @(Compare-RestoredDatabase -Source $origen -Restored $restaurada `
            -SourceFlyway '27' -RestoredFlyway '26')

        # Assert
        $diferencias.Count | Should Be 1
        $diferencias[0] | Should Match 'flyway'
    }
}
