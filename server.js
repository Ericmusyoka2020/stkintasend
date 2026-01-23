 const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const IntaSend = require('intasend-node');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// LIVE KEYS
const PUBLISHABLE_KEY = 'ISPubKey_live_2920cc1b-4078-4368-b2c1-102620a0f300';
const SECRET_KEY = 'ISSecretKey_live_bc638444-2927-4f46-b391-7a9f389223ca';
const intasend = new IntaSend(PUBLISHABLE_KEY, SECRET_KEY, false); // live mode

// In-memory storage (use Redis/DB in production)
const paymentStatus = new Map(); // invoiceId → { status, message, amount }

// Your ngrok URL & challenge
const NGROK_URL = 'https://17af263f6638.ngrok-free.app';
const EXPECTED_CHALLENGE = 'k9p2m4q8r5t1v3x7h9j0l2b6c8d0e';

// 🔹 STK PUSH
app.post('/api/stk-push', async (req, res) => {
  const { phone, amount } = req.body;

  console.log('STK Push requested:', { phone, amount });

  if (!phone || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Valid phone and amount required' });
  }

  try {
    const collection = intasend.collection();
    const resp = await collection.mpesaStkPush({
      first_name: 'User',
      last_name: 'Payment',
      email: 'user@example.com',
      host: NGROK_URL,
      amount: Number(amount),
      phone_number: phone.startsWith('0') ? '254' + phone.slice(1) : phone,
      api_ref: 'ref_' + Date.now(),
      callback_url: `${NGROK_URL}/api/callback`
    });

    const invoiceId = resp?.invoice?.invoice_id;
    console.log('STK Push response:', { invoiceId, resp });

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'No invoice ID received' });
    }

    // Initialize status
    paymentStatus.set(invoiceId, { status: 'pending', message: 'Awaiting payment confirmation' });

    res.json({
      success: true,
      checkoutRequestId: invoiceId,
      message: 'STK Push sent successfully!'
    });

  } catch (error) {
    console.error('STK Push Error:', error);
    res.status(500).json({ success: false, message: error.message || 'STK Push failed' });
  }
});

// 🔹 STATUS POLLING (CRITICAL - this was broken!)
app.get('/api/payment-status', (req, res) => {
  try {
    const { checkoutRequestId } = req.query;
    
    if (!checkoutRequestId) {
      return res.status(400).json({ status: 'error', message: 'Missing checkoutRequestId' });
    }

    if (!paymentStatus.has(checkoutRequestId)) {
      return res.json({ status: 'pending', message: 'Payment not found' });
    }

    const status = paymentStatus.get(checkoutRequestId);
    console.log(`Status check for ${checkoutRequestId}:`, status);
    res.json(status);

  } catch (error) {
    console.error('Status endpoint error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// 🔹 WEBHOOK (FIXED - invoice is DIRECTLY in req.body, not payload.invoice!)
app.post('/api/callback', (req, res) => {
  try {
    console.log('INTASEND WEBHOOK RECEIVED:', JSON.stringify(req.body, null, 2));

    const payload = req.body;

    // ✅ Challenge verification (your secret)
    if (payload.challenge && payload.challenge !== EXPECTED_CHALLENGE) {
      console.warn('❌ Invalid challenge:', payload.challenge);
      return res.sendStatus(200);
    }

    // ✅ FIXED: Invoice data is DIRECTLY in req.body (not wrapped in .invoice)
    const invoiceId = payload.invoice_id;
    const state = (payload.state || '').toUpperCase();

    if (!invoiceId) {
      console.log('⚠️ No invoice_id in webhook');
      return res.sendStatus(200);
    }

    // Update status based on state
    if (state === 'COMPLETE') {
      paymentStatus.set(invoiceId, {
        status: 'success',
        message: 'Payment completed successfully! 🎉',
        amount: payload.value,
        mpesaRef: payload.mpesa_reference,
        completedAt: new Date().toISOString()
      });
      console.log(`✅ SUCCESS: Invoice ${invoiceId} | Amount: ${payload.value} KES`);
    } else if (state === 'FAILED') {
      paymentStatus.set(invoiceId, {
        status: 'failed',
        message: payload.failed_reason || 'Payment failed',
        amount: payload.value
      });
      console.log(`❌ FAILED: Invoice ${invoiceId} | Reason: ${payload.failed_reason || 'Unknown'}`);
    } else if (state === 'PENDING' || state === 'PROCESSING') {
      paymentStatus.set(invoiceId, {
        status: 'processing',
        message: 'Payment processing... Please wait'
      });
      console.log(`⏳ ${state}: Invoice ${invoiceId}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(200); // Always 200 for IntaSend
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook: ${NGROK_URL}/api/callback`);
  console.log(`✅ Ready for payments!`);
});