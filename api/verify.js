// api/verify.js - Generate verification proof
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { 
        requestId,
        displayName,
        extractedData,
        selectedFields
      } = req.body;

      // Fetch original request
      const requestResponse = await fetch(`https://api.jsonbin.io/v3/b/${requestId}/latest`, {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY
        }
      });

      if (!requestResponse.ok) {
        return res.status(404).json({ 
          success: false,
          error: 'Original request not found' 
        });
      }

      const requestData = (await requestResponse.json()).record;

      // Check if request expired
      if (Date.now() > requestData.expiresAt) {
        return res.status(410).json({ 
          success: false,
          error: 'Request has expired' 
        });
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
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        isValid: true,
        requesterName: requestData.requesterName,
        targetName: requestData.targetName,
        extractedData: extractedData,
        displayName: displayName
      };

      // Create simple token (will upgrade to real JWT in Phase 2)
      const token = createSimpleToken(verificationResult);

      // Store proof in JSONBin
      const proofData = {
        ...verificationResult,
        token: token
      };

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

      res.status(200).json({ 
        success: true,
        proofId: verificationResult.proofId,
        token: token,
        results: verificationResult
      });
    } catch (error) {
      console.error('Error generating proof:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to generate proof' 
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Comparison utilities
function compareValues(extracted, claimed, isSelected) {
  if (!claimed) return null; // Field not requested
  if (!isSelected) return null; // User chose not to provide this field
  if (!extracted) return false; // Field requested and selected but not provided
  
  // Normalize and compare
  const normalizeValue = (val) => val?.toString().toLowerCase().trim();
  return normalizeValue(extracted) === normalizeValue(claimed);
}

function compareName(displayName, claimedName) {
  // Name is always required - never returns null, only true/false
  if (!displayName || !claimedName) return false;
  
  // Case-insensitive exact match
  return displayName.toLowerCase().trim() === claimedName.toLowerCase().trim();
}

function createSimpleToken(data) {
  // Simple base64 encoding for development
  // Will replace with real JWT + Play Integrity in Phase 2
  const payload = {
    ...data,
    signature: 'dev_mode_' + Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Utility function to generate unique IDs
function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
