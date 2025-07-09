// api/badge.js - Matches your existing API structure
exports.handler = async (event, context) => {
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
      const { 
        displayName,
        extractedData,
        selectedFields
      } = body;

      // Validate required fields
      if (!displayName || !extractedData) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Missing required fields: displayName, extractedData' 
          })
        };
      }

      // Create badge data (same pattern as verify.js)
      const badgeData = {
        badgeId: generateId(),
        displayName: displayName,
        extractedData: extractedData,
        selectedFields: selectedFields || [],
        type: 'badge',
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        isValid: true
      };

      const token = createSimpleToken(badgeData);
      const finalBadgeData = { ...badgeData, token: token };

      // Store in JSONBin (same pattern as verify.js)
      const storeResponse = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY,
          'X-Bin-Name': `badge_${badgeData.badgeId}`
        },
        body: JSON.stringify(finalBadgeData)
      });

      if (!storeResponse.ok) {
        throw new Error('Failed to store badge');
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          badgeId: badgeData.badgeId,
          token: token,
          results: badgeData
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to create badge' 
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
            error: 'Badge ID is required' 
          })
        };
      }

      // Fetch badge from JSONBin (same pattern as proof.js)
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
            error: 'Badge not found' 
          })
        };
      }

      const data = await response.json();
      const badgeData = data.record;

      // Check if expired (same pattern as proof.js)
      if (Date.now() > badgeData.expiresAt) {
        return {
          statusCode: 410,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Badge has expired' 
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          data: badgeData 
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to fetch badge' 
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

// Helper functions (same as verify.js)
function createSimpleToken(data) {
  const payload = { ...data, signature: 'dev_mode_' + Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
