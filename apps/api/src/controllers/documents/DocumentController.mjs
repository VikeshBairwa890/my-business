import fs from 'node:fs';
import { DocumentService } from '../../services/documents/DocumentService.mjs';

export class DocumentController {
  static async upload(req, res) {
    try {
      const result = DocumentService.saveDocument(req.user.orgId, req.body || {});
      return res.json({ ok: true, id: result.id });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  static async download(req, res) {
    try {
      const doc = DocumentService.getDocument(req.params.id);
      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`);
      const fileStream = fs.createReadStream(doc.filePath);
      fileStream.pipe(res);
    } catch (err) {
      return res.status(err.status || 404).json({ error: err.message });
    }
  }
}

export default DocumentController;
