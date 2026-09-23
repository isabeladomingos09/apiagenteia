// teste.js
// Script para testar cadastro, login e a rota de documento (RAG) via código.
// Rode com: node teste.js

const fs = require('fs');

const BASE_URL = "http://localhost:3000";

// ⚠️ Troque pelo caminho de um PDF real no seu computador
const CAMINHO_PDF = "./meu-documento.pdf";

const usuarioTeste = {
    nome: "Isabela",
    email: "isabela@teste.com",
    senha: "123456"
};

async function main() {
    console.log("=== 1. Tentando cadastrar usuário ===");
    try {
        const resCadastro = await fetch(`${BASE_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(usuarioTeste)
        });
        const dataCadastro = await resCadastro.json();
        console.log("Status:", resCadastro.status, "| Resposta:", dataCadastro);
    } catch (err) {
        console.log("Erro no cadastro (pode ser que já exista, seguindo para login):", err.message);
    }

    console.log("\n=== 2. Fazendo login ===");
    const resLogin = await fetch(`${BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: usuarioTeste.email,
            senha: usuarioTeste.senha
        })
    });
    const dataLogin = await resLogin.json();
    console.log("Status:", resLogin.status, "| Resposta:", dataLogin);

    if (!dataLogin.token) {
        console.log("\n❌ Não recebi um token. Parando aqui — confira o cadastro/login.");
        return;
    }

    const token = dataLogin.token;
    console.log("\n✅ Token recebido:", token.substring(0, 30) + "...");

    console.log("\n=== 3. Testando rota SEM token (deve dar 401) ===");
    const formDataSemToken = new FormData();
    formDataSemToken.append("pergunta", "Teste sem token");

    if (fs.existsSync(CAMINHO_PDF)) {
        const bufferPDF = fs.readFileSync(CAMINHO_PDF);
        const blobPDF = new Blob([bufferPDF], { type: "application/pdf" });
        formDataSemToken.append("documento", blobPDF, "documento.pdf");

        const resSemToken = await fetch(`${BASE_URL}/api/chat/documento`, {
            method: "POST",
            body: formDataSemToken
        });
        console.log("Status (esperado 401):", resSemToken.status);
        console.log("Resposta:", await resSemToken.json());
    } else {
        console.log(`⚠️ Arquivo PDF não encontrado em "${CAMINHO_PDF}". Pulando este teste.`);
        console.log("   Coloque um PDF na pasta do projeto e ajuste CAMINHO_PDF no topo do script.");
        return;
    }

    console.log("\n=== 4. Testando rota COM token (deve funcionar) ===");
    const bufferPDF = fs.readFileSync(CAMINHO_PDF);
    const blobPDF = new Blob([bufferPDF], { type: "application/pdf" });

    const formDataComToken = new FormData();
    formDataComToken.append("pergunta", "Do que se trata esse documento? Resuma em 2 frases.");
    formDataComToken.append("documento", blobPDF, "documento.pdf");

    const resComToken = await fetch(`${BASE_URL}/api/chat/documento`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formDataComToken
    });

    const dataComToken = await resComToken.json();
    console.log("Status (esperado 200):", resComToken.status);
    console.log("Resposta da IA:", dataComToken);

    console.log("\n=== 5. Teste Anti-Alucinação (pergunta fora do documento) ===");
    const formDataAlucinacao = new FormData();
    formDataAlucinacao.append("pergunta", "Qual é a capital da França?");
    const blobPDF2 = new Blob([fs.readFileSync(CAMINHO_PDF)], { type: "application/pdf" });
    formDataAlucinacao.append("documento", blobPDF2, "documento.pdf");

    const resAlucinacao = await fetch(`${BASE_URL}/api/chat/documento`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formDataAlucinacao
    });

    const dataAlucinacao = await resAlucinacao.json();
    console.log("Status:", resAlucinacao.status);
    console.log("Resposta (deve dizer que não encontrou no documento):", dataAlucinacao);
}

main().catch(err => console.error("Erro geral no teste:", err));