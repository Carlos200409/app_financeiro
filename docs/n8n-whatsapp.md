# WhatsApp → n8n → App Financeiro

Fluxo: você manda **foto de comprovante/extrato/holerite** ou **texto** ("gastei 50
no mercado") pro seu número WABA → o n8n chama `/api/ingest` → a IA registra →
o n8n responde no WhatsApp ("✓ Registrado: Mercado R$50 · Gastos do mês: R$X").

## 1. Variáveis na Vercel (Settings → Environment Variables)

| Nome | Valor |
|---|---|
| `INGEST_SECRET` | uma string aleatória longa (ex: gere com `openssl rand -hex 24`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (⚠️ NUNCA no cliente) |

Depois de salvar: **Redeploy** (variável nova só vale no próximo deploy).

## 2. O contrato da rota

`POST https://financeiroapp-rho.vercel.app/api/ingest`

Headers:
```
Content-Type: application/json
x-ingest-secret: <INGEST_SECRET>
```

Body (texto):
```json
{ "kind": "texto", "text": "gastei 50 no mercado ontem" }
```

Body (imagem — comprovante/extrato/nota):
```json
{ "kind": "imagem", "mediaBase64": "<base64 da imagem>", "mediaType": "image/jpeg", "hint": "<legenda da mensagem, se houver>" }
```

> Se a legenda da foto contiver "holerite", a imagem é tratada como holerite
> (vira renda fixa, com adiantamento/fechamento somando por competência).

Resposta (sempre JSON):
```json
{ "ok": true, "resumo": "✓ Registrado: Mercado R$ 50,00 (Supermercado/util). Gastos do mês: R$ 1.234,56." }
```
→ Manda `resumo` de volta no WhatsApp.

## 3. Fluxo no n8n (nós)

1. **WhatsApp Trigger** (nó nativo do n8n, credencial WABA que você já tem)
   — dispara em mensagem recebida.
2. **IF — só você**: `{{ $json.messages[0].from }}` igual ao SEU número
   (ex: `5547999999999`). Senão → parar. *(Não pule: sem isso qualquer pessoa
   que mandar mensagem pro número registra gasto na sua conta.)*
3. **IF — imagem ou texto**: `{{ $json.messages[0].type }}` == `image`?
4. **Ramo imagem**:
   a. **HTTP Request** GET `https://graph.facebook.com/v20.0/{{ $json.messages[0].image.id }}`
      com header `Authorization: Bearer <token WABA>` → devolve a `url` da mídia.
   b. **HTTP Request** GET nessa `url` (mesmo Bearer), **Response Format: File**.
   c. **Extract from File** (ou Code node): binário → base64.
   d. **HTTP Request** POST no `/api/ingest` com
      `kind=imagem`, `mediaBase64={{ base64 }}`, `mediaType=image/jpeg`,
      `hint={{ $json.messages[0].image.caption || '' }}` + header `x-ingest-secret`.
5. **Ramo texto**:
   a. **HTTP Request** POST no `/api/ingest` com
      `kind=texto`, `text={{ $json.messages[0].text.body }}` + header do secret.
6. **WhatsApp Send Message** (nó nativo): para `{{ from }}`, texto
   `{{ $json.resumo }}`.

## 4. Teste rápido sem n8n (curl)

```sh
curl -s -X POST https://financeiroapp-rho.vercel.app/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-secret: SEU_SECRET" \
  -d '{"kind":"texto","text":"gastei 25 na padaria hoje"}'
```

## Limitações conhecidas
- Gasto reportado por texto pode duplicar se depois vier o mesmo no extrato
  importado (reconciliação inteligente está no backlog). Se acontecer, apaga
  um dos dois em Gastos.
- Imagens grandes: o WhatsApp já comprime; PDFs por WhatsApp não são suportados
  neste fluxo (usa o upload no app).
