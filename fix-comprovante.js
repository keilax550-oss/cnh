// Fix para garantir que o comprovante sempre tenha um transactionId válido
(function() {
  // Monitora uploads de comprovante e valida transaction_id
  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    const [url, config] = args;
    
    // Se é upload de comprovante
    if (url.includes("comprovantes-upload") && config?.body) {
      try {
        const body = JSON.parse(config.body);
        
        // Se não tem transaction_id, tenta pegar do localStorage
        if (!body.transaction_id) {
          body.transaction_id = localStorage.getItem("currentTransactionId") || 
                                localStorage.getItem("currentDepositId") ||
                                null;
          
          console.log("[ComprovanteFix] Adicionado transaction_id:", body.transaction_id);
        }
        
        // Se AINDA não tem, mostra erro
        if (!body.transaction_id) {
          console.error("[ComprovanteFix] ERRO: transaction_id não encontrado!");
          alert("Erro: ID da transação não encontrado. Recarregue a página e tente novamente.");
          return originalFetch.apply(this, args);
        }
        
        config.body = JSON.stringify(body);
      } catch (e) {
        console.error("[ComprovanteFix] Erro ao processar body:", e);
      }
    }
    
    return originalFetch.apply(this, args);
  };
})();
