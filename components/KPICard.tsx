'use client'
import { LucideIcon } from 'lucide-react'
import { fmt } from '@/lib/format'

interface Props {
  title: string
  value: number
  icon: LucideIcon
  color: 'green' | 'red' | 'blue' | 'purple' | 'yellow'
  trend?: number
  subtitle?: string
}

const colorMap = {
  green:  { bg: 'bg-[#00e5aa]/10',  icon: 'text-[#00e5aa]',  glow: 'shadow-[#00e5aa]/10',  text: 'text-[#00e5aa]'  },
  red:    { bg: 'bg-[#ff3366]/10',  icon: 'text-[#ff3366]',  glow: 'shadow-[#ff3366]/10',  text: 'text-[#ff3366]'  },
  blue:   { bg: 'bg-[#4d8dff]/10',  icon: 'text-[#4d8dff]',  glow: 'shadow-[#4d8dff]/10',  text: 'text-[#4d8dff]'  },
  purple: { bg: 'bg-[#9966ff]/10',  icon: 'text-[#9966ff]',  glow: 'shadow-[#9966ff]/10',  text: 'text-[#9966ff]'  },
  yellow: { bg: 'bg-[#ffcc00]/10',  icon: 'text-[#ffcc00]',  glow: 'shadow-[#ffcc00]/10',  text: 'text-[#ffcc00]'  },
}

export default function KPICard({ title, value, icon: Icon, color, trend, subtitle }: Props) {
  const c = colorMap[color]
  const isPositive = value >= 0

  return (
    <div className={`relative bg-[#0d0d1a] border border-[#1a1a2e] rounded-2xl p-5 shadow-lg ${c.glow} overflow-hidden`}>
      {/* background glow */}
      <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-20 blur-2xl ${c.bg.replace('/10','')}`} />

      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            trend >= 0 ? 'bg-[#00e5aa]/10 text-[#00e5aa]' : 'bg-[#ff3366]/10 text-[#ff3366]'
          }`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>

      <p className="text-[#7070a0] text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-xl font-bold ${color === 'red' || (!isPositive && color !== 'green') ? 'text-[#ff3366]' : 'text-white'}`}>
        {fmt(value)}
      </p>
      {subtitle && <p className="text-[#505070] text-xs mt-1">{subtitle}</p>}
    </div>
  )
}
