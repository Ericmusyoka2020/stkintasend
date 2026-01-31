
const express = require('express');
const IntaSend = require('intasend-node');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// IMPORTANT: Use publishable + secret correctly (SDK expects them this way)
const intasend = new IntaSend({
  publicId: 'ISPubKey_live_2920cc1b-4078-4368-b2c1-102620a0f300',
  secretKey: 'ISSecretKey_live_bc638444-2927-4f46-b391-7a9f389223ca',
  isTest: false  // live environment
});

// Webhook endpoint (strongly recommended - add this URL in your IntaSend dashboard)
app.post('/webhook/intasend', express.raw({ type: 'application/json' }), (req, res) => {
  // In production: verify signature from header 'x-intasend-signature'
  // For now just log
  console.log('Webhook received:', req.body);

  const event = req.body;
  if (event?.invoice?.status === 'SUCCESS' || event?.status === 'SUCCESS') {
    const invoiceId = event.invoice?.id || event.id;
    const apiRef  = event.invoice?.api_ref || event.api_ref;
    console.log(`Payment SUCCESS! Invoice: ${invoiceId} | Ref: ${apiRef}`);
    // TODO: Update your database/order status here
  }

  res.sendStatus(200); // Always acknowledge
});

app.post('/api/initiate-stk', async (req, res) => {
  try {
    const { phone_number, amount = 10, order_ref = `ORD-${Date.now()}` } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: 'phone_number is required' });
    }

    // Clean phone number → must be 2547xxxxxxxx format
    let cleanPhone = phone_number.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.slice(1);
    }
    if (!cleanPhone.startsWith('254') || cleanPhone.length !== 12) {
      return res.status(400).json({ error: 'Invalid phone number format. Use 2547xxxxxxxx' });
    }

    const collection = intasend.collection();

    // Use checkout.create() → this gives redirect after success
    const payload = {
      amount: Number(amount),
      currency: 'KES',
      phone_number: cleanPhone,
      email: 'customer@emxluz.xyz',
      first_name: 'Customer',
      last_name: 'User',
      api_ref: order_ref,
      host: 'https://emxluz.xyz',               // Your domain
      redirect_url: 'https://www.app.exmluz.xyz', // ← Where user goes AFTER SUCCESS
      // Optional but recommended for UX
      mobile_tarrif: 'BUSINESS-PAYS',           // You pay M-Pesa fees
      // card_tarrif: 'BUSINESS-PAYS',          // if you want cards too
    };

    const response = await collection.checkout.create(payload);

    // The response should have .url (hosted checkout page)
    if (!response?.url) {
      throw new Error('No checkout URL returned from IntaSend');
    }

    console.log('Checkout created:', response.url);

    // Return the URL → your frontend should redirect user to it
    res.json({
      success: true,
      checkout_url: response.url,
      invoice_id: response.invoice?.id || response.id,
      api_ref: order_ref
    });

  } catch (error) {
    console.error('IntaSend Error Details:');
    console.error(error?.response?.data || error.message || error);

    const errMsg = error?.response?.data?.detail 
      || error?.message 
      || 'Failed to initiate payment';

    res.status(500).json({ error: errMsg });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /api/initiate-stk     → start payment');
  console.log('  POST /webhook/intasend     → IntaSend will call this on payment events');
});
