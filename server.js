const express = require('express');
const IntaSend = require('intasend-node');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const intasend = new IntaSend({
  publicId: 'ISPubKey_live_2920cc1b-4078-4368-b2c1-102620a0f300',
  secretKey: 'ISSecretKey_live_bc638444-2927-4f46-b391-7a9f389223ca',
  isTest: false
});

// INITIATE STK PUSH
app.post('/api/initiate-stk', async (req, res) => {
  try {
    const { phone_number } = req.body;
    const cleanPhone = phone_number.replace(/\D/g, '');

    const collection = intasend.collection();

    const response = await collection.mpesaStkPush({
      first_name: 'Customer',
      last_name: 'User',
      email: 'customer@emxluz.xyz',
      amount: 10,
      phone_number: cleanPhone,
      api_ref: 'Order123',

      // 🔔 WEBHOOK URL (THIS IS KEY)
      webhook_url: 'https://emxluz.xyz/api/intasend/webhook'
    });

    res.json({
      success: true,
      message: 'STK Push sent',
      data: response
    });

  } catch (error) {
    console.error('STK ERROR:', error);
    res.status(500).json({ success: false });
  }
});

// 🔔 INTASEND SUCCESS / STATUS CALLBACK
app.post('/api/intasend/webhook', (req, res) => {
  const payload = req.body;

  console.log('📩 IntaSend Webhook Received');
  console.log(payload);

  /*
    IMPORTANT FIELDS TO CHECK:
    payload.state === "COMPLETE"
    payload.invoice.state === "COMPLETE"
  */

  if (
    payload.state === 'COMPLETE' ||
    payload?.invoice?.state === 'COMPLETE'
  ) {
    console.log('✅ PAYMENT SUCCESSFUL');
  } else {
    console.log('❌ PAYMENT NOT SUCCESSFUL');
  }

  // IntaSend expects 200 OK
  res.status(200).send('OK');
});

app.listen(5000, () => {
  console.log('Backend running on http://localhost:5000');
});
