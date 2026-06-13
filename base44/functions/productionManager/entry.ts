import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PERFIS_AMPLOS = ['administrador', 'comandante_crpm', 'p1', 'p2', 'p3', 'p4'];

// Verifica se o appUser pertence à mesma OPM do registro de produção
function userBelongsToOrg(appUser, record) {
  if (!appUser || !record) return false;
  const perfil = appUser.perfil;
  if (PERFIS_AMPLOS.includes(perfil)) return true;

  const rBpm = record.bpm || '';
  const rCia = record.companhia || '';
  const rPel = record.pelotao || '';
  const rGpm = record.gpm || '';
  const uBpm = appUser.bpm || '';
  const uCia = appUser.companhia || '';
  const uPel = appUser.pelotao || '';
  const uGpm = appUser.gpm || '';

  if (perfil === 'comandante_btl') return uBpm === rBpm;
  if (perfil === 'comandante_cia') return uBpm === rBpm && uCia === rCia;
  if (perfil === 'comandante_pel') return uBpm === rBpm && uCia === rCia && uPel === rPel;
  if (perfil === 'comandante_gpm') return uBpm === rBpm && uCia === rCia && uPel === rPel && uGpm === rGpm;

  // operador e demais — mesmo organization_id
  const rOrgId = record.organization_id || [rBpm, rCia, rPel, rGpm].filter(Boolean).join('|');
  const uOrgId = appUser.organization_id || [uBpm, uCia, uPel, uGpm].filter(Boolean).join('|');
  return rOrgId === uOrgId;
}

function canEditFree(record) {
  const ref = record.updated_date || record.created_date;
  if (!ref) return false;
  return new Date(ref) > new Date(Date.now() - 48 * 60 * 60 * 1000);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, recordId, updateData, appUserId } = body;

    if (!action || !recordId) {
      return Response.json({ error: 'action e recordId sao obrigatorios' }, { status: 400 });
    }

    // Busca o registro de produção usando get() (não filter)
    let record = null;
    try {
      record = await base44.asServiceRole.entities.Production.get(recordId);
    } catch {
      return Response.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    // Busca o AppUser para validar pertencimento à OPM
    let appUser = null;
    if (appUserId) {
      try {
        appUser = await base44.asServiceRole.entities.AppUser.get(appUserId);
      } catch {
        appUser = null;
      }
    }

    // Valida pertencimento à OPM
    if (appUser && !userBelongsToOrg(appUser, record)) {
      return Response.json({ error: 'Sem permissão: você não pertence à mesma OPM deste registro' }, { status: 403 });
    }

    // Verifica se está dentro de 48h ou se há liberação administrativa ativa
    const dentro48h = canEditFree(record);

    if (!dentro48h) {
      // Admin tem acesso irrestrito
      const isAdmin = appUser && ['administrador', 'comandante_crpm'].includes(appUser.perfil);
      if (!isAdmin) {
        // Verifica liberação ativa
        const editRequests = await base44.asServiceRole.entities.EditRequest.list('-created_date');
        const now = new Date();
        const liberacaoAtiva = editRequests.find(r =>
          r.production_id === recordId &&
          r.status === 'aprovado' &&
          r.liberado_ate &&
          new Date(r.liberado_ate) > now
        );
        if (!liberacaoAtiva) {
          return Response.json({ error: 'Prazo de 48h expirado e sem autorização administrativa ativa' }, { status: 403 });
        }
      }
    }

    if (action === 'update') {
      if (!updateData) {
        return Response.json({ error: 'updateData e obrigatorio' }, { status: 400 });
      }
      await base44.asServiceRole.entities.Production.update(recordId, updateData);
      return Response.json({ success: true, action: 'updated' });
    }

    if (action === 'delete') {
      await base44.asServiceRole.entities.Production.delete(recordId);
      return Response.json({ success: true, action: 'deleted' });
    }

    return Response.json({ error: 'action invalida. Use: update ou delete' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});