const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('http://localhost:8080/api/chat', {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy_mistral_key_to_bypass_check'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'deepseek'
      })
    });
    
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
  } catch (err) {
    console.error(err);
  }
}

test();
