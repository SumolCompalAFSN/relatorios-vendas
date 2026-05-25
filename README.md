# 📊 RVV — Relatórios Valores Vendas

Aplicação web para análise e gestão de atrasos e diferenças de depósitos de vendedores, com geração de relatórios e envio de e-mails.

---

## 🎯 Objetivo

Automatizar e simplificar o processo de:

- Identificação de **atrasos nos depósitos**
- Deteção de **diferenças financeiras**
- Envio de comunicações por e-mail
- Criação de relatórios (PDF / EML / ZIP)
- Monitorização de atividade através de ranking

---

## ⚙️ Funcionalidades Principais

### 📂 Carregamento de Dados
- Importação de ficheiro único `export.xlsx`
- Processamento automático para:
  - **Atrasos (ZD)**
  - **Diferenças (SA)**
- Carregamento único que alimenta ambos os separadores

---

### 📊 Análise de Dados

#### 🔵 Atrasos
- Filtragem automática por dias úteis
- Exclusão de casos irrelevantes (ex: “Em análise”)
- Ordenação por **maior atraso**
- Identificação do vendedor mais crítico

#### 🟠 Diferenças
- Agrupamento por referência
- Cálculo automático de totais
- Visualização consolidada por vendedor

---

### 📧 Gestão de Emails
- Importação de base de emails (`Template_Emails.xlsx`)
- Associação automática por código de vendedor (Ref3)
- Suporte a:
  - Email principal
  - Email do Gestor de Território (GT)

---

### ✉️ Envio de Comunicações
- Geração automática de emails (.eml)
- Conteúdo HTML formatado
- Envio individual por vendedor
- Exportação em lote (ZIP)

---

### 📄 Relatórios
- Exportação de:
  - PDF por vendedor
  - Emails (.eml)
  - ZIP completo (emails + relatórios)

---

### 🏆 Ranking de Atividade
- Contabiliza envios de emails (apenas Atrasos)
- Persistência local (localStorage)
- Exportação e importação de ranking
- Acumulação de dados entre utilizadores

---

## 🧠 UX Inteligente

A aplicação guia automaticamente o utilizador:

1. 🟡 **Sem emails carregados**
   → destaque em **Carregar Emails***

2. 🟠 **Emails carregados mas sem dados**
   → destaque em **Carregar Dados**

3. 🟢 **Sistema pronto**
   → separadores (Atrasos / Diferenças) destacados

---

## 🔄 Fluxo de Utilização

1. Carregar base de e-mails  
2. Carregar ficheiro `export.xlsx`  
3. Consultar dados em:
   - Atrasos
   - Diferenças  
4. Enviar emails (individual ou em lote)  
5. Exportar ranking (quando necessário)

---

## 🗂️ Estrutura dos Dados

### Ficheiro SAP (`export.xlsx`)
Contém:
- Tipo de documento (ZD / SA)
- Referência
- Data de lançamento
- Valor

---

### Base de Emails (`Template_Emails.xlsx`)
Requer colunas:

- `Codigo_3_digitos`
- `Email`
- `Email GT`
- `Nome Vendedor`

---

## 🧩 Arquitetura (Resumo)

- **React + TypeScript**
- Estado separado entre:
  - Dados brutos (`rawData`)
  - Dados processados (`resultsAtraso`, `resultsDiferenca`)
- Processamento independente do modo (ATRASO / DIFERENÇA)
- UI baseada em estado (UX reativa)

---

## ✅ Boas Práticas Implementadas

- ✅ Separação entre dados e apresentação  
- ✅ Evitar mutação de dados (clonagem segura)  
- ✅ Processamento único para múltiplas views  
- ✅ Proteção contra duplicação no ranking  
- ✅ UX guiada por estado  

---

## ⚠️ Notas Importantes

- O ranking é local ao browser
- Deve ser exportado regularmente para partilha
- Importações de ranking são acumulativas (não substituem)

---

## 🚀 Próximos Passos (Evolução)

- Dashboard gráfico de ranking
- Histórico por períodos
- Integração com Outlook / envio direto
- Exportação automática
- Indicadores de risco (alertas)

---

## 👤 Autor

Pedro Gameiro  
Administrativo Financeiro  

---

## 🏁 Estado do Projeto

✅ Estável  
✅ Pronto para uso interno  
🔧 Em evolução contínua
