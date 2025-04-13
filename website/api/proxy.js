const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { endpoint } = req.query;
  const portiaApiUrl = 'https://portia-finetune-1.onrender.com';
  
  try {
    console.log(`Proxying request to: ${portiaApiUrl}${endpoint}`);
    
    const response = await axios({
      method: req.method,
      url: `${portiaApiUrl}${endpoint}`,
      data: req.body,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || 'No details available'
    });
  }
};