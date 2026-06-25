import { onDocumentCreated } from 'firebase-functions/v2/firestore';

export const onPersonalGreetingCreated = onDocumentCreated(
  {
    document: 'broadcasts/{docId}',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();

    // We only process personal greetings targeted to a specific phone
    if (!['personal_birthday', 'personal_anniversary'].includes(data.type)) {
      return;
    }

    if (!data.targetPhones || data.targetPhones.length === 0) {
      console.log('Skipping WhatsApp message: No target phones specified');
      return;
    }

    // Using process.env instead of Google Cloud Secrets
    const token = process.env.WA_ACCESS_TOKEN;
    const phoneId = process.env.WA_PHONE_ID;

    if (!token || !phoneId) {
      console.error('Missing WA_ACCESS_TOKEN or WA_PHONE_ID. Cannot send WhatsApp message.');
      return;
    }

    for (const rawPhone of data.targetPhones) {
      // Format phone: must not have +, must only have digits. e.g. 919398501975
      let toPhone = rawPhone.replace(/\D/g, '');
      if (toPhone.length === 10) {
        toPhone = `91${toPhone}`;
      }

      console.log(`Sending WhatsApp message to ${toPhone}`);

      try {
        const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            type: 'text',
            text: { 
              preview_url: false,
              body: data.body
            }
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`Meta API Error for ${toPhone}:`, JSON.stringify(result));
        } else {
          console.log(`Successfully sent WhatsApp to ${toPhone}. Message ID: ${result.messages?.[0]?.id}`);
        }
      } catch (error) {
        console.error(`Network Error sending WhatsApp to ${toPhone}:`, error);
      }
    }
  }
);

import { onRequest } from 'firebase-functions/v2/https';

export const testWhatsApp = onRequest(async (req, res) => {
  const token = process.env.WA_ACCESS_TOKEN;
  const phoneId = process.env.WA_PHONE_ID;

  if (!token || !phoneId) {
    res.status(500).send('Missing WA_ACCESS_TOKEN or WA_PHONE_ID');
    return;
  }

  const toPhone = req.query.phone as string;
  if (!toPhone) {
    res.status(400).send('Please provide a ?phone=YOUR_NUMBER parameter');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone,
        type: 'text',
        text: { 
          preview_url: false,
          body: 'This is a test WhatsApp message from the WeChristian App Backend! 🎉'
        }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      res.status(500).json({ error: 'Meta API Error', details: result });
    } else {
      res.status(200).json({ success: true, details: result });
    }
  } catch (error) {
    res.status(500).json({ error: 'Network Error', details: String(error) });
  }
});
