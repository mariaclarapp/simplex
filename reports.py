def build_report(problem_data: dict, solution: dict) -> dict:
    # monta um resumo simples para aparecer na tela
    if solution["optimal_value"] is None:
        return {
            "summary": "Não foi possível encontrar uma solução ótima.",
            "model": solution["message"],
            "non_negativity": _build_non_negative_summary(problem_data),
            "variables": [],
            "restrictions": [],
            "recommendation": {
                "title": "Revise o modelo",
                "text": "Confira os coeficientes, os sinais das restrições e os valores do lado direito.",
                "principle": "A recomendação considera se o solver encontrou uma solução viável e limitada.",
            },
        }

    optimization_label = (
        "maximização"
        if problem_data.get("optimizationType") == "maximize"
        else "minimização"
    )

    return {
        "summary": f"O modelo foi resolvido como um problema de {optimization_label}.",
        "model": f"O valor ótimo da função objetivo é {solution['optimal_value']}.",
        "non_negativity": _build_non_negative_summary(problem_data),
        "variables": [
            {
                "name": variable["name"],
                "value": variable["value"],
                "text": f"{variable['name']} deve assumir o valor {variable['value']}.",
            }
            for variable in solution["variables"]
        ],
        "restrictions": [
            {
                "name": f"Restrição {slack['constraint']}",
                "state": "ativa" if slack["active"] else "com folga",
                "lhs": slack["lhs"],
                "rhs": slack["rhs"],
                "slack": slack["slack"],
                "text": (
                    f"Lado esquerdo = {slack['lhs']}, lado direito = {slack['rhs']} "
                    f"e folga = {slack['slack']}."
                ),
            }
            for slack in solution["slacks"]
        ],
        "recommendation": _build_recommendation(solution),
    }


def _build_non_negative_summary(problem_data: dict) -> str:
    # descreve quais variaveis ficaram com a regra x maior ou igual a zero
    names = problem_data.get("variableNames", [])
    rules = problem_data.get("nonNegative", [])

    if not names or len(names) != len(rules):
        return "A não negatividade foi aplicada como padrão para todas as variáveis."

    applied = [name for name, active in zip(names, rules) if active]
    free = [name for name, active in zip(names, rules) if not active]

    if applied and free:
        return (
            f"Não negatividade aplicada em: {', '.join(applied)}. "
            f"Variáveis livres: {', '.join(free)}."
        )

    if applied:
        return f"Não negatividade aplicada em todas as variáveis: {', '.join(applied)}."

    return "Nenhuma variável foi limitada pela regra de não negatividade."


def _build_recommendation(solution: dict) -> dict:
    # usa as folgas para identificar o que limita a solucao
    active_count = sum(1 for slack in solution["slacks"] if slack["active"])
    if active_count == 1:
        title = "Atenção à restrição ativa"
        text = (
            "O modelo encontrou 1 restrição ativa. Essa restrição é a que limita "
            "diretamente a melhoria da função objetivo."
        )
    else:
        title = f"Atenção às {active_count} restrições ativas"
        text = (
            f"O modelo encontrou {active_count} restrições ativas. Essas restrições são as que "
            "limitam diretamente a melhoria da função objetivo."
        )

    if active_count == 0:
        return {
            "title": "Há folga nas restrições",
            "text": (
                "A solução respeita todas as restrições com folga. Isso sugere que, dentro dos dados "
                "informados, ainda existe capacidade não utilizada no modelo."
            ),
            "principle": (
                "A recomendação compara o lado esquerdo e o lado direito de cada restrição. "
                "Quando nenhuma restrição está ativa, nenhuma delas está limitando diretamente o ótimo."
            ),
        }

    return {
        "title": title,
        "text": text,
        "principle": (
            "A recomendação é baseada nas folgas: restrições com folga zero são tratadas como ativas "
            "e indicam os recursos, limites ou condições que mais pressionam a solução ótima."
        ),
    }
