# WhatsApp → App Financeiro (Meta Cloud API, número de teste — SEM CNPJ)

Você manda **foto de comprovante/extrato** (legenda "holerite" se for holerite)
ou **texto** ("gastei 50 no mercado") do **seu WhatsApp pessoal** pro número de
teste da Meta → o app registra com IA → responde no chat:
`✓ Registrado: Mercado R$ 50,00 (Supermercado/util). Gastos do mês: R$ 1.234,56`

Sem CNPJ, sem servidor extra, sem risco pro seu número (é o caminho oficial).

## 1. Criar o app na Meta (pessoa física, ~10 min)

1. Acesse **developers.facebook.com** → login com seu Facebook → **My Apps → Create App**.
2. Tipo: **Business** (não pede CNPJ — cria/usa um "portfólio de negócios" pessoal sem verificação).
3. No painel do app: **Add Product → WhatsApp → Set up**.
4. Na tela **API Setup** você já ganha:
   - **Número de teste** (um +1 555…) e o **Phone number ID**
   - Campo **To**: clique em **Manage phone number list** e **adicione o SEU número**
     (chega um código no seu WhatsApp pra confirmar — é isso que autoriza o bot a te responder).
5. Teste ali mesmo: botão **Send message** → deve chegar "hello world" no seu WhatsApp.
   Salve o contato como **💰 Finance**.

## 2. Token de acesso

- **Rápido (expira em 24h, bom pra testar):** o **Temporary access token** na mesma tela API Setup.
- **Permanente (faça depois que funcionar):** Meta **Business Settings → Users → System Users**
  → Add (função Admin) → **Add Assets** (selecione o app) → **Generate New Token**
  → marque `whatsapp_business_messaging` e `whatsapp_business_management` → gere e guarde.

## 3. Variáveis na Vercel (Settings → Environment Variables) + Redeploy

| Nome | Valor |
|---|---|
| `WHATSAPP_TOKEN` | o token do passo 2 |
| `WHATSAPP_VERIFY_TOKEN` | uma string qualquer que VOCÊ inventa (ex: `finance-2026-xyz`) |
| `WHATSAPP_ALLOWED_NUMBER` | seu número com DDI, só dígitos (ex: `5547999999999`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |

⚠️ Depois de salvar: **Deployments → ⋯ → Redeploy**.

## 4. Configurar o webhook (liga a Meta no app)

No painel do app: **WhatsApp → Configuration → Webhook → Edit**:
- **Callback URL**: `https://financeiroapp-rho.vercel.app/api/whatsapp`
- **Verify token**: o MESMO valor de `WHATSAPP_VERIFY_TOKEN`
- **Verify and save** (a Meta chama o GET da rota; se as envs já estiverem no ar, verifica na hora)
- Em **Webhook fields**: clique **Manage** e assine (**Subscribe**) o campo **messages**.

## 5. Usar 🎉

Manda pro contato **💰 Finance**:
- `gastei 25 na padaria` → registra na hora
- 📷 foto de um comprovante Pix / nota / extrato → categoriza tudo
- 📷 foto do holerite com legenda **"holerite"** → registra como renda
- Pagou a parcela do carro e mandou o comprovante? → marca a parcela como paga

## Notas
- **Allowlist**: só o número em `WHATSAPP_ALLOWED_NUMBER` consegue registrar — mensagens de outros são ignoradas.
- **Dedupe**: a Meta re-tenta webhooks; mensagens repetidas não registram 2x.
- **Token de 24h venceu?** As mensagens param de responder — gere o token permanente (passo 2).
- **Janela de 24h**: o bot responde suas mensagens normalmente (você inicia a conversa, então a janela está sempre aberta).
- **Alternativa via n8n/curl**: a rota `POST /api/ingest` (header `x-ingest-secret` = env `INGEST_SECRET`) aceita `{kind:'texto'|'imagem', text?, mediaBase64?, mediaType?, hint?}` e devolve `{ok, resumo}` — mesma lógica.

## Teste rápido sem WhatsApp (curl)

```sh
curl -s -X POST https://financeiroapp-rho.vercel.app/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-secret: SEU_INGEST_SECRET" \
  -d '{"kind":"texto","text":"gastei 25 na padaria hoje"}'
```
