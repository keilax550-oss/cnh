// Simular uma imagem de teste
const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const payload = {
  transaction_id: 'test_tx_' + Date.now(),
  customer_name: 'Teste User',
  customer_cpf: '12345678901',
  customer_email: 'teste@email.com',
  arquivo: testImageBase64,
  filename: 'test-comprovante.png'
};

console.log('📤 Enviando comprovante de teste...');
console.log('Transaction ID:', payload.transaction_id);
console.log('Nome:', payload.customer_name);
console.log('Arquivo tem base64?', !!payload.arquivo);

// Testar localmente - chamar a função diretamente
const handler = require('./functions/comprovantes-upload.js').handler;

const mockEvent = {
  httpMethod: 'POST',
  body: JSON.stringify(payload),
  headers: {
    'content-type': 'application/json'
  }
};

console.log('\n⏳ Executando função...\n');

handler(mockEvent)
  .then(response => {
    console.log('✅ Resposta da função:');
    console.log('Status:', response.statusCode);
    const body = JSON.parse(response.body);
    console.log('Body:', body);
    
    if (body.success) {
      console.log('\n🎉 SUCESSO! Comprovante foi salvo no Supabase!');
      process.exit(0);
    } else {
      console.log('\n❌ ERRO:', body.error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n❌ ERRO ao chamar função:', err.message);
    console.error(err);
    process.exit(1);
  });
