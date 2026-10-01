const fs = require('fs');
const path = require('path');
const https = require('https');

// Criar uma imagem PNG real (1x1 pixel)
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 
  0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00, 
  0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

// Converter para base64
const base64Image = pngBuffer.toString('base64');
const dataUrl = `data:image/png;base64,${base64Image}`;

const transactionId = 'teste_real_' + Date.now();

const payload = {
  transaction_id: transactionId,
  customer_name: 'Teste Real Funil',
  customer_cpf: '12345678901',
  customer_email: 'teste@funil.com',
  arquivo: dataUrl,
  filename: 'comprovante-teste.png'
};

console.log('🧪 TESTE REAL - Simulando envio de comprovante pelo funil');
console.log('================================================');
console.log('Transaction ID:', transactionId);
console.log('Nome:', payload.customer_name);
console.log('CPF:', payload.customer_cpf);
console.log('Tamanho imagem:', (base64Image.length / 1024).toFixed(2), 'KB');
console.log('Enviando para: /api/comprovantes-upload\n');

const payloadStr = JSON.stringify(payload);
const payloadBuffer = Buffer.from(payloadStr);

const options = {
  hostname: 'suacnh-gov-br.netlify.app',
  port: 443,
  path: '/api/comprovantes-upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payloadBuffer.length
  }
};

console.log('⏳ Enviando requisição...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📊 Resposta Recebida:');
    console.log('Status HTTP:', res.statusCode);
    
    try {
      const body = JSON.parse(data);
      console.log('Body:', JSON.stringify(body, null, 2));
      
      console.log('\n' + '='.repeat(50));
      if (res.statusCode === 200 && body.success) {
        console.log('✅ SUCESSO! Comprovante foi SALVO no Supabase!');
        console.log('Verifique em: Supabase > comprovantes');
        console.log('Transaction ID:', transactionId);
      } else {
        console.log('❌ ERRO ao salvar!');
        console.log('Erro:', body.error);
      }
      console.log('='.repeat(50));
    } catch (e) {
      console.log('Erro ao parsear:', e.message);
      console.log('Dados brutos:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Erro de conexão:', e.message);
});

req.write(payloadBuffer);
req.end();
