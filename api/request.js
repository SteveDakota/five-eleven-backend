// api/request.js - Fixed Netlify format with proper ID mapping
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

      // Store in JSONBin and get the bin ID immediately
      const response = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY,
          'X-Bin-Name': `request_${requestData.id}`,
          'X-Bin-Private': 'false'  // Make bins public so we can search them
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('Failed to store request');
      }

      const jsonBinResult = await response.json();
      console.log('JSONBin storage result:', jsonBinResult);
      
      // IMPORTANT: Use the actual bin ID as our requestId
      // This eliminates the mapping problem entirely
      const actualRequestId = jsonBinResult.metadata.id;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          requestId: actualRequestId  // Return the actual bin ID
        })
      };
    } catch (error) {
      console.error('Error storing request:', error);
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

      // Try direct access by searching for bins with our naming pattern
      const searchResponse = await fetch(`https://api.jsonbin.io/v3/c/bins`, {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      });

      if (!searchResponse.ok) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Failed to search bins' 
          })
        };
      }

      const bins = await searchResponse.json();
      
      // Find the bin with name matching our request
      const requestBin = bins.record.find(bin => bin.name === `request_${id}`);
      
      if (!requestBin) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Request not found' 
          })
        };
      }

      // Now fetch the actual request data using the found bin ID
      const response = await fetch(`https://api.jsonbin.io/v3/b/${requestBin.id}/latest`, {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      });

      if (!mappingResponse.ok) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Request not found' 
          })
        };
      }

      if (!response.ok) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Request data not found' 
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
      console.error('Error fetching request:', error);
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
