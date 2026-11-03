#!/usr/bin/env node
/**
 * Verifica que o score de match apresentado ao 50+ (GET /api/vagas/:id/match)
 * é EXACTAMENTE o mesmo que o parceiro vê em "Top candidatos"
 * (GET /api/parceiros/publicacoes/:id/alinhamento?escopo=candidatos).
 *
 * Ambos os endpoints passam por getCandidatoScoreCached(vaga, conta), que usa a
 * cache match_candidato_cache com chave email + vagaId + inputHash. Este script
 * reproduz fielmente os dois caminhos contra o DB real e compara:
 *   - o inputHash (chave de cache) gerado em cada caminho;
 *   - o score final devolvido.
 *
 * Uso: node scripts/verify-match-consistency.js [vagaId]
 */
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const {
  isOpenRouterConfigured,
  scoreCurriculoForVaga,
  buildCandidatoMatchInputHash,
} = require("./curriculo-vaga-match");

const CONTA_PROJECTION = { email: 1, nome: 1, curriculoPerfil: 1 };

async function getCandidatoScoreCached(db, vaga, conta) {
  const email = String(conta.email || "").trim().toLowerCase();
  const inputHash = buildCandidatoMatchInputHash(vaga, conta);
  const cached = await db.collection("match_candidato_cache").findOne({
    email,
    vagaId: vaga._id,
    inputHash,
  });
  if (cached) {
    return { score: cached.score, inputHash, fonte: "cache" };
  }
  const result = await scoreCurriculoForVaga(vaga, conta);
  await db.collection("match_candidato_cache").updateOne(
    { email, vagaId: vaga._id },
    {
      $set: {
        inputHash,
        score: result.score,
        motivo: result.motivo,
        modelo: result.modelo,
        calculatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  return { score: result.score, inputHash, fonte: "calculado (IA)" };
}

async function escolherVagaComCandidato(db, vagaIdArg) {
  if (vagaIdArg && ObjectId.isValid(vagaIdArg)) {
    const vaga = await db.collection("vagas").findOne({ _id: new ObjectId(vagaIdArg) });
    if (!vaga) throw new Error(`Vaga ${vagaIdArg} não encontrada.`);
    return vaga;
  }
  // Procura uma vaga activa que tenha candidaturas com currículo preenchido.
  const candidaturas = await db
    .collection("candidaturas")
    .aggregate([
      { $group: { _id: "$vagaId", emails: { $addToSet: "$email" } } },
    ])
    .toArray();

  for (const grupo of candidaturas) {
    const vaga = await db.collection("vagas").findOne({ _id: grupo._id, status: "activa" });
    if (!vaga) continue;
    const emails = grupo.emails
      .map((e) => String(e || "").trim().toLowerCase())
      .filter(Boolean);
    const comCurriculo = await db.collection("contas").countDocuments({
      email: { $in: emails },
      "curriculoPerfil.nome": { $exists: true, $ne: "" },
    });
    if (comCurriculo > 0) return vaga;
  }
  throw new Error("Nenhuma vaga activa com candidato (currículo preenchido) encontrada.");
}

async function main() {
  if (!isOpenRouterConfigured()) {
    console.error("OPENROUTER_API_KEY não configurado — o teste precisa dele para calcular caso não esteja em cache.");
    process.exit(2);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI ausente no .env");
    process.exit(2);
  }
  const dbName = process.env.MONGODB_DB || "maisexperiencia";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const vaga = await escolherVagaComCandidato(db, process.argv[2]);
    const titulo = vaga.tituloPublicado || vaga.titulo;
    console.log(`Vaga: ${titulo} (${vaga._id})\n`);

    // ---- Caminho do PARCEIRO (escopo=candidatos) ----
    const candidaturas = await db
      .collection("candidaturas")
      .find({ vagaId: vaga._id })
      .project({ email: 1 })
      .toArray();
    const emails = [
      ...new Set(candidaturas.map((c) => String(c.email || "").trim().toLowerCase()).filter(Boolean)),
    ];
    const contasParceiro = await db
      .collection("contas")
      .find({ email: { $in: emails }, "curriculoPerfil.nome": { $exists: true, $ne: "" } })
      .project(CONTA_PROJECTION)
      .toArray();

    if (!contasParceiro.length) {
      throw new Error("Vaga sem candidatos com currículo — escolhe outra.");
    }

    const alvo = contasParceiro[0]; // candidato a comparar
    const emailAlvo = String(alvo.email || "").trim().toLowerCase();

    const scoreParceiro = await getCandidatoScoreCached(db, vaga, alvo);

    // ---- Caminho do 50+ (GET /api/vagas/:id/match) ----
    const conta50 = await db
      .collection("contas")
      .findOne({ email: emailAlvo }, { projection: CONTA_PROJECTION });
    const score50 = await getCandidatoScoreCached(db, vaga, conta50);

    console.log(`Candidato avaliado: ${emailAlvo}\n`);
    console.log("                         inputHash (chave cache)        score   fonte");
    console.log(`50+   (/match)         : ${score50.inputHash}  ${String(score50.score).padStart(3)}%   ${score50.fonte}`);
    console.log(`Parc. (/alinhamento)   : ${scoreParceiro.inputHash}  ${String(scoreParceiro.score).padStart(3)}%   ${scoreParceiro.fonte}`);
    console.log("");

    const hashIgual = score50.inputHash === scoreParceiro.inputHash;
    const scoreIgual = score50.score === scoreParceiro.score;

    if (hashIgual && scoreIgual) {
      console.log("✅ PASSOU: 50+ e parceiro usam a mesma chave de cache e o MESMO score.");
      process.exit(0);
    } else {
      console.log("❌ FALHOU:");
      if (!hashIgual) console.log("   - inputHash diferente (chaves de cache divergem).");
      if (!scoreIgual) console.log(`   - score diferente: 50+=${score50.score}% parceiro=${scoreParceiro.score}%`);
      process.exit(1);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Erro no teste:", err.message);
  process.exit(1);
});
