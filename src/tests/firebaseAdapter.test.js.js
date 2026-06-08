import { base44 } from "@/api/base44Client";

/**
 * SISPROD FIREBASE ADAPTER TEST SUITE
 * Executa validação completa do backend migrado
 */

const log = (label, data) => {
  console.log(`\n🧪 ${label}`);
  console.log("--------------------------------");
  console.log(data);
};

const error = (label, err) => {
  console.error(`\n❌ ${label}`);
  console.error(err);
};

async function testProduction() {
  try {
    const data = await base44.entities.Production.list("-created_date", 5);
    log("Production.list", data);
    return true;
  } catch (err) {
    error("Production.list FAILED", err);
    return false;
  }
}

async function testAppUser() {
  try {
    const data = await base44.entities.AppUser.list("-created_date", 5);
    log("AppUser.list", data);
    return true;
  } catch (err) {
    error("AppUser.list FAILED", err);
    return false;
  }
}

async function testEditRequest() {
  try {
    const data = await base44.entities.EditRequest.list("-created_date", 5);
    log("EditRequest.list", data);
    return true;
  } catch (err) {
    error("EditRequest.list FAILED", err);
    return false;
  }
}

async function testFilterSort() {
  try {
    const data = await base44.entities.Production.filter(
      { status: "ativo" },
      "-created_date",
      10
    );

    log("Production.filter + sort + limit", data);
    return true;
  } catch (err) {
    error("filter/sort FAILED", err);
    return false;
  }
}

async function testCreateUpdateDelete() {
  try {
    // CREATE
    const created = await base44.entities.Production.create({
      test: true,
      indicator_name: "TESTE AUTOMÁTICO",
      categoria: "Teste",
      quantidade: 1,
      pontuacao: 1,
      data: new Date().toISOString().slice(0, 10),
    });

    log("CREATE", created);

    // UPDATE
    const updated = await base44.entities.Production.update(created.id, {
      quantidade: 2,
      pontuacao: 2,
    });

    log("UPDATE", updated);

    // DELETE
    await base44.entities.Production.delete(created.id);

    log("DELETE", "OK");

    return true;
  } catch (err) {
    error("CRUD FAILED", err);
    return false;
  }
}

async function testSubscribe() {
  return new Promise((resolve) => {
    try {
      let received = false;

      const unsub = base44.entities.Production.subscribe((event) => {
        received = true;
        log("SUBSCRIBE EVENT", event);
        unsub();
        resolve(true);
      });

      // timeout safety
      setTimeout(() => {
        if (!received) {
          error("SUBSCRIBE FAILED", "No events received (timeout 5s)");
          resolve(false);
        }
      }, 5000);
    } catch (err) {
      error("SUBSCRIBE ERROR", err);
      resolve(false);
    }
  });
}

async function runAllTests() {
  console.log("\n🚀 SISPROD FIREBASE ADAPTER TEST START\n");

  const results = {
    production: await testProduction(),
    appUser: await testAppUser(),
    editRequest: await testEditRequest(),
    filter: await testFilterSort(),
    crud: await testCreateUpdateDelete(),
    subscribe: await testSubscribe(),
  };

  console.log("\n📊 TEST SUMMARY");
  console.log("--------------------------------");
  console.table(results);

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.values(results).length;

  console.log(`\n✅ RESULTADO FINAL: ${passed}/${total} testes passaram`);

  if (passed === total) {
    console.log("\n🎉 MIGRAÇÃO 100% OK — PRONTO PARA VERCEL");
  } else {
    console.log("\n⚠️ MIGRAÇÃO INCOMPLETA — NÃO PUBLICAR AINDA");
  }
}

// EXECUTA AUTOMATICAMENTE
runAllTests();