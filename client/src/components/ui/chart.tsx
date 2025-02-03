import { ReactNode } from 'react'
import { Tooltip, TooltipProps } from 'recharts'

export type ChartConfig = Record<
  string,
  {
    label: string
    color: string
  }
>

interface ChartContainerProps {
  config: ChartConfig
  children: ReactNode
}

export function ChartContainer({ config, children }: ChartContainerProps) {
  return (
    <div
      style={
        {
          '--color-proofs': config.proofs.color,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}

export function ChartTooltip(props: TooltipProps<any, any>) {
  return <Tooltip {...props} />
}

interface ChartTooltipContentProps {
  active?: boolean
  payload?: any[]
  label?: string
  indicator?: 'line' | 'bar'
}

export function ChartTooltipContent({
  active,
  payload,
  label,
}: ChartTooltipContentProps) {
  if (!active || !payload) return null

  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="font-medium">{label}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="ml-2 font-medium tabular-nums">
              {payload[0].value}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
