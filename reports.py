def montar_relatorio(dados, solucao):
    # monta apenas as informacoes importantes
    if solucao["valor_otimo"] is None:
        return {
            "resumo": "Não foi possível encontrar uma solução ótima.",
            "nao_negatividade": texto_nao_negatividade(dados),
            "variaveis": [],
            "restricoes": [],
        }


    return {
        "nao_negatividade": texto_nao_negatividade(dados),
        "variaveis": solucao["variaveis"],
        "restricoes": [
            {
                "nome": f"Restrição {folga['numero']}",
                "ativa": folga["ativa"],
            }
            for folga in solucao["folgas"]
        ],
    }


def texto_nao_negatividade(dados):
    # explica quais variaveis nao podem ser negativas
    nomes = dados.get("nomes", [])
    regras = dados.get("nao_negativas", [])

    if not nomes or len(nomes) != len(regras):
        return "Todas as variáveis foram consideradas não negativas."

    nao_negativas = [nome for nome, regra in zip(nomes, regras) if regra]
    livres = [nome for nome, regra in zip(nomes, regras) if not regra]

    if nao_negativas and livres:
        return f"Não negativas: {', '.join(nao_negativas)}. Livres: {', '.join(livres)}."

    if nao_negativas:
        return f"Todas as variáveis são não negativas: {', '.join(nao_negativas)}."

    return "Nenhuma variável foi limitada pela regra de não negatividade."





