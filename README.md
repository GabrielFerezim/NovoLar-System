# 🏢 Novo Lar - Sistema de Gestão Comercial e Frente de Caixa (PDV)

Sistema integrado completo para lojas de materiais de construção, comércio varejista e atacado. Desenvolvido com arquitetura **Offline-First**, sincronização em nuvem via **PostgreSQL (NeonDB)** e distribuição híbrida (**Web + Desktop Windows com Electron**).

---

## 🚀 Principais Módulos do Sistema

### 🛒 1. Frente de Caixa / PDV Ágil
- **Leitor de Código de Barras**: Integração com leitores físicos USB/Bluetooth e busca rápida por nome/código.
- **Estoque Multi-Loja Estrito**: A busca e a venda filtram e validam exclusivamente o estoque da loja logada (**Loja 1 - Matriz** ou **Loja 2 - Filial**).
- **Múltiplas Formas de Pagamento**:
  - Dinheiro com cálculo automático de troco em tempo real.
  - PIX com chave instantânea.
  - Cartão de Débito e Crédito parcelado em até 12x.
  - Venda a Prazo (**Fiado / Conta Marcada**).
- **Logística Integrada**: Opção de marcar pedido para entrega com agendamento, endereço e recebedor.
- **Impressão de Comprovante**: Emissão de cupom não-fiscal formatado.

### 📄 2. Orçamentos & Cotações Comerciais
- Montagem de propostas comerciais sem baixar o estoque da loja.
- Inclusão de produtos do estoque e itens manuais avulsos (mão de obra, serviços, frete).
- **Lançamento Direto no PDV**: Conversão de orçamento em venda no caixa com **1 clique**.
- **Compartilhamento no WhatsApp**: Envio de mensagem formatada diretamente para o cliente.
- **Impressão Oficial**: Emissão de proposta comercial em folha A4 com a logomarca da empresa.

### 📖 3. Gestão de Contas a Prazo (Fiado)
- Controle de clientes de confiança com saldo devedor individual e limite.
- Histórico completo de compras e amortizações/abatimentos parciais.
- **Cobrança Automática via WhatsApp**: Envio de extrato limpo com detalhamento das compras e chave PIX CNPJ da loja para pagamento.

### 💰 4. Fechamento de Caixa Diário & Cofre Seguro
- Apuração rápida de caixa com contagem direta de gaveta.
- Identificação instantânea de **Caixa Exato**, **Quebra (Falta)** ou **Sobra**.
- **Sangria de Fechamento**: Transferência direta do excedente em dinheiro para o cofre seguro.
- **Comprovante de Fechamento**: Extrato impresso com logomarca e campos de assinatura para operador e gerente.

### 📅 5. Relatórios por Calendário & DRE Financeiro
- Seleção por data individual ou por período customizado.
- Demonstração do Resultado (Faturamento Bruto, Custos de Mercadorias, Lucro Líquido e Despesas Operacionais).
- Extrato de conferência com a logomarca oficial para download e impressão.

### 📦 6. Controle de Estoque, Transferências e Devoluções
- Cadastro completo de produtos com preço de custo, preço de venda e estoque mínimo por loja.
- **Transferência Multi-Loja**: Movimentação rápida de mercadorias entre Matriz e Filial.
- **Módulo de Devolução / Troca**: Retorno automático de itens ao estoque da loja com opção de estorno financeiro no caixa.

### 🔒 7. Controle do Cofre (Vault)
- Rastreamento de entradas por sangria e saídas para pagamento de despesas de grande porte com saldos individuais por loja.

### 📑 8. Controle de Boletos & Despesas Fixas
- Acompanhamento de contas a pagar com filtro por status (*Pendente* / *Pago*).
- Notificação automática no sino do sistema sobre boletos próximos do vencimento.

### 🚚 9. Controle de Entregas & Expedição
- Painel logístico com status de expedição (*Pendente* ➔ *Saiu para Entrega* ➔ *Entregue*).
- Impressão de DANFE e comprovante de entrega com canhoto de assinatura.

### 🤖 10. Insights Comerciais com Inteligência Artificial
- Diagnóstico automatizado de produtos de maior margem de lucro, itens de baixo giro e recomendações de compras.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18, JavaScript (ESNext), Lucide React Icons
- **Build Tool**: Vite
- **Estilização**: CSS Design System modular nativo (Dark Glassmorphism, responsivo)
- **Desktop Runtime**: Electron 22 (Empacotamento Windows x64)
- **Banco de Dados**: PostgreSQL em Nuvem (**NeonDB**) + Cache Local (*Offline-First*)

---

## ⚙️ Instalação e Execução

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior.

### 1. Clonar o Repositório
```bash
git clone https://github.com/GabrielFerezim/NovoLar-System.git
cd NovoLar-System
```

### 2. Instalar as Dependências
```bash
npm install
```

### 3. Executar em Modo de Desenvolvimento (Web)
```bash
npm run dev
```
O sistema estará acessível em: `http://localhost:5199` (ou na porta configurada pelo Vite).

### 4. Executar em Modo Desktop (Electron)
```bash
npm start
```

### 5. Gerar Build Web de Produção
```bash
npm run build
```

### 6. Gerar o Aplicativo Desktop (.EXE) para Windows
```bash
npm run dist
```
O executável portátil será gerado na pasta:
📂 `dist-electron/ConstruControl-win32-x64/ConstruControl.exe`

---

## 💾 Arquitetura do Banco de Dados & Sincronização

O sistema opera no modelo **Offline-First com Nuvem Híbrida**:
1. **Operação Normal**: As transações são salvas instantaneamente no banco PostgreSQL NeonDB e refletidas em tempo real entre Matriz e Filial.
2. **Queda de Conexão**: Se a internet da loja oscilar, o sistema continua funcionando normalmente gravando localmente no navegador/desktop.
3. **Reconexão Automática**: Assim que o sinal de internet é restabelecido, a fila de sincronização em segundo plano envia todos os dados pendentes para a nuvem sem interrupções.

---

## 📄 Licença e Direitos
Desenvolvido exclusivamente para **Novo Lar - Casa & Construção**. Todos os direitos reservados.
