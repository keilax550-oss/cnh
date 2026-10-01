#!/usr/bin/env node

// Script de teste para debug da função PIX
// Use: node test-pix.js

const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do .env.local
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

console.log("\n=== TESTE DE FUNÇÃO PIX ===\n");
console.log("Variáveis carregadas:");
console.log("✓ WINNER_CLIENT_ID:", process.env.WINNER_CLIENT_ID ? "✓ Configurada" : "✗ NÃO ENCONTRADA");
console.log("✓ WINNER_CLIENT_SECRET:", process.env.WINNER_CLIENT_SECRET ? "✓ Configurada" : "✗ NÃO ENCONTRADA");
console.log("✓ SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✓ Configurada" : "✗ NÃO ENCONTRADA");
console.log("✓ SUPABASE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Configurada" : "✗ NÃO ENCONTRADA");

console.log("\n=== TESTE DE REQUISIÇÃO ===\n");

// Importar a função handler
const { handler } = require('./functions/pix.js');

// Simular um evento de requisição POST
const mockEvent = {
  httpMethod: 'POST',
  body: JSON.stringify({
    nome: "João da Silva",
    email: "joao@example.com",
    cpf: "12345678901",
    phone: "11999999999",
    utm: {
      utm_source: "google",
      utm_campaign: "test"
    }
  }),
  queryStringParameters: null
};

async function runTest() {
  try {
    console.log("Enviando requisição para gerar PIX...\n");
    const result = await handler(mockEvent);
    
    console.log("Resposta da função:");
    console.log("Status:", result.statusCode);
    console.log("Body:", JSON.stringify(JSON.parse(result.body), null, 2));
    
  } catch (err) {
    console.error("❌ Erro ao executar teste:", err);
  }
}

runTest();
