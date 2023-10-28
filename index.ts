

const dataFile = Bun.file("data.json");
const data = JSON.parse(await dataFile.text());

const data3minFile = Bun.file("data3min.json");
const data3min = JSON.parse(await dataFile.text());


/**
 * Returns a hash code from a string
 * @param  {String} str The string to hash.
 * @return {Number}    A 32bit integer
 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 */
function hashCode(str:string) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

/**
 * checks for the hash of an item in a json array
 * @param  {Array} list The json to check for the item in.
 * @param  {any} item The item to check for.
 * @return {boolean}
 */
function checkForItem(list:Array<Number>, item:any){
    const hash = hashCode(item.dateAdded.value + item.title)

    for (let index = 0; index < list.length; index++) {
        if (list[index] == hash){
            return true;
        }
        
    }
    return false;
}

/**
 * Adds a query to the items.json file
 * @param  {string} query The query to add the the items.json file.
 * @return {boolean}
 */
async function addQuery(query:string){
    const itemsFile = Bun.file("items.json");
    const items = JSON.parse( await itemsFile.text());

    items.push(query);
    Bun.write(itemsFile, JSON.stringify(items));
}

/**
 * Removes a query to the items.json file
 * @param  {string} query The query to add the the items.json file.
 * @return {boolean}
 */
async function removeQuery(query:string){
    const itemsFile = Bun.file("items.json");
    const items = JSON.parse( await itemsFile.text());

    const index = items.indexOf(query);
    if (index > -1) { // only splice array when item is found
        items.splice(index, 1); // 2nd parameter means remove one item only
    }
    Bun.write(itemsFile, JSON.stringify(items));
}

Bun.serve({
    fetch(req, server) {
        // upgrade the request to a WebSocket
        if (server.upgrade(req)) {
          return; // do not return a Response
        }
        return new Response(Bun.file("./index.html"));
      }, // upgrade logic
    websocket: {
        // code 500 is invalid json
        // code 404 is type not found
      async message(ws, message) {
        try {
            const msgJson = JSON.parse(message.toString())
            switch (msgJson.type) {
                case "add":
                    addQuery(msgJson.query);
                break;
                    
                case "remove":
                    removeQuery(msgJson.query);
                break;

                case "get":
                    const items = await Bun.file("items.json").text();
                    ws.send(items);
                break;
    
                default:
                    ws.send("404")
                    break;
            }
        } catch (error) {
         ws.send("500")   
        }
      }, // a message is received
      open(ws) {}, // a socket is opened
      close(ws, code, message) {}, // a socket is closed
      drain(ws) {}, // the socket is ready to receive more data
    },
  });

async function main() {
    const itemsText = await Bun.file("items.json").text();
    const items = JSON.parse(itemsText);
    for (let index = 0; index < items.length; index++) {
        const query = items[index];
        console.log("Checked " + query)
        const response = await fetch("https://www.nellisauction.com/search?query=" + query + "&_data=routes%2Fsearch", {
            headers: {
                Cookie: '__shopping-location=eyJzaG9wcGluZ0xvY2F0aW9uIjp7ImlkIjoyLCJuYW1lIjoiUGhvZW5peCwgQVoifX0=.ViHixf0+jtriCgQyfRH5wAeOxRuXUjpFvWd8be/YlN4; Expires=Tue, 19 Jan 2038 03:14:07 GMT; Domain=www.nellisauction.com; Path=/search	'
            }
        });

        const body = await response.json();
        for (let index = 0; index < body.products.length; index++) {
            const product = body.products[index];
                var diff = Date.parse(product.dateClosed.value) - Date.now();

                if (diff > 0 && diff <= 1800000 && product.sold == 0 && !checkForItem(data,product) && product.title.toLowerCase().includes(query.toLowerCase())) {
                    product.item.query = query;
                    data.push(hashCode(product.dateAdded.value + product.title));
                    Bun.write(dataFile, JSON.stringify(data))
                    console.log(product);
                    fetch('https://ntfy.sh', {
                        method: 'POST',
                        body: JSON.stringify({
                            "topic": "nellis",
                            "message": "Current price: " + product.wprice + ", Retail price: " + product.item.retailPrice + ", Query: " + query,
                            "title": product.title,
                            "attach": product.item.photos[0].url,
                            "click": encodeURI("https://www.nellisauction.com/p/" + product.title.replace(/\s/g, "-").replace(/\//g, "-") + "/" + product.bidState.projectId)
                        })
                    })

                }else if (diff > 0 && diff <= 180000 && product.sold == 0 && !checkForItem(data3min,product) && product.title.toLowerCase().includes(query.toLowerCase())) {
                    product.item.query = query;
                    data3min.push(hashCode(product.dateAdded.value + product.title));
                    Bun.write(data3minFile, JSON.stringify(data3min))
                    console.log(product);
                    fetch('https://ntfy.sh', {
                        method: 'POST',
                        body: JSON.stringify({
                            "topic": "nellis",
                            "message": "Current price: " + product.wprice + ", Retail price: " + product.item.retailPrice + ", Query: " + query,
                            "title": product.title,
                            "priority": 4,
                            "attach": product.item.photos[0].url,
                            "click": encodeURI("https://www.nellisauction.com/p/" + product.title.replace(/\s/g, "-").replace(/\//g, "-") + "/" + product.bidState.projectId)
                        })
                    })

                }
        }
    }
}
main();
setInterval(main, 30000)

