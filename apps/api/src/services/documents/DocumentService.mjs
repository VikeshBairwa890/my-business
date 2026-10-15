import fs from 'node:fs';
import path from 'node:path';

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export class DocumentService {
  static saveDocument(orgId, { id: docId, name, mimeType, dataUrl }) {
    if (!docId || !dataUrl) throw new Error('Missing document id or dataUrl');

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
