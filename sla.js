import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    // Navegar até a página e esperar até que a rede esteja ociosa
    await page.goto('https://www.enjoei.com.br/p/geladeira-bosch-frost-free-117227670?rsid=baf40baf-60a2-4d97-b7f2-501d64d8aa7a-1739831881951&rsp=1&rspix=2&vid=178f0b36-c68b-4574-b401-03024725614b', {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // Aguardar elementos necessários serem carregados
    await page.waitForSelector('p.l-product-details__description-text');

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

    // Extraindo as imagens do produto (pegando até 2 imagens)
    const productImages = await page.evaluate(() => {
      const imageElements = document.querySelectorAll('img.c-photo-gallery__image');
      return Array.from(imageElements).slice(0, 2).map(img => img.getAttribute('src'));
    });

    // Extraindo a descrição do produto
    const productDescription = await page.evaluate(() => {
      const descriptionElement = document.querySelector('p.l-product-details__description-text');
      return descriptionElement ? descriptionElement.innerText.trim() : 'Descrição do produto não encontrada';
    });

    // Extraindo o estado e cidade da venda
    const location = await page.evaluate(() => {
      const locationElement = document.querySelector('span.l-store-info__seller-subtitle');
      return locationElement ? locationElement.innerText.trim() : 'Localização não encontrada';
    });

    // Extraindo o valor do produto
    const productPrice = await page.evaluate(() => {
      const priceElement = document.querySelector('span[data-test="div-preco-produto"]');
      return priceElement ? priceElement.innerText.trim() : 'Preço não encontrado';
    });

    // Exibindo os resultados
    console.log('Nome do Produto:', productName);
    console.log('Nome do Vendedor:', sellerName);
    console.log('Imagens do Produto:', productImages);
    console.log('Descrição:', productDescription);
    console.log('Localização:', location);
    console.log('Preço:', productPrice);

  } catch (error) {
    console.log('Erro ao buscar dados da página:', error);
  } finally {
    await browser.close(); // Garantir que o navegador será fechado
  }
})();
