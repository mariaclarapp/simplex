from scipy.optimize import linprog


class ErroProgramaLinear(ValueError):
    pass


def resolver_programa_linear(dados):
    # monta o problema e chama o solver
    problema = montar_problema(dados)

    objetivo = problema["objetivo"][:]
    if problema["tipo"] == "maximizar":
        objetivo = [-valor for valor in objetivo]

    resultado = linprog(
        c=objetivo,
        A_ub=problema["a_ub"] or None,
        b_ub=problema["b_ub"] or None,
        A_eq=problema["a_eq"] or None,
        b_eq=problema["b_eq"] or None,
        bounds=[(0, None) if regra else (None, None) for regra in problema["nao_negativas"]],
        method="highs",
    )

    if not resultado.success:
        return {
            "mensagem": traduzir_mensagem(resultado.message),
            "valor_otimo": None,
            "variaveis": [],
            "nao_negatividade": [],
            "folgas": [],
        }

    valor_otimo = float(resultado.fun)
    if problema["tipo"] == "maximizar":
        valor_otimo *= -1

    variaveis = []
    for nome, valor in zip(problema["nomes"], resultado.x):
        variaveis.append({"nome": nome, "valor": arredondar(valor)})

    nao_negatividade = []
    for nome, regra in zip(problema["nomes"], problema["nao_negativas"]):
        nao_negatividade.append({"nome": nome, "aplicada": regra})

    return {
        "mensagem": "Solução ótima encontrada.",
        "valor_otimo": arredondar(valor_otimo),
        "variaveis": variaveis,
        "nao_negatividade": nao_negatividade,
        "folgas": calcular_folgas(problema["restricoes_originais"], resultado.x),
    }


def montar_problema(dados):
    # transforma os dados da tela em listas para o scipy
    tipo = dados.get("tipo")
    if tipo not in {"maximizar", "minimizar"}:
        raise ErroProgramaLinear("Escolha se deseja maximizar ou minimizar.")

    quantidade = int(dados.get("quantidade", 0))
    if quantidade <= 0:
        raise ErroProgramaLinear("Informe pelo menos uma variável.")

    nomes = dados.get("nomes", [])
    if len(nomes) != quantidade:
        nomes = [f"x{indice + 1}" for indice in range(quantidade)]

    nomes = [limpar_nome(nome, indice) for indice, nome in enumerate(nomes)]
    objetivo = ler_coeficientes(dados.get("objetivo", []), quantidade, "função objetivo")
    nao_negativas = dados.get("nao_negativas", [True for _ in range(quantidade)])

    a_ub = []
    b_ub = []
    a_eq = []
    b_eq = []
    restricoes_originais = []

    for indice, restricao in enumerate(dados.get("restricoes", []), start=1):
        coeficientes = ler_coeficientes(restricao.get("coeficientes", []), quantidade, f"restrição {indice}")
        operador = restricao.get("operador")
        lado_direito = ler_numero(restricao.get("lado_direito"), f"lado direito da restrição {indice}")

        restricoes_originais.append({
            "coeficientes": coeficientes,
            "operador": operador,
            "lado_direito": lado_direito,
        })

        if operador == "<=":
            a_ub.append(coeficientes)
            b_ub.append(lado_direito)
        elif operador == ">=":
            a_ub.append([-valor for valor in coeficientes])
            b_ub.append(-lado_direito)
        elif operador == "=":
            a_eq.append(coeficientes)
            b_eq.append(lado_direito)
        else:
            raise ErroProgramaLinear(f"Operador inválido na restrição {indice}.")

    return {
        "tipo": tipo,
        "objetivo": objetivo,
        "nomes": nomes,
        "nao_negativas": [bool(valor) for valor in nao_negativas],
        "a_ub": a_ub,
        "b_ub": b_ub,
        "a_eq": a_eq,
        "b_eq": b_eq,
        "restricoes_originais": restricoes_originais,
    }


def ler_coeficientes(valores, quantidade, campo):
    if len(valores) != quantidade:
        raise ErroProgramaLinear(f"A {campo} deve ter {quantidade} coeficientes.")
    return [ler_numero(valor, campo) for valor in valores]


def ler_numero(valor, campo):
    try:
        return float(valor)
    except (TypeError, ValueError):
        raise ErroProgramaLinear(f"Valor inválido em {campo}.")


def limpar_nome(nome, indice):
    nome = str(nome or "").strip()
    return nome if nome else f"x{indice + 1}"


def calcular_folgas(restricoes, valores_variaveis):
    # calcula a folga de cada restricao
    folgas = []

    for indice, restricao in enumerate(restricoes, start=1):
        lado_esquerdo = 0
        for coeficiente, valor in zip(restricao["coeficientes"], valores_variaveis):
            lado_esquerdo += coeficiente * valor

        lado_direito = restricao["lado_direito"]
        operador = restricao["operador"]

        if operador == "<=":
            folga = lado_direito - lado_esquerdo
        elif operador == ">=":
            folga = lado_esquerdo - lado_direito
        else:
            folga = abs(lado_esquerdo - lado_direito)

        folgas.append({
            "numero": indice,
            "folga": arredondar(folga),
            "ativa": bool(abs(float(folga)) <= 1e-7),
        })

    return folgas


def traduzir_mensagem(mensagem):
    if "infeasible" in mensagem.lower():
        return "O problema não possui solução viável com as restrições informadas."
    if "unbounded" in mensagem.lower():
        return "O problema é ilimitado. A função objetivo pode crescer ou diminuir sem limite."
    return mensagem


def arredondar(valor):
    valor = round(float(valor), 6)
    return 0.0 if abs(valor) < 1e-9 else valor
