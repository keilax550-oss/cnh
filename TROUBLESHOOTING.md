# Troubleshooting Guide

## Leads não estão gerando PIX

### ✅ O que foi corrigido

1. **Removidas duplicações**
   - Deletado `pix_vizzion.js` (Vizzion não é usado)
   - Deletado `pix_winner.js` (duplicata de pix.js)
   - Sistema agora usa apenas `pix.js` com WinnerPay

2. **Credenciais obrigatórias**
   - Removidos valores hardcoded nas funções
   - Sistema agora valida se env vars estão configuradas
   - Se faltar credencial, retorna erro claro no log

3. **Erros não bloqueadores**
   - Supabase falha? PIX ainda é gerado
   - UTMify timeout? PIX ainda é gerado
   - Apenas rastreamento pode falhar, não a geração

4. **Melhor logging**
   - Cada etapa loga seu status
   - Erros indicam exatamente o que faltou

---

## Checklist de Configuração

### ✓ Netlify Environment Variables

Verifique se estas variáveis estão configuradas:

```
WINNER_CLIENT_ID = 18a742ac-d8d8-434d-94a0-df68e822f23a
WINNER_CLIENT_SECRET = d1c289042e1735fdfdf5a34c3216203cbd6f84b2880cf3ac36eea47af7977cd3
NEXT_PUBLIC_SUPABASE_URL = https://ldyhodwdhavrgyooukpi.supabase.co/
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Como verificar:**
1. Vá para https://app.netlify.com
2. Selecione seu site
3. Settings → Build & Deploy → Environment
4. Confirme que as 4 variáveis estão lá

### ✓ WinnerPay API Aprovada

A API deve estar **aprovada** no painel da WinnerPay:
1. Acesse https://app.winnerpayy.com.br
2. Vá para Configurações → Integração
3. Confirme que a API está **ativa/aprovada**

### ✓ Supabase Acessível

O banco de dados precisa estar disponível:
1. Acesse https://app.supabase.com
2. Selecione o projeto `ldyhodwdhavrgyooukpi`
3. Verifique se está online
4. Confirme tabela `transactions` existe

---

## Fluxo de Lead Completo

```
1. Lead entra no formulário
   ↓
2. Submit form → POST /api/pix
   ↓
3. Validar dados (nome, email, phone)
   ↓
4. Chamar WinnerPay para gerar PIX
   ↓
5. Salvar transação no Supabase (opcional)
   ↓
6. Enviar para UTMify (opcional)
   ↓
7. Retornar pixCode ao frontend
   ↓
8. Exibir QR Code para lead
```

**Importante:** Mesmo se etapas 5 ou 6 falharem, o PIX ainda é gerado (etapa 7).

---

## Erros Comuns

### "Credenciais inválidas" (401)
- Significa credenciais WinnerPay estão expiradas
- Solução: Gerar novas credenciais e atualizar env vars

### "Credencial não aprovada" (403)
- Significa API não foi ativada no painel WinnerPay
- Solução: Ir ao painel WinnerPay → ativar API

### "PIX não aparece no QR Code"
- Frontend pode não estar parseando a resposta corretamente
- Verifique console do browser para erros
- Confirme que `pixCode` está sendo retornado (não null)

### "Lead entrou mas não gerou PIX"
- Verificar logs da Netlify: https://app.netlify.com/sites/seu-site/logs
- Procurar por `[PIX]` ou `[WinnerPay]`
- Se ver erro, confirmar env vars e credenciais

---

## Testing Rápido

Execute localmente:

```bash
npm install dotenv
node -e "
require('dotenv').config({ path: '.env.local' });
const { handler } = require('./functions/pix.js');
handler({ httpMethod: 'POST', body: JSON.stringify({ nome: 'Test', email: 'test@test.com', phone: '11999999999' }) })
  .then(r => console.log(JSON.parse(r.body)))
  .catch(e => console.error(e))
"
```

Esperado: resposta com `success: true` e `pixCode`

---

## Stack

- **Frontend:** React (compiled em index-f8rMPGcv.js)
- **Backend:** Netlify Functions (Node.js)
- **Gateway:** WinnerPay (API: api.winnerpayy.com.br)
- **Database:** Supabase PostgreSQL
- **Tracking:** UTMify (api.utmify.com.br)
- **Deployment:** Netlify (novacnh-brasil-gov-br.netlify.app)
