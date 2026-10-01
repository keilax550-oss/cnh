const https = require('https');

function testarPix(amount, nome) {
  return new Promise((resolve) => {
    const payload = {
      amount: amount,
      customer_name: nome,
      customer_email: nome.toLowerCase().replace(/ /g, '') + '@test.com',
      customer_phone: '11987654321',
      customer_cpf: '11144477735'
    };

    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    const options = {
      hostname: 'suacnh-gov-br.netlify.app',
      port: 443,
      path: '/api/pix',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payloadBuffer.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (body.success && body.pix_code) {
            console.log(`✅ PIX R$ ${amount} GERADO COM SUCESSO!`);
            console.log(`   Transaction ID: ${body.transaction_id}`);
            console.log(`   Produto: LOJA BRINQUEDO 02`);
          } else {
            console.log(`❌ Erro ao gerar PIX R$ ${amount}: ${body.error}`);
          }
        } catch(e) {
          console.log(`❌ Erro: ${e.message}`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`❌ Erro de conexão: ${e.message}`);
      resolve();
    });

    req.write(payloadBuffer);
    req.end();
  });
}

(async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE GATEWAY - NOVOS VALORES                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('Testando geração de PIX...\n');
  
  await testarPix(67.70, 'Teste Taxa 1');
  await new Promise(r => setTimeout(r, 2000));
  
  await testarPix(75.20, 'Teste Upsell');
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ TESTE COMPLETO!');
  console.log('═'.repeat(60));
})();
