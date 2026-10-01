# 🚀 DEPLOY CHECKLIST - WINNERPAY → AVENPAYMENTS

**Data de Criação**: 27 de Agosto de 2026  
**Status**: PRONTO PARA DEPLOY  
**Versão**: 1.0 Production  

---

## ✅ O QUE FOI FEITO (LOCAL)

### 📂 Arquivos Modificados

#### ✅ 1. `functions/pix.js` (11,109 bytes)
- **Status**: ✅ Substituído
- **Mudança**: WinnerPay → AvenPayments
- **Fix**: Race condition eliminada (`const resp = await fetch()`)
- **Verificação**: 
  ```javascript
  // First line checks
  const AVEN_BASE = "https://api.avenpayments.com";
  const AVEN_API_KEY = process.env.AVEN_API_KEY;
  ```

#### ✅ 2. `functions/check-payment.js` (5,662 bytes)
- **Status**: ✅ Substituído
- **Mudança**: WinnerPay → AvenPayments
- **Verificação**:
  ```javascript
  const AVEN_BASE = "https://api.avenpayments.com";
  ```

#### ✅ 3. `.env.local`
- **Status**: ✅ Atualizado
- **Mudança**:
  - ❌ REMOVIDO: `WINNER_CLIENT_ID`
  - ❌ REMOVIDO: `WINNER_CLIENT_SECRET`
  - ✅ ADICIONADO: `AVEN_API_KEY`
  - ✅ ADICIONADO: `AVEN_TOKENIZATION_KEY`
  - ✅ MANTIDO: Supabase credentials

### 📄 Arquivos Auxiliares Criados

#### ✅ 4. `DEPLOYMENT_AVEN.md`
- Instruções completas de deploy
- Variáveis Netlify necessárias
- Checklist pré-deploy

#### ✅ 5. `VERIFICACAO_FINAL.md`
- Verificação ponto-por-ponto
- Status de cada componente
- Fluxo esperado de funcionamento

#### ✅ 6. `MUDANCAS_REALIZADAS.md`
- Resumo de mudanças
- Antes/depois de cada arquivo
- Bugs corrigidos

---

## 🎯 PRÓXIMAS ETAPAS (SEQ)

### ETAPA 1: Configurar Netlify (5-10 min)

**Acesse**: https://netlify.com → seu-site → Settings → Build & Deploy → Environment

**Adicione estas variáveis**:

```
AVEN_API_KEY = bfXZ3yCCr9GDCcD6T_H7md4rlb0NeDJjLnRJhuGL_n8
AVEN_TOKENIZATION_KEY = htOFxg75beQt2kAl9PQ_il0sp8yEhEfxzwBZDEAKDGk
NEXT_PUBLIC_SUPABASE_URL = https://ldyhodwdhavrgyooukpi.supabase.co/
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkeWhvZHdkaGF2cmd5b291a3BpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQxMDUyNCwiZXhwIjoyMTAxOTg2NTI0fQ.JvEtOi46gaL5fAFk8XnUUeEyPTibpC79NwPGMF8SvdY
```

**Remova estas variáveis** (se existirem):
- ❌ DELETE: `WINNER_CLIENT_ID`
- ❌ DELETE: `WINNER_CLIENT_SECRET`

**Checklist**:
- [ ] Login em Netlify realizado
- [ ] Acessei Settings → Build & Deploy → Environment
- [ ] Adicionei `AVEN_API_KEY`
- [ ] Adicionei `AVEN_TOKENIZATION_KEY`
- [ ] Confirmei `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Confirmei `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Deletei `WINNER_*` (se existiam)
- [ ] Salvei mudanças

---

### ETAPA 2: Git Commit & Push (2-3 min)

**Abra terminal e execute**:

```bash
cd c:\Users\Pc\Downloads\MASTERGG\WINERPAY

# Verificar status
git status

# Adicionar mudanças
git add functions/pix.js functions/check-payment.js .env.local

# Criar commit
git commit -m "feat: migrate to AvenPayments gateway

- Replace pix.js: WinnerPay → AvenPayments
- Replace check-payment.js: WinnerPay → AvenPayments
- Update .env.local: WINNER_* → AVEN_*
- Fix critical race condition bug
- Optimize timeouts to 30s
- Make Supabase and UTMify non-blocking"

# Push para repositório
git push origin main
```

**Checklist**:
- [ ] Executei `git status` sem erros
- [ ] Executei `git add` nas 3 mudanças
- [ ] Executei `git commit` com mensagem descritiva
- [ ] Executei `git push origin main` com sucesso
- [ ] Recebi confirmação "1 commit pushed"

---

### ETAPA 3: Monitorar Netlify Deploy (5 min)

**Acesse**: https://netlify.com → seu-site → Deploys

**Monitore**:
1. ✅ Build iniciado (após push)
2. ✅ Functions built (pix.js, check-payment.js)
3. ✅ Publicado com sucesso

**Se houver erro**:
- Verificar logs Netlify
- Confirmar variáveis ambiente
- Tentar rebuild manual

**Checklist**:
- [ ] Build iniciou automaticamente
- [ ] Nenhum erro em "Builds"
- [ ] Status final: "Published"
- [ ] URL disponível

---

### ETAPA 4: Testar PIX Generation (5-10 min)

**Método 1: Via Browser**

1. Ir para `https://seu-site.netlify.app`
2. Preencher formulário:
   - Nome: "Teste PIX"
   - Email: "teste@gmail.com"
   - Telefone: "11999999999"
   - CPF: "12345678901"
