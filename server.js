const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// Use your LIVE Publishable Key for Bearer auth (safer for checkout creation)
const INTASEND_PUBLISHABLE_KEY = 'ISPubKey_live_2920cc1b-4078-4368-b2c1-102620a0f300';
// Optional: fallback to secret if needed, but publishable is recommended here
// const INTASEND_SECRET_KEY = 'ISSecretKey_live_bc638444-2927-4f46-b391-7a9f389223ca';

// Webhook endpoint – add https://stkintasend.vercel.app/webhook/intasend in IntaSend dashboard
app.post('/webhook/intasend', express.json(), (req, res) => {
  const event = req.body;
  console.log('Webhook received:', JSON.stringify(event, null, 2));

  if (event?.status === 'SUCCESS' || event?.invoice?.status === 'SUCCESS') {
    console.log('Payment SUCCESS!', {
      invoice: event.invoice?.id || event.id,
      ref: event.api_ref || event.invoice?.api_ref,
    });
    // TODO: Update DB/order status
  }

  res.sendStatus(200);
});

app.post('/api/initiate-stk', async (req, res) => {
  try {
    const { phone_number, amount = '10', order_ref = `ORD-${Date.now()}` } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: 'phone_number is required' });
    }

    // Normalize phone to 2547xxxxxxxx
    let cleanPhone = phone_number.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('254') || cleanPhone.length !== 12) {
      return res.status(400).json({ error: 'Invalid phone format — use 254712345678' });
    }

    const payload = {
      amount: String(amount),  // Docs show string
      currency: 'KES',
      phone_number: cleanPhone,
      email: 'customer@emxluz.xyz',
      first_name: 'Customer',
      last_name: 'User',
      api_ref: order_ref,
      host: 'https://emxluz.xyz',
      redirect_url: 'https://www.app.exmluz.xyz',  // success redirect
      // success_url: 'https://www.app.exmluz.xyz?status=success',  // alternative if redirect_url not working
      // failure_url: 'https://www.app.exmluz.xyz?status=failed',
      charge_fee: 'BUSINESS-PAYS',  // or 'CUSTOMER-PAYS'
      // description: `Payment for ${order_ref}`,
      // payment_method: 'MOBILE',  // optional
    };

    console.log('IntaSend payload:', payload);

    const response = await fetch('https://api.intasend.com/api/v1/checkout/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INTASEND_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log('IntaSend response status:', response.status);
    console.log('IntaSend response body:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`IntaSend error ${response.status}: ${data.detail || data.message || 'Unknown'}`);
    }

    if (!data.url) {
      throw new Error('No checkout URL in response');
    }

    res.json({
      success: true,
      checkout_url: data.url,
      invoice_id: data.id || null,
      api_ref: order_ref,
    });

  } catch (error) {
    console.error('Payment initiation failed:', error.message);
    console.error(error.stack || '');

    res.status(500).json({
      error: error.message || 'Internal server error - check Vercel logs',
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
