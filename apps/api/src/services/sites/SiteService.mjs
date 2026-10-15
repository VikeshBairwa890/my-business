import prisma from '../../prisma.mjs';

export class SiteService {
  static async list(orgId) {
    return await prisma.site.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getById(orgId, id) {
    const site = await prisma.site.findFirst({
      where: { orgId, id },
    });
    if (!site) {
      const err = new Error('Site not found');
      err.status = 404;
      throw err;
    }
    return site;
  }

  static async create(orgId, data, id = undefined) {
    const ownerName = data.ownerName || data.owner_name || '';
    const workType = data.workType || data.work_type || 'LABOUR';
    const pricing = data.pricing || 'FIXED';
    let contractAmount = Number(data.contractAmount ?? data.contract_amount ?? 0);
    const quantity = Number(data.quantity || 1);
    const unitRate = Number(data.unitRate ?? data.unit_rate ?? 0);

    if (pricing !== 'FIXED') {
      contractAmount = Math.round(quantity * unitRate);
    }

    const startDate = data.startDate || data.start_date || new Date().toISOString().slice(0, 10);
    const endDate = data.endDate || data.end_date || null;

    return await prisma.site.create({
      data: {
        ...(id ? { id } : {}),
        orgId,
        name: data.name.trim(),
        ownerName: ownerName.trim(),
        phone: data.phone || '',
        address: data.address || '',
        workType,
        pricing,
        contractAmount,
        quantity,
        unit: data.unit || 'job',
        unitRate,
        remainingEstimate: data.status === 'COMPLETED' ? 0 : Number(data.remainingEstimate ?? data.remaining_estimate ?? contractAmount),
        status: data.status || 'ONGOING',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        notes: data.notes || '',
      },
    });
  }

  static async update(orgId, id, data) {
    await this.getById(orgId, id);

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.ownerName !== undefined || data.owner_name !== undefined) updateData.ownerName = (data.ownerName || data.owner_name).trim();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.workType !== undefined || data.work_type !== undefined) updateData.workType = data.workType || data.work_type;
    if (data.pricing !== undefined) updateData.pricing = data.pricing;
    if (data.quantity !== undefined) updateData.quantity = Number(data.quantity);
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.unitRate !== undefined || data.unit_rate !== undefined) updateData.unitRate = Number(data.unitRate ?? data.unit_rate);

    let contractAmount = data.contractAmount ?? data.contract_amount;
    if (updateData.pricing && updateData.pricing !== 'FIXED') {
      const q = updateData.quantity ?? Number(data.quantity || 1);
      const r = updateData.unitRate ?? Number(data.unit_rate || 0);
      contractAmount = Math.round(q * r);
    }
    if (contractAmount !== undefined) updateData.contractAmount = Number(contractAmount);

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'COMPLETED') updateData.remainingEstimate = 0;
    }
    if (data.remainingEstimate !== undefined || data.remaining_estimate !== undefined) {
      if (updateData.status !== 'COMPLETED') {
        updateData.remainingEstimate = Number(data.remainingEstimate ?? data.remaining_estimate);
      }
    }
    if (data.startDate || data.start_date) updateData.startDate = new Date(data.startDate || data.start_date);
    if (data.endDate !== undefined || data.end_date !== undefined) {
      const ed = data.endDate || data.end_date;
      updateData.endDate = ed ? new Date(ed) : null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    return await prisma.site.update({
      where: { id },
      data: updateData,
    });
  }
}

export default SiteService;
