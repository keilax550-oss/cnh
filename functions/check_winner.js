// ❌ REMOVIDO: Credenciais hardcoded
// Use variáveis de ambiente: WINNER_CLIENT_ID e WINNER_CLIENT_SECRET

const { getSupabase } = require("./lib/supabase");

const WINNER_BASE   = "https://api.winnerpayy.com.br/api";
const WINNER_ID     = process.env.WINNER_CLIENT_ID;
const WINNER_SECRET = process.env.WINNER_CLIENT_SECRET;
const UTMIFY_TOKEN  = process.env.UTMIFY_TOKEN || "lzASZob4ldSJJc3jT1LILy9alPxWJgpnPhCh";

function getAuthHeader() {
  if (!WINNER_ID || !WINNER_SECRET) {
    throw new Error("❌ ERRO CRÍTICO: WINNER_CLIENT_ID e WINNER_CLIENT_SECRET não configurados na Netlify!");
  }
  const b64 = Buffer.from(`${WINNER_ID}:${WINNER_SECRET}`).toString("base64");
  return `Basic ${b64}`;
}

async function sendUtmifyPaid(txData, transactionId) {
  try {
    const amountCents     = Math.round((txData.amount || 64) * 100);
    const gatewayFeeCents = Math.round(amountCents * 0.02);
    const payload = {
      orderId: transactionId, platform: "WinnerPay", paymentMethod: "pix",
      status: "paid",
      createdAt: txData.created_at || new Date().toISOString().replace("T"," ").slice(0,19),
      approvedDate: new Date().toISOString().replace("T"," ").slice(0,19),
      refundedAt: null,
      customer: { name: txData.customer_name||null, email: txData.customer_email||null, phone: txData.customer_phone||null, document: txData.customer_cpf||null, country:"BR", ip:"177.0.0.1" },
      products: [{ id:"loja-shopify-br-001", name:"LOJA SHOPIFY 02", planId:null, planName:null, quantity:1, priceInCents:amountCents }],
      trackingParameters: { src:null, sck:null, utm_source:txData.utm_source||null, utm_campaign:txData.utm_campaign||null, utm_medium:txData.utm_medium||null, utm_content:null, utm_term:null },
      commission: { totalPriceInCents:amountCents, gatewayFeeInCents:gatewayFeeCents, userCommissionInCents:amountCents-gatewayFeeCents, currency:"BRL" },
      isTest: false,
    };
    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method:"POST", headers:{"Content-Type":"application/json","x-api-token":UTMIFY_TOKEN}, body:JSON.stringify(payload)
    });
  } catch(err) { console.error("[UTMify]",err); }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Access-Control-Allow-Methods":"GET,POST,OPTIONS" },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode:204, headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}, body:"" };

  let transactionId = event.queryStringParameters?.id || event.queryStringParameters?.transactionId;
  if (event.httpMethod === "POST") {
    try { const b = event.body ? JSON.parse(event.body) : {}; transactionId = b?.transactionId || b?.id || transactionId; } catch {}
  }
  if (!transactionId) return jsonResponse(400, { success:false, error:"Informe o transactionId" });

  // WinnerPay — GET /dashboard/transactions/:transactionId
  let statusResp, text = "";
  
  let authHeader;
  try {
    authHeader = getAuthHeader();
  } catch (err) {
    console.error("[CheckWinner] Credenciais inválidas:", err.message);
    return jsonResponse(500, { success: false, error: "Credenciais não configuradas", debug: err.message });
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    statusResp = await fetch(
      `${WINNER_BASE}/dashboard/transactions/${encodeURIComponent(transactionId)}`,
      { method:"GET", headers:{ "Content-Type":"application/json", "Authorization": authHeader }, signal:controller.signal }
    );
    text = await statusResp.text();
    clearTimeout(timeout);
  } catch(err) {
    return jsonResponse(502, { success:false, error:"Falha ao consultar status: "+String(err) });
  }

  let parsed = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  const data      = parsed.data || parsed || {};
  const rawStatus = (data.status || "pending").toLowerCase();

  // WinnerPay statuses: pending, processing, paid, completed, refused, failed, cancelled, refunded
  const paid = rawStatus === "paid" || rawStatus === "completed";
  let status;
  if (paid)                                                     status = "paid";
  else if (rawStatus === "refused" || rawStatus === "failed")   status = "rejected";
  else if (rawStatus === "cancelled")                           status = "expired";
  else                                                          status = "pending";

  try {
    const supabase = getSupabase();
    if (paid) {
      const { data: txData } = await supabase
        .from("transactions")
        .select("status,customer_name,customer_email,customer_phone,customer_cpf,amount,created_at,utm_source,utm_campaign,utm_medium")
        .eq("transaction_id", transactionId)
        .single();
      const alreadyPaid = txData?.status === "paid";
      await supabase.from("transactions").update({ status:"paid", paid_at:new Date().toISOString() }).eq("transaction_id", transactionId);
      if (!alreadyPaid && txData) await sendUtmifyPaid(txData, transactionId);
    } else {
      await supabase.from("transactions").update({ status }).eq("transaction_id", transactionId);
    }
  } catch(err) { console.error("[Supabase]",err); }

  return jsonResponse(200, { success:true, transactionId, status, paid });
};
