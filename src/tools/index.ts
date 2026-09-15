import { registerTool } from '@/services/tool-registry'
import type { DeveloperToolExecute } from '@/types/developer-tool'
import { imageConvertTool } from './image-convert'
import { imageCompressTool } from './image-compress'
import { imageResizeTool } from './image-resize'
import { imageCropTool } from './image-crop'
import { imagesToPdfTool } from './images-to-pdf'
import { pdfMergeTool } from './pdf-merge'
import { pdfSplitTool } from './pdf-split'
import { pdfCompressTool } from './pdf-compress'
import { pdfOrganizeTool } from './pdf-organize'
import { pdfToImagesTool } from './pdf-to-images'
import { zipCreateTool } from './zip-create'
import { zipExtractTool } from './zip-extract'
import { tarExtractTool } from './tar-extract'
import { fileInfoTool } from './file-info'
import { batchRenameTool } from './batch-rename'
import { duplicateDetectTool } from './duplicate-detect'
import { videoToAudioTool } from './video-to-audio'
import { audioConvertTool } from './audio-convert'
import { videoCompressTool } from './video-compress'
import { jsonFormatTool, processJsonFormat } from './json-format'
import { base64Tool, processBase64 } from './base64-convert'
import { hashGenerateTool, processHash } from './hash-generate'
import { uuidGenerateTool, processUuidGenerate } from './uuid-generate'
import { urlConvertTool, processUrlConvert } from './url-convert'
import { jwtDecodeTool, processJwtDecode } from './jwt-decode'
import { timestampConvertTool, processTimestampConvert } from './timestamp-convert'

const developerProcessors: Record<string, DeveloperToolExecute> = {
  'json-format': processJsonFormat,
  'base64-convert': processBase64,
  'hash-generate': processHash,
  'uuid-generate': processUuidGenerate,
  'url-convert': processUrlConvert,
  'jwt-decode': processJwtDecode,
  'timestamp-convert': processTimestampConvert,
}

export function getDeveloperProcessor(toolId: string): DeveloperToolExecute | undefined {
  return developerProcessors[toolId]
}

export function registerAllTools(): void {
  registerTool(imageConvertTool)
  registerTool(imageCompressTool)
  registerTool(imageResizeTool)
  registerTool(imageCropTool)
  registerTool(imagesToPdfTool)
  registerTool(pdfMergeTool)
  registerTool(pdfSplitTool)
  registerTool(pdfCompressTool)
  registerTool(pdfOrganizeTool)
  registerTool(pdfToImagesTool)
  registerTool(zipCreateTool)
  registerTool(zipExtractTool)
  registerTool(tarExtractTool)
  registerTool(fileInfoTool)
  registerTool(batchRenameTool)
  registerTool(duplicateDetectTool)
  registerTool(videoToAudioTool)
  registerTool(audioConvertTool)
  registerTool(videoCompressTool)
  registerTool(jsonFormatTool)
  registerTool(base64Tool)
  registerTool(hashGenerateTool)
  registerTool(uuidGenerateTool)
  registerTool(urlConvertTool)
  registerTool(jwtDecodeTool)
  registerTool(timestampConvertTool)
}