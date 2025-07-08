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

      const jsonBinResult = await response.json();
      console.log('JSONBin storage result:', jsonBinResult);
      
      // Store the mapping of requestId -> actual JSONBin ID
      const mappingData = {
        requestId: requestData.id,
        binId: jsonBinResult.metadata.id,
        timestamp: Date.now()
      };

      // Store the mapping in a separate bin for lookup
      await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY,
          'X-Bin-Name': `mapping_${requestData.id}`
        },
        body: JSON.stringify(mappingData)
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          requestId: requestData.id 
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

      // First, get the mapping to find the actual JSONBin ID
      const mappingResponse = await fetch(`https://api.jsonbin.io/v3/b/name/mapping_${id}`, {
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

      const mappingData = await mappingResponse.json();
      const actualBinId = mappingData.record.binId;

      // Now fetch the actual request data using the real bin ID
      const response = await fetch(`https://api.jsonbin.io/v3/b/${actualBinId}/latest`, {
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
