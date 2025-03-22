import React from 'react'

interface SpinnerProps {
  className?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ className = 'h-64' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex space-x-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
      </div>
    </div>
  )
}
