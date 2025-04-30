import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface CopyButtonProps {
  value: string
  displayValue?: string
  className?: string
  iconClassName?: string
  tooltipText?: string
  successMessage?: string
  showText?: boolean
  size?: number
}

export const CopyButton = ({
  value,
  displayValue,
  className,
  iconClassName,
  tooltipText = 'Copy to clipboard',
  successMessage = 'Copied to clipboard',
  showText = false,
  size = 14,
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)

      toast({
        title: 'Success',
        description: successMessage,
        variant: 'default',
      })

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-md transition-colors',
        'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
        'dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
        className
      )}
      title={tooltipText}
      aria-label={tooltipText}
    >
      {showText && displayValue && (
        <span className="text-xs font-mono truncate max-w-[120px]">
          {displayValue}
        </span>
      )}
      {copied ? (
        <Check size={size} className={cn('text-green-500', iconClassName)} />
      ) : (
        <Copy size={size} className={iconClassName} />
      )}
    </button>
  )
}
