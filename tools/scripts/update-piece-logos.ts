import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PIECES_ROOT = path.resolve('packages', 'pieces', 'community')
const TARGET_ROOT = path.resolve('packages', 'react-ui', 'public', 'images', 'pieces')
const LOG_PREFIX = '[update-piece-logos]'

type PieceResult = {
    piece: string
    status: 'updated' | 'skipped-local' | 'skipped-missing' | 'skipped-download-failed'
    reason?: string
}

async function main(): Promise<void> {
    await mkdir(TARGET_ROOT, { recursive: true })
    const entries = await readdir(PIECES_ROOT, { withFileTypes: true })
    const results: PieceResult[] = []

    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const pieceName = entry.name
        const indexPath = path.join(PIECES_ROOT, pieceName, 'src', 'index.ts')
        try {
            const content = await readFile(indexPath, 'utf-8')
            const regex = /logoUrl\s*:\s*(['"])([^'"]+)\1/
            const match = regex.exec(content)
            if (!match) {
                results.push({ piece: pieceName, status: 'skipped-missing', reason: 'logoUrl not found' })
                continue
            }
            const [, quote, logoUrl] = match
            if (logoUrl.startsWith('/') || logoUrl.startsWith('./')) {
                results.push({ piece: pieceName, status: 'skipped-local', reason: 'already local' })
                continue
            }

            const fileName = await downloadLogo(pieceName, logoUrl)
            if (!fileName) {
                results.push({ piece: pieceName, status: 'skipped-download-failed', reason: `failed to download ${logoUrl}` })
                continue
            }
            const localPath = `/images/pieces/${fileName}`
            const updatedContent = content.replace(regex, `logoUrl: ${quote}${localPath}${quote}`)
            await writeFile(indexPath, updatedContent)
            results.push({ piece: pieceName, status: 'updated' })
        }
        catch (error) {
            results.push({ piece: pieceName, status: 'skipped-missing', reason: (error as Error).message })
        }
    }

    summarize(results)
}

async function downloadLogo(pieceName: string, logoUrl: string): Promise<string | null> {
    try {
        const fetchResult = await fetchWithFallback(logoUrl)
        if (!fetchResult) {
            return null
        }
        const { response, resolvedUrl } = fetchResult
        const buffer = Buffer.from(await response.arrayBuffer())
        const urlExt = path.extname(new URL(resolvedUrl).pathname)
        const contentType = response.headers.get('content-type') ?? ''
        const inferredExt = inferExtension(urlExt, contentType)
        const fileName = `${pieceName}${inferredExt}`
        await writeFile(path.join(TARGET_ROOT, fileName), buffer)
        return fileName
    }
    catch (error) {
        console.warn(`${LOG_PREFIX} Error downloading ${logoUrl}: ${(error as Error).message}`)
        return null
    }
}

async function fetchWithFallback(logoUrl: string): Promise<{ response: Response, resolvedUrl: string } | null> {
    const attempts = [logoUrl, ...buildFallbackUrls(logoUrl)]
    for (const attempt of attempts) {
        try {
            const response = await fetch(attempt)
            if (response.ok) {
                return { response, resolvedUrl: attempt }
            }
            console.warn(`${LOG_PREFIX} Failed to download ${attempt}: ${response.status}`)
        }
        catch (error) {
            console.warn(`${LOG_PREFIX} Error downloading ${attempt}: ${(error as Error).message}`)
        }
    }
    return null
}

function buildFallbackUrls(originalUrl: string): string[] {
    const fallbacks: string[] = []
    if (originalUrl.startsWith('https://cdn.flowlytics.com/')) {
        fallbacks.push(originalUrl.replace('https://cdn.flowlytics.com/', 'https://cdn.activepieces.com/'))
    }
    return fallbacks
}

function inferExtension(urlExt: string, contentType: string): string {
    const ext = urlExt.toLowerCase()
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.svg' || ext === '.webp') {
        return ext
    }
    if (contentType.includes('png')) return '.png'
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg'
    if (contentType.includes('svg')) return '.svg'
    if (contentType.includes('webp')) return '.webp'
    return '.png'
}

function summarize(results: PieceResult[]): void {
    const totals = results.reduce<Record<PieceResult['status'], number>>((acc, result) => {
        acc[result.status] = (acc[result.status] ?? 0) + 1
        return acc
    }, {
        'updated': 0,
        'skipped-local': 0,
        'skipped-missing': 0,
        'skipped-download-failed': 0,
    })

    console.log(`${LOG_PREFIX} Updated logos: ${totals.updated}`)
    console.log(`${LOG_PREFIX} Already local: ${totals['skipped-local']}`)
    console.log(`${LOG_PREFIX} Missing logo definitions: ${totals['skipped-missing']}`)
    console.log(`${LOG_PREFIX} Download failures: ${totals['skipped-download-failed']}`)
}

main().catch((error) => {
    console.error(`${LOG_PREFIX} Unexpected error`, error)
    process.exitCode = 1
})

