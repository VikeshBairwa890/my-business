import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Use /tmp/uploads on serverless (Vercel / AWS Lambda) or local ./uploads
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isServerless
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve(process.cwd(), 'uploads');

function ensureUploadsDir() {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create uploads directory:', err.message);
  }
}

export class DocumentService {
  static saveDocument(orgId, { id: docId, name, mimeType, dataUrl }) {
    if (!docId || !dataUrl) throw new Error('Missing document id or dataUrl');

    ensureUploadsDir();

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const base64Content = match ? match[2] : dataUrl;
    const detectedMime = match ? match[1] : (mimeType || 'application/pdf');
    const buffer = Buffer.from(base64Content, 'base64');
    const filePath = path.join(uploadsDir, `${docId}.bin`);
    const metaPath = path.join(uploadsDir, `${docId}.json`);

    fs.writeFileSync(filePath, buffer);
    fs.writeFileSync(metaPath, JSON.stringify({
      id: docId,
      orgId,
      name: name || 'document.pdf',
      mimeType: detectedMime,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    }));

    return { id: docId };
  }

  static getDocument(rawId) {
    ensureUploadsDir();

    const decodedId = decodeURIComponent(rawId);
    let filePath = path.join(uploadsDir, `${rawId}.bin`);
    let metaPath = path.join(uploadsDir, `${rawId}.json`);

    if (!fs.existsSync(filePath)) {
      const testPath = path.join(uploadsDir, `${decodedId}.bin`);
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        metaPath = path.join(uploadsDir, `${decodedId}.json`);
      }
    }

    if (!fs.existsSync(filePath)) {
      const err = new Error('Document not found');
      err.status = 404;
      throw err;
    }

    let meta = { name: decodedId || 'document.pdf', mimeType: 'application/pdf' };
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch { }
    }

    return {
      filePath,
      filename: meta.name || decodedId || 'document.pdf',
      mimeType: meta.mimeType || 'application/pdf',
    };
  }
}

export default DocumentService;
