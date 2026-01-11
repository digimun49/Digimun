const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const contentType = event.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'Content-Type must be multipart/form-data' })
      };
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'No boundary found in Content-Type' })
      };
    }

    const body = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64') 
      : Buffer.from(event.body);

    const parts = parseMultipart(body, boundary);
    const filePart = parts.find(p => p.filename);
    const ticketIdPart = parts.find(p => p.name === 'ticketId');

    if (!filePart) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'No file uploaded' })
      };
    }

    const ticketId = ticketIdPart ? ticketIdPart.data.toString() : 'unknown';
    const fileBuffer = filePart.data;
    const fileName = filePart.filename;
    const mimeType = filePart.contentType || 'application/octet-stream';

    const fileSize = fileBuffer.length;
    const maxSize = 5 * 1024 * 1024;
    if (fileSize > maxSize) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'File too large. Max 5MB allowed.' })
      };
    }

    const base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: `digimun-tickets/${ticketId}`,
      resource_type: 'auto',
      public_id: `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        url: result.secure_url,
        name: fileName,
        type: mimeType,
        size: fileSize
      })
    };

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: 'Upload failed: ' + error.message })
    };
  }
};

function parseMultipart(body, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from('--' + boundary);
  const endBoundary = Buffer.from('--' + boundary + '--');
  
  let start = body.indexOf(boundaryBuffer);
  
  while (start !== -1) {
    const nextBoundary = body.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (nextBoundary === -1) break;
    
    const partData = body.slice(start + boundaryBuffer.length, nextBoundary);
    const headerEnd = partData.indexOf(Buffer.from('\r\n\r\n'));
    
    if (headerEnd !== -1) {
      const headerStr = partData.slice(0, headerEnd).toString();
      const dataStart = headerEnd + 4;
      let dataEnd = partData.length;
      
      if (partData[dataEnd - 2] === 13 && partData[dataEnd - 1] === 10) {
        dataEnd -= 2;
      }
      
      const data = partData.slice(dataStart, dataEnd);
      
      const nameMatch = headerStr.match(/name="([^"]+)"/);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);
      const contentTypeMatch = headerStr.match(/Content-Type:\s*(.+)/i);
      
      parts.push({
        name: nameMatch ? nameMatch[1] : null,
        filename: filenameMatch ? filenameMatch[1] : null,
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : null,
        data: data
      });
    }
    
    start = nextBoundary;
  }
  
  return parts;
}
