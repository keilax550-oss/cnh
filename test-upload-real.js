const https = require('https');

// Simular uma imagem de teste pequena (PNG 1x1)
const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const payload = {
  transaction_id: 'test_funil_' + Date.now(),
  customer_name: 'Teste Funil',
  customer_cpf: '12345678901',
  customer_email: 'teste@email.com',
  arquivo: testImageBase64,
  filename: 'test-funil.png'
};

console.log('📤 Enviando comprovante REAL para o funil...');
console.log('URL: https://suacnh-gov-br.netlify.app/api/comprovantes-upload');
console.log('Transaction ID:', payload.transaction_id);
console.log('Tamanho payload:', JSON.stringify(payload).length, 'bytes\n');

const options = {
  hostname: 'suacnh-gov-br.netlify.app',
  port: 443,
  path: '/api/comprovantes-upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(payload))
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✅ Status HTTP:', res.statusCode);
    try {
      const body = JSON.parse(data);
      console.log('Resposta:', body);
      
      if (res.statusCode === 200 && body.success) {
        console.log('\n🎉 SUCESSO! Comprovante foi salvo no Supabase pelo funil!');
        console.log('Agora verifique no Supabase se apareceu em: comprovantes');
        console.log('Transaction ID para buscar:', payload.transaction_id);
        process.exit(0);
      } else {
        console.log('\n❌ ERRO:', body.error || 'Resposta inválida');
        process.exit(1);
      }
    } catch (e) {
      console.log('❌ Erro ao parsear resposta:', e.message);
      console.log('Dados brutos:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Erro ao conectar:', e.message);
  process.exit(1);
});

req.write(JSON.stringify(payload));
req.end();

console.log('⏳ Aguardando resposta...\n');
