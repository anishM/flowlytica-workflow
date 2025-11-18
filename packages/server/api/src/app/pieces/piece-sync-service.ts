import { PieceMetadata, PieceMetadataModel, PieceMetadataModelSummary } from '@activepieces/pieces-framework'
import { AppSystemProp, apVersionUtil, filePiecesUtils, PiecesSource } from '@activepieces/server-shared'
import { ApEnvironment, FileCompression, FileId, FileType, ListVersionsResponse, PackageType, PieceSyncMode, PieceType } from '@activepieces/shared'
import { exec } from 'child_process'
import dayjs from 'dayjs'
import { FastifyBaseLogger } from 'fastify'
import { readFile, unlink } from 'fs/promises'
import { StatusCodes } from 'http-status-codes'
import { join, resolve } from 'path'
import { promisify } from 'util'
import { fileService } from '../file/file.service'
import { repoFactory } from '../core/db/repo-factory'
import { parseAndVerify } from '../helper/json-validator'
import { system } from '../helper/system/system'
import { SystemJobName } from '../helper/system-jobs/common'
import { systemJobHandlers } from '../helper/system-jobs/job-handlers'
import { systemJobsSchedule } from '../helper/system-jobs/system-job'
import { PieceMetadataEntity } from './piece-metadata-entity'
import { pieceMetadataService } from './piece-metadata-service'

const REGISTRY_API_URL = system.getOrThrow(AppSystemProp.PIECES_REGISTRY_URL)
const IS_LOCAL_REGISTRY = REGISTRY_API_URL === 'local'
const piecesSource = system.getOrThrow<PiecesSource>(AppSystemProp.PIECES_SOURCE)
const environment = system.get(AppSystemProp.ENVIRONMENT)
const piecesRepo = repoFactory(PieceMetadataEntity)
const syncMode = system.get<PieceSyncMode>(AppSystemProp.PIECES_SYNC_MODE)

const execAsync = promisify(exec)

export const pieceSyncService = (log: FastifyBaseLogger) => ({
    async setup(): Promise<void> {
        if (syncMode === PieceSyncMode.NONE) {
            if (shouldBootstrapLocalDbWithPieces()) {
                log.info('Piece sync disabled but local development DB detected; running one-time sync so all pieces are available.')
                await pieceSyncService(log).sync()
            }
            else {
            log.info('Piece sync service is disabled')
            }
            return
        }
        const isAutoSync = syncMode === PieceSyncMode.OFFICIAL_AUTO || syncMode === PieceSyncMode.LOCAL_AUTO
        if (isAutoSync) {
            systemJobHandlers.registerJobHandler(SystemJobName.PIECES_SYNC, async function syncPiecesJobHandler(): Promise<void> {
                await pieceSyncService(log).sync()
            })
            await pieceSyncService(log).sync()
            await systemJobsSchedule(log).upsertJob({
                job: {
                    name: SystemJobName.PIECES_SYNC,
                    data: {},
                },
                schedule: {
                    type: 'repeated',
                    cron: '0 */1 * * *',
                },
            })
        }
    },
    async sync(): Promise<void> {
        try {
            log.info({ time: dayjs().toISOString() }, 'Syncing pieces')
            const pieces = await listPieces()
            const promises: Promise<void>[] = []

            for (const summary of pieces) {
                const lastVersionSynced = await existsInDatabase({ name: summary.name, version: summary.version })
                if (!lastVersionSynced) {
                    promises.push(syncPiece(summary.name, log))
                }
            }
            await Promise.all(promises)
        }
        catch (error) {
            log.error({ error }, 'Error syncing pieces')
        }
    },
})

const shouldBootstrapLocalDbWithPieces = (): boolean => {
    return environment === ApEnvironment.DEVELOPMENT
        && piecesSource === PiecesSource.DB
        && IS_LOCAL_REGISTRY
}

async function syncPiece(name: string, log: FastifyBaseLogger): Promise<void> {
    try {
        log.info({ name }, 'Syncing piece metadata into database')
        const versions = await getVersions({ name })
        for (const version of Object.keys(versions)) {
            const currentVersionSynced = await existsInDatabase({ name, version })
            if (!currentVersionSynced) {
                const piece = await getOrThrow({ name, version, log })
                await pieceMetadataService(log).create({
                    pieceMetadata: piece,
                    packageType: piece.packageType,
                    pieceType: piece.pieceType,
                })
            }
        }
    }
    catch (error) {
        log.error(error, 'Error syncing piece, please upgrade the activepieces to latest version')
    }

}
async function existsInDatabase({ name, version }: { name: string, version: string }): Promise<boolean> {
    if (IS_LOCAL_REGISTRY) {
        // For local pieces, check both ARCHIVE and REGISTRY types
        return piecesRepo().existsBy({
            name,
            version,
            pieceType: PieceType.OFFICIAL,
        })
    }
    return piecesRepo().existsBy({
        name,
        version,
        pieceType: PieceType.OFFICIAL,
        packageType: PackageType.REGISTRY,
    })
}

async function getVersions({ name }: { name: string }): Promise<ListVersionsResponse> {
    if (IS_LOCAL_REGISTRY) {
        // For local sync, load ALL pieces regardless of AP_DEV_PIECES
        // AP_DEV_PIECES is only for FILE source mode, not DB sync
        const all = await filePiecesUtils([''], system.globalLogger()).findAllPieces()
        const piece = all.find(p => p.name === name)
        if (!piece) {
            return {}
        }
        return { [piece.version]: {} }
    }
    else {
        const queryParams = new URLSearchParams()
        queryParams.append('edition', system.getEdition())
        queryParams.append('release', await apVersionUtil.getCurrentRelease())
        queryParams.append('name', name)
        const url = `${REGISTRY_API_URL}/versions?${queryParams.toString()}`
        const response = await fetch(url)
        return parseAndVerify<ListVersionsResponse>(ListVersionsResponse, (await response.json()))
    }
}

