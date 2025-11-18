import { piecesRegistryUrlValidator } from '../../../src/app/helper/system-validator'

describe('piecesRegistryUrlValidator', () => {
    it('accepts the local sentinel value', () => {
        expect(piecesRegistryUrlValidator('local')).toBe(true)
    })

    it('accepts valid URLs', () => {
        expect(piecesRegistryUrlValidator('https://registry.example.com/api/v1/pieces')).toBe(true)
    })

    it('rejects invalid values', () => {
        expect(piecesRegistryUrlValidator('registry')).toBe('Value must be a valid URL')
    })
})

