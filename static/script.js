const variableCountInput = document.querySelector("#variable-count");
const buildModelButton = document.querySelector("#build-model");
const addConstraintButton = document.querySelector("#add-constraint");
const form = document.querySelector("#solver-form");

const variablesContainer = document.querySelector("#variables");
const nonNegativityContainer = document.querySelector("#non-negativity");
const objectiveContainer = document.querySelector("#objective");
const constraintsContainer = document.querySelector("#constraints");
const resultsSection = document.querySelector("#results");
const solutionContainer = document.querySelector("#solution");
const reportContainer = document.querySelector("#report");

buildModelButton.addEventListener("click", buildModelFields);
addConstraintButton.addEventListener("click", () => addConstraintRow());
form.addEventListener("submit", solveModel);
document.addEventListener("click", closeCustomSelects);

buildModelFields();
prepareCustomSelects();

function buildModelFields() {
  // remonta os campos quando a quantidade de variaveis muda
  const variableCount = getVariableCount();

  variablesContainer.innerHTML = "";
  nonNegativityContainer.innerHTML = "";
  objectiveContainer.innerHTML = "";
  constraintsContainer.innerHTML = "";

  for (let index = 0; index < variableCount; index += 1) {
    const variableName = `x${index + 1}`;

    variablesContainer.appendChild(createVariableNameField(index, variableName));
    nonNegativityContainer.appendChild(createNonNegativeOption(index, variableName));
    objectiveContainer.appendChild(createCoefficientField("objective", index, variableName));
  }

  addConstraintRow();
  prepareInputs();
}

function createVariableNameField(index, defaultName) {
  const wrapper = document.createElement("div");
  wrapper.className = "field-item";

  const label = document.createElement("label");
  label.setAttribute("for", `variable-name-${index}`);
  label.textContent = `Nome da variável ${index + 1}`;

  const input = document.createElement("input");
  input.id = `variable-name-${index}`;
  input.className = "variable-name";
  input.value = defaultName;

  wrapper.append(label, input);
  return wrapper;
}

function createNonNegativeOption(index, variableName) {
  const label = document.createElement("label");
  label.className = "check-card";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "non-negative-option";
  input.dataset.index = index;
  input.checked = true;

  const control = document.createElement("span");
  control.className = "check-control";

  const text = document.createElement("span");
  text.className = "check-text";
  text.textContent = `${variableName} >= 0`;

  label.append(input, control, text);
  return label;
}

function createCoefficientField(group, index, variableName) {
  const wrapper = document.createElement("label");
  wrapper.className = "coefficient-field";
  wrapper.textContent = `${variableName}: `;

  const input = document.createElement("input");
  input.type = "number";
  input.step = "any";
  input.placeholder = "0";
  input.className = `${group}-coefficient`;
  input.dataset.index = index;

  wrapper.appendChild(input);
  return wrapper;
}

function addConstraintRow() {
  // cria uma nova linha de restricao
  const variableCount = getVariableCount();
  const row = document.createElement("fieldset");
  row.className = "constraint-row";

  const legend = document.createElement("legend");
  legend.textContent = `Restrição ${constraintsContainer.children.length + 1}`;
  row.appendChild(legend);

  for (let index = 0; index < variableCount; index += 1) {
    const variableName = getVariableNames()[index] || `x${index + 1}`;
    const field = createCoefficientField("constraint", index, variableName);
    row.appendChild(field);
  }

  const operator = createCustomSelect("constraint-operator", [
    { value: "<=", label: "<=" },
    { value: ">=", label: ">=" },
    { value: "=", label: "=" },
  ]);

  const rhs = document.createElement("input");
  rhs.type = "number";
  rhs.step = "any";
  rhs.placeholder = "lado direito";
  rhs.className = "constraint-rhs";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remover";
  removeButton.addEventListener("click", () => row.remove());

  row.append(operator, rhs, removeButton);
  constraintsContainer.appendChild(row);
  prepareInputs();
  prepareCustomSelects();
}

function createCustomSelect(className, options) {
  // cria um dropdown estilizado sem depender do select nativo
  const wrapper = document.createElement("div");
  wrapper.className = `custom-select ${className}`;
  wrapper.dataset.value = options[0].value;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = `<span>${options[0].label}</span>`;

  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");

  options.forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.dataset.value = option.value;
    item.textContent = option.label;
    menu.appendChild(item);
  });

  wrapper.append(trigger, menu);
  return wrapper;
}

async function solveModel(event) {
  // envia o modelo para o flask resolver
  event.preventDefault();
  clearResults();

  const payload = collectModelData();

  try {
    const response = await fetch("/solve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showError(data.error || "Não foi possível resolver o modelo.");
      return;
    }

    showResults(data.solution, data.report);
  } catch (error) {
    showError("Erro ao conectar com o servidor.");
  }
}

function collectModelData() {
  // junta todos os inputs em um objeto para a api
  return {
    optimizationType: document.querySelector("#optimization-type").dataset.value,
    variableCount: getVariableCount(),
    variableNames: getVariableNames(),
    nonNegative: collectNonNegativeOptions(),
    objective: collectValues(".objective-coefficient"),
    constraints: collectConstraints(),
  };
}

function collectNonNegativeOptions() {
  return [...document.querySelectorAll(".non-negative-option")].map((input) => input.checked);
}

