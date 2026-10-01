# Version History

## v1.1.0 - 2026-08-26

### ✅ Fixed
- **usage_exceeded error** - Adicionado cache para evitar requisições duplicadas ao UTMify
- **Código duplicado** - Removidas funções pix_vizzion.js e pix_winner.js
- **Credenciais** - Migradas para variáveis de ambiente

### 🔧 Changes
- WinnerPay agora é o único gateway integrado
- Cache TTL de 60 segundos para requisições de tracking
- Timeout de 5 segundos para requisições ao UTMify
- Proteção contra múltiplas chamadas para a mesma transação

### ✨ Testing
- PIX gerando com sucesso na gateway WinnerPay
- Transação ID: TXN_1787770452790_F66CEF26
- Valor: R$ 64.00
- Status: Pronto para produção

### 📦 Deployment
Configure as seguintes variáveis na Netlify:
- `WINNER_CLIENT_ID`
- `WINNER_CLIENT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Veja DEPLOY.md para instruções completas.
