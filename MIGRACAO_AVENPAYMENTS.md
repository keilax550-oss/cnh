# 🔄 MIGRAÇÃO WINNERPAY → AVENPAYMENTS

## 📋 Arquivos Criados:

### **1. functions/pix-aven.js**
- Substitui `functions/pix.js`
- Integra com AvenPayments (`https://api.avenpayments.com`)
- Retorna PIX código no campo `data.copypaste`

### **2. functions/check-payment-aven.js**
- Substitui `functions/check-payment.js`
- Verifica status do pagamento em AvenPayments
- Statuses: PENDING | PROCESSING | PAID | REFUSED | REFUNDED | MED | CHARGEDBACK

---

## 🔑 CREDENCIAIS AVENPAYMENTS:

```
API Key (Pagamentos): bfXZ3yCCr9GDCcD6T_H7md4rlb0NeDJjLnRJhuGL_n8
Tokenization Key: htOFxg75beQt2kAl9PQ_il0sp8yEhEfxzwBZDEAKDGk
Base URL: https://api.avenpayments.com
```

---

## ⚙️ CONFIGURAR NA NETLIFY:

1. **Vá para:** https://app.netlify.com/sites/cnh-brasil-gov-br/settings/deploy
2. **Role até:** Environment variables
3. **Remova:** `WINNER_CLIENT_ID` e `WINNER_CLIENT_SECRET`
4. **Adicione:**
   ```
   AVEN_API_KEY = bfXZ3yCCr9GDCcD6T_H7md4rlb0NeDJjLnRJhuGL_n8
   ```
5. **Mantenha:**
   ```
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ```

---

## 📡 DIFERENÇAS WINNERPAY vs AVENPAYMENTS:

| Item | WinnerPay | AvenPayments |
|------|-----------|--------------|
| **Base URL** | api.winnerpayy.com.br | api.avenpayments.com |
| **Endpoint** | /financial/receber-pix | /v1/payment |
| **Auth** | Basic (client:secret) | Bearer token |
| **Amount** | REAIS (65.20) | CENTAVOS (6520) |
| **PIX Code** | pix_copia_e_cola | data.copypaste |
| **Response ID** | transaction.transaction_id | id |
| **Status Check** | GET /dashboard/transactions/:id | GET /v1/payment/:id |

---

## 🔄 COMO USAR:

### **Opção 1: Substituir os arquivos originais**
```bash
mv functions/pix.js functions/pix.bak
cp functions/pix-aven.js functions/pix.js

mv functions/check-payment.js functions/check-payment.bak
cp functions/check-payment-aven.js functions/check-payment.js
```

### **Opção 2: Manter ambos e usar netlify.toml**
```toml
[[redirects]]
  from = "/api/pix"
  to = "/.netlify/functions/pix-aven"
  status = 200

[[redirects]]
  from = "/api/check-payment"
  to = "/.netlify/functions/check-payment-aven"
  status = 200
```

---

## ✅ CHECKLIST DE MIGRAÇÃO:

- [ ] Configurar `AVEN_API_KEY` na Netlify
- [ ] Remover credenciais WinnerPay da Netlify
- [ ] Copiar/renomear arquivos *-aven.js
- [ ] Testar com lead real
- [ ] Verificar logs no Netlify
- [ ] Confirmar PIX sendo gerado
- [ ] Testar webhook de pagamento

---

## 🧪 TESTE LOCAL:

```bash
# Editar .env.local
AVEN_API_KEY=bfXZ3yCCr9GDCcD6T_H7md4rlb0NeDJjLnRJhuGL_n8

# Rodar teste
node -e "
const handler = require('./functions/pix-aven.js').handler;
handler({
  httpMethod: 'POST',
  body: JSON.stringify({
    nome: 'João Silva',
    email: 'joao@test.com',
    cpf: '12345678901',
    phone: '11999999999'
  })
}).then(r => console.log(JSON.parse(r.body)))
"
```

---

## 📞 SUPORTE AVENPAYMENTS:

- **Docs:** https://avenpayments.com/docs
- **API Base:** https://api.avenpayments.com
- **Dashboard:** https://dashboard.avenpayments.com

---

## ⚠️ IMPORTANTE:

1. **Amount é em CENTAVOS** - Não em Reais!
2. **PIX Code retorna em** `data.copypaste`, não `pix_copia_e_cola`
3. **Status codes diferentes** - Veja enum acima
4. **Webhook é OBRIGATÓRIO** - Polling é bloqueado por rate limit

---

## 🚀 PRÓXIMAS ETAPAS:

1. Configure `AVEN_API_KEY` na Netlify
2. Copie/renomeie os arquivos *-aven.js
3. Teste com lead real
4. Monitore os logs
5. Ative webhooks quando estiver pronto

**Tudo pronto! Os arquivos estão prontos para usar.** ✅

