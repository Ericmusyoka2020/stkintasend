const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // For making HTTP requests

const app = express();

app.use(express.json());
app.use(cors());

// Your IntaSend LIVE Secret Key (keep secure - never expose in frontend!)
const INTASEND_SECRET_KEY = 'ISSecretKey_live_bc638444-2927-4f46-b391-7a9f389223ca';

// Webhook endpoint (add this URL in IntaSend dashboard > Settings > Webhooks)
app.post('/webhook/intasend', (req, res) => {
  const event = req.body;
  console.log('IntaSend Webhook received:', event);

  // In production: Verify signature using header 'x-intasend-signature' if provided
  if (event?.invoice?.status === 'SUCCESS' || event?.status === 'SUCCESS') {
    const invoiceId = event.invoice?.id || event.id;
    const apiRef = event.invoice?.api_ref || event.api_ref;
    console.log(`SUCCESS - Invoice: ${invoiceId} | Ref: ${apiRef}`);
    // TODO: Update your database / mark order as paid here
  }

  res.sendStatus(200); // Must respond 200 to acknowledge
});

app.post('/api/initiate-stk', async (req, res) => {
  try {
    const { phone_number, amount = 10, order_ref = `ORD-${Date.now()}` } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: 'phone_number is required' });
    }

    // Clean phone to 2547xxxxxxxx format
    let cleanPhone = phone_number.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.slice(1);
    }
    if (!cleanPhone.startsWith('254') || cleanPhone.length !== 12) {
      return res.status(400).json({ error: 'Invalid phone: Use format 254712345678' });
    }

    if (Number(amount) < 1) {
      return res.status(400).json({ error: 'Amount must be at least 1 KES' });
    }

    const payload = {
      amount: Number(amount),
      currency: 'KES',
      phone_number: cleanPhone,
      email: 'customer@emxluz.xyz',
      first_name: 'Customer',
      last_name: 'User',
      api_ref: order_ref,
      host: 'https://emxluz.xyz',                    // Your domain (helps with CORS/security)
      redirect_url: 'https://www.app.exmluz.xyz',    // ← Auto-redirect here AFTER SUCCESS
      mobile_tarrif: 'BUSINESS-PAYS',                // Business pays M-Pesa fees (better UX)
      // Optional: card_tarrif: 'BUSINESS-PAYS',
      // Optional: description: 'Payment for order ' + order_ref,
    };

    console.log('Sending payload to IntaSend:', payload);

    // Basic Auth: username empty, password = secret key
    const auth = Buffer.from(`:${INTASEND_SECRET_KEY}`).toString('base64');

    const apiResponse = await fetch('https://api.intasend.com/api/v1/checkout/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('IntaSend API error:', data);
      throw new Error(data.detail || data.message || `HTTP ${apiResponse.status}`);
    }

    if (!data.url) {
      throw new Error('No checkout URL returned from IntaSend');
    }

    console.log('Checkout created successfully:', data.url);

    res.json({
      success: true,
      checkout_url: data.url,
      invoice_id: data.invoice?.id || data.id || null,
      api_ref: order_ref,
    });

  } catch (error) {
    console.error('Error initiating payment:');
    console.error(error.message);
    console.error(error.stack || '');

    const errMsg = error.message || 'Failed to initiate payment. Check server logs.';
    res.status(500).json({ error: errMsg });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('→ POST /api/initiate-stk → Start STK/Checkout');
  console.log('→ POST /webhook/intasend → For payment notifications');
});