function collectConstraints() {
  return [...document.querySelectorAll(".constraint-row")].map((row) => ({
    coefficients: [...row.querySelectorAll(".constraint-coefficient")].map((input) => input.value || "0"),
    operator: row.querySelector(".constraint-operator").dataset.value,
    rhs: row.querySelector(".constraint-rhs").value,
  }));
}

function collectValues(selector) {
  return [...document.querySelectorAll(selector)].map((input) => input.value || "0");
}

function getVariableNames() {
  return [...document.querySelectorAll(".variable-name")].map((input, index) => (
    input.value.trim() || `x${index + 1}`
  ));
}

function getVariableCount() {
  return Math.max(1, Number.parseInt(variableCountInput.value, 10) || 1);
}

function showResults(solution, report) {
  // mostra a solucao numerica e os blocos de resultado
  resultsSection.hidden = false;

  if (solution.optimal_value === null) {
    solutionContainer.innerHTML = `
      <article class="result-hero result-error">
        <span>Status</span>
        <strong>Não resolvido</strong>
        <p>${solution.message}</p>
      </article>
    `;
  } else {
    const variables = solution.variables
      .map((variable) => `
        <article class="metric-card">
          <span>${variable.name}</span>
          <strong>${variable.value}</strong>
        </article>
      `)
      .join("");

    const activeRestrictions = solution.slacks.filter((slack) => slack.active).length;
    const restrictionCards = solution.slacks
      .map((slack) => `
        <article class="restriction-card ${slack.active ? "is-active" : ""}">
          <div>
            <span>Restrição ${slack.constraint}</span>
            <strong>${slack.active ? "Ativa" : "Com folga"}</strong>
          </div>
          <dl>
            <div>
              <dt>Lado esquerdo</dt>
              <dd>${slack.lhs}</dd>
            </div>
            <div>
              <dt>Lado direito</dt>
              <dd>${slack.rhs}</dd>
            </div>
            <div>
              <dt>Folga</dt>
              <dd>${slack.slack}</dd>
            </div>
          </dl>
        </article>
      `)
      .join("");

    solutionContainer.innerHTML = `
      <div class="result-grid">
        <article class="result-hero">
          <span>${solution.message}</span>
          <strong>${solution.optimal_value}</strong>
          <p>Esse é o melhor valor possível para a função objetivo com as restrições informadas.</p>
        </article>

        <article class="result-note">
          <span>Restrições ativas</span>
          <strong>${activeRestrictions}</strong>
          <p>São restrições sem folga, ou seja, limites que a solução ótima está usando por completo.</p>
        </article>
      </div>

      <div class="result-block">
        <h3>Valores das variáveis</h3>
        <div class="metric-grid">${variables}</div>
      </div>

      <div class="result-block">
        <h3>Restrições</h3>
        <div class="restriction-grid">${restrictionCards}</div>
      </div>
    `;
  }

  renderReport(report);
}

function renderReport(report) {
  // resume as informacoes mais importantes do resultado
  const variables = (report.variables || [])
    .map((variable) => `${variable.name} = ${variable.value}`)
    .join(", ");
  const activeRestrictions = (report.restrictions || [])
    .filter((restriction) => restriction.state === "ativa")
      .map((restriction) => restriction.name)
      .join(", ");

  reportContainer.innerHTML = `
    <article class="report-card">
      <h3>Relatório</h3>
      <p>${report.summary || ""} ${report.model || ""}</p>
      <p><strong>Valores ótimos:</strong> ${variables || "Nenhum valor disponível."}</p>
      <p><strong>Não negatividade:</strong> ${report.non_negativity || ""}</p>
      <p><strong>Restrições ativas:</strong> ${activeRestrictions || "nenhuma."}</p>
    </article>
  `;
}

function showError(message) {
  resultsSection.hidden = false;
  solutionContainer.innerHTML = `
    <article class="result-hero result-error">
      <span>Status</span>
      <strong>Erro</strong>
      <p>${message}</p>
    </article>
  `;
  reportContainer.innerHTML = "";
}

function clearResults() {
  resultsSection.hidden = true;
  solutionContainer.innerHTML = "";
  reportContainer.innerHTML = "";
}

function prepareInputs() {
  document.querySelectorAll("input").forEach((input) => {
    if (input.type === "checkbox") {
      return;
    }

    if (input.dataset.readyToSelect === "true") {
      return;
    }

    input.addEventListener("focus", () => input.select());
    input.addEventListener("click", () => input.select());
    input.dataset.readyToSelect = "true";
  });
}

function prepareCustomSelects() {
  // ativa abertura, escolha e fechamento dos dropdowns customizados
  document.querySelectorAll(".custom-select").forEach((select) => {
    if (select.dataset.ready === "true") {
      return;
    }

    const trigger = select.querySelector(".custom-select-trigger");
    const label = trigger.querySelector("span");
    const options = select.querySelectorAll(".custom-select-menu button");

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = select.classList.contains("is-open");
      closeCustomSelects();
      select.classList.toggle("is-open", !isOpen);
      trigger.setAttribute("aria-expanded", String(!isOpen));
    });

    options.forEach((option) => {
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        select.dataset.value = option.dataset.value;
        label.textContent = option.textContent;
        closeCustomSelects();
      });
    });

    select.dataset.ready = "true";
  });
}

function closeCustomSelects() {
  document.querySelectorAll(".custom-select.is-open").forEach((select) => {
    select.classList.remove("is-open");
    select.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
  });
}
