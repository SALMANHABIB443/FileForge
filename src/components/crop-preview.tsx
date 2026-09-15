import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import type { CustomPanelProps } from '@/services/tool-registry'
import { readFileAsBlob } from '@/services/file-service'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const MIN_SIZE = 16

export function CropPreviewPanel({ files, values, onChange }: CustomPanelProps) {
  const file = files[0]
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; box: Box } | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<{ w: number; h: number; naturalW: number; naturalH: number; ratio: number } | null>(null)
  const [box, setBox] = useState<Box | null>(null)

  const initializedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!file || initializedRef.current === file.id) return
    initializedRef.current = file.id
    let objectUrl: string | null = null
    void readFileAsBlob(file)
      .then(async (blob) => {
        const img = new Image()
        img.onload = () => {
          const naturalW = img.naturalWidth
          const naturalH = img.naturalHeight
          const maxW = 560
          const w = Math.min(naturalW, maxW)
          const h = naturalH * (w / naturalW)
          const ratio = naturalW / w
          setSize({ w, h, naturalW, naturalH, ratio })
          const b: Box = { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 }
          setBox(b)
          onChange({
            ...values,
            crop: {
              x: Math.round(b.x * ratio),
              y: Math.round(b.y * ratio),
              width: Math.round(b.w * ratio),
              height: Math.round(b.h * ratio),
            },
          })
        }
        objectUrl = URL.createObjectURL(blob)
        img.src = objectUrl
        setUrl(objectUrl)
      })
      .catch(console.error)
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file, values, onChange])

  if (!file) return null

  const pushBox = (b: Box) => {
    if (!size) return
    const clamped = {
      x: Math.max(0, Math.min(b.x, size.w - MIN_SIZE)),
      y: Math.max(0, Math.min(b.y, size.h - MIN_SIZE)),
      w: Math.max(MIN_SIZE, Math.min(b.w, size.w - b.x)),
      h: Math.max(MIN_SIZE, Math.min(b.h, size.h - b.y)),
    }
    setBox(clamped)
    onChange({
      ...values,
      crop: {
        x: Math.round(clamped.x * size.ratio),
        y: Math.round(clamped.y * size.ratio),
        width: Math.round(clamped.w * size.ratio),
        height: Math.round(clamped.h * size.ratio),
      },
    })
  }

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'resize') => {
    if (!box) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      box,
    }
  }

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || !size) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (drag.mode === 'move') {
      pushBox({ x: drag.box.x + dx, y: drag.box.y + dy, w: drag.box.w, h: drag.box.h })
    } else {
      pushBox({ x: drag.box.x, y: drag.box.y, w: drag.box.w + dx, h: drag.box.h + dy })
    }
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!box) return
    const step = event.shiftKey ? 40 : 4
    let dx = 0
    let dy = 0
    switch (event.key) {
      case 'ArrowLeft':
        dx = -step
        break
      case 'ArrowRight':
        dx = step
        break
      case 'ArrowUp':
        dy = -step
        break
      case 'ArrowDown':
        dy = step
        break
      default:
        return
    }
    event.preventDefault()
    pushBox({ x: box.x + dx, y: box.y + dy, w: box.w, h: box.h })
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
          Crop
        </h3>
        <div className="flex gap-1">
          {[0, 90, 180, 270].map((deg) => (
            <button
              key={deg}
              type="button"
              aria-label={`Rotate ${deg} degrees`}
              aria-pressed={Number(values.rotation) === deg}
              onClick={() => onChange({ ...values, rotation: deg })}
              className={`rounded-[var(--radius-buttons)] px-3 py-1 text-[12px] font-medium font-[family-name:var(--font-geist)] border border-hairline transition-colors cursor-pointer ${
                Number(values.rotation) === deg
                  ? 'bg-brown text-paper'
                  : 'bg-canvas text-ink hover:bg-surface-alt'
              }`}
            >
              {deg === 0 ? '0°' : `${deg}°`}
            </button>
          ))}
        </div>
      </div>

      {url && (
        <div className="flex justify-center">
          <div
            className="relative select-none overflow-hidden rounded-[var(--radius-xl)] border border-hairline"
            style={{ width: size?.w, height: size?.h, touchAction: 'none' }}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <img
              src={url}
              alt={file.name}
              draggable={false}
              className="block w-full h-full object-contain"
            />
            {box && (
              <div
                tabIndex={0}
                role="group"
                aria-label="Crop area. Use arrow keys to move, Shift + arrows to move faster"
                onKeyDown={nudge}
                onPointerDown={(e) => beginDrag(e, 'move')}
                style={{
                  left: box.x,
                  top: box.y,
                  width: box.w,
                  height: box.h,
                  position: 'absolute',
                  border: '2px solid #0a0a0a',
                  boxShadow: '0 0 0 9999px rgba(10,10,10,0.3)',
                  cursor: 'move',
                }}
              >
                <div
                  onPointerDown={(e) => beginDrag(e, 'resize')}
                  style={{
                    position: 'absolute',
                    right: -6,
                    bottom: -6,
                    width: 12,
                    height: 12,
                    border: '2px solid #0a0a0a',
                    background: '#ffffff',
                    borderRadius: 999,
                    cursor: 'nwse-resize',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {box && (
        <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
          {Math.round(box.w * (size?.ratio ?? 1))} × {Math.round(box.h * (size?.ratio ?? 1))} px selected
        </p>
      )}
    </Card>
  )
}