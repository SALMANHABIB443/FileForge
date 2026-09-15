import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface ReorderItem {
  key: string
  title: string
  subtitle?: string
}

interface ReorderListProps {
  items: ReorderItem[]
  onReorder: (items: ReorderItem[]) => void
}

export function ReorderList({ items, onReorder }: ReorderListProps) {
  if (items.length === 0) return null

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = items.slice()
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    onReorder(next)
  }

  return (
    <Card className="p-4 space-y-2">
      <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
        Order
      </h3>
      <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
        {items.length === 1 ? 'Add more items to reorder them.' : 'Use the arrows to set the order.'}
      </p>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.key}
            className="flex items-center gap-3 bg-surface-alt rounded-[var(--radius-md)] px-3 py-2"
          >
            <span className="text-[12px] leading-[1.33] text-mid-gray tabular-nums w-6 shrink-0 font-[family-name:var(--font-geist)]">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] leading-[1.43] text-ink truncate font-medium font-[family-name:var(--font-geist)]">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
                  {item.subtitle}
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Move ${item.title} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Move ${item.title} down`}
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}