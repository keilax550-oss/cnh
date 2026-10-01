# API Documentation

## PIX Generation Endpoint

### Endpoint
```
POST /api/pix
```

### Request Body
```json
{
  "nome": "Cliente Nome",
  "email": "cliente@email.com",
  "phone": "11999999999",
  "cpf": "12345678901",
  "amount": 64,
  "utm": {
    "utm_source": "google",
    "utm_campaign": "campaign_name",
    "utm_medium": "cpc",
    "utm_content": "ad_content",
    "utm_term": "search_term"
  }
}
```

### Response (Success)
```json
{
  "success": true,
  "pixCode": "00020101021226900014br.gov.bcb.pix...",
  "pix_code": "00020101021226900014br.gov.bcb.pix...",
  "brcode": "00020101021226900014br.gov.bcb.pix...",
  "transaction_id": "TXN_1787783005643_11914101",
  "transactionId": "TXN_1787783005643_11914101",
  "status": "pending"
}
```

### Response (Error)
```json
{
  "success": false,
  "error": "Error message here",
  "debug": "Additional debug info"
}
```

## Important Notes

- **Field `nome`** is used for customer name (alternatives: `name`, `customer_name`)
- **Field `amount`** defaults to R$ 64.00 if not provided
- **Field `cpf`** is optional - a valid CPF will be generated if not provided
- **Field `phone`** will be formatted automatically
- **UTM parameters** are optional but recommended for tracking

## Funnel Flow

1. **Lead enters form** → Validates fields
2. **Submit form** → Calls `/api/pix`
3. **Receive pixCode** → Display QR Code to user
4. **User scans** → Payment gateway handles the rest

## Status Codes

- `200` - PIX generated successfully
- `400` - Bad request (missing or invalid fields)
- `502` - Gateway connection error
- `500` - Server error

## Testing

Use this cURL command to test:

```bash
curl -X POST https://novacnh-brasil-gov-br.netlify.app/api/pix \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Test User",
    "email": "test@example.com",
    "phone": "11999999999",
    "cpf": "12345678901",
    "amount": 64,
    "utm": {"utm_source": "test"}
  }'
```
