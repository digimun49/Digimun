const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email || !ADMIN_EMAIL) {
      return { statusCode: 200, headers, body: JSON.stringify({ isAdmin: false }) };
    }

    const isAdmin = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ isAdmin })
    };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ isAdmin: false }) };
  }
};
