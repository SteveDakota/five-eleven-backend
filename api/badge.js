// api/badge.js - CORRECTED version matching request.js pattern
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

      // Create badge data WITHOUT badgeId first (like request.js)
      const tempBadgeData = {
        displayName: displayName,
        extractedData: extractedData,
        selectedFields: selectedFields || [],
        type: 'badge',
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        isValid: true
      };

      // Store in JSONBin and get the bin ID immediately
      const response = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY
        },
        body: JSON.stringify(tempBadgeData)
      });

      if (!response.ok) {
        throw new Error('Failed to store badge');
      }

      const jsonBinResult = await response.json();
      const binId = jsonBinResult.metadata.id;
      
      // Now update the stored data to include the correct ID
      const finalBadgeData = {
        ...tempBadgeData,
        badgeId: binId // Use binId as badgeId
      };

      const token = createSimpleToken(finalBadgeData);
      const updatedBadgeData = { ...finalBadgeData, token: token };

      // Update the bin with the correct ID
      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY
        },
        body: JSON.stringify(updatedBadgeData)
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          badgeId: binId, // Return the actual binId
          token: token,
          results: finalBadgeData
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

      // Direct fetch using the badgeId as the bin ID (like request.js)
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

      // Check if expired
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

// Helper function
function createSimpleToken(data) {
  const payload = { ...data, signature: 'dev_mode_' + Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
