/**
 * Teste direto com a gateway AvenPayments
 * Para verificar se os PIX estão sendo realmente gerados e salvos
 */

const AVEN_BASE = "https://api.avenpayments.com/v1/payment";
const AVEN_API_KEY = "2zxA50CzfpTMZgKCwuotYv681fsfo4bcrXrdttHxdD4";

async function testDirectGateway(amount, description) {
  console.log(`\n📌 Testando Direct Gateway com R$ ${amount} (${description})`);
  console.log("=" .repeat(70));

  const randId = Math.random().toString(36).slice(2, 10);
  
  const payload = {
    amount: Math.round(amount * 100),
    currency: "BRL",
    method: "PIX",
    description: description,
    externalRef: `order_${randId}`,
    notificationUrl: "https://cnh-brasil-gov-br.netlify.app/webhook/payment",
    payer: {
      name: "Teste ECOM 02",
      taxId: "12345678901",
      email: "teste@ecom02.com",
      phone: "5511999999999",
    },
    items: [{
      quantity: 1,
      name: description,
      price: Math.round(amount * 100),
      type: "DIGITAL",
    }],
  };

  console.log("📤 Payload enviado:");
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(AVEN_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AVEN_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data = {};
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log("❌ Erro ao fazer parse da resposta!");
      console.log(`   Texto: ${text.substring(0, 200)}`);
      return false;
    }

    if (response.ok) {
      console.log("\n✅ PIX GERADO COM SUCESSO!");
      console.log(`   Gateway Response ID: ${data.id}`);
      console.log(`   ExternalRef: ${data.externalRef}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Amount: R$ ${(data.amount / 100).toFixed(2)}`);
      console.log(`   Description: ${data.description}`);
      console.log(`   PIX Code: ${data.data?.copypaste ? "✓ Existe" : "❌ Não existe"}`);
      
      if (data.data?.copypaste) {
        console.log(`\n   PIX COPYPASTE:`);
        console.log(`   ${data.data.copypaste}`);
      }
      
      // Guardar o ID real da gateway
      return {
        success: true,
        gatewayId: data.id,
        externalRef: data.externalRef,
        pixCode: data.data?.copypaste
      };
    } else {
      console.log("\n❌ ERRO ao gerar PIX!");
      console.log(`   Status HTTP: ${response.status}`);
      console.log(`   Erro: ${data.message || JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ Erro na requisição: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log("\n🎯 TESTE DIRETO COM GATEWAY AVENPAYMENTS");
  console.log("=" .repeat(70));
  
  const firstResult = await testDirectGateway(68.70, "ECOM 02");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const upsellResult = await testDirectGateway(81.40, "ECOM 02");
  
  console.log("\n" + "=" .repeat(70));
  console.log("📊 RESUMO");
  console.log("=" .repeat(70));
  
  if (firstResult && firstResult.success) {
    console.log(`✅ Primeira Taxa (68.70): GERADO`);
    console.log(`   Gateway ID: ${firstResult.gatewayId}`);
  } else {
    console.log(`❌ Primeira Taxa (68.70): ERRO`);
  }
  
  if (upsellResult && upsellResult.success) {
    console.log(`✅ Segunda Taxa (81.40): GERADO`);
    console.log(`   Gateway ID: ${upsellResult.gatewayId}`);
  } else {
    console.log(`❌ Segunda Taxa (81.40): ERRO`);
  }
}

runTests();
