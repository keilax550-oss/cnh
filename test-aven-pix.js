#!/usr/bin/env node

// Script de teste para gerar PIX na gateway AvenPayments
require('dotenv').config({ path: '.env.local' });

const AVEN_API_KEY = process.env.AVEN_API_KEY || 'bfXZ3yCCr9GDCcD6T_H7md4rlb0NeDJjLnRJhuGL_n8';

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

async function testarAvenPayments() {
  console.log("\n=== TESTE AVENPAYMENTS ===\n");
  console.log("API Key configurada:", AVEN_API_KEY ? "✓" : "✗");
  
  const amountReais = 65.20;
  const amountCents = Math.round(amountReais * 100);
  const cpfTeste = gerarCpfValido();
  
  const payload = {
    amount: amountCents,
    currency: "BRL",
    method: "PIX",
    description: "LOJA SHOPIFY 03",
    externalRef: `test_${Date.now()}_${Math.random().toString(36).slice(2,10)}`,
    notificationUrl: "https://cnh-brasil-gov-br.netlify.app/webhook/payment",
    ip: "177.0.0.1",
    payer: {
      name: "João da Silva Teste",
      taxId: cpfTeste,
      email: "joao.teste@example.com",
      phone: "5511999999999",
    },
    items: [{
      quantity: 1,
      name: "LOJA SHOPIFY 03",
      price: amountCents,
      type: "PHYSICAL",
    }],
    delivery: {
      fee: 0,
      address: {
        country: "BR",
        state: "SP",
        city: "São Paulo",
        district: "Centro",
        street: "Rua Teste",
        number: "123",
        zipCode: "01001-000",
      }
    },
    metadata: {
      provider: "test-winnerpay-migration",
      orderId: `test_${Date.now()}`,
      sellerTaxId: "12345678000199",
      sellerEmail: "loja@shopify.com",
    },
  };

  console.log("\n📝 Payload enviado:");
  console.log(JSON.stringify(payload, null, 2));

  try {
    console.log("\n🔄 Enviando para AvenPayments...\n");
    
    const response = await fetch("https://api.avenpayments.com/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AVEN_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log("Status HTTP:", response.status);
    
    let responseData = {};
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log("Raw Response:", responseText);
      return;
    }

    console.log("\n✅ Resposta da Gateway:");
    console.log(JSON.stringify(responseData, null, 2));

    if (response.ok && responseData.data?.copypaste) {
      console.log("\n🎉 PIX GERADO COM SUCESSO!\n");
      console.log("Transaction ID:", responseData.id);
      console.log("Status:", responseData.status);
      console.log("Amount:", responseData.amount / 100, "BRL");
      console.log("\n📱 PIX Cópia e Cola:");
      console.log(responseData.data.copypaste);
      console.log("\n💡 E2E (End-to-End):");
      console.log(responseData.data.e2e || "N/A");
      console.log("\n✅ FUNCIONA! Pode usar em produção.");
    } else {
      console.log("\n❌ ERRO ao gerar PIX:");
      console.log("Status:", responseData.status || response.status);
      console.log("Message:", responseData.message);
    }

  } catch (err) {
    console.error("\n❌ ERRO na requisição:");
    console.error(err.message);
  }
}

testarAvenPayments();
