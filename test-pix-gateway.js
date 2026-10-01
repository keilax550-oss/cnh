const https = require('https');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTE PIX NA GATEWAY - VALORES NOVOS                     ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Teste 1: Primeira taxa (68.10)
console.log('TEST 1️⃣: Gerando PIX da 1ª taxa (R$ 68.10)\n');

const payload1 = {
  amount: 68.10,
  customer_name: 'Teste Cliente 01',
  customer_email: 'teste01@email.com',
  customer_phone: '11999999999',
  customer_cpf: '12345678901',
  utm: {
    utm_source: 'test',
    utm_campaign: 'test_gateway'
  }
};

const payloadStr1 = JSON.stringify(payload1);
const payloadBuffer1 = Buffer.from(payloadStr1);

const options1 = {
  hostname: 'suacnh-gov-br.netlify.app',
  port: 443,
  path: '/api/pix',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payloadBuffer1.length
  }
};

console.log('📤 Enviando: R$ 68.10 para /api/pix\n');

const req1 = https.request(options1, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status HTTP:', res.statusCode);
    
    try {
      const body = JSON.parse(data);
      
      if (body.success && body.pix_code) {
        console.log('✅ PIX GERADO COM SUCESSO!');
        console.log('─'.repeat(60));
        console.log('Amount: R$ 68.10');
        console.log('Nome Produto: LOJINHA 04');
        console.log('Transaction ID:', body.transaction_id);
        console.log('PIX Code: ' + body.pix_code.substring(0, 50) + '...');
        console.log('─'.repeat(60));
        console.log('\nTEST 2️⃣: Gerando PIX da 2ª taxa (R$ 81.00)\n');
        
        // Teste 2: Segunda taxa (81.00)
        const payload2 = {
          amount: 81.00,
          customer_name: 'Teste Cliente 02',
          customer_email: 'teste02@email.com',
          customer_phone: '11999999999',
          customer_cpf: '12345678902',
          utm: {
            utm_source: 'test',
            utm_campaign: 'test_upsell'
          }
        };

        const payloadStr2 = JSON.stringify(payload2);
        const payloadBuffer2 = Buffer.from(payloadStr2);

        const req2 = https.request(options1, (res) => {
          let data2 = '';

          res.on('data', (chunk) => {
            data2 += chunk;
          });

          res.on('end', () => {
            console.log('Status HTTP:', res.statusCode);
            
            try {
              const body2 = JSON.parse(data2);
              
              if (body2.success && body2.pix_code) {
                console.log('✅ PIX GERADO COM SUCESSO!');
                console.log('─'.repeat(60));
                console.log('Amount: R$ 81.00');
                console.log('Nome Produto: LOJINHA 04');
                console.log('Transaction ID:', body2.transaction_id);
                console.log('PIX Code: ' + body2.pix_code.substring(0, 50) + '...');
                console.log('─'.repeat(60));
                
                console.log('\n' + '═'.repeat(60));
                console.log('✅ ✅ ✅  AMBOS OS PIX GERADOS COM SUCESSO!  ✅ ✅ ✅');
                console.log('═'.repeat(60));
                console.log('\n📊 RESUMO:');
                console.log('├─ 1ª Taxa: R$ 68.10 ✅');
                console.log('├─ 2ª Taxa: R$ 81.00 ✅');
                console.log('├─ Produto: LOJINHA 04 ✅');
                console.log('├─ Tipo: DIGITAL ✅');
                console.log('└─ Status: PRONTO PARA USAR NA GATEWAY 🎯\n');
              } else {
                console.log('❌ ERRO ao gerar PIX da 2ª taxa');
                console.log('Erro:', body2.error);
              }
            } catch (e) {
              console.log('Erro ao parsear resposta:', e.message);
            }
          });
        });

        req2.on('error', (e) => {
          console.error('❌ Erro de conexão:', e.message);
        });

        req2.write(payloadBuffer2);
        req2.end();
      } else {
        console.log('❌ ERRO ao gerar PIX da 1ª taxa');
        console.log('Erro:', body.error);
      }
    } catch (e) {
      console.log('Erro ao parsear resposta:', e.message);
    }
  });
});

req1.on('error', (e) => {
  console.error('❌ Erro de conexão:', e.message);
});

req1.write(payloadBuffer1);
req1.end();

console.log('⏳ Processando...\n');
