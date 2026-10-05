import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// findBy espera 1 s por defecto, insuficiente cuando un import dinamico tarda en
// resolverse bajo carga. Ver scripts/check-test-timeouts.node-test.mjs.
configure({ asyncUtilTimeout: 15000 })