import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'

const CRFS = [18, 22, 28, 32, 38]
const AUDIO_BITRATES = [96, 128, 192]

export const videoCompressTool: ToolDefinition = {
  id: 'video-compress',
  name: 'Video Compress',
  description: 'Reduce video size and resolution. Heavy on memory — use on desktop.',
  category: 'video',
  supportedInputs: ['video/'],
  defaultOptions: { resolution: 'original', crf: 28, audioBitrate: 128 },
  optionSchema: [
    {
      key: 'resolution',
      label: 'Resolution',
      type: 'select',
      options: [
        { label: 'Original', value: 'original' },
        { label: '1080p', value: '1080' },
        { label: '720p', value: '720' },
        { label: '480p', value: '480' },
      ],
      default: 'original',
    },
    {
      key: 'crf',
      label: 'Quality (lower = better)',
      type: 'select',
      options: CRFS.map((v) => ({ label: `${v}`, value: v })),
      default: 28,
    },
    {
      key: 'audioBitrate',
      label: 'Audio bitrate (kbps)',
      type: 'select',
      options: AUDIO_BITRATES.map((v) => ({ label: `${v}`, value: v })),
      default: 128,
    },
  ],
  engine: engineFor(
    'ffmpeg.compressVideo',
    () => import('@/engines/ffmpeg-engine').then((m) => ({ execute: m.compressVideo })),
  ),
  outputExtension: 'mp4',
}