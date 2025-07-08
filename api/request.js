// api/request.js - Netlify format
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      const requestData = {
        id: generateId(),
        requesterName: body.requesterName,
        targetName: body.targetName,
        claimedHeight: body.claimedHeight || null,
        claimedAge: body.claimedAge || null,
        claimedLocation: body.claimedLocation || null,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          requestId: requestData.id 
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to create verification request' 
        })
      };
    }
  } else if (event.httpMethod === 'GET') {
    try {
      const id = event.queryStringParameters?.id;
      
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Request ID is required' 
          })
        };
      }

      // Fetch from JSONBin
      const response = await fetch(`https://api.jsonbin.io/v3/b/${id}/latest`, {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      });

      if (!response.ok) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Request not found' 
          })
        };
      }

      const data = await response.json();
      const requestData = data.record;

      if (Date.now() > requestData.expiresAt) {
        return {
          statusCode: 410,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Request has expired' 
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          data: requestData 
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to fetch request' 
        })
      };
    }
  } else {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
};

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
