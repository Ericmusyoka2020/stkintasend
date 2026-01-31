import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/initiate-stk", async (req, res) => {
  try {
    const { phone_number } = req.body;

    const response = await fetch(
      "https://payment.intasend.com/api/v1/payment/mpesa-stk-push/",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer ISSecretKey_live_bc638444-2927-4f46-b391-7a9f389223ca",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: 5,
          phone_number,
          email: "customer@emxluz.xyz",
          api_ref: "Order123",
          redirect_url: "https://www.app.emxluz.app",
          webhook_url: "https://stkintasend.vercel.app/api/intasend/webhook"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("IntaSend API Error:", data);
      return res.status(400).json(data);
    }

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/intasend/webhook", (req, res) => {
  console.log("✅ IntaSend webhook:", req.body);
  res.status(200).send("OK");
});

app.listen(3000, () => console.log("Backend running"));
