# Software-Cevibraz - Sistema de Orçamento de Quadros

![Captura de Tela do Software](https://github.com/user-attachments/assets/d041adb1-1172-4db1-a416-10c660e356cf) Um sistema de desktop completo construído com Electron e Node.js para gerenciar e criar orçamentos detalhados para a fabricação de quadros feita para a empresa de esquadrias

---

## ✨✨ Funcionalidades

* **Criação de Orçamentos:** Adicione múltiplos quadros a um pedido, especificando medidas, molduras e materiais.
* **Cálculo Automático:** O sistema calcula o preço final com base nos custos de materiais e mão de obra cadastrados.
* **Geração de PDFs:** Crie e salve PDFs profissionais tanto para o orçamento do cliente quanto para a Ordem de Serviço (OS) da oficina.
* **Backlog de Pedidos:** Acompanhe o status de todos os pedidos em um painel kanban simples ("A Fazer", "Já Feito", "Entregue").
* **Gestão de Materiais:** Cadastre e edite molduras e materiais com seus respectivos custos.

---

##  Tecnologias Utilizadas

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Node.js, Express.js
* **Desktop App:** Electron.js
* **Banco de Dados:** MySQL
* **Geração de PDF:** Puppeteer

---

##  Pré-requisitos

Antes de começar, você precisará ter as seguintes ferramentas instaladas em sua máquina:
* [Git](https://git-scm.com)
* [Node.js](https://nodejs.org/en/)
* [XAMPP](https://www.apachefriends.org/index.html) (ou qualquer outro servidor MySQL)

---

##  Instalação e Execução

Siga os passos abaixo para configurar e rodar o projeto em ambiente de desenvolvimento.

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/vitorpdim/Software-Cevibraz.git](https://github.com/vitorpdim/Software-Cevibraz.git)
    cd Software-Cevibraz
    ```

2.  **Instale as dependências (isso também fará o download automático do Chromium usado pelo Puppeteer)::**
    ```bash
    npm install
    ```

3.  **Configure o Banco de Dados:**
    * Inicie o Apache e o MySQL no seu painel de controle XAMPP.
    * Acesse o phpMyAdmin (geralmente em `http://localhost/phpmyadmin`).
    * Crie um novo banco de dados chamado `orcamento_quadros_db`.
    * Selecione o banco de dados recém-criado e vá para a aba "Importar".
    * Importe o arquivo `setup_completo.sql` que está na pasta database deste projeto.

4.  **Inicie a aplicação em modo de desenvolvimento:**
    ```bash
    npm start
    ```

🔎 Observação:
O diretório node_modules e o local-chromium não estão no repositório pois são muito grandes.
Eles são instalados automaticamente pelo comando npm install.

---

##  Compilando para Produção

Para criar o arquivo executável (`.exe`) para distribuição, use o comando:

```bash
npm run build
```
O executável e o instalador serão gerados na pasta `dist/`.

---
