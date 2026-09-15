import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'

const BITRATES = [96, 128, 192, 256, 320]

export const videoToAudioTool: ToolDefinition = {
  id: 'video-to-audio',
  name: 'Video to Audio',
  description: 'Extract the audio track from a video as MP3 or WAV.',
  category: 'video',
  supportedInputs: ['video/'],
  defaultOptions: { format: 'mp3', bitrate: 192 },
  optionSchema: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      options: [
        { label: 'MP3', value: 'mp3' },
        { label: 'WAV', value: 'wav' },
      ],
      default: 'mp3',
    },
    {
      key: 'bitrate',
      label: 'Bitrate (kbps)',
      type: 'select',
      options: BITRATES.map((v) => ({ label: `${v}`, value: v })),
      default: 192,
    },
  ],
  engine: lazyEngine(() =>
    import('@/engines/ffmpeg-engine').then((m) => ({ execute: m.extractAudio })),
  ),
  outputExtension: 'mp3',
}