// api/verify.js - Netlify format
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      const { 
        requestId,
        displayName,
        extractedData,
        selectedFields
      } = body;

      // Fetch original request
      const requestResponse = await fetch(`https://api.jsonbin.io/v3/b/${requestId}/latest`, {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      });

      if (!requestResponse.ok) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'Original request not found' 
          })
        };
      }

      const requestData = (await requestResponse.json()).record;

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

      // Generate verification results
      const verificationResult = {
        proofId: generateId(),
        requestId: requestId,
        heightMatch: compareValues(extractedData.height, requestData.claimedHeight, selectedFields.includes('height')),
        ageMatch: compareValues(extractedData.age, requestData.claimedAge, selectedFields.includes('age')),
        locationMatch: compareValues(extractedData.location, requestData.claimedLocation, selectedFields.includes('location')),
        nameMatch: compareName(displayName, requestData.targetName),
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        isValid: true,
        requesterName: requestData.requesterName,
        targetName: requestData.targetName,
        extractedData: extractedData,
        displayName: displayName
      };

      const token = createSimpleToken(verificationResult);
      const proofData = { ...verificationResult, token: token };

      const storeResponse = await fetch('https://api.jsonbin.io/v3/b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY,
          'X-Bin-Name': `proof_${verificationResult.proofId}`
        },
        body: JSON.stringify(proofData)
      });

      if (!storeResponse.ok) {
        throw new Error('Failed to store proof');
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          proofId: verificationResult.proofId,
          token: token,
          results: verificationResult
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to generate proof' 
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

function compareValues(extracted, claimed, isSelected) {
  if (!claimed) return null;
  if (!isSelected) return null;
  if (!extracted) return false;
  
  const normalizeValue = (val) => val?.toString().toLowerCase().trim();
  return normalizeValue(extracted) === normalizeValue(claimed);
}

function compareName(displayName, claimedName) {
  if (!displayName || !claimedName) return false;
  return displayName.toLowerCase().trim() === claimedName.toLowerCase().trim();
}

function createSimpleToken(data) {
  const payload = { ...data, signature: 'dev_mode_' + Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
