// api/proof.js - Retrieve proof results
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ 
          success: false,
          error: 'Proof ID is required' 
        });
      }

      // Fetch proof from JSONBin
      const response = await fetch(`https://api.jsonbin.io/v3/b/${id}/latest`, {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      });

      if (!response.ok) {
        return res.status(404).json({ 
          success: false,
          error: 'Proof not found' 
        });
      }

      const data = await response.json();
      const proofData = data.record;

      // Check if expired
      if (Date.now() > proofData.expiresAt) {
        return res.status(410).json({ 
          success: false,
          error: 'Proof has expired' 
        });
      }

      // Validate token (simple check for development)
      if (!proofData.token) {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid proof token' 
        });
      }

      res.status(200).json({ 
        success: true,
        data: proofData 
      });
    } catch (error) {
      console.error('Error fetching proof:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch proof' 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
