// Reduz uma imagem no navegador e devolve base64 JPEG. Respeita a orientação
// EXIF (foto de celular vem girada) e limita o tamanho — mais rápido de enviar,
// mais barato na API de visão, e evita estourar o limite de body do servidor.
export async function fileToScaledBase64(
  file: File,
  maxDim = 1600,
): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')
  ctx.drawImage(bitmap, 0, 0, w, h)

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' }
}

// Lê qualquer arquivo (ex: PDF) como base64 puro, sem mexer no conteúdo.
export async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const buf = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  return { base64: btoa(bin), mediaType: file.type || 'application/pdf' }
}
