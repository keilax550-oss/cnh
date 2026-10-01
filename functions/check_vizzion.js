const { getSupabase } = require("./lib/supabase");

const VIZZION_BASE   = "https://app.vizzionpay.com.br/api/v1";
const UTMIFY_TOKEN   = "lzASZob4ldSJJc3jT1LILy9alPxWJgpnPhCh";

async function sendUtmifyPaid(txData, transactionId) {
  try {
    const amountCents     = Math.round((txData.amount || 64) * 100);
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const payload = {
      orderId: transactionId, platform: "VizzionPay", paymentMethod: "pix",
      status: "paid",
      createdAt: txData.created_at || new Date().toISOString().replace("T"," ").slice(0,19),
      approvedDate: new Date().toISOString().replace("T"," ").slice(0,19),
      refundedAt: null,
      customer: { name: txData.customer_name||null, email: txData.customer_email||null, phone: txData.customer_phone||null, document: txData.customer_cpf||null, country:"BR", ip:"177.0.0.1" },
      products: [{ id:"shopify-br-001", name:"LOJA SHOPIFY BR", planId:null, planName:null, quantity:1, priceInCents:amountCents }],
      trackingParameters: { src:null,sck:null, utm_source:txData.utm_source||null, utm_campaign:txData.utm_campaign||null, utm_medium:txData.utm_medium||null, utm_content:null, utm_term:null },
      commission: { totalPriceInCents:amountCents, gatewayFeeInCents:gatewayFeeCents, userCommissionInCents:amountCents-gatewayFeeCents, currency:"BRL" },
      isTest: false,
    };
    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method:"POST", headers:{"Content-Type":"application/json","x-api-token":UTMIFY_TOKEN}, body:JSON.stringify(payload)
    });
  } catch(err) { console.error("[UTMify]",err); }
}

function jsonResponse(statusCode, body) {
  return { statusCode, headers:{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}, body:JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode:204, headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}, body:"" };

  let transactionId = event.queryStringParameters?.id || event.queryStringParameters?.transactionId;
  if (event.httpMethod === "POST") {
    try { const b = event.body ? JSON.parse(event.body) : {}; transactionId = b?.transactionId || b?.id || transactionId; } catch {}
  }
  if (!transactionId) return jsonResponse(400, { success:false, error:"Informe o transactionId" });

  let statusResp, text = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    statusResp = await fetch(`${VIZZION_BASE}/gateway/transactions/${encodeURIComponent(transactionId)}`,
      { method:"GET", headers:{"Content-Type":"application/json"}, signal:controller.signal }
    );
    text = await statusResp.text();
    clearTimeout(timeout);
  } catch(err) {
    return jsonResponse(502, { success:false, error:"Falha ao consultar status: "+String(err) });
  }

  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  const data      = parsed.data || parsed || {};
  const rawStatus = (data.status || "PENDING").toUpperCase();
  const paid      = rawStatus === "PAID" || rawStatus === "APPROVED" || rawStatus === "OK";
  let status;
  if (paid)                   status = "paid";
  else if (rawStatus === "REJECTED" || rawStatus === "CANCELED" || rawStatus === "FAILED") status = "expired";
  else                        status = "pending";

  try {
    const supabase = getSupabase();
    if (paid) {
      const { data: txData } = await supabase.from("transactions").select("status,customer_name,customer_email,customer_phone,customer_cpf,amount,created_at,utm_source,utm_campaign,utm_medium").eq("transaction_id", transactionId).single();
      const alreadyPaid = txData?.status === "paid";
      await supabase.from("transactions").update({ status:"paid", paid_at:new Date().toISOString() }).eq("transaction_id", transactionId);
      if (!alreadyPaid && txData) await sendUtmifyPaid(txData, transactionId);
    } else {
      await supabase.from("transactions").update({ status }).eq("transaction_id", transactionId);
    }
  } catch(err) { console.error("[Supabase]",err); }

  return jsonResponse(200, { success:true, transactionId, status, paid });
};
