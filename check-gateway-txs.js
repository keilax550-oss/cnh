/**
 * Script para verificar as transações na gateway (AvenPayments)
 * Consulta os PIX que foram gerados no teste
 */

const API_BASE = "https://api.avenpayments.com/v1/payment";
const AVEN_API_KEY = "2zxA50CzfpTMZgKCwuotYv681fsfo4bcrXrdttHxdD4";

async function checkTransaction(transactionId) {
  console.log(`\n🔍 Consultando transação: ${transactionId}`);
  console.log("=" .repeat(60));

  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(transactionId)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AVEN_API_KEY}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Transação encontrada na gateway!");
      console.log(`   ID: ${data.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Amount: R$ ${(data.amount / 100).toFixed(2)}`);
      console.log(`   PIX: ${data.data?.copypaste ? "✓ Gerado" : "❌ Não gerado"}`);
      console.log(`   Descrição: ${data.description}`);
      if (data.items && data.items.length > 0) {
        console.log(`   Produto: ${data.items[0].name}`);
      }
      return true;
    } else {
      console.log("❌ Transação NÃO encontrada na gateway!");
      console.log(`   Status: ${response.status}`);
      console.log(`   Erro: ${data.message || JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.log("❌ Erro ao consultar:");
    console.log(`   ${err.message}`);
    return false;
  }
}

async function runCheck() {
  console.log("\n🔎 VERIFICANDO TRANSAÇÕES NA GATEWAY (AvenPayments)");
  console.log("=" .repeat(60));
  
  // IDs das transações que foram geradas no teste anterior
  const transactions = [
    "TXN_1789471782968_0465E019",  // 68.70
    "TXN_1789471786059_A1CA711E"   // 81.40
  ];

  for (const txId of transactions) {
    await checkTransaction(txId);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n" + "=" .repeat(60));
  console.log("✅ Verificação concluída!");
}

runCheck();
