import { WorkerPdfService } from '../../services/reports/WorkerPdfService.mjs';

export class ReportController {
  static async getWorkerReport(req, res, next) {
    try {
      const pdfBuffer = await WorkerPdfService.generateWorkerReportPdf(req.params.workerId, req.query);
      if (!pdfBuffer) {
        return res.status(404).json({ error: 'Worker report not found' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="worker_slip_${req.params.workerId}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

export default ReportController;
