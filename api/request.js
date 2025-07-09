// api/request.js - Clean version without syntax errors
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
      console.log('Received request body:', JSON.stringify(body, null, 2));
      
      // Create request data WITHOUT an ID first
      const tempRequestData = {
        requesterName: body.requesterName,
        targetName: body.targetName,
        claimedHeight: body.claimedHeight || null,
        claimedAge: body.claimedAge || null,
        claimedLocation: body.claimedLocation || null,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      };

      console.log('Processed request data:', JSON.stringify(tempRequestData, null, 2));

      // Store in JSONBin and get the bin ID immediately
      const response = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY
        },
        body: JSON.stringify(tempRequestData)
      });

      if (!response.ok) {
        throw new Error('Failed to store request');
      }

      const jsonBinResult = await response.json();
      const binId = jsonBinResult.metadata.id;
      
      // Now update the stored data to include the correct ID
      const finalRequestData = {
        ...tempRequestData,
        id: binId
      };

      // Update the bin with the correct ID
      await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY
        },
        body: JSON.stringify(finalRequestData)
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          requestId: binId
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

      // Direct fetch using the requestId as the bin ID
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
