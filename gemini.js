const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ordem de tentativa: se o primeiro falhar, tenta o próximo
const MODELOS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest"
];

// "conteudo" pode ser um texto ou uma lista [texto, imagem]
async function gerarComRetry(conteudo) {
    let ultimoErro;

    for (const nome of MODELOS) {
        for (let tentativa = 1; tentativa <= 2; tentativa++) {
            try {
                const model = genAI.getGenerativeModel({ model: nome });
                const result = await model.generateContent(conteudo);
                return result.response.text();
            } catch (error) {
                ultimoErro = error;
                const ocupado = error.status === 503 || error.status === 429;
                const naoExiste = error.status === 404;

                if (naoExiste) break;      // modelo indisponível: vai pro próximo
                if (!ocupado) throw error; // outro erro (ex: chave inválida): não adianta insistir

                console.log(`⏳ ${nome} ocupado (tentativa ${tentativa}/2)...`);
                await new Promise(r => setTimeout(r, 1000 * tentativa));
            }
        }
        console.log(`↪️ Trocando de ${nome} para o próximo modelo...`);
    }

    throw ultimoErro;
}

module.exports = { gerarComRetry };