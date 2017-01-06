let osmosis  = require('osmosis');
let numbro   = require('numbro');
let bOpen    = require('open');
let jsonfile = require('jsonfile');
let prompt   = require('prompt');
let Promise  = require('bluebird');
let notifier = require('node-notifier');
let cron     = require('node-cron');
let prices   = jsonfile.readFileSync('./prices.json');

prompt.message = 'radar';
let promptGet = Promise.promisify(prompt.get);

numbro.culture('es-AR');
numbro.defaultCurrencyFormat('$0,0[,]');

let CRON_SCHEDULE = '0 12,15,18,22 * * *';

let baseUrl  = 'http://www.solotodo.com';
let diskLink = 'http://www.solotodo.com/external_storage_drives/?min_price=0&max_price=1656990&keywords=&brand=&capacity=388642&color=&connector=388739&technology=&format=&advanced_controls=0&ordering=';

// let PERCENTAGE = 40;
// MAIN
let getParams, cliParam = process.argv[2];
if ( cliParam && prices[cliParam] )
  getParams = Promise.resolve({ name: cliParam, link: prices[cliParam].parentLink, notify: prices[cliParam].notify });
else
  getParams = promptGet(['name', 'link', 'notify']);

getParams.then(({ name, link, notify }) => {
  name = name || 'disco';
  link = link || diskLink;
  notify = parseInt(notify) ? parseInt(notify) : 0;
  if ( cliParam ) {
    console.log('Setting cron...');
    setCron(name, link, notify);
  }
  return [name, getMin(link), notify]
}).spread((name, min, notify) => {
  console.log('Precio mínimo encontrado:', min.price);

  // if ( ! notify ) notify = prices[name] && prices[name].price ? ( prices[name].price * (100-PERCENTAGE)/100 ) : 0;

  // Write to json
  min.notify = notify;
  let prices = jsonfile.readFileSync('./prices.json');
  prices[name] = min;
  jsonfile.writeFileSync('./prices.json', prices);
  popNotification(name, min);

  return;
}).catch((err) => {
  console.log('Shit happened:\n', err);
});


// SCRAPPER
function getMin(url) {
  return new Promise((resolve, reject) => {
    osmosis.get(url)
      .set({
        items: [
          osmosis
            .find('.search_result')
            .set({
              'price': '.search-result-price',
              'link': '.search-result-price@href'
            })
          ]
      })
      .data(({ items }) => {
        let first = items && items.length ? items[0] : -1;
        if ( first === -1 ) return console.log('Nothing found');

        // Numbroing data
        items = items.map((item) => { item.price = numbro(item.price).value(); return item; });

        let min = items.reduce((reduced, curr) => {
          if (reduced.price < curr.price)
            return reduced;
          return curr;
        }, first);

        min.link = baseUrl + min.link;
        min.parentLink = url;
        return resolve(min);
    });
  });
}

function popNotification(name, min) {
  notifier.notify({
    'title': 'Radar found something!',
    'message': `${name} a ${min.price}`,
    'wait': true,
    'link': min.link
  });

  notifier.on('click', function (notifierObject, options) {
    bOpen(options.link);
  });
}

function save(name, min) {
  let prices   = jsonfile.readFileSync('./prices.json');
  prices[name] = min;
  jsonfile.writeFileSync('./prices.json', prices);
};

function setCron(name, link, notify) {
  if ( ! notify ) return;
  cron.schedule(CRON_SCHEDULE, function(){
    getMin(link).then((min) => {
      min.notify = notify;
      let prices = jsonfile.readFileSync('./prices.json');
      prices[name] = min;
      jsonfile.writeFileSync('./prices.json', prices);

      if ( min.price < notify )
        popNotification(name, min);
    });
  });
}
