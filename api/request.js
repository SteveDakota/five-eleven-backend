// api/request.js - Store and retrieve verification requests
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const requestData = {
        id: generateId(),
        requesterName: req.body.requesterName,
        targetName: req.body.targetName,
        claimedHeight: req.body.claimedHeight || null,
        claimedAge: req.body.claimedAge || null,
        claimedLocation: req.body.claimedLocation || null,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      // Store in JSONBin
      const response = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY,
          'X-Bin-Name': `request_${requestData.id}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('Failed to store request');
      }

      res.status(200).json({ 
        success: true,
        requestId: requestData.id 
      });
    } catch (error) {
      console.error('Error storing request:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to create verification request' 
      });
    }
  } else if (req.method === 'GET') {
    try {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ 
          success: false,
          error: 'Request ID is required' 
        });
      }

      // Fetch from JSONBin
      const response = await fetch(`https://api.jsonbin.io/v3/b/${id}/latest`, {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      });

      if (!response.ok) {
        return res.status(404).json({ 
          success: false,
          error: 'Request not found' 
        });
      }

      const data = await response.json();
      const requestData = data.record;

      // Check if expired
      if (Date.now() > requestData.expiresAt) {
        return res.status(410).json({ 
          success: false,
          error: 'Request has expired' 
        });
      }

      res.status(200).json({ 
        success: true,
        data: requestData 
      });
    } catch (error) {
      console.error('Error fetching request:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch request' 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Utility function to generate unique IDs
function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
