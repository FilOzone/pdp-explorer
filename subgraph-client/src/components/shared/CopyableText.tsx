import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { CopyButton } from './CopyButton'

interface CopyableTextProps {
  value: string
  to?: string
  label?: string
  truncate?: boolean
  truncateLength?: number
  className?: string
  linkClassName?: string
  monospace?: boolean
}

export const CopyableText = ({
  value,
  to,
  label = 'Text',
  truncate = false,
  truncateLength = 8,
  className,
  linkClassName,
  monospace = true,
}: CopyableTextProps) => {
  // Format value for display if truncation is enabled
  const displayValue =
    truncate && value.length > truncateLength * 2
      ? `${value.substring(0, truncateLength)}...${value.substring(
          value.length - truncateLength
        )}`
      : value

  return (
    <div
      className={cn(
        'group flex items-center gap-1',
        monospace && 'font-mono text-sm',
        className
      )}
    >
      {to ? (
        <Link
          to={to}
          className={cn(
            'text-blue-500 hover:underline dark:text-blue-400',
            linkClassName
          )}
          title={value}
        >
          {displayValue}
        </Link>
      ) : (
        <span title={value}>{displayValue}</span>
      )}
      <CopyButton
        value={value}
        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
        successMessage={`${label} copied to clipboard`}
      />
    </div>
  )
}
