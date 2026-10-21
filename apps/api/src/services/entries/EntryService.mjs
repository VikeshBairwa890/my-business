import prisma from '../../prisma.mjs';

export class EntryService {
  static async listBySite(orgId, siteId) {
    return await prisma.entry.findMany({
      where: { orgId, siteId },
      include: { worker: true, supplier: true },
      orderBy: { date: 'desc' },
    });
  }

  static async create(orgId, data, id = undefined) {
    const siteId = data.siteId || data.site_id;
    const workerId = data.workerId || data.worker_id || null;
    const supplierId = data.supplierId || data.supplier_id || null;
    const linkedEntryId = data.linkedEntryId || data.linked_entry_id || null;
    const amount = Number(data.amount);
    const date = new Date(data.date);
    const dueDate = data.dueDate || data.due_date ? new Date(data.dueDate || data.due_date) : null;
    const quantity = data.quantity !== undefined && data.quantity !== null ? Number(data.quantity) : null;

    // Verify site
    const site = await prisma.site.findFirst({ where: { orgId, id: siteId } });
    if (!site) throw new Error('Site not found');

    // Rule: worker only for wage payments
    if (data.kind === 'WAGE_PAYMENT' && !workerId) {
      throw new Error('Select a worker for labour payments');
    }
    if (workerId) {
      const worker = await prisma.worker.findFirst({ where: { orgId, id: workerId } });
      if (!worker) throw new Error('Worker not found');
    }

    // Rule: supplier payment must link to cost bill
    if (data.kind === 'SUPPLIER_PAYMENT') {
      if (!linkedEntryId) throw new Error('Supplier payment must reference a cost bill');
      const bill = await prisma.entry.findFirst({ where: { orgId, id: linkedEntryId } });
      if (!bill || bill.voidedAt || !['MATERIAL', 'EXPENSE'].includes(bill.kind)) {
        throw new Error('Choose a valid cost bill from this site');
      }
      const paidAggregate = await prisma.entry.aggregate({
        where: { orgId, linkedEntryId, voidedAt: null },
        _sum: { amount: true },
      });
      const alreadyPaid = Number(paidAggregate._sum.amount || 0);
      if (alreadyPaid + amount > Number(bill.amount)) {
        throw new Error('Payment exceeds bill balance');
      }
    }

    return await prisma.entry.create({
      data: {
        ...(id ? { id } : {}),
        orgId,
        siteId,
        workerId,
        supplierId,
        kind: data.kind,
        date,
        amount,
        description: data.description.trim(),
        party: data.party || '',
        mode: data.mode || 'CASH',
        reference: data.reference || '',
        dueDate,
        linkedEntryId,
        quantity,
        unit: data.unit || '',
      },
    });
  }

  static async void(orgId, id, reason) {
    const entry = await prisma.entry.findFirst({ where: { orgId, id } });
    if (!entry) throw new Error('Entry not found');
    if (entry.voidedAt) throw new Error('Entry is already voided');

    const linkedPayment = await prisma.entry.findFirst({
      where: { orgId, linkedEntryId: id, voidedAt: null },
    });
    if (linkedPayment) {
      throw new Error('Void linked supplier payments before voiding this bill');
    }

    return await prisma.entry.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidReason: reason || 'Voided by user',
      },
    });
  }
}

export default EntryService;
