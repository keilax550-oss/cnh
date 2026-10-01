/**
 * Script para testar geração de PIX com ECOM 02
 * Testa:
 * 1. Primeira cobrança: 68.70
 * 2. Upsell: 81.40
 */

const API_BASE = "https://cnh-brasil-gov-br.netlify.app/.netlify/functions";

async function testPixGeneration(amount, paymentType = "first") {
  console.log(`\n📌 Testando ${paymentType} payment: R$ ${amount}`);
  console.log("=" .repeat(60));

  const payload = {
    nome: "Teste ECOM 02",
    email: "teste@ecom02.com",
    cpf: "12345678901",
    phone: "11999999999",
    amount: amount,
    utm: {
      utm_source: "test",
      utm_campaign: "ecom02",
      utm_medium: "test"
    }
  };

  try {
    const response = await fetch(`${API_BASE}/pix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      console.log("✅ PIX Gerado com Sucesso!");
      console.log(`   Transaction ID: ${data.transaction_id}`);
      console.log(`   Valor: R$ ${amount}`);
      console.log(`   PIX Code: ${data.pixCode ? "✓ Gerado" : "❌ Não gerado"}`);
      console.log(`   Status: ${data.status}`);
      return true;
    } else {
      console.log("❌ Erro ao gerar PIX:");
      console.log(`   Erro: ${data.error}`);
      console.log(`   Debug: ${JSON.stringify(data.debug, null, 2)}`);
      return false;
    }
  } catch (err) {
    console.log("❌ Erro na requisição:");
    console.log(`   ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log("\n🧪 TESTE DE GERAÇÃO DE PIX - ECOM 02");
  console.log("=" .repeat(60));
  
  const firstPaymentResult = await testPixGeneration(68.70, "Primeira Taxa (1ª)");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const upsellResult = await testPixGeneration(81.40, "Segunda Taxa (Upsell)");
  
  console.log("\n📊 Resumo dos Testes");
  console.log("=" .repeat(60));
  console.log(`Primeira Taxa (68.70): ${firstPaymentResult ? "✅ OK" : "❌ ERRO"}`);
  console.log(`Segunda Taxa (81.40): ${upsellResult ? "✅ OK" : "❌ ERRO"}`);
  
  if (firstPaymentResult && upsellResult) {
    console.log("\n🎉 TODOS OS TESTES PASSARAM! Pronto para fazer push.");
  } else {
    console.log("\n⚠️  Alguns testes falharam. Verifique os logs acima.");
  }
}

runTests();