async function getOrThrow({ name, version, log }: { name: string, version: string, log: FastifyBaseLogger }): Promise<PieceMetadataModel> {
    if (IS_LOCAL_REGISTRY) {
        // For local sync, load ALL pieces regardless of AP_DEV_PIECES
        // AP_DEV_PIECES is only for FILE source mode, not DB sync
        const all = await filePiecesUtils([''], system.globalLogger()).findAllPieces()
        const meta = all.find(p => p.name === name)
        if (!meta) {
            throw new Error(`Piece not found locally: ${name}`)
        }
        // Create archive for local piece and get archiveId
        const archiveId = await createArchiveForLocalPiece(meta.directoryPath, name, log)
        return toPieceMetadataModel(meta, archiveId)
    }
    else {
        const response = await fetch(`${REGISTRY_API_URL}/${name}${version ? '?version=' + version : ''}`)
        return response.json()
    }
}

async function listPieces(): Promise<PieceMetadataModelSummary[]> {
    if (IS_LOCAL_REGISTRY) {
        // For local sync, load ALL pieces regardless of AP_DEV_PIECES
        // AP_DEV_PIECES is only for FILE source mode, not DB sync
        const all = await filePiecesUtils([''], system.globalLogger()).findAllPieces()
        const summaries: PieceMetadataModelSummary[] = all.map(p => ({
            name: p.name,
            displayName: p.displayName,
            description: p.description,
            logoUrl: p.logoUrl,
            version: p.version,
            authors: p.authors,
            minimumSupportedRelease: p.minimumSupportedRelease ?? '0.0.0',
            maximumSupportedRelease: p.maximumSupportedRelease ?? '999.999.999',
            i18n: p.i18n,
            pieceType: PieceType.OFFICIAL,
            packageType: IS_LOCAL_REGISTRY ? PackageType.ARCHIVE : PackageType.REGISTRY,
            categories: p.categories,
            actions: Object.keys(p.actions ?? {}).length,
            triggers: Object.keys(p.triggers ?? {}).length,
            projectUsage: 0,
            isPinned: false,
            isHidden: false,
        }))
        return summaries
    }
    else {
        const queryParams = new URLSearchParams()
        queryParams.append('edition', system.getEdition())
        queryParams.append('release', await apVersionUtil.getCurrentRelease())
        const url = `${REGISTRY_API_URL}?${queryParams.toString()}`
        const response = await fetch(url)
        if (response.status === StatusCodes.GONE.valueOf()) {
            return []
        }
        if (response.status !== StatusCodes.OK.valueOf()) {
            throw new Error(await response.text())
        }
        return response.json()
    }
}

async function createArchiveForLocalPiece(directoryPath: string | undefined, pieceName: string, log: FastifyBaseLogger): Promise<FileId | undefined> {
    if (!directoryPath) {
        log.warn({ pieceName }, 'No directory path for piece, skipping archive creation')
        return undefined
    }

    try {
        // directoryPath is already an absolute path to dist/packages/pieces/...
        // Just use it directly
        const absoluteDistPath = directoryPath

        log.info({ pieceName, distPath: absoluteDistPath }, 'Creating archive for local piece')

        // Use npm pack to create the archive
        const { stdout } = await execAsync('npm pack --json', { cwd: absoluteDistPath })
        const packResult = JSON.parse(stdout)
        const tarFileName = packResult[0]?.filename

        if (!tarFileName) {
            throw new Error('npm pack did not return a filename')
        }

        const archivePath = join(absoluteDistPath, tarFileName)
        const archiveBuffer = await readFile(archivePath)

        // Save archive to file service
        const archiveFile = await fileService(log).save({
            projectId: undefined,
            platformId: undefined,
            data: archiveBuffer,
            size: archiveBuffer.length,
            type: FileType.PACKAGE_ARCHIVE,
            compression: FileCompression.NONE,
            fileName: tarFileName,
        })

        // Clean up temporary archive file
        await unlink(archivePath).catch(() => {
            // Ignore cleanup errors
        })

        log.info({ pieceName, archiveId: archiveFile.id }, 'Archive created and saved for local piece')
        return archiveFile.id
    }
    catch (error) {
        log.error({ error, pieceName, directoryPath }, 'Failed to create archive for local piece')
        return undefined
    }
}

function toPieceMetadataModel(piece: PieceMetadata, archiveId?: FileId): PieceMetadataModel {
    return {
        name: piece.name,
        displayName: piece.displayName,
        description: piece.description,
        logoUrl: piece.logoUrl,
        version: piece.version,
        authors: piece.authors,
        auth: piece.auth,
        actions: piece.actions,
        triggers: piece.triggers,
        minimumSupportedRelease: piece.minimumSupportedRelease ?? '0.0.0',
        maximumSupportedRelease: piece.maximumSupportedRelease ?? '999.999.999',
        pieceType: PieceType.OFFICIAL,
        packageType: IS_LOCAL_REGISTRY ? PackageType.ARCHIVE : PackageType.REGISTRY,
        archiveId: IS_LOCAL_REGISTRY ? archiveId : undefined,
        i18n: piece.i18n,
        projectId: undefined,
        projectUsage: 0,
        directoryPath: piece.directoryPath,
        categories: piece.categories,
    }
}
