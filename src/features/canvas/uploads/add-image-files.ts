import type { XYPosition } from '@xyflow/react'
import { imageStorage } from '@/services/persistence'
import { useUiStore } from '@/stores/ui-store'
import type { ImageStorage } from '@/services/persistence/image-storage'
import { IMAGE_LIMITS, MAX_FILES_PER_DROP } from '../utils/constants'
import { createImageCard } from '../utils/node-factory'
import type { ImageCard } from '../types/nodes'
import { compressImage, type CompressedImage } from './image-compress'
import { readImageDimensions, type ImageDimensions } from './image-decode'
import { fitImageWidth, validatePixelCount, validateImageFile } from './image-validation'

/** إزاحة تراكب الصور المتعددة كي لا تتطابق تماماً */
const CASCADE_OFFSET = 28

export interface ImageIntake {
  /** الصورة بعد الحفظ والفحص، جاهزة لتُضاف أو تُستخدم لاستبدال صورة قائمة */
  imageId: string
  fileName: string
  naturalWidth: number
  naturalHeight: number
}

export interface ImageDeps {
  storage?: ImageStorage
  readDimensions?: (blob: Blob) => Promise<ImageDimensions>
  /** يضغط الصورة إن استحقت (null = تُخزَّن كما هي). الافتراضي يحترم إعداد «ضغط الصور الجديدة». */
  compress?: (file: File, dimensions: ImageDimensions) => Promise<CompressedImage | null>
}

const defaultCompress = (file: File, dimensions: ImageDimensions) =>
  useUiStore.getState().compressImages ? compressImage(file, dimensions) : Promise.resolve(null)

/** يفحص ملفاً واحداً ويحفظه؛ يرمي Error برسالة مقروءة للمستخدم عند أي فشل. */
export async function intakeImageFile(file: File, deps: ImageDeps = {}): Promise<ImageIntake> {
  const storage = deps.storage ?? imageStorage
  const readDimensions = deps.readDimensions ?? readImageDimensions

  const check = validateImageFile(file)
  if (!check.ok) throw new Error(check.message)

  let dimensions: ImageDimensions
  try {
    dimensions = await readDimensions(file)
  } catch {
    throw new Error(`"${file.name}" could not be read as an image. It may be damaged.`)
  }
  const pixels = validatePixelCount(file.name, dimensions.width, dimensions.height)
  if (!pixels.ok) throw new Error(pixels.message)

  // الضغط تحسين لا شرط: أي فشل فيه (أو رفض من المعيار) يعني تخزين الأصل كما هو، فلا نخسر الصورة بسببه
  const compressed = await (deps.compress ?? defaultCompress)(file, dimensions).catch(() => null)

  let imageId: string
  try {
    imageId = await storage.save(compressed?.blob ?? file)
  } catch {
    throw new Error(`"${file.name}" could not be stored in this browser.`)
  }
  return {
    imageId,
    fileName: file.name,
    naturalWidth: compressed?.width ?? dimensions.width,
    naturalHeight: compressed?.height ?? dimensions.height,
  }
}

export interface AddImagesResult {
  nodes: ImageCard[]
  errors: string[]
}

/**
 * ملفات → بطاقات صور. تُعالج بالتتابع (لا بالتوازي) كي يكون الترتيب والتراكب ثابتين،
 * وفشل ملف لا يوقف الباقي. الأخطاء تُجمع ليعرضها المستدعي في إشعار واحد.
 */
export async function addImageFiles(
  files: readonly File[],
  center: XYPosition,
  now: number,
  deps: ImageDeps = {},
): Promise<AddImagesResult> {
  const errors: string[] = []
  const nodes: ImageCard[] = []
  const accepted = files.slice(0, MAX_FILES_PER_DROP)
  if (files.length > accepted.length) {
    errors.push(`Only the first ${MAX_FILES_PER_DROP} files were added.`)
  }

  for (const file of accepted) {
    try {
      const intake = await intakeImageFile(file, deps)
      const point = { x: center.x + nodes.length * CASCADE_OFFSET, y: center.y + nodes.length * CASCADE_OFFSET }
      nodes.push(
        createImageCard(point, now, {
          ...intake,
          width: Math.min(fitImageWidth(intake.naturalWidth, intake.naturalHeight), IMAGE_LIMITS.maxWidth),
        }),
      )
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `"${file.name}" could not be added.`)
    }
  }
  return { nodes, errors }
}
