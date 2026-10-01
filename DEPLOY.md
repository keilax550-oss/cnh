# Deployment Guide - Netlify

## Environment Variables Setup

Para que o sistema funcione corretamente na Netlify, você precisa configurar as seguintes variáveis de ambiente:

### 1. Acesse o painel da Netlify
- Vá para: https://app.netlify.com
- Selecione seu site "winnerpay"

### 2. Configure as variáveis
- Clique em **Settings** → **Build & Deploy** → **Environment**
- Adicione as seguintes variáveis:

```
WINNER_CLIENT_ID=18a742ac-d8d8-434d-94a0-df68e822f23a
WINNER_CLIENT_SECRET=d1c289042e1735fdfdf5a34c3216203cbd6f84b2880cf3ac36eea47af7977cd3
NEXT_PUBLIC_SUPABASE_URL=https://ldyhodwdhavrgyooukpi.supabase.co/
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkeWhvZHdkaGF2cmd5b291a3BpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQxMDUyNCwiZXhwIjoyMTAxOTg2NTI0fQ.JvEtOi46gaL5fAFk8XnUUeEyPTibpC79NwPGMF8SvdY
```

### 3. Redeploy
- Após adicionar as variáveis, clique em **Deploys** → **Trigger deploy** → **Deploy site**

## O que foi corrigido

✅ **Erro "usage_exceeded"** - Adicionado cache para evitar requisições duplicadas
✅ **Código limpo** - Removidas funções duplicadas (pix_vizzion.js, pix_winner.js)
✅ **WinnerPay integrado** - Sistema agora usa apenas WinnerPay com credenciais válidas
✅ **API aprovada** - PIX gerando com sucesso

## Testes

Para testar localmente com Node.js:

```bash
npm install
node test-pix-approved.js
```

Resultado esperado:
```
✅ PIX GERADO COM SUCESSO!
📋 Código PIX Cópia e Cola: 00020101...
🆔 ID da Transação: TXN_...
```
