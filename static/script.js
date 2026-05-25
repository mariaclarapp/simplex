const quantidadeVariaveis = document.querySelector("#quantidade-variaveis");
const botaoMontar = document.querySelector("#montar-modelo");
const botaoAdicionar = document.querySelector("#adicionar-restricao");
const formulario = document.querySelector("#formulario");

const areaVariaveis = document.querySelector("#variaveis");
const areaNaoNegatividade = document.querySelector("#nao-negatividade");
const areaObjetivo = document.querySelector("#objetivo");
const areaRestricoes = document.querySelector("#restricoes");
const areaResultado = document.querySelector("#resultado");
const areaRelatorio = document.querySelector("#relatorio");

botaoMontar.addEventListener("click", montarCampos);
botaoAdicionar.addEventListener("click", adicionarRestricao);
formulario.addEventListener("submit", resolverModelo);

montarCampos();

function montarCampos() {
  // cria os campos principais
  const quantidade = pegarQuantidade();

  areaVariaveis.innerHTML = "";
  areaNaoNegatividade.innerHTML = "";
  areaObjetivo.innerHTML = "";
  areaRestricoes.innerHTML = "";

  for (let indice = 0; indice < quantidade; indice++) {
    const nome = `x${indice + 1}`;
    areaVariaveis.appendChild(criarCampoNome(indice, nome));
    areaNaoNegatividade.appendChild(criarCampoNaoNegatividade(nome));
    areaObjetivo.appendChild(criarCampoNumero("objetivo", nome));
  }

  adicionarRestricao();
  prepararInputs();
}

function criarCampoNome(indice, nome) {
  const rotulo = document.createElement("label");
  rotulo.textContent = `Nome da variável ${indice + 1}`;

  const campo = document.createElement("input");
  campo.className = "nome-variavel";
  campo.value = nome;

  rotulo.appendChild(campo);
  return rotulo;
}

function criarCampoNaoNegatividade(nome) {
  const rotulo = document.createElement("label");
  rotulo.className = "check";

  const campo = document.createElement("input");
  campo.type = "checkbox";
  campo.className = "nao-negativa";
  campo.checked = true;

  const texto = document.createElement("span");
  texto.textContent = `${nome} >= 0`;

  rotulo.append(campo, texto);
  return rotulo;
}

function criarCampoNumero(classe, nome) {
  const rotulo = document.createElement("label");
  rotulo.textContent = nome;

  const campo = document.createElement("input");
  campo.type = "number";
  campo.step = "any";
  campo.placeholder = "0";
  campo.className = `${classe}-coeficiente`;

  rotulo.appendChild(campo);
  return rotulo;
}

function adicionarRestricao() {
  // cria uma nova restricao
  const bloco = document.createElement("fieldset");
  bloco.className = "restricao";

  const legenda = document.createElement("legend");
  legenda.textContent = `Restrição ${areaRestricoes.children.length + 1}`;
  bloco.appendChild(legenda);

  pegarNomes().forEach((nome) => {
    bloco.appendChild(criarCampoNumero("restricao", nome));
  });

  const operador = document.createElement("select");
  operador.className = "operador";

  ["<=", ">=", "="].forEach((sinal) => {
    const opcao = document.createElement("option");
    opcao.value = sinal;
    opcao.textContent = sinal;
    operador.appendChild(opcao);
  });

  const ladoDireito = document.createElement("input");
  ladoDireito.type = "number";
  ladoDireito.step = "any";
  ladoDireito.placeholder = "lado direito";
  ladoDireito.className = "lado-direito";

  const remover = document.createElement("button");
  remover.type = "button";
  remover.textContent = "Remover";
  remover.addEventListener("click", () => bloco.remove());

  bloco.append(operador, ladoDireito, remover);
  areaRestricoes.appendChild(bloco);
  prepararInputs();
}

async function resolverModelo(evento) {
  // envia os dados para o python
  evento.preventDefault();
  areaResultado.hidden = true;

  const resposta = await fetch("/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(montarDados()),
  });

  const dados = await resposta.json();

  if (!resposta.ok || !dados.sucesso) {
    mostrarErro(dados.erro || "Não foi possível resolver o modelo.");
    return;
  }

  mostrarResultado(dados.solucao, dados.relatorio);
}

function montarDados() {
  // junta os dados em portugues para enviar ao servidor
  return {
    tipo: document.querySelector("#tipo-otimizacao").value,
    quantidade: pegarQuantidade(),
    nomes: pegarNomes(),
    nao_negativas: pegarNaoNegatividade(),
    objetivo: pegarValores(".objetivo-coeficiente"),
    restricoes: pegarRestricoes(),
  };
}

function pegarRestricoes() {
  const restricoes = [];

  document.querySelectorAll(".restricao").forEach((bloco) => {
    restricoes.push({
      coeficientes: pegarValoresDentro(bloco, ".restricao-coeficiente"),
      operador: bloco.querySelector(".operador").value,
      lado_direito: bloco.querySelector(".lado-direito").value,
    });
  });

  return restricoes;
}

function pegarValores(seletor) {
  return [...document.querySelectorAll(seletor)].map((campo) => campo.value || "0");
}

function pegarValoresDentro(bloco, seletor) {
  return [...bloco.querySelectorAll(seletor)].map((campo) => campo.value || "0");
}

function pegarNomes() {
  return [...document.querySelectorAll(".nome-variavel")].map((campo, indice) => {
    return campo.value.trim() || `x${indice + 1}`;
  });
}

function pegarNaoNegatividade() {
  return [...document.querySelectorAll(".nao-negativa")].map((campo) => campo.checked);
}

function pegarQuantidade() {
  return Math.max(1, parseInt(quantidadeVariaveis.value) || 1);
}

function mostrarResultado(solucao, relatorio) {
  // mostra apenas o relatorio final
  areaResultado.hidden = false;

  if (solucao.valor_otimo === null) {
    mostrarErro(solucao.mensagem);
    return;
  }

  const objetivo = document.querySelector("#tipo-otimizacao").value === "maximizar" ? "Maximizar" : "Minimizar";
  const variaveis = relatorio.variaveis.map((item) => `${item.nome} = ${item.valor}`).join(", ") + ".";
  const ativas = (relatorio.restricoes
    .filter((item) => item.ativa)
    .map((item) => item.nome)
    .join(", ") || "nenhuma") + ".";

  areaRelatorio.innerHTML = `
    <p><strong>Valor ótimo:</strong> ${solucao.valor_otimo}.</p>
    <p><strong>Objetivo:</strong> ${objetivo}.</p>
    <p><strong>Valores ótimos:</strong> ${variaveis}</p>
    <p><strong>Não negatividade:</strong> ${relatorio.nao_negatividade}</p>
    <p><strong>Restrições ativas:</strong> ${ativas}</p>
  `;
}

function mostrarErro(mensagem) {
  areaResultado.hidden = false;
  areaRelatorio.innerHTML = `<p class="erro">${mensagem}</p>`;
}

function prepararInputs() {
  document.querySelectorAll("input[type='number']").forEach((campo) => {
    campo.addEventListener("focus", () => campo.select());
  });
}




