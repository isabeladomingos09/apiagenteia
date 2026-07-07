// --- FASE 2: A CLASSE SEGURA ---
class VooSeguro {
    // Atributos privados (HASHTAG neles!)
    #codigo;
    #combustivel;

    constructor(codigoPassado) {
        this.#codigo = codigoPassado;
        this.#combustivel = 100; // Começa com 100%
    }

    // GETTER: A janelinha de vidro para ler a informação
    get lerCombustivel() {
        return `O tanque do voo ${this.#codigo} está em ${this.#combustivel}%`;
    }

    // SETTER: A porta segura para alterar a informação
    set abastecer(quantidade) {
        if (quantidade <= 0) {
            console.error("❌ Erro: Quantidade de abastecimento inválida.");
        } else if (this.#combustivel + quantidade > 100) {
            console.warn("⚠️ Cuidado: O tanque não pode passar de 100%.");
            this.#combustivel = 100;
        } else {
            this.#combustivel += quantidade;
            console.log(`✅ Abastecido! Novo nível: ${this.#combustivel}%`);
        }
    }

    // MÉTODO PARA GASTAR: Lógica do desafio da Fase 3
    gastar(quantidade) {
        if (this.#combustivel - quantidade < 0) {
            this.#combustivel = 0;
            console.warn("🚨 ALERTA: Combustível esgotado!");
        } else {
            this.#combustivel -= quantidade;
            console.log(`✈️ Voando... Combustível atual: ${this.#combustivel}%`);
        }
    }
}

// --- FASE 3: CONEXÃO COM A TELA (DOM) ---

// 1. Criamos o objeto do voo
const meuVoo = new VooSeguro("VIP-001");

// 2. Capturamos os elementos do HTML
const display = document.getElementById("painelCombustivel");
const btnGastar = document.getElementById("btnGastar");
const btnAbastecer = document.getElementById("btnAbastecerSeguro");

// 3. Função para atualizar o texto na tela
function atualizarPainel() {
    display.innerText = meuVoo.lerCombustivel; // Usa o GETTER
}

// Inicializa a tela
atualizarPainel();

// 4. Evento do botão GASTAR
btnGastar.addEventListener("click", () => {
    meuVoo.gastar(10); // Gastando 10% por clique
    atualizarPainel();
});

// 5. Evento do botão ABASTECER
btnAbastecer.addEventListener("click", () => {
    meuVoo.abastecer = 10; // Usa o SETTER
    atualizarPainel();
});

/* DICA DE OURO:
   Se você tentar escrever: console.log(meuVoo.#combustivel); 
   O VS Code vai marcar um erro vermelho e o navegador vai parar tudo.
   A "Caixa-Preta" realmente protege o dado!
*/