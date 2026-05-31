'use client'
import { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react'
import { parseXLSX } from '@/lib/xlsx-parser'
import { FinanceData } from '@/lib/types'

interface Props {
  onImport: (data: FinanceData) => void
}

export default function ImportScreen({ onImport }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Apenas arquivos .xlsx ou .xls são suportados.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const data = parseXLSX(buffer)
      onImport(data)
    } catch (e) {
      setError('Erro ao processar a planilha. Verifique o formato do arquivo.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [onImport])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <div className="min-h-screen bg-[#070711] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4d8dff] to-[#9966ff] mb-4 shadow-lg shadow-[#4d8dff]/20">
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Finance Dashboard</h1>
          <p className="text-[#7070a0] text-sm">Importe sua planilha para começar</p>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`block cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-10 text-center ${
            dragging
              ? 'border-[#4d8dff] bg-[#4d8dff]/10'
              : 'border-[#1e1e33] bg-[#0d0d1a] hover:border-[#4d8dff]/50 hover:bg-[#0d0d1a]'
          }`}
        >
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInput} />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-[#4d8dff] animate-spin" />
              <p className="text-[#7070a0] text-sm">Processando planilha...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className={`w-10 h-10 transition-colors ${dragging ? 'text-[#4d8dff]' : 'text-[#4040668]'}`} style={{ color: dragging ? '#4d8dff' : '#404066' }} />
              <div>
                <p className="text-white font-medium mb-1">
                  {dragging ? 'Solte aqui' : 'Arraste sua planilha'}
                </p>
                <p className="text-[#7070a0] text-sm">ou clique para selecionar o arquivo .xlsx</p>
              </div>
            </div>
          )}
        </label>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-[#ff3366]/10 border border-[#ff3366]/20 text-[#ff3366] text-sm text-center">
            {error}
          </div>
        )}

        <p className="text-center text-[#404066] text-xs mt-6">
          Os dados ficam salvos localmente no seu dispositivo
        </p>
      </div>
    </div>
  )
}
