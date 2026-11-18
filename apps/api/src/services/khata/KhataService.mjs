import prisma from '../../prisma.mjs';

const VALID_CATEGORIES = new Set(['FRIEND', 'LABOUR', 'SUPPLIER', 'CLIENT', 'OTHER']);
const VALID_MODES = new Set(['CASH', 'UPI', 'BANK_TRANSFER']);

function parseOptionalDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIsDebit(data, required = true) {
  if (typeof data.isDebit === 'boolean') return data.isDebit;
  if (typeof data.is_debit === 'boolean') return data.is_debit;
  if (data.type !== undefined) {
    const t = String(data.type).toUpperCase();
    if (t === 'GAVE') return true;
    if (t === 'GOT') return false;
  }
  if (required) {
    const err = new Error('Entry isDebit must be a boolean (true for GAVE, false for GOT)');
    err.status = 400;
    throw err;
  }
  return undefined;
}

export class KhataService {
  static async getPartyById(orgId, partyId) {
    return await prisma.khataParty.findFirst({
      where: { orgId, id: partyId },
    });
  }

  static async createParty(orgId, data, id = undefined) {
    const name = String(data.name || '').trim();
    if (!name) {
      const err = new Error('Person name is required');
      err.status = 400;
      throw err;
    }

    const rawCat = String(data.category || 'FRIEND').toUpperCase();
    const category = VALID_CATEGORIES.has(rawCat) ? rawCat : 'FRIEND';
    const phone = String(data.phone || '').trim();
    const notes = String(data.notes || '').trim();
    const workerId = data.workerId || data.worker_id || null;
    const reminderDate = parseOptionalDate(data.reminderDate || data.reminder_date);

    return await prisma.khataParty.create({
      data: {
        ...(id ? { id } : {}),
        orgId,
        name,
        phone,
        category,
        workerId,
        notes,
        reminderDate,
        active: data.active !== undefined ? Boolean(data.active) : true,
      },
    });
  }

  static async updateParty(orgId, partyId, data, existing = null) {
    const party = existing || (await KhataService.getPartyById(orgId, partyId));
    if (!party) {
      const err = new Error('Khata person not found');
      err.status = 404;
      throw err;
    }

    const updateData = {};
    if (data.name !== undefined) {
      const name = String(data.name || '').trim();
      if (!name) {
        const err = new Error('Person name is required');
        err.status = 400;
        throw err;
      }
      updateData.name = name;
    }
    if (data.phone !== undefined) updateData.phone = String(data.phone || '').trim();
    if (data.category !== undefined) {
      const rawCat = String(data.category || 'FRIEND').toUpperCase();
      updateData.category = VALID_CATEGORIES.has(rawCat) ? rawCat : 'FRIEND';
    }
    if (data.workerId !== undefined || data.worker_id !== undefined) {
      updateData.workerId = data.workerId || data.worker_id || null;
    }
    if (data.notes !== undefined) updateData.notes = String(data.notes || '').trim();
    if (data.reminderDate !== undefined || data.reminder_date !== undefined) {
      const rawRem = data.reminderDate !== undefined ? data.reminderDate : data.reminder_date;
      updateData.reminderDate = rawRem ? parseOptionalDate(rawRem) : null;
    }
    if (data.active !== undefined) updateData.active = Boolean(data.active);

    return await prisma.khataParty.update({
      where: { id: party.id },
      data: updateData,
    });
  }

  static async deleteParty(orgId, partyId) {
    const [party, entryCount] = await Promise.all([
      KhataService.getPartyById(orgId, partyId),
      prisma.khataEntry.count({ where: { orgId, partyId } }),
    ]);
    if (!party) {
      const err = new Error('Khata person not found');
      err.status = 404;
      throw err;
    }
    if (entryCount > 0) {
      const err = new Error('Cannot delete person because ledger has existing entries');
      err.status = 400;
      throw err;
    }
    await prisma.khataParty.delete({
      where: { id: party.id },
    });
    return { id: party.id, deleted: true };
  }

  static async createEntry(orgId, data, id = undefined) {
    const partyId = data.partyId || data.party_id;
    if (!partyId) {
      const err = new Error('Select a person for this entry');
      err.status = 400;
      throw err;
    }

    const isDebit = parseIsDebit(data, true);

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      const err = new Error('Enter a valid amount greater than 0');
      err.status = 400;
      throw err;
    }

    const date = parseOptionalDate(data.date) || new Date();
    const rawMode = String(data.mode || 'CASH').toUpperCase();
    const mode = VALID_MODES.has(rawMode) ? rawMode : 'CASH';
    const note = String(data.note || '').trim();
    const proofUrl = String(data.proofUrl ?? data.proof_url ?? '').trim();
    const proofName = String(data.proofName ?? data.proof_name ?? '').trim();
    const proofMime = String(data.proofMime ?? data.proof_mime ?? '').trim();

    const party = await prisma.khataParty.findFirst({ where: { orgId, id: partyId } });
    if (!party) {
      const err = new Error('Khata person not found');
      err.status = 404;
      throw err;
    }

    return await prisma.khataEntry.create({
      data: {
        ...(id ? { id } : {}),
        orgId,
        partyId,
        isDebit,
        amount,
        date,
        note,
        mode,
        proofUrl,
        proofName,
        proofMime,
      },
    });
  }

  static async updateEntry(orgId, entryId, data) {
    const existing = await prisma.khataEntry.findFirst({ where: { orgId, id: entryId } });
    if (!existing) {
      const err = new Error('Khata entry not found');
      err.status = 404;
      throw err;
    }

    const updateData = {};
    const parsedIsDebit = parseIsDebit(data, false);
    if (parsedIsDebit !== undefined) {
      updateData.isDebit = parsedIsDebit;
    }
    if (data.amount !== undefined) {
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        const err = new Error('Enter a valid amount greater than 0');
        err.status = 400;
        throw err;
      }
      updateData.amount = amount;
    }
    if (data.date !== undefined) {
      const d = parseOptionalDate(data.date);
      if (d) updateData.date = d;
    }
    if (data.note !== undefined) updateData.note = String(data.note || '').trim();
    if (data.mode !== undefined) {
      const rawMode = String(data.mode || 'CASH').toUpperCase();
      updateData.mode = VALID_MODES.has(rawMode) ? rawMode : 'CASH';
    }
    if (data.proofUrl !== undefined || data.proof_url !== undefined) {
      updateData.proofUrl = String(data.proofUrl ?? data.proof_url ?? '').trim();
    }
    if (data.proofName !== undefined || data.proof_name !== undefined) {
      updateData.proofName = String(data.proofName ?? data.proof_name ?? '').trim();
    }
    if (data.proofMime !== undefined || data.proof_mime !== undefined) {
      updateData.proofMime = String(data.proofMime ?? data.proof_mime ?? '').trim();
    }

    return await prisma.khataEntry.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  static async deleteEntry(orgId, entryId) {
    const existing = await prisma.khataEntry.findFirst({ where: { orgId, id: entryId } });
    if (!existing) {
      const err = new Error('Khata entry not found');
      err.status = 404;
      throw err;
    }
    await prisma.khataEntry.delete({
      where: { id: existing.id },
    });
    return { id: existing.id, party_id: existing.partyId, deleted: true };
  }
}

export default KhataService;
