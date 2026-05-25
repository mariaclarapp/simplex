from flask import Flask, jsonify, render_template, request

from reports import montar_relatorio
from solver import ErroProgramaLinear, resolver_programa_linear

app = Flask(__name__)


@app.get("/")
def pagina_inicial():
    # mostra a pagina inicial
    return render_template("index.html")


@app.post("/solve")
def resolver():
    # recebe os dados do formulario
    dados = request.get_json(silent=True)

    if not dados:
        return jsonify({"sucesso": False, "erro": "Nenhum dado foi enviado."}), 400

    try:
        solucao = resolver_programa_linear(dados)
        relatorio = montar_relatorio(dados, solucao)
    except ErroProgramaLinear as erro:
        return jsonify({"sucesso": False, "erro": str(erro)}), 400

    return jsonify({
        "sucesso": True,
        "solucao": solucao,
        "relatorio": relatorio,
    })


if __name__ == "__main__":
    app.run(debug=False)