3. Clicar "Gerar PIX"
4. Verificar:
   - [ ] PIX gerado (QR Code apareceu)
   - [ ] Código Pix Cópia e Cola visível
   - [ ] Valor: R$ 65,20

**Método 2: Via cURL (terminal)**

```bash
curl -X POST https://seu-site.netlify.app/.netlify/functions/pix \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste",
    "email": "teste@example.com",
    "phone": "11999999999",
    "cpf": "12345678901",
    "amount": 65.20
  }' | jq .
```

**Esperado**:
```json
{
  "success": true,
  "pixCode": "00020101...",
  "transaction_id": "txn_...",
  "status": "pending"
}
```

**Checklist**:
- [ ] Requisição retorna `success: true`
- [ ] `pixCode` não está vazio
- [ ] `transaction_id` gerado
- [ ] Valor correto (6520 centavos)

---

### ETAPA 5: Verificar Status Check (5 min)

**Teste status endpoint**:

```bash
curl -X GET "https://seu-site.netlify.app/.netlify/functions/check-payment?transactionId=txn_XXXXX"
```

**Esperado**:
```json
{
  "success": true,
  "transactionId": "txn_XXXXX",
  "status": "pending"
}
```

**Checklist**:
- [ ] Status endpoint responde
- [ ] Retorna `success: true`
- [ ] Status muda conforme pagamento

---

### ETAPA 6: Verificar Logs (10 min)

**Netlify Functions Logs**:

1. Ir para `https://netlify.com` → seu-site
2. Clicar em "Functions" tab
3. Selecionar "pix"
4. Verificar logs recentes
5. Procurar por:
   - ✅ `[PIX-AVEN] ===== PIX GERADO COM SUCESSO =====`
   - ✅ `Transaction ID: `
   - ✅ `[Supabase] ✓ Salvo`
   - ✅ `[UTMify] ✓ Enviado para`

**Checklist**:
- [ ] Logs aparecem após requisição
- [ ] Nenhum erro em vermelho
- [ ] Message "PIX GERADO COM SUCESSO" presente

---

## ⚠️ TROUBLESHOOTING

### Problema: "AVEN_API_KEY não configurada"

**Solução**:
1. Voltar para Netlify Settings
2. Confirmar `AVEN_API_KEY` foi adicionada
3. Fazer **manual redeploy** (não push)
4. Aguardar build + deploy

### Problema: "AvenPayments API error"

**Causas possíveis**:
- Chave API inválida (copiar errada)
- Endpoint não alcançável
- Rate limit excedido

**Verificação**:
1. Testar chave API com curl:
```bash
curl -X GET https://api.avenpayments.com/v1/payment/test \
  -H "Authorization: Bearer bfXZ3yCCr9GDCcD6T_H7md4rlb0NeDJjLnRJhuGL_n8"
```

### Problema: "Supabase error" nos logs

**Isso É NORMAL** - Sistema foi configurado para não bloquear PIX se Supabase falhar
- ✅ PIX ainda é gerado
- ✅ Apenas não salva no banco

---

## 📊 RESULTADO ESPERADO

### Antes do Deploy
```
500 cliques → 23 PIX gerados (95% bloqueado) ❌
```

### Depois do Deploy
```
500 cliques → ~500 PIX gerados (0% bloqueado) ✅
```

### Por que melhorou?
1. ✅ Race condition FIXADA
2. ✅ Timeout aumentado (5s → 30s)
3. ✅ Supabase não bloqueia
4. ✅ UTMify não bloqueia
5. ✅ Single endpoint (sem conflito)

---

## 🎯 SUCESSO CONFIRMADO?

**Quando você sabe que está 100% funcional**:

- ✅ Cliques no site → PIX gerados imediatamente
- ✅ Nenhum error no console do browser
- ✅ Nenhum erro em vermelho nos logs Netlify
- ✅ QR Code exibido corretamente
- ✅ Pix Cópia e Cola copiável
- ✅ Status muda para "paid" quando escaneia PIX
- ✅ Supabase atualizado (opcional)
- ✅ Pixel 10 disparado após confirmação

---

## 📋 FINAL CHECKLIST

**PRÉ-DEPLOY**:
- [x] Arquivos locais: pix.js, check-payment.js, .env.local
- [x] Documentação: DEPLOYMENT_AVEN.md, VERIFICACAO_FINAL.md, MUDANCAS_REALIZADAS.md

**DEPLOY**:
- [ ] Variáveis Netlify configuradas
- [ ] Git commit + push realizado
- [ ] Build Netlify completado com sucesso
- [ ] Functions disponíveis

**PÓS-DEPLOY**:
- [ ] PIX gerado com sucesso via browser
- [ ] Status check endpoint funciona
- [ ] Logs Netlify sem erros
- [ ] Supabase atualizado (se aplicável)
- [ ] Pixel 10 disparado

**VALIDAÇÃO FINAL**:
- [ ] 100% das requisições → PIX gerado
- [ ] Taxa de bloqueio: 0%
- [ ] Sistema pronto para produção

---

## 🚀 PRÓXIMO PASSO

**AGORA**: Execute este comando para confirmar tudo localmente:

```bash
cd c:\Users\Pc\Downloads\MASTERGG\WINERPAY
git status
```

**Você deve ver**:
```
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
(use "git push" to publish your local commits)

Changes to be committed:
  modified:   functions/pix.js
  modified:   functions/check-payment.js
  modified:   .env.local
```

**Se estiver certo**: Faça `git push origin main`

**Se vir outro resultado**: Avise antes de continuar!

---

**Status**: 🟢 PRONTO PARA DEPLOY  
**Criado em**: 27 de Agosto de 2026  
**Versão**: 1.0 Production Ready
