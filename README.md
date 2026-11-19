# UNIFAP Chamados — protótipo navegável

Interface do sistema de chamados de infraestrutura (telas T01–T14), só com HTML, CSS e JavaScript.
Não há back-end nem banco de dados: os dados são simulados em `js/data.js` e ficam guardados
apenas na aba do navegador (sessionStorage). Fechar a aba ou usar **Restaurar dados de demonstração**
(no menu do usuário) volta ao estado inicial.

## Como abrir
Abra `index.html` no navegador (duplo clique funciona). Precisa de internet para carregar as fontes
Montserrat, Inter e Material Symbols.

## Contas de demonstração (qualquer senha)
| Matrícula/SIAPE | Pessoa | Perfis |
|---|---|---|
| 2021001234 | Rafael Costa | Solicitante |
| 1765432 | Ana Paula Souza | Gestor/triagem + solicitante |
| 1987654 | Joana Ribeiro | Executora (manutenção predial) + solicitante |
| 1654321 | Marcos Almeida | Reitoria + solicitante |
| 1543210 | Lúcia Ferreira | Administradora + solicitante |
| 2019004321 | Carla Menezes | Vínculo inativo (acesso negado) |
| 1876543 | Paulo Nunes | Acesso local desativado (acesso negado) |
| 0000 | — | Simula serviço de autenticação indisponível |

## Rotas
`#/login` T01 · `#/painel` T02 · `#/abrir` T03 · `#/confirmacao/:id` T04 · `#/meus` T05 ·
`#/chamado/:id` T06 · `#/fila` T07 · `#/fila/:id/atribuir` T08 · `#/operacao/:id` T09 ·
`#/relatorios` T10 · `#/demandas` T11 · `#/atendimento/:id` T12 · `#/usuarios` T13 · `#/catalogo` T14

## Arquivos
- `css/styles.css` — tokens de cor e tipo, componentes e responsivo
- `js/data.js` — dados simulados e regras (prioridade, protocolo)
- `js/ui.js` — componentes (status, prioridade, trilha do chamado, diálogos, avisos)
- `js/screens.js`, `js/screens-ops.js`, `js/screens-admin.js` — telas
- `js/app.js` — rotas, cabeçalho e controle de acesso por perfil
