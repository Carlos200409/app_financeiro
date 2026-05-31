'use client'
import { useMemo } from 'react'
import { fmt } from '@/lib/format'

interface Slice {
  label: string
  value: number
  color: string
  gradientId?: string
}

interface Props {
  slices: Slice[]
  centerLabel?: string
  centerValue?: number
  size?: number
}

const COLORS = [
  { solid: '#4d8dff', gradient: ['#4d8dff', '#7b5fff'] },
  { solid: '#ffcc00', gradient: ['#ffcc00', '#ff9900'] },
  { solid: '#9966ff', gradient: ['#9966ff', '#cc44ff'] },
  { solid: '#00e5aa', gradient: ['#00e5aa', '#00b8d9'] },
  { solid: '#ff3366', gradient: ['#ff3366', '#ff6633'] },
]

export default function DonutChart({ slices, centerLabel = 'Total', centerValue, size = 200 }: Props) {
  const total = slices.reduce((s, i) => s + i.value, 0)
  const r = 70
  const cx = size / 2
  const cy = size / 2
  const strokeWidth = 22
  const circumference = 2 * Math.PI * r
  const gap = 4 // gap between segments in degrees

  const segments = useMemo(() => {
    if (total === 0) return []
    let cumAngle = -90 // start from top
    return slices
      .filter(s => s.value > 0)
      .map((slice, i) => {
        const pct = slice.value / total
        const angleDeg = pct * 360 - gap
        const startAngle = cumAngle + gap / 2
        cumAngle += pct * 360

        const toRad = (d: number) => (d * Math.PI) / 180
        const x1 = cx + r * Math.cos(toRad(startAngle))
        const y1 = cy + r * Math.sin(toRad(startAngle))
        const endAngle = startAngle + angleDeg
        const x2 = cx + r * Math.cos(toRad(endAngle))
        const y2 = cy + r * Math.sin(toRad(endAngle))
        const largeArc = angleDeg > 180 ? 1 : 0

        const midAngle = startAngle + angleDeg / 2
        const labelR = r + strokeWidth / 2 + 18
        const lx = cx + labelR * Math.cos(toRad(midAngle))
        const ly = cy + labelR * Math.sin(toRad(midAngle))

        const gradId = `donut-grad-${i}`
        const colors = COLORS[i % COLORS.length]

        return {
          path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
          pct: Math.round(pct * 100),
          label: slice.label,
          value: slice.value,
          lx,
          ly,
          gradId,
          colors,
          i,
        }
      })
  }, [slices, total, cx, cy, r, gap])

  const displayValue = centerValue ?? total

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size + 80} height={size + 40} viewBox={`-40 -20 ${size + 80} ${size + 40}`} className="overflow-visible">
        <defs>
          {segments.map(seg => (
            <linearGradient key={seg.gradId} id={seg.gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={seg.colors.gradient[0]} />
              <stop offset="100%" stopColor={seg.colors.gradient[1]} />
            </linearGradient>
          ))}
          {/* Glow filter */}
          <filter id="donut-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {/* Background circle gradient */}
          <radialGradient id="bg-circle-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1a33" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0d0d1a" stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#1a1a2e"
          strokeWidth={strokeWidth + 2}
        />

        {/* Inner glow circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r - strokeWidth / 2 - 4}
          fill="url(#bg-circle-grad)"
        />

        {/* Segments */}
        {segments.length > 0 ? segments.map(seg => (
          <g key={seg.i}>
            {/* Shadow */}
            <path
              d={seg.path}
              fill="none"
              stroke={seg.colors.gradient[0]}
              strokeWidth={strokeWidth + 4}
              strokeLinecap="round"
              opacity={0.15}
              filter="url(#donut-glow)"
            />
            {/* Main segment */}
            <path
              d={seg.path}
              fill="none"
              stroke={`url(#${seg.gradId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          </g>
        )) : (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e33" strokeWidth={strokeWidth} strokeDasharray="6 4" />
        )}

        {/* Center text */}
        <text x={cx} y={cy - 12} textAnchor="middle" fill="#5a5a80" fontSize="11" fontWeight="500">
          {centerLabel}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="white" fontSize="17" fontWeight="700">
          {fmt(displayValue)}
        </text>

        {/* Labels */}
        {segments.map(seg => (
          <g key={`label-${seg.i}`}>
            <circle cx={seg.lx} cy={seg.ly} r={3} fill={seg.colors.solid} />
            <text
              x={seg.lx + (seg.lx > cx ? 6 : -6)}
              y={seg.ly + 1}
              textAnchor={seg.lx > cx ? 'start' : 'end'}
              fill={seg.colors.solid}
              fontSize="10"
              fontWeight="600"
            >
              {seg.pct}%
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
        {segments.map(seg => (
          <div key={`leg-${seg.i}`} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.colors.solid }} />
            <span className="text-[#8080a0] text-xs">{seg.label}</span>
            <span className="text-white text-xs font-medium">{fmt(seg.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
