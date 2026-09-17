import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'

const BITRATES = [96, 128, 192, 256, 320]

export const audioConvertTool: ToolDefinition = {
  id: 'audio-convert',
  name: 'Audio Convert',
  description: 'Convert between MP3, WAV and M4A with bitrate control.',
  category: 'audio',
  supportedInputs: ['audio/'],
  defaultOptions: { format: 'mp3', bitrate: 192 },
  optionSchema: [
    {
      key: 'format',
      label: 'Output format',
      type: 'select',
      options: [
        { label: 'MP3', value: 'mp3' },
        { label: 'WAV', value: 'wav' },
        { label: 'M4A', value: 'm4a' },
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
  engine: engineFor(
    'ffmpeg.convertAudio',
    () => import('@/engines/ffmpeg-engine').then((m) => ({ execute: m.convertAudio })),
  ),
  outputExtension: 'mp3',
}